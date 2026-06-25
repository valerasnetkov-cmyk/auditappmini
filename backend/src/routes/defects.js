import { v4 as uuidv4 } from 'uuid'
import { sendInspectionCompletedError } from '../services/inspectionReadiness.js'
import {
  DEFECT_SEVERITIES,
  validateDefectTransition,
} from '../services/defectLifecycle.js'

function rejectCompletedInspection(db, res, inspectionId, companyId) {
  const inspection = db.prepare(`
    SELECT completed
    FROM inspections
    WHERE id = ? AND company_id = ?
  `).get(inspectionId, companyId)
  if (inspection?.completed) {
    sendInspectionCompletedError(res)
    return true
  }
  return false
}

const COMPANY_ACTIVITY_RECIPIENT_ROLES = ['company_owner', 'manager']

function createCompanyActivityNotifications(db, {
  companyId,
  type,
  title,
  message,
  actorUserId,
}) {
  const insertNotification = db.prepare(`
    INSERT INTO company_notifications (
      id, company_id, recipient_role, type, channel, title, message,
      status, created_by_user_id, source, created_at
    ) VALUES (?, ?, ?, ?, 'in_app', ?, ?, 'new', ?, 'system', datetime('now'))
  `)

  COMPANY_ACTIVITY_RECIPIENT_ROLES.forEach((recipientRole) => {
    insertNotification.run(uuidv4(), companyId, recipientRole, type, title, message, actorUserId)
  })
}

