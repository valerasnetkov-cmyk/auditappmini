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

function createVehicleRecord(db, { id, number, name, status, region, companyId = 'default' }) {
  return db.prepare(`
    INSERT INTO vehicles (id, number, name, status, region, company_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, number, name, status, region, companyId)
}

function updateVehicleRecord(db, id, { number, name, status, region, companyId = null }) {
  const query = companyId
    ? db.prepare(`
      UPDATE vehicles SET number = ?, name = ?, status = ?, region = ?
      WHERE id = ? AND company_id = ?
    `)
    : db.prepare(`
    UPDATE vehicles SET number = ?, name = ?, status = ?, region = ?
    WHERE id = ?
  `)

  return companyId
    ? query.run(number.toUpperCase(), name, status, region || null, id, companyId)
    : query.run(number.toUpperCase(), name, status, region || null, id)
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
}) {
  app.get('/api/vehicles', authenticate, (req, res) => {
    const { page = 1, limit = 20, search = '', status = 'all' } = req.query
    const offset = (page - 1) * limit
    const companyId = req.user.company_id || 'default'

    let countWhereClause = 'company_id = ?'
    let vehicleWhereClause = 'v.company_id = ?'
    const params = [companyId]

    if (search) {
      countWhereClause += ' AND (number LIKE ? OR name LIKE ?)'
      vehicleWhereClause += ' AND (v.number LIKE ? OR v.name LIKE ?)'
      params.push(`%${search}%`, `%${search}%`)
    }

    if (status && status !== 'all') {
      if (!VEHICLE_STATUSES.has(String(status))) {
        return sendError(res, 400, 'Неизвестный статус техники')
      }
      countWhereClause += ' AND status = ?'
      vehicleWhereClause += ' AND v.status = ?'
      params.push(status)
    } else {
      countWhereClause += " AND status != 'archived'"
      vehicleWhereClause += " AND v.status != 'archived'"
    }

    const countQuery = db.prepare(`SELECT COUNT(*) as count FROM vehicles WHERE ${countWhereClause}`)
    const { count } = countQuery.get(...params)

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
        v.last_scheduled_inspection,
        li.id AS last_inspection_id,
        li.created_at AS last_inspection_created_at,
        COALESCE(dc.count, 0) AS defects_count
      FROM vehicles v
      LEFT JOIN latest_inspections li ON li.vehicle_id = v.id AND li.rn = 1
      LEFT JOIN defect_counts dc ON dc.vehicle_id = v.id
      WHERE ${vehicleWhereClause}
      ORDER BY v.created_at DESC
      LIMIT ? OFFSET ?
    `)
    const vehicles = query.all(companyId, companyId, ...params, Number(limit), offset)

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

    res.json({
      data: vehiclesWithStats,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count,
        pages: Math.ceil(count / limit),
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
      SELECT d.id, d.inspection_id, d.title, d.comment, d.created_at, d.status, d.closed_at,
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

  app.post('/api/vehicles', authenticate, (req, res) => {
    if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'create' })) return

    const { number, name, status = 'active', region } = req.body
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

    const { number, name, status, region, reason } = req.body
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

    updateVehicleRecord(db, req.params.id, {
      number: validated.number,
      name: validated.name,
      status,
      region: validated.region,
      companyId,
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
