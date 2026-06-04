import { v4 as uuidv4 } from 'uuid'

function validateAccidentDetails(API_MESSAGES, type, accidentOccurredAt, accidentLocation) {
  if (type !== 'accident') {
    return {
      accidentOccurredAt: accidentOccurredAt || null,
      accidentLocation: accidentLocation?.trim() || null,
    }
  }

  const normalizedOccurredAt = typeof accidentOccurredAt === 'string' ? accidentOccurredAt.trim() : ''
  const normalizedLocation = typeof accidentLocation === 'string' ? accidentLocation.trim() : ''

  if (!normalizedOccurredAt || !normalizedLocation) {
    return { error: API_MESSAGES.accidentDetailsRequired }
  }

  return {
    accidentOccurredAt: normalizedOccurredAt,
    accidentLocation: normalizedLocation,
  }
}

function getInspectionPhotos(db, PHOTO_SELECT_COLUMNS, inspectionId, companyId) {
  return db.prepare(`
    SELECT ${PHOTO_SELECT_COLUMNS}
    FROM photos
    WHERE inspection_id = ? AND company_id = ? AND defect_id IS NULL
    ORDER BY created_at ASC
  `).all(inspectionId, companyId)
}

function getDefectsWithPhotos(db, PHOTO_SELECT_COLUMNS, inspectionId, companyId) {
  const defects = db.prepare(`
    SELECT *
    FROM defects
    WHERE inspection_id = ? AND company_id = ?
    ORDER BY created_at ASC
  `).all(inspectionId, companyId)

  const photos = db.prepare(`
    SELECT ${PHOTO_SELECT_COLUMNS}
    FROM photos
    WHERE inspection_id = ? AND company_id = ? AND defect_id IS NOT NULL
    ORDER BY created_at ASC
  `).all(inspectionId, companyId)

  const photosByDefectId = photos.reduce((acc, photo) => {
    acc[photo.defect_id] = acc[photo.defect_id] || []
    acc[photo.defect_id].push(photo)
    return acc
  }, {})

  return defects.map((defect) => ({
    ...defect,
    photos: photosByDefectId[defect.id] || [],
  }))
}

