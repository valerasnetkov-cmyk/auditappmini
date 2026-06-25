import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { sendInspectionCompletedError } from '../services/inspectionReadiness.js'
import { generateWatermarkedPhoto, resolveUploadPath } from '../services/photoUpload.js'
import { buildPhotoWatermarkLines } from '../utils/photoWatermark.js'

function getAllowedPhotoTypes(photoRequirements, inspectionType) {
  const requirements = photoRequirements[inspectionType]
  if (!requirements) return new Set()
  return new Set([...(requirements.required || []), ...(requirements.optional || [])])
}

function nullableCoordinate(value) {
  if (value === undefined || value === null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function getExistingClientPhoto(db, companyId, inspectionId, clientPhotoId) {
  if (!clientPhotoId) return null
  return db.prepare(`
    SELECT *
    FROM photos
    WHERE company_id = ? AND inspection_id = ? AND client_photo_id = ?
  `).get(companyId, inspectionId, clientPhotoId)
}

export default function registerPhotoRoutes({
  app,
  db,
  authenticate,
  sendError,
  API_MESSAGES,
  PHOTO_SELECT_COLUMNS,
  photoRequirements,
  uploadPhoto,
  processUploadedPhoto,
  removeFileIfExists,
  removePhotoFiles,
  ensureCompanyOperationalWriteAllowed,
}) {
  app.post('/api/inspections/:id/photos', authenticate, (req, res, next) => {
    if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'create' })) return
    next()
  }, uploadPhoto, async (req, res) => {
    const inspectionId = req.params.id
    const companyId = req.user.company_id || 'default'
    const inspection = db.prepare('SELECT id, type, completed FROM inspections WHERE id = ? AND company_id = ?').get(inspectionId, companyId)
    if (!inspection) {
      await removeFileIfExists(req.file?.path)
      return sendError(res, 404, API_MESSAGES.inspectionNotFound)
    }
    if (inspection.completed) {
      await removeFileIfExists(req.file?.path)
      return sendInspectionCompletedError(res)
    }

    if (!req.file) {
      return sendError(res, 400, 'Photo is required')
    }

    const clientPhotoId = String(req.body.client_photo_id || req.body.clientPhotoId || '').trim() || null
    const existingPhoto = getExistingClientPhoto(db, companyId, inspectionId, clientPhotoId)
    if (existingPhoto) {
      await removeFileIfExists(req.file.path)
      return res.json(existingPhoto)
    }

    const photoType = String(req.body.photo_type || req.body.photoType || '').trim()
    if (!getAllowedPhotoTypes(photoRequirements, inspection.type).has(photoType)) {
      await removeFileIfExists(req.file?.path)
      return sendError(res, 400, API_MESSAGES.invalidPhotoType)
    }

    const id = uuidv4()
    const geo = req.body.geo || null
    const capturedAt = String(req.body.captured_at || req.body.capturedAt || '').trim() || new Date().toISOString()
    const capturedLat = nullableCoordinate(req.body.captured_lat ?? req.body.capturedLat)
    const capturedLng = nullableCoordinate(req.body.captured_lng ?? req.body.capturedLng)
    const isRequired = (photoRequirements[inspection.type]?.required || []).includes(photoType) ? 1 : 0

    try {
      const processed = await processUploadedPhoto({
        tempPath: req.file.path,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        inspectionId,
        photoId: id,
      })

      db.prepare(`
        INSERT INTO photos (
          id, inspection_id, defect_id, company_id, photo_type, url,
          original_url, webp_url, thumb_url, original_mime, original_name,
          width, height, size_original, size_webp, size_thumb, hash,
          geo, is_required, client_photo_id, upload_status, captured_at,
          captured_lat, captured_lng
        )
        VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'uploaded', ?, ?, ?)
      `).run(
        id,
        inspectionId,
        companyId,
        photoType,
        processed.url,
        processed.original_url,
        processed.webp_url,
        processed.thumb_url,
        processed.original_mime,
        processed.original_name,
        processed.width,
        processed.height,
        processed.size_original,
        processed.size_webp,
        processed.size_thumb,
        processed.hash,
        geo,
        isRequired,
        clientPhotoId,
        capturedAt,
        capturedLat,
        capturedLng,
      )
    } catch (err) {
      await removeFileIfExists(req.file?.path)
      console.warn('[uploads] Failed to process inspection photo:', err.message)
      return sendError(res, 400, 'Photo could not be processed')
    }

    const photo = db.prepare(`
      SELECT ${PHOTO_SELECT_COLUMNS}
      FROM photos
      WHERE id = ? AND company_id = ?
    `).get(id, companyId)

    res.status(201).json(photo)
  })

  app.post('/api/defects/:id/photos', authenticate, (req, res, next) => {
    if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'create' })) return
    next()
  }, uploadPhoto, async (req, res) => {
    const { geo } = req.body
    const companyId = req.user.company_id || 'default'
    const defect = db.prepare(`
      SELECT d.id, d.inspection_id, i.completed
      FROM defects d
      JOIN inspections i ON i.id = d.inspection_id
      WHERE d.id = ? AND d.company_id = ?
    `).get(req.params.id, companyId)
    if (!defect) {
      await removeFileIfExists(req.file?.path)
      return sendError(res, 404, API_MESSAGES.defectNotFound)
    }
    if (defect.completed) {
      await removeFileIfExists(req.file?.path)
      return sendInspectionCompletedError(res)
    }
    if (!req.file) return sendError(res, 400, 'Photo is required')

    const clientPhotoId = String(req.body.client_photo_id || req.body.clientPhotoId || '').trim() || null
    const existingPhoto = getExistingClientPhoto(db, companyId, defect.inspection_id, clientPhotoId)
    if (existingPhoto) {
      await removeFileIfExists(req.file.path)
      return res.json(existingPhoto)
    }
    const id = uuidv4()
    const capturedAt = String(req.body.captured_at || req.body.capturedAt || '').trim() || new Date().toISOString()
    const capturedLat = nullableCoordinate(req.body.captured_lat ?? req.body.capturedLat)
    const capturedLng = nullableCoordinate(req.body.captured_lng ?? req.body.capturedLng)

    try {
      const processed = await processUploadedPhoto({
        tempPath: req.file.path,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        inspectionId: defect.inspection_id,
        photoId: id,
      })

      db.prepare(`
        INSERT INTO photos (
          id, inspection_id, defect_id, company_id, photo_type, url,
          original_url, webp_url, thumb_url, original_mime, original_name,
          width, height, size_original, size_webp, size_thumb, hash,
          geo, is_required, client_photo_id, upload_status, captured_at,
          captured_lat, captured_lng
        )
        VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'uploaded', ?, ?, ?)
      `).run(
        id,
        defect.inspection_id,
        req.params.id,
        companyId,
        processed.url,
        processed.original_url,
        processed.webp_url,
        processed.thumb_url,
        processed.original_mime,
        processed.original_name,
        processed.width,
        processed.height,
        processed.size_original,
        processed.size_webp,
        processed.size_thumb,
        processed.hash,
        geo || null,
        clientPhotoId,
        capturedAt,
        capturedLat,
        capturedLng,
      )
    } catch (err) {
      await removeFileIfExists(req.file?.path)
      console.warn('[uploads] Failed to process defect photo:', err.message)
      return sendError(res, 400, 'Photo could not be processed')
    }

    const photo = db.prepare(`SELECT ${PHOTO_SELECT_COLUMNS} FROM photos WHERE id = ? AND company_id = ?`).get(id, companyId)
    res.status(201).json(photo)
  })

  app.post('/api/photos/:id/watermark', authenticate, async (req, res) => {
    const companyId = req.user.company_id || 'default'
    const photo = db.prepare(`
      SELECT p.*, c.name AS company_name, i.type AS inspection_type,
             v.number AS vehicle_number, v.name AS vehicle_name
      FROM photos p
      JOIN companies c ON c.id = p.company_id
      LEFT JOIN inspections i ON i.id = p.inspection_id AND i.company_id = p.company_id
      LEFT JOIN vehicles v ON v.id = i.vehicle_id AND v.company_id = p.company_id
      WHERE p.id = ? AND p.company_id = ?
    `).get(req.params.id, companyId)

    if (!photo) return sendError(res, 404, 'Photo not found')

    if (photo.watermark_url) {
      const resolved = resolveUploadPath(photo.watermark_url.replace(/^\/uploads\//, ''))
      if (resolved && fs.existsSync(resolved.filePath)) {
        return res.json(db.prepare(`SELECT ${PHOTO_SELECT_COLUMNS} FROM photos WHERE id = ? AND company_id = ?`).get(photo.id, companyId))
      }
    }

    try {
      const watermarkUrl = await generateWatermarkedPhoto({
        photo,
        lines: buildPhotoWatermarkLines({
          photo,
          inspection: {
            id: photo.inspection_id,
            type: photo.inspection_type,
            company_name: photo.company_name,
            vehicle_number: photo.vehicle_number,
          },
        }),
      })
      const generatedAt = new Date().toISOString()
      db.prepare(`
        UPDATE photos
        SET watermark_url = ?, watermark_generated_at = ?
        WHERE id = ? AND company_id = ?
      `).run(watermarkUrl, generatedAt, photo.id, companyId)

      return res.json(db.prepare(`SELECT ${PHOTO_SELECT_COLUMNS} FROM photos WHERE id = ? AND company_id = ?`).get(photo.id, companyId))
    } catch (err) {
      console.warn('[uploads] Failed to watermark photo:', err.message)
      return sendError(res, 500, 'Не удалось сформировать фото с водяным знаком')
    }
  })

  app.delete('/api/photos/:id', authenticate, async (req, res) => {
    if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'write' })) return

    const { id } = req.params
    const companyId = req.user.company_id || 'default'
    const photo = db.prepare(`
      SELECT ${PHOTO_SELECT_COLUMNS}
      FROM photos p
      WHERE p.id = ? AND p.company_id = ?
    `).get(id, companyId)

    if (!photo) {
      return sendError(res, 404, 'Photo not found')
    }
    const inspection = db.prepare(`
      SELECT completed
      FROM inspections
      WHERE id = ? AND company_id = ?
    `).get(photo.inspection_id, companyId)
    if (inspection?.completed) return sendInspectionCompletedError(res)

    db.prepare('DELETE FROM photos WHERE id = ?').run(id)
    await removePhotoFiles(photo)
    res.status(204).send()
  })
}
