import { v4 as uuidv4 } from 'uuid'
import {
  normalizeVehicleNumberToCyrillic,
  isValidRussianLicensePlate,
} from '../utils/transliteration.js'
import {
  normalizeRegionName,
  getRegionByName,
  createRegionRecord,
} from '../services/regions.js'

const VEHICLE_STATUSES = new Set(['active', 'repair', 'archived'])
const INSPECTION_SCHEDULE_STATUSES = new Set([
  'inspection_actual',
  'inspection_due_soon',
  'inspection_overdue',
  'never_inspected',
])

function normalizeOptionalInterval(value) {
  if (value === undefined || value === null || value === '') return { value: null }
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 3650) {
    return { error: 'Интервал осмотра должен быть целым числом от 1 до 3650' }
  }
  return { value: parsed }
}

function getVehicleByNumber(db, number, companyId = null) {
  const query = companyId
    ? db.prepare(`
      SELECT id, number, name, status, region, company_id, created_at, last_scheduled_inspection
      FROM vehicles
      WHERE number = ? AND company_id = ?
    `)
    : db.prepare(`
    SELECT id, number, name, status, region, company_id, created_at, last_scheduled_inspection
    FROM vehicles
    WHERE number = ?
  `)

  return companyId ? query.get(number, companyId) : query.get(number)
}