export default function registerInspectionRoutes({
  app,
  db,
  authenticate,
  sendError,
  API_MESSAGES,
  PHOTO_SELECT_COLUMNS,
  getVehicleById,
  getInspectionById,
  ensureCompanyFeatureEnabled,
  ensureCompanyOperationalWriteAllowed,
  removePhotoFilesForRows,
}) {
  app.get('/api/inspections', authenticate, (req, res) => {
    const { page = 1, limit = 20, type = '', vehicle = '', from = '', to = '' } = req.query
    const offset = (page - 1) * limit
    const companyId = req.user.company_id || 'default'

    let whereClause = 'i.company_id = ?'
    const params = [companyId]

    if (type) {
      whereClause += ' AND i.type = ?'
      params.push(type)
    }

    if (vehicle) {
      whereClause += ' AND i.vehicle_id = ?'
      params.push(vehicle)
    }

    if (from) {
      whereClause += ' AND i.created_at >= ?'
      params.push(from)
    }

    if (to) {
      whereClause += ' AND i.created_at <= ?'
      params.push(to + ' 23:59:59')
    }

    const countQuery = db.prepare(`SELECT COUNT(*) as count FROM inspections i WHERE ${whereClause}`)
    const { count } = countQuery.get(...params)

    const query = db.prepare(`
      SELECT i.id, i.vehicle_id, i.type, i.completed, i.created_at, i.accident_occurred_at, i.accident_location,
             v.number as vehicle_number, v.name as vehicle_name, v.region as vehicle_region, u.name as inspector_name,
             (SELECT COUNT(*) FROM defects WHERE inspection_id = i.id) as defects_count
      FROM inspections i
      JOIN vehicles v ON i.vehicle_id = v.id
      JOIN users u ON i.inspector_id = u.id
      WHERE ${whereClause}
      ORDER BY i.created_at DESC
      LIMIT ? OFFSET ?
    `)
    const inspections = query.all(...params, Number(limit), offset)

    res.json({
      data: inspections,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count,
        pages: Math.ceil(count / limit),
      },
    })
  })

  app.get('/api/vehicles/:vehicleId/inspections', authenticate, (req, res) => {
    const { page = 1, limit = 5 } = req.query
    const offset = (page - 1) * limit
    const companyId = req.user.company_id || 'default'

    const vehicle = getVehicleById(req.params.vehicleId, companyId)
    if (!vehicle) {
      return sendError(res, 404, API_MESSAGES.vehicleNotFound)
    }

    const countQuery = db.prepare('SELECT COUNT(*) as count FROM inspections WHERE vehicle_id = ? AND company_id = ?')
    const { count } = countQuery.get(req.params.vehicleId, companyId)

    const query = db.prepare(`
      SELECT i.id, i.vehicle_id, i.type, i.completed, i.created_at,
             v.number as vehicle_number, v.name as vehicle_name, v.region as vehicle_region,
             u.name as inspector_name,
             (SELECT COUNT(*) FROM defects WHERE inspection_id = i.id) as defects_count
      FROM inspections i
      JOIN vehicles v ON i.vehicle_id = v.id
      JOIN users u ON i.inspector_id = u.id
      WHERE i.vehicle_id = ? AND i.company_id = ?
      ORDER BY i.created_at DESC
      LIMIT ? OFFSET ?
    `)
    const inspections = query.all(req.params.vehicleId, companyId, Number(limit), offset)

    res.json({
      data: inspections,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count,
        pages: Math.ceil(count / limit),
      },
    })
  })

  app.post('/api/inspections', authenticate, (req, res) => {
    if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'create' })) return

    const { vehicle_id, type = 'quick', checklist = [], accident_occurred_at = null, accident_location = null } = req.body
    const companyId = req.user.company_id || 'default'

    if (type === 'accident' && !ensureCompanyFeatureEnabled(req, res, 'accident_module_enabled', API_MESSAGES.accidentModuleDisabled)) {
      return
    }

    const vehicle = getVehicleById(vehicle_id, companyId)
    if (!vehicle) {
      return sendError(res, 404, API_MESSAGES.vehicleNotFound)
    }

    const accidentValidation = validateAccidentDetails(API_MESSAGES, type, accident_occurred_at, accident_location)
    if (accidentValidation.error) {
      return sendError(res, 400, accidentValidation.error)
    }
    const id = uuidv4()

    db.prepare(`
      INSERT INTO inspections (id, vehicle_id, inspector_id, type, completed, accident_occurred_at, accident_location, company_id)
      VALUES (?, ?, ?, ?, 0, ?, ?, ?)
    `).run(id, vehicle_id, req.user.id, type, accidentValidation.accidentOccurredAt, accidentValidation.accidentLocation, companyId)

    if (type === 'scheduled') {
      db.prepare("UPDATE vehicles SET last_scheduled_inspection = datetime('now') WHERE id = ? AND company_id = ?").run(vehicle_id, companyId)
    }

    const insertChecklist = db.prepare(`
      INSERT INTO checklist_items (id, inspection_id, title, result, comment)
      VALUES (?, ?, ?, ?, ?)
    `)

    checklist.forEach(item => {
      const itemId = uuidv4()
      insertChecklist.run(itemId, id, item.title, item.result ? 1 : 0, item.comment || null)
    })

    const inspection = getInspectionById(id, companyId)
    res.status(201).json(inspection)
  })

  app.get('/api/inspections/:id', authenticate, (req, res) => {
    const companyId = req.user.company_id || 'default'
    const inspection = db.prepare(`
      SELECT i.*, v.number as vehicle_number, v.name as vehicle_name, u.name as inspector_name
      FROM inspections i
      JOIN vehicles v ON i.vehicle_id = v.id
      JOIN users u ON i.inspector_id = u.id
      WHERE i.id = ? AND i.company_id = ?
    `).get(req.params.id, companyId)

    if (!inspection) {
      return sendError(res, 404, API_MESSAGES.inspectionNotFound)
    }

    const checklist = db.prepare('SELECT * FROM checklist_items WHERE inspection_id = ?').all(req.params.id)
    const defects = getDefectsWithPhotos(db, PHOTO_SELECT_COLUMNS, req.params.id, companyId)
    const photos = getInspectionPhotos(db, PHOTO_SELECT_COLUMNS, req.params.id, companyId)

    res.json({ ...inspection, checklist_items: checklist, defects, photos })
  })

  app.put('/api/inspections/:id', authenticate, async (req, res) => {
    if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'write' })) return

    const companyId = req.user.company_id || 'default'
    const inspection = db.prepare('SELECT * FROM inspections WHERE id = ? AND company_id = ?').get(req.params.id, companyId)
    if (!inspection) {
      return sendError(res, 404, API_MESSAGES.inspectionNotFound)
    }

    const { checklist = [], accident_occurred_at = null, accident_location = null } = req.body
    const accidentValidation = validateAccidentDetails(API_MESSAGES, inspection.type, accident_occurred_at, accident_location)
    if (accidentValidation.error) {
      return sendError(res, 400, accidentValidation.error)
    }

    db.prepare(`
      UPDATE inspections
      SET accident_occurred_at = ?, accident_location = ?, odometer_value = ?, odometer_unit = ?
      WHERE id = ? AND company_id = ?
    `).run(
      accidentValidation.accidentOccurredAt,
      accidentValidation.accidentLocation,
      req.body.odometer_value ?? inspection.odometer_value ?? null,
      req.body.odometer_unit ?? inspection.odometer_unit ?? 'km',
      req.params.id,
      companyId,
    )

    const existingChecklistItems = db.prepare(`
      SELECT id, title
      FROM checklist_items
      WHERE inspection_id = ?
    `).all(req.params.id)
    const existingChecklistById = new Map(existingChecklistItems.map((item) => [item.id, item]))
    const existingChecklistByTitle = new Map(existingChecklistItems.map((item) => [item.title, item]))
    const existingDefects = db.prepare(`
      SELECT id, title, checklist_item_id
      FROM defects
      WHERE inspection_id = ? AND company_id = ?
      ORDER BY created_at ASC
    `).all(req.params.id, companyId)
    const existingDefectsByChecklistItemId = new Map()
    const existingDefectsByTitle = new Map()

    existingDefects.forEach((defect) => {
      if (defect.checklist_item_id && !existingDefectsByChecklistItemId.has(defect.checklist_item_id)) {
        existingDefectsByChecklistItemId.set(defect.checklist_item_id, defect)
      }

      if (!existingDefectsByTitle.has(defect.title)) {
        existingDefectsByTitle.set(defect.title, defect)
      }
    })

    const insertChecklist = db.prepare(`
      INSERT INTO checklist_items (id, inspection_id, title, result, comment)
      VALUES (?, ?, ?, ?, ?)
    `)
    const updateChecklist = db.prepare(`
      UPDATE checklist_items
      SET result = ?, comment = ?
      WHERE id = ?
    `)
    const deleteChecklist = db.prepare('DELETE FROM checklist_items WHERE id = ?')

    const insertDefect = db.prepare(`
      INSERT INTO defects (id, inspection_id, checklist_item_id, title, comment, company_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `)
    const updateDefect = db.prepare(`
      UPDATE defects
      SET checklist_item_id = ?, title = ?, comment = ?
      WHERE id = ? AND company_id = ?
    `)
    const selectDefectPhotos = db.prepare(`SELECT ${PHOTO_SELECT_COLUMNS} FROM photos WHERE defect_id = ? AND company_id = ?`)
    const deleteDefectPhotos = db.prepare('DELETE FROM photos WHERE defect_id = ? AND company_id = ?')
    const deleteDefect = db.prepare('DELETE FROM defects WHERE id = ? AND company_id = ?')
    const retainedChecklistItemIds = new Set()
    const photosToRemove = []

    checklist.forEach((item) => {
      const existingChecklistItem = (item.id && existingChecklistById.get(item.id)) || existingChecklistByTitle.get(item.title)
      const checklistItemId = existingChecklistItem?.id || item.id || uuidv4()
      retainedChecklistItemIds.add(checklistItemId)

      if (existingChecklistItem) {
        updateChecklist.run(item.result ? 1 : 0, item.comment || null, existingChecklistItem.id)
      } else {
        insertChecklist.run(checklistItemId, req.params.id, item.title, item.result ? 1 : 0, item.comment || null)
      }

      const existingDefect = existingDefectsByChecklistItemId.get(checklistItemId) || existingDefectsByTitle.get(item.title)
      if (!item.result) {
        if (existingDefect) {
          updateDefect.run(checklistItemId, item.title, item.comment || null, existingDefect.id, companyId)
        } else {
          insertDefect.run(uuidv4(), req.params.id, checklistItemId, item.title, item.comment || null, companyId)
        }
        return
      }

      if (existingDefect) {
        photosToRemove.push(...selectDefectPhotos.all(existingDefect.id, companyId))
        deleteDefectPhotos.run(existingDefect.id, companyId)
        deleteDefect.run(existingDefect.id, companyId)
      }
    })

    existingChecklistItems.forEach((item) => {
      if (!retainedChecklistItemIds.has(item.id)) {
        deleteChecklist.run(item.id)
      }
    })

    existingDefects.forEach((defect) => {
      if (defect.checklist_item_id && !retainedChecklistItemIds.has(defect.checklist_item_id)) {
        photosToRemove.push(...selectDefectPhotos.all(defect.id, companyId))
        deleteDefectPhotos.run(defect.id, companyId)
        deleteDefect.run(defect.id, companyId)
      }
    })

    await removePhotoFilesForRows(photosToRemove)

    const updatedInspection = db.prepare(`
      SELECT i.*, v.number as vehicle_number, v.name as vehicle_name, u.name as inspector_name
      FROM inspections i
      JOIN vehicles v ON i.vehicle_id = v.id
      JOIN users u ON i.inspector_id = u.id
      WHERE i.id = ? AND i.company_id = ?
    `).get(req.params.id, companyId)

    const updatedChecklist = db.prepare('SELECT * FROM checklist_items WHERE inspection_id = ?').all(req.params.id)
    const updatedDefects = getDefectsWithPhotos(db, PHOTO_SELECT_COLUMNS, req.params.id, companyId)
    const photos = getInspectionPhotos(db, PHOTO_SELECT_COLUMNS, req.params.id, companyId)

    res.json({ ...updatedInspection, checklist_items: updatedChecklist, defects: updatedDefects, photos })
  })

  app.delete('/api/inspections/:id', authenticate, async (req, res) => {
    if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'write' })) return

    const { id } = req.params
    const companyId = req.user.company_id || 'default'

    const inspection = db.prepare('SELECT * FROM inspections WHERE id = ? AND company_id = ?').get(id, companyId)
    if (!inspection) {
      return sendError(res, 404, API_MESSAGES.inspectionNotFound)
    }

    const photos = db.prepare(`SELECT ${PHOTO_SELECT_COLUMNS} FROM photos WHERE inspection_id = ? AND company_id = ?`).all(id, companyId)
    db.prepare('DELETE FROM checklist_items WHERE inspection_id = ?').run(id)
    db.prepare('DELETE FROM defects WHERE inspection_id = ?').run(id)
    db.prepare('DELETE FROM photos WHERE inspection_id = ? AND company_id = ?').run(id, companyId)
    db.prepare('DELETE FROM inspections WHERE id = ? AND company_id = ?').run(id, companyId)
    await removePhotoFilesForRows(photos)

    res.status(204).send()
  })
}
