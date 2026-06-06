import { v4 as uuidv4 } from 'uuid'

export default function registerDefectRoutes({
  app,
  db,
  authenticate,
  sendError,
  API_MESSAGES,
  PHOTO_SELECT_COLUMNS,
  ensureCompanyOperationalWriteAllowed,
  removePhotoFilesForRows,
}) {
  app.post('/api/inspections/:id/defects', authenticate, (req, res) => {
    if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'write' })) return

    const inspectionId = req.params.id
    const { title, comment } = req.body
    const companyId = req.user.company_id || 'default'
    if (!title) return sendError(res, 400, API_MESSAGES.defectTitleRequired || 'Заголовок дефекта обязателен')

    const inspection = db.prepare('SELECT * FROM inspections WHERE id = ? AND company_id = ?').get(inspectionId, companyId)
    if (!inspection) return sendError(res, 404, API_MESSAGES.inspectionNotFound)

    const defectId = uuidv4()
    db.prepare(`
      INSERT INTO defects (id, inspection_id, title, comment, status, company_id, created_at)
      VALUES (?, ?, ?, ?, 'open', ?, datetime('now'))
    `).run(defectId, inspectionId, title, comment || null, companyId)

    const defect = db.prepare('SELECT * FROM defects WHERE id = ?').get(defectId)
    res.status(201).json(defect)
  })

  app.get('/api/defects', authenticate, (req, res) => {
    const { page = 1, limit = 20, search = '', vehicle = '', from = '', to = '' } = req.query
    const offset = (page - 1) * limit
    const companyId = req.user.company_id || 'default'

    let whereClause = 'd.company_id = ?'
    const params = [companyId]

    if (search) {
      whereClause += ' AND (d.title LIKE ? OR d.comment LIKE ?)'
      params.push(`%${search}%`, `%${search}%`)
    }

    if (vehicle) {
      whereClause += ' AND v.id = ?'
      params.push(vehicle)
    }

    if (from) {
      whereClause += ' AND d.created_at >= ?'
      params.push(from)
    }

    if (to) {
      whereClause += ' AND d.created_at <= ?'
      params.push(to + ' 23:59:59')
    }

    const countQuery = db.prepare(`SELECT COUNT(*) as count FROM defects d JOIN inspections i ON d.inspection_id = i.id JOIN vehicles v ON i.vehicle_id = v.id WHERE ${whereClause}`)
    const { count } = countQuery.get(...params)

    const query = db.prepare(`
      SELECT d.id, d.inspection_id, d.title, d.comment, d.created_at as created_at, d.status as status, d.closed_at as closed_at,
             i.type as inspection_type, i.created_at as inspection_date, i.created_at as inspection_time,
             i.accident_occurred_at, i.accident_location,
             v.id as vehicle_id, v.number as vehicle_number, v.name as vehicle_name, v.region as vehicle_region,
             u.name as inspector_name
      FROM defects d
      JOIN inspections i ON d.inspection_id = i.id
      JOIN vehicles v ON i.vehicle_id = v.id
      JOIN users u ON i.inspector_id = u.id
      WHERE ${whereClause}
      ORDER BY d.created_at DESC
      LIMIT ? OFFSET ?
    `)
    const defects = query.all(...params, Number(limit), offset)

    const defectsWithPhotos = defects.map(defect => {
      const photos = db.prepare(`SELECT ${PHOTO_SELECT_COLUMNS} FROM photos WHERE defect_id = ? AND company_id = ?`).all(defect.id, companyId)
      return { ...defect, photos }
    })

    res.json({
      data: defectsWithPhotos,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count,
        pages: Math.ceil(count / limit),
      },
    })
  })

  app.get('/api/defects/:id', authenticate, (req, res) => {
    const companyId = req.user.company_id || 'default'
    const defect = db.prepare(`
      SELECT d.id, d.inspection_id, d.title, d.comment, d.created_at, d.status, d.closed_at,
             i.type as inspection_type, i.created_at as inspection_date, i.created_at as inspection_time,
             i.accident_occurred_at, i.accident_location,
             v.id as vehicle_id, v.number as vehicle_number, v.name as vehicle_name, v.region as vehicle_region,
             u.name as inspector_name
      FROM defects d
      JOIN inspections i ON d.inspection_id = i.id
      JOIN vehicles v ON i.vehicle_id = v.id
      JOIN users u ON i.inspector_id = u.id
      WHERE d.id = ? AND d.company_id = ?
    `).get(req.params.id, companyId)

    if (!defect) {
      return sendError(res, 404, API_MESSAGES.defectNotFound)
    }

    const photos = db.prepare(`SELECT ${PHOTO_SELECT_COLUMNS} FROM photos WHERE defect_id = ? AND company_id = ? ORDER BY created_at ASC`).all(req.params.id, companyId)
    res.json({ ...defect, photos })
  })

  app.post('/api/defects/:id/close', authenticate, (req, res) => {
    if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'write' })) return

    const defectId = req.params.id
    const companyId = req.user.company_id || 'default'
    const defect = db.prepare('SELECT id, status, closed_at FROM defects WHERE id = ? AND company_id = ?').get(defectId, companyId)
    if (!defect) return sendError(res, 404, API_MESSAGES.defectNotFound)
    if (defect.status === 'closed') {
      return res.json({ id: defectId, status: 'closed', closed_at: defect.closed_at })
    }

    const now = new Date().toISOString()
    db.prepare('UPDATE defects SET status = ?, closed_at = ? WHERE id = ? AND company_id = ?').run('closed', now, defectId, companyId)
    const historyId = uuidv4()
    db.prepare('INSERT INTO defect_history (id, defect_id, status, changed_at, changed_by) VALUES (?, ?, ?, ?, ?)').run(historyId, defectId, 'closed', now, req.user?.id ?? null)
    const updated = db.prepare('SELECT id, inspection_id, title, comment, status, created_at, closed_at FROM defects WHERE id = ? AND company_id = ?').get(defectId, companyId)
    res.json(updated)
  })

  app.post('/api/defects/:id/reopen', authenticate, (req, res) => {
    if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'write' })) return

    const defectId = req.params.id
    const companyId = req.user.company_id || 'default'
    const defect = db.prepare('SELECT id, status FROM defects WHERE id = ? AND company_id = ?').get(defectId, companyId)
    if (!defect) return sendError(res, 404, API_MESSAGES.defectNotFound)
    if (defect.status !== 'closed') {
      return res.json({ id: defectId, status: defect.status })
    }

    const now = new Date().toISOString()
    db.prepare('UPDATE defects SET status = ?, closed_at = NULL WHERE id = ? AND company_id = ?').run('open', defectId, companyId)
    const historyId = uuidv4()
    db.prepare('INSERT INTO defect_history (id, defect_id, status, changed_at, changed_by) VALUES (?, ?, ?, ?, ?)').run(historyId, defectId, 'open', now, req.user?.id ?? null)
    const updated = db.prepare('SELECT id, inspection_id, title, comment, status, created_at, closed_at FROM defects WHERE id = ? AND company_id = ?').get(defectId, companyId)
    res.json(updated)
  })

  app.get('/api/defects/:id/history', authenticate, (req, res) => {
    const defectId = req.params.id
    const companyId = req.user.company_id || 'default'
    const defect = db.prepare('SELECT id FROM defects WHERE id = ? AND company_id = ?').get(defectId, companyId)
    if (!defect) return sendError(res, 404, API_MESSAGES.defectNotFound)

    const history = db.prepare('SELECT id, defect_id, status, changed_at, changed_by FROM defect_history WHERE defect_id = ? ORDER BY changed_at DESC').all(defectId)
    res.json(history)
  })

  app.put('/api/defects/:id', authenticate, (req, res) => {
    if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'write' })) return

    const { title, comment } = req.body
    const companyId = req.user.company_id || 'default'
    const defect = db.prepare('SELECT id FROM defects WHERE id = ? AND company_id = ?').get(req.params.id, companyId)
    if (!defect) return sendError(res, 404, API_MESSAGES.defectNotFound)

    db.prepare('UPDATE defects SET title = ?, comment = ? WHERE id = ? AND company_id = ?')
      .run(title, comment || null, req.params.id, companyId)

    const updatedDefect = db.prepare('SELECT * FROM defects WHERE id = ? AND company_id = ?').get(req.params.id, companyId)
    res.json(updatedDefect)
  })

  app.delete('/api/defects/:id', authenticate, async (req, res) => {
    if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'write' })) return

    const { id } = req.params
    const companyId = req.user.company_id || 'default'
    const defect = db.prepare('SELECT id FROM defects WHERE id = ? AND company_id = ?').get(id, companyId)
    if (!defect) return sendError(res, 404, API_MESSAGES.defectNotFound)

    const photos = db.prepare(`SELECT ${PHOTO_SELECT_COLUMNS} FROM photos WHERE defect_id = ? AND company_id = ?`).all(id, companyId)
    db.prepare('DELETE FROM photos WHERE defect_id = ? AND company_id = ?').run(id, companyId)
    db.prepare('DELETE FROM defects WHERE id = ? AND company_id = ?').run(id, companyId)
    await removePhotoFilesForRows(photos)

    res.status(204).send()
  })
}