export default function registerDefectRoutes({
  app,
  db,
  authenticate,
  sendError,
  API_MESSAGES,
  PHOTO_SELECT_COLUMNS,
  ensureCompanyOperationalWriteAllowed,
  removePhotoFilesForRows,
  ensureManager,
}) {
  app.post('/api/inspections/:id/defects', authenticate, (req, res) => {
    if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'write' })) return

    const inspectionId = req.params.id
    const { title, comment, severity = 'medium' } = req.body
    const companyId = req.user.company_id || 'default'
    if (!title) return sendError(res, 400, API_MESSAGES.defectTitleRequired || 'Заголовок дефекта обязателен')
    if (!DEFECT_SEVERITIES.includes(severity)) {
      return res.status(400).json({ error: 'DEFECT_SEVERITY_INVALID', message: 'Неизвестная критичность дефекта' })
    }

    const inspection = db.prepare('SELECT * FROM inspections WHERE id = ? AND company_id = ?').get(inspectionId, companyId)
    if (!inspection) return sendError(res, 404, API_MESSAGES.inspectionNotFound)
    if (inspection.completed) return sendInspectionCompletedError(res)

    const defectId = uuidv4()
    db.prepare(`
      INSERT INTO defects (id, inspection_id, title, comment, status, severity, company_id, created_at)
      VALUES (?, ?, ?, ?, 'open', ?, ?, datetime('now'))
    `).run(defectId, inspectionId, title, comment || null, severity, companyId)

    const vehicle = db.prepare('SELECT number, name FROM vehicles WHERE id = ? AND company_id = ?').get(inspection.vehicle_id, companyId)
    const vehicleLabel = vehicle?.number || vehicle?.name || inspection.vehicle_id
    createCompanyActivityNotifications(db, {
      companyId,
      type: 'defect_created',
      title: 'Новый дефект',
      message: `${vehicleLabel}: ${title}`,
      actorUserId: req.user.id,
    })

    if (severity === 'critical') {
      const insertNotification = db.prepare(`
        INSERT INTO company_notifications (
          id, company_id, recipient_role, type, channel, title, message,
          status, created_by_user_id, source, created_at
        ) VALUES (?, ?, ?, 'critical_defect_created', 'in_app', ?, ?, 'new', ?, 'system', datetime('now'))
      `)
      for (const recipientRole of ['company_owner', 'manager']) {
        insertNotification.run(
          uuidv4(),
          companyId,
          recipientRole,
          'Критический дефект',
          `${title}: требуется внимание руководителя`,
          req.user.id,
        )
      }
    }

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
      SELECT d.id, d.inspection_id, d.title, d.comment, d.created_at as created_at,
             d.status, d.severity, d.resolved_at, d.closed_at, d.closed_by, d.manager_comment,
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
      WHERE d.id = ? AND d.company_id = ?
    `).get(req.params.id, companyId)

    if (!defect) {
      return sendError(res, 404, API_MESSAGES.defectNotFound)
    }

    const photos = db.prepare(`SELECT ${PHOTO_SELECT_COLUMNS} FROM photos WHERE defect_id = ? AND company_id = ? ORDER BY created_at ASC`).all(req.params.id, companyId)
    res.json({ ...defect, photos })
  })

  function transitionDefect(req, res, requestedStatus) {
    if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'write' })) return
    if (!ensureManager(req, res)) return

    const defectId = req.params.id
    const companyId = req.user.company_id || 'default'
    const toStatus = requestedStatus || req.body?.status
    const comment = String(req.body?.comment || '').trim()
    const defect = db.prepare(`
      SELECT id, inspection_id, status, severity, resolved_at, closed_at
      FROM defects
      WHERE id = ? AND company_id = ?
    `).get(defectId, companyId)
    if (!defect) return sendError(res, 404, API_MESSAGES.defectNotFound)
    if (defect.status === toStatus) {
      return res.json(db.prepare('SELECT * FROM defects WHERE id = ? AND company_id = ?').get(defectId, companyId))
    }
    const validation = validateDefectTransition(defect.status, toStatus, comment)
    if (validation) return res.status(400).json(validation)

    const now = new Date().toISOString()
    const resolvedAt = toStatus === 'resolved'
      ? now
      : toStatus === 'reopened' || toStatus === 'in_progress'
        ? null
        : defect.resolved_at
    const closedAt = toStatus === 'closed' ? now : null
    const closedBy = toStatus === 'closed' ? req.user.id : null

    const transition = db.transaction(() => {
      db.prepare(`
        UPDATE defects
        SET status = ?, resolved_at = ?, closed_at = ?, closed_by = ?, manager_comment = ?
        WHERE id = ? AND company_id = ?
      `).run(toStatus, resolvedAt, closedAt, closedBy, comment, defectId, companyId)
      db.prepare(`
        INSERT INTO defect_status_history (
          id, company_id, defect_id, from_status, to_status, comment, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), companyId, defectId, defect.status, toStatus, comment, req.user.id, now)
    })
    transition()

    return res.json(db.prepare('SELECT * FROM defects WHERE id = ? AND company_id = ?').get(defectId, companyId))
  }

  app.post('/api/defects/:id/status', authenticate, (req, res) => transitionDefect(req, res))
  app.post('/api/defects/:id/close', authenticate, (req, res) => transitionDefect(req, res, 'closed'))
  app.post('/api/defects/:id/reopen', authenticate, (req, res) => transitionDefect(req, res, 'reopened'))

  app.get('/api/defects/:id/history', authenticate, (req, res) => {
    const defectId = req.params.id
    const companyId = req.user.company_id || 'default'
    const defect = db.prepare('SELECT id FROM defects WHERE id = ? AND company_id = ?').get(defectId, companyId)
    if (!defect) return sendError(res, 404, API_MESSAGES.defectNotFound)

    const history = db.prepare(`
      SELECT h.id, h.defect_id, h.from_status, h.to_status, h.to_status AS status,
             h.comment, h.created_at AS changed_at, h.created_by AS changed_by,
             u.name AS changed_by_name
      FROM defect_status_history h
      LEFT JOIN users u ON u.id = h.created_by
      WHERE h.defect_id = ? AND h.company_id = ?
      ORDER BY h.created_at DESC, h.id DESC
    `).all(defectId, companyId)
    res.json(history)
  })

  app.put('/api/defects/:id', authenticate, (req, res) => {
    if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'write' })) return

    const { title, comment, severity = 'medium' } = req.body
    const companyId = req.user.company_id || 'default'
    const defect = db.prepare('SELECT id FROM defects WHERE id = ? AND company_id = ?').get(req.params.id, companyId)
    if (!defect) return sendError(res, 404, API_MESSAGES.defectNotFound)
    if (!DEFECT_SEVERITIES.includes(severity)) {
      return res.status(400).json({ error: 'DEFECT_SEVERITY_INVALID', message: 'Неизвестная критичность дефекта' })
    }
    const inspectionId = db.prepare('SELECT inspection_id FROM defects WHERE id = ? AND company_id = ?').get(req.params.id, companyId)?.inspection_id
    if (rejectCompletedInspection(db, res, inspectionId, companyId)) return

    db.prepare('UPDATE defects SET title = ?, comment = ?, severity = ? WHERE id = ? AND company_id = ?')
      .run(title, comment || null, severity, req.params.id, companyId)

    const updatedDefect = db.prepare('SELECT * FROM defects WHERE id = ? AND company_id = ?').get(req.params.id, companyId)
    res.json(updatedDefect)
  })

  app.delete('/api/defects/:id', authenticate, async (req, res) => {
    if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'write' })) return

    const { id } = req.params
    const companyId = req.user.company_id || 'default'
    const defect = db.prepare('SELECT id FROM defects WHERE id = ? AND company_id = ?').get(id, companyId)
    if (!defect) return sendError(res, 404, API_MESSAGES.defectNotFound)
    const inspectionId = db.prepare('SELECT inspection_id FROM defects WHERE id = ? AND company_id = ?').get(id, companyId)?.inspection_id
    if (rejectCompletedInspection(db, res, inspectionId, companyId)) return

    const photos = db.prepare(`SELECT ${PHOTO_SELECT_COLUMNS} FROM photos WHERE defect_id = ? AND company_id = ?`).all(id, companyId)
    db.prepare('DELETE FROM photos WHERE defect_id = ? AND company_id = ?').run(id, companyId)
    db.prepare('DELETE FROM defects WHERE id = ? AND company_id = ?').run(id, companyId)
    await removePhotoFilesForRows(photos)

    res.status(204).send()
  })
}