function createVehicleRecord(db, {
  id,
  number,
  name,
  status,
  region,
  companyId = 'default',
  quickInspectionIntervalDays = null,
  plannedInspectionIntervalDays = null,
}) {
  return db.prepare(`
    INSERT INTO vehicles (
      id, number, name, status, region, company_id,
      quick_inspection_interval_days, planned_inspection_interval_days
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    number,
    name,
    status,
    region,
    companyId,
    quickInspectionIntervalDays,
    plannedInspectionIntervalDays,
  )
}

function updateVehicleRecord(db, id, {
  number,
  name,
  status,
  region,
  companyId = null,
  quickInspectionIntervalDays = null,
  plannedInspectionIntervalDays = null,
}) {
  const query = companyId
    ? db.prepare(`
      UPDATE vehicles
      SET number = ?, name = ?, status = ?, region = ?,
          quick_inspection_interval_days = ?, planned_inspection_interval_days = ?
      WHERE id = ? AND company_id = ?
    `)
    : db.prepare(`
    UPDATE vehicles
    SET number = ?, name = ?, status = ?, region = ?,
        quick_inspection_interval_days = ?, planned_inspection_interval_days = ?
    WHERE id = ?
  `)

  return companyId
    ? query.run(
      number.toUpperCase(),
      name,
      status,
      region || null,
      quickInspectionIntervalDays,
      plannedInspectionIntervalDays,
      id,
      companyId,
    )
    : query.run(
      number.toUpperCase(),
      name,
      status,
      region || null,
      quickInspectionIntervalDays,
      plannedInspectionIntervalDays,
      id,
    )
}

function recordVehicleStatusChange(db, { vehicleId, oldStatus, newStatus, reason, changedBy }) {
  return db.prepare(`
    INSERT INTO vehicle_status_history (id, vehicle_id, old_status, new_status, reason, changed_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(uuidv4(), vehicleId, oldStatus, newStatus, reason || null, changedBy)
}

function archiveVehiclesByIds(db, API_MESSAGES, { ids, companyId, changedBy }) {
  const uniqueIds = [...new Set((Array.isArray(ids) ? ids : []).map((id) => String(id || '').trim()).filter(Boolean))]

  if (uniqueIds.length === 0) {
    return { error: 'Не выбрана техника для архивации', status: 400 }
  }

  if (uniqueIds.length > 500) {
    return { error: 'За один раз можно архивировать не более 500 единиц техники', status: 400 }
  }

  const placeholders = uniqueIds.map(() => '?').join(', ')
  const existingVehicles = db.prepare(`
    SELECT id, status
    FROM vehicles
    WHERE company_id = ? AND id IN (${placeholders})
  `).all(companyId, ...uniqueIds)

  if (existingVehicles.length === 0) {
    return { error: API_MESSAGES.vehicleNotFound, status: 404 }
  }

  const vehiclesToArchive = existingVehicles.filter((vehicle) => vehicle.status !== 'archived')
  if (vehiclesToArchive.length === 0) {
    return {
      requested: uniqueIds.length,
      matched: existingVehicles.length,
      archived: 0,
      skipped: uniqueIds.length,
      ids: [],
    }
  }

  const archiveIds = vehiclesToArchive.map((vehicle) => vehicle.id)
  const archivePlaceholders = archiveIds.map(() => '?').join(', ')

  db.prepare(`
    UPDATE vehicles
    SET status = 'archived'
    WHERE company_id = ? AND id IN (${archivePlaceholders})
  `).run(companyId, ...archiveIds)

  vehiclesToArchive.forEach((vehicle) => {
    recordVehicleStatusChange(db, {
      vehicleId: vehicle.id,
      oldStatus: vehicle.status,
      newStatus: 'archived',
      reason: 'Archived from vehicles list',
      changedBy,
    })
  })

  return {
    requested: uniqueIds.length,
    matched: existingVehicles.length,
    archived: vehiclesToArchive.length,
    skipped: uniqueIds.length - vehiclesToArchive.length,
    ids: archiveIds,
  }
}

function normalizeVehicleNumber(number) {
  return normalizeVehicleNumberToCyrillic(number)
}

function validateVehiclePayload(db, API_MESSAGES, { number, name, region }) {
  const normalizedNumber = normalizeVehicleNumber(number)
  const normalizedName = typeof name === 'string' ? name.trim() : ''
  const normalizedRegion = normalizeRegionName(region)

  if (!normalizedNumber || !normalizedName) {
    return { error: API_MESSAGES.vehicleFieldsRequired }
  }

  if (!isValidRussianLicensePlate(normalizedNumber)) {
    return { error: API_MESSAGES.invalidVehicleNumber }
  }

  if (normalizedRegion && !getRegionByName(db, normalizedRegion)) {
    return { error: API_MESSAGES.invalidRegion }
  }

  return {
    number: normalizedNumber,
    name: normalizedName,
    region: normalizedRegion,
  }
}

function ensureVehicleNumberAvailable(db, API_MESSAGES, number, currentVehicleId = null, companyId = null) {
  const existingVehicle = getVehicleByNumber(db, number, companyId)
  if (!existingVehicle) return null
  if (currentVehicleId && existingVehicle.id === currentVehicleId) return null
  return API_MESSAGES.vehicleNumberExists
}

function mapPrimaryPhotoUpdate(photo, source) {
  return {
    primary_photo_url: photo?.url || photo?.webp_url || null,
    primary_photo_original_url: photo?.original_url || null,
    primary_photo_webp_url: photo?.webp_url || photo?.url || null,
    primary_photo_thumb_url: photo?.thumb_url || photo?.webp_url || photo?.url || null,
    primary_photo_source: source,
  }
}

function updateVehiclePrimaryPhoto(db, vehicleId, companyId, photo, source) {
  const mapped = mapPrimaryPhotoUpdate(photo, source)
  db.prepare(`
    UPDATE vehicles
    SET primary_photo_url = ?,
        primary_photo_original_url = ?,
        primary_photo_webp_url = ?,
        primary_photo_thumb_url = ?,
        primary_photo_source = ?
    WHERE id = ? AND company_id = ?
  `).run(
    mapped.primary_photo_url,
    mapped.primary_photo_original_url,
    mapped.primary_photo_webp_url,
    mapped.primary_photo_thumb_url,
    mapped.primary_photo_source,
    vehicleId,
    companyId,
  )
}

function getVehicleUploadedPrimaryPhoto(vehicle) {
  if (vehicle?.primary_photo_source !== 'upload') return null
  return {
    url: vehicle.primary_photo_url,
    original_url: vehicle.primary_photo_original_url,
    webp_url: vehicle.primary_photo_webp_url,
    thumb_url: vehicle.primary_photo_thumb_url,
  }
}

const QUALIFIED_PHOTO_SELECT_COLUMNS = `
  p.id, p.inspection_id, p.defect_id, p.company_id, p.photo_type, p.url, p.original_url, p.webp_url, p.thumb_url,
  p.original_mime, p.original_name, p.width, p.height, p.size_original, p.size_webp, p.size_thumb, p.hash,
  p.geo, p.is_required, p.client_photo_id, p.upload_status, p.captured_at, p.captured_lat, p.captured_lng,
  p.watermark_url, p.watermark_generated_at, p.created_at
`

export default function registerVehicleRoutes({
  app,
  db,
  authenticate,
  sendError,
  sendInternalError,
  sendCompanyLimitViolation,
  API_MESSAGES,
  PHOTO_SELECT_COLUMNS,
  getVehicleById,
  getCompanyLimitViolation,
  getCompanyResourceLimitState,
  ensureManager,
  ensureCompanyOperationalWriteAllowed,
  inspectionSchedule,
  uploadPhoto,
  processUploadedPhoto,
  removeFileIfExists,
  removePhotoFiles,
}) {
  app.get('/api/vehicles', authenticate, (req, res) => {
    const {
      page = 1,
      limit = 20,
      search = '',
      status = 'all',
      inspection_status: inspectionStatus = 'all',
    } = req.query
    const offset = (page - 1) * limit
    const companyId = req.user.company_id || 'default'

    let vehicleWhereClause = 'v.company_id = ?'
    const params = [companyId]

    if (search) {
      vehicleWhereClause += ' AND (v.number LIKE ? OR v.name LIKE ?)'
      params.push(`%${search}%`, `%${search}%`)
    }

    if (status && status !== 'all') {
      if (!VEHICLE_STATUSES.has(String(status))) {
        return sendError(res, 400, 'Неизвестный статус техники')
      }
      vehicleWhereClause += ' AND v.status = ?'
      params.push(status)
    } else {
      vehicleWhereClause += " AND v.status != 'archived'"
    }

    if (inspectionStatus !== 'all' && !INSPECTION_SCHEDULE_STATUSES.has(String(inspectionStatus))) {
      return sendError(res, 400, 'Неизвестный статус графика осмотров')
    }

    const query = db.prepare(`
      WITH latest_inspections AS (
        SELECT id, vehicle_id, created_at,
               ROW_NUMBER() OVER (PARTITION BY vehicle_id ORDER BY created_at DESC, id DESC) AS rn
        FROM inspections
        WHERE company_id = ?
      ),
      defect_counts AS (
        SELECT i.vehicle_id, COUNT(*) AS count
        FROM defects d
        JOIN inspections i ON d.inspection_id = i.id
        WHERE i.company_id = ?
        GROUP BY i.vehicle_id
      )
      SELECT
        v.id,
        v.number,
        v.name,
        v.status,
        v.region,
        v.company_id,
        v.created_at,
        c.created_at AS company_created_at,
        v.last_scheduled_inspection,
        v.quick_inspection_interval_days,
        v.planned_inspection_interval_days,
        (
          SELECT COALESCE(si.completed_at, si.created_at)
          FROM inspections si
          WHERE si.vehicle_id = v.id AND si.company_id = v.company_id
            AND si.type = 'quick' AND si.completed = 1
          ORDER BY COALESCE(si.completed_at, si.created_at) DESC, si.id DESC
          LIMIT 1
        ) AS last_quick_inspection_at,
        (
          SELECT COALESCE(si.completed_at, si.created_at)
          FROM inspections si
          WHERE si.vehicle_id = v.id AND si.company_id = v.company_id
            AND si.type = 'scheduled' AND si.completed = 1
          ORDER BY COALESCE(si.completed_at, si.created_at) DESC, si.id DESC
          LIMIT 1
        ) AS last_planned_inspection_at,
        li.id AS last_inspection_id,
        li.created_at AS last_inspection_created_at,
        COALESCE(dc.count, 0) AS defects_count
      FROM vehicles v
      LEFT JOIN companies c ON c.id = v.company_id
      LEFT JOIN latest_inspections li ON li.vehicle_id = v.id AND li.rn = 1
      LEFT JOIN defect_counts dc ON dc.vehicle_id = v.id
      WHERE ${vehicleWhereClause}
      ORDER BY v.created_at DESC
    `)
    const vehicles = query.all(companyId, companyId, ...params)

    const vehiclesWithStats = vehicles.map(({
      last_inspection_id,
      last_inspection_created_at,
      defects_count,
      ...vehicle
    }) => {
      const lastInspection = last_inspection_id
        ? { id: last_inspection_id, created_at: last_inspection_created_at }
        : undefined

      return { ...vehicle, lastInspection, defectsCount: Number(defects_count || 0) }
    })
    const scheduledVehicles = inspectionSchedule.enrichVehicles(vehiclesWithStats, companyId)
    const filteredVehicles = inspectionStatus === 'all'
      ? scheduledVehicles
      : scheduledVehicles.filter((vehicle) => vehicle.inspection_schedule.status === inspectionStatus)
    const paginatedVehicles = filteredVehicles.slice(offset, offset + Number(limit))

    res.json({
      data: paginatedVehicles,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: filteredVehicles.length,
        pages: Math.ceil(filteredVehicles.length / Number(limit)),
      },
    })
  })

  app.get('/api/vehicles/list', authenticate, (req, res) => {
    try {
      const companyId = req.user.company_id || 'default'
      const vehicles = db.prepare(`
        SELECT id, number, name, status, region
        FROM vehicles
        WHERE company_id = ? AND status != 'archived'
        ORDER BY number
      `).all(companyId)
      res.json(vehicles)
    } catch (err) {
      console.error('Vehicles list error:', err)
      return sendInternalError(res, 'Vehicles list error', err)
    }
  })

  app.get('/api/vehicles/:id/history', authenticate, (req, res) => {
    const companyId = req.user.company_id || 'default'
    const vehicle = getVehicleById(req.params.id, companyId)
    if (!vehicle) {
      return sendError(res, 404, API_MESSAGES.vehicleNotFound)
    }

    const history = db.prepare(`
      SELECT h.*, u.name as changed_by_name
      FROM vehicle_status_history h
      LEFT JOIN users u ON h.changed_by = u.id
      WHERE h.vehicle_id = ?
      ORDER BY h.created_at DESC
    `).all(req.params.id)
    res.json(history)
  })

  app.get('/api/vehicles/:id/defects', authenticate, (req, res) => {
    const companyId = req.user.company_id || 'default'
    const vehicle = getVehicleById(req.params.id, companyId)
    if (!vehicle) {
      return sendError(res, 404, API_MESSAGES.vehicleNotFound)
    }

    const limit = Number(req.query.limit || 20)
    const defects = db.prepare(`
      SELECT d.id, d.inspection_id, d.title, d.comment, d.created_at,
             d.status, d.severity, d.resolved_at, d.closed_at, d.closed_by, d.manager_comment,
             i.type as inspection_type, i.created_at as inspection_date, i.created_at as inspection_time,
             i.accident_occurred_at, i.accident_location,
             v.id as vehicle_id, v.number as vehicle_number, v.name as vehicle_name, v.region as vehicle_region,
             u.name as inspector_name
      FROM defects d
      JOIN inspections i ON d.inspection_id = i.id
      JOIN vehicles v ON i.vehicle_id = v.id
      JOIN users u ON i.inspector_id = u.id
      WHERE v.id = ? AND v.company_id = ?
      ORDER BY d.created_at DESC
      LIMIT ?
    `).all(req.params.id, companyId, limit)

    const defectsWithPhotos = defects.map((defect) => {
      const photos = db.prepare(`SELECT ${PHOTO_SELECT_COLUMNS} FROM photos WHERE defect_id = ? AND company_id = ? ORDER BY created_at ASC`).all(defect.id, companyId)
      return { ...defect, photos }
    })

    res.json(defectsWithPhotos)
  })

  app.get('/api/vehicles/:id', authenticate, (req, res) => {
    const companyId = req.user.company_id || 'default'
    const vehicle = getVehicleById(req.params.id, companyId)
    if (!vehicle) {
      return sendError(res, 404, API_MESSAGES.vehicleNotFound)
    }
    res.json(vehicle)
  })

  app.get('/api/vehicles/:id/photo-options', authenticate, (req, res) => {
    const companyId = req.user.company_id || 'default'
    const vehicle = getVehicleById(req.params.id, companyId)
    if (!vehicle) {
      return sendError(res, 404, API_MESSAGES.vehicleNotFound)
    }

    const photos = db.prepare(`
      SELECT ${QUALIFIED_PHOTO_SELECT_COLUMNS},
             i.type AS inspection_type,
             i.created_at AS inspection_created_at
      FROM photos p
      JOIN inspections i ON i.id = p.inspection_id AND i.company_id = p.company_id
      WHERE i.vehicle_id = ? AND p.company_id = ? AND p.photo_type = 'overall'
      ORDER BY COALESCE(p.captured_at, p.created_at) DESC, p.id DESC
      LIMIT 120
    `).all(req.params.id, companyId)

    res.json(photos)
  })

  app.post('/api/vehicles/:id/primary-photo', authenticate, (req, res, next) => {
    if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'write' })) return
    next()
  }, uploadPhoto, async (req, res) => {
    const companyId = req.user.company_id || 'default'
    const vehicle = getVehicleById(req.params.id, companyId)
    if (!vehicle) {
      await removeFileIfExists(req.file?.path)
      return sendError(res, 404, API_MESSAGES.vehicleNotFound)
    }

    if (!req.file) return sendError(res, 400, 'Photo is required')

    try {
      const processed = await processUploadedPhoto({
        tempPath: req.file.path,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        companyId,
        inspectionId: `vehicle-${req.params.id}`,
        photoId: uuidv4(),
      })
      const previousUpload = getVehicleUploadedPrimaryPhoto(vehicle)
      updateVehiclePrimaryPhoto(db, req.params.id, companyId, processed, 'upload')
      await removePhotoFiles(previousUpload)
      res.json(getVehicleById(req.params.id, companyId))
    } catch (err) {
      await removeFileIfExists(req.file?.path)
      console.warn('[uploads] Failed to process vehicle primary photo:', err.message)
      return sendError(res, 400, 'Photo could not be processed')
    }
  })

  app.post('/api/vehicles/:id/primary-photo/from-photo', authenticate, async (req, res) => {
    if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'write' })) return

    const companyId = req.user.company_id || 'default'
    const vehicle = getVehicleById(req.params.id, companyId)
    if (!vehicle) {
      return sendError(res, 404, API_MESSAGES.vehicleNotFound)
    }

    const photoId = String(req.body?.photo_id || req.body?.photoId || '').trim()
    if (!photoId) {
      return sendError(res, 400, 'Photo is required')
    }

    const photo = db.prepare(`
      SELECT ${QUALIFIED_PHOTO_SELECT_COLUMNS}
      FROM photos p
      JOIN inspections i ON i.id = p.inspection_id AND i.company_id = p.company_id
      WHERE p.id = ? AND p.company_id = ? AND i.vehicle_id = ? AND p.photo_type = 'overall'
    `).get(photoId, companyId, req.params.id)
    if (!photo) {
      return sendError(res, 404, 'Photo not found')
    }

    const previousUpload = getVehicleUploadedPrimaryPhoto(vehicle)
    updateVehiclePrimaryPhoto(db, req.params.id, companyId, photo, 'inspection')
    await removePhotoFiles(previousUpload)
    res.json(getVehicleById(req.params.id, companyId))
  })

  app.post('/api/vehicles', authenticate, (req, res) => {
    if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'create' })) return

    const {
      number,
      name,
      status = 'active',
      region,
      quick_inspection_interval_days,
      planned_inspection_interval_days,
    } = req.body
    const companyId = req.user.company_id || 'default'
    if (!VEHICLE_STATUSES.has(String(status))) {
      return sendError(res, 400, 'Неизвестный статус техники')
    }

    const validated = validateVehiclePayload(db, API_MESSAGES, { number, name, region })
    if (validated.error) {
      return sendError(res, 400, validated.error)
    }

    const duplicateError = ensureVehicleNumberAvailable(db, API_MESSAGES, validated.number, null, companyId)
    if (duplicateError) {
      return sendError(res, 400, duplicateError)
    }
    const quickInterval = normalizeOptionalInterval(quick_inspection_interval_days)
    const plannedInterval = normalizeOptionalInterval(planned_inspection_interval_days)
    if (quickInterval.error || plannedInterval.error) {
      return sendError(res, 400, quickInterval.error || plannedInterval.error)
    }

    const limitViolation = getCompanyLimitViolation(companyId, 'vehicles')
    if (limitViolation) {
      return sendCompanyLimitViolation(res, limitViolation)
    }

    const id = uuidv4()

    createVehicleRecord(db, {
      id,
      number: validated.number,
      name: validated.name,
      status,
      region: validated.region,
      companyId,
      quickInspectionIntervalDays: quickInterval.value,
      plannedInspectionIntervalDays: plannedInterval.value,
    })

    const vehicle = getVehicleById(id, companyId)
    res.status(201).json(vehicle)
  })

  app.post('/api/vehicles/import', authenticate, (req, res) => {
    if (!ensureManager(req, res)) return
    if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'create' })) return

    const companyId = req.user.company_id || 'default'

    const { vehicles } = req.body
    if (!Array.isArray(vehicles)) {
      return sendError(res, 400, 'Требуется массив vehicles')
    }

    const imported = []
    const errors = []
    const regionsAdded = []
    const vehicleLimitState = getCompanyResourceLimitState(companyId, 'vehicles')

    const regions = new Set()
    vehicles.forEach(v => {
      if (v.region) regions.add(v.region)
    })

    regions.forEach(regionName => {
      const normalized = normalizeRegionName(regionName)
      if (normalized && !getRegionByName(db, normalized)) {
        createRegionRecord(db, normalized)
        regionsAdded.push(normalized)
      }
    })

    vehicles.forEach((v, idx) => {
      const { number, name, region } = v
      const normalizedRegion = region ? normalizeRegionName(region) : ''

      const validated = validateVehiclePayload(db, API_MESSAGES, { number, name, region: normalizedRegion })
      if (validated.error) {
        errors.push({ row: idx + 1, error: validated.error })
        return
      }

      const duplicateError = ensureVehicleNumberAvailable(db, API_MESSAGES, validated.number, null, companyId)
      if (duplicateError) {
        errors.push({ row: idx + 1, error: duplicateError })
        return
      }

      if (vehicleLimitState && vehicleLimitState.current + imported.length + 1 > vehicleLimitState.max) {
        errors.push({
          row: idx + 1,
          error: `${API_MESSAGES.vehicleLimitExceeded}. Текущее значение: ${vehicleLimitState.current + imported.length}/${vehicleLimitState.max}.`,
        })
        return
      }

      const id = uuidv4()
      createVehicleRecord(db, {
        id,
        number: validated.number,
        name: validated.name,
        status: 'active',
        region: validated.region,
        companyId,
      })
      imported.push({ number: validated.number })
    })

    res.json({ imported: imported.length, errors, vehicles: imported, regionsAdded: regionsAdded.length })
  })

  app.post('/api/vehicles/archive', authenticate, (req, res) => {
    if (!ensureManager(req, res)) return
    if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'write' })) return

    const companyId = req.user.company_id || 'default'
    const result = archiveVehiclesByIds(db, API_MESSAGES, {
      ids: req.body?.ids,
      companyId,
      changedBy: req.user.id,
    })

    if (result.error) {
      return sendError(res, result.status || 400, result.error)
    }

    res.json(result)
  })

  app.post('/api/vehicles/:id/archive', authenticate, (req, res) => {
    if (!ensureManager(req, res)) return
    if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'write' })) return

    const companyId = req.user.company_id || 'default'
    const result = archiveVehiclesByIds(db, API_MESSAGES, {
      ids: [req.params.id],
      companyId,
      changedBy: req.user.id,
    })

    if (result.error) {
      return sendError(res, result.status || 400, result.error)
    }

    res.json(result)
  })

  app.put('/api/vehicles/:id', authenticate, (req, res) => {
    if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'write' })) return

    const {
      number,
      name,
      status,
      region,
      reason,
      quick_inspection_interval_days,
      planned_inspection_interval_days,
    } = req.body
    const companyId = req.user.company_id || 'default'
    if (!VEHICLE_STATUSES.has(String(status))) {
      return sendError(res, 400, 'Неизвестный статус техники')
    }

    const oldVehicle = getVehicleById(req.params.id, companyId)
    if (!oldVehicle) {
      return sendError(res, 404, API_MESSAGES.vehicleNotFound)
    }

    const validated = validateVehiclePayload(db, API_MESSAGES, { number, name, region })
    if (validated.error) {
      return sendError(res, 400, validated.error)
    }

    const duplicateError = ensureVehicleNumberAvailable(db, API_MESSAGES, validated.number, req.params.id, companyId)
    if (duplicateError) {
      return sendError(res, 400, duplicateError)
    }
    const quickInterval = normalizeOptionalInterval(
      quick_inspection_interval_days === undefined
        ? oldVehicle.quick_inspection_interval_days
        : quick_inspection_interval_days,
    )
    const plannedInterval = normalizeOptionalInterval(
      planned_inspection_interval_days === undefined
        ? oldVehicle.planned_inspection_interval_days
        : planned_inspection_interval_days,
    )
    if (quickInterval.error || plannedInterval.error) {
      return sendError(res, 400, quickInterval.error || plannedInterval.error)
    }

    updateVehicleRecord(db, req.params.id, {
      number: validated.number,
      name: validated.name,
      status,
      region: validated.region,
      companyId,
      quickInspectionIntervalDays: quickInterval.value,
      plannedInspectionIntervalDays: plannedInterval.value,
    })

    if (oldVehicle.status !== status) {
      recordVehicleStatusChange(db, {
        vehicleId: req.params.id,
        oldStatus: oldVehicle.status,
        newStatus: status,
        reason,
        changedBy: req.user.id,
      })
    }

    const vehicle = getVehicleById(req.params.id, companyId)
    res.json(vehicle)
  })

  app.delete('/api/vehicles/:id', authenticate, (req, res) => {
    if (!ensureManager(req, res)) return
    if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'write' })) return

    const companyId = req.user.company_id || 'default'
    const result = archiveVehiclesByIds(db, API_MESSAGES, {
      ids: [req.params.id],
      companyId,
      changedBy: req.user.id,
    })

    if (result.error) {
      return sendError(res, result.status || 400, result.error)
    }

    res.status(204).send()
  })
}
