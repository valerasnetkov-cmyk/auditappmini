import { v4 as uuidv4 } from 'uuid'

function getAllowedPhotoTypes(photoRequirements, inspectionType) {
  const requirements = photoRequirements[inspectionType]
  if (!requirements) return new Set()
  return new Set([...(requirements.required || []), ...(requirements.optional || [])])
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
    const inspection = db.prepare('SELECT id, type FROM inspections WHERE id = ? AND company_id = ?').get(inspectionId, companyId)
    if (!inspection) {
      await removeFileIfExists(req.file?.path)
      return sendError(res, 404, API_MESSAGES.inspectionNotFound)
    }

    if (!req.file) {
      return sendError(res, 400, 'Photo is required')
    }

    const photoType = String(req.body.photo_type || req.body.photoType || '').trim()
    if (!getAllowedPhotoTypes(photoRequirements, inspection.type).has(photoType)) {
      await removeFileIfExists(req.file?.path)
      return sendError(res, 400, API_MESSAGES.invalidPhotoType)
    }

    const id = uuidv4()
    const geo = req.body.geo || null
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
          geo, is_required
        )
        VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    const defect = db.prepare('SELECT id, inspection_id FROM defects WHERE id = ? AND company_id = ?').get(req.params.id, companyId)
    if (!defect) {
      await removeFileIfExists(req.file?.path)
      return sendError(res, 404, API_MESSAGES.defectNotFound)
    }
    if (!req.file) return sendError(res, 400, 'Photo is required')

    const id = uuidv4()

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
          geo, is_required
        )
        VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
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
      )
    } catch (err) {
      await removeFileIfExists(req.file?.path)
      console.warn('[uploads] Failed to process defect photo:', err.message)
      return sendError(res, 400, 'Photo could not be processed')
    }

    const photo = db.prepare(`SELECT ${PHOTO_SELECT_COLUMNS} FROM photos WHERE id = ? AND company_id = ?`).get(id, companyId)
    res.status(201).json(photo)
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

    db.prepare('DELETE FROM photos WHERE id = ?').run(id)
    await removePhotoFiles(photo)
    res.status(204).send()
  })
}
