import { v4 as uuidv4 } from 'uuid'

const REVIEW_STATUSES = new Set(['approved', 'rejected', 'revision_required'])
const RESUBMIT_STATUSES = new Set(['draft', 'rejected', 'revision_required'])

function normalizeComment(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export default function registerInspectionApprovalRoutes({
  app,
  db,
  authenticate,
  ensureManager,
  ensureCompanyOperationalWriteAllowed,
}) {
  function getInspection(inspectionId, companyId) {
    return db.prepare(`
      SELECT i.*, v.number AS vehicle_number, v.name AS vehicle_name
      FROM inspections i
      JOIN vehicles v ON v.id = i.vehicle_id
      WHERE i.id = ? AND i.company_id = ?
    `).get(inspectionId, companyId)
  }

  function getHistory(inspectionId, companyId) {
    return db.prepare(`
      SELECT h.*, u.name AS created_by_name, u.role AS created_by_role
      FROM inspection_approval_history h
      LEFT JOIN users u ON u.id = h.created_by
      WHERE h.inspection_id = ? AND h.company_id = ?
      ORDER BY h.created_at ASC, h.id ASC
    `).all(inspectionId, companyId)
  }

  function writeHistory({ companyId, inspectionId, fromStatus, toStatus, comment, userId, createdAt }) {
    db.prepare(`
      INSERT INTO inspection_approval_history (
        id, company_id, inspection_id, from_status, to_status, comment, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), companyId, inspectionId, fromStatus, toStatus, comment || null, userId, createdAt)
  }

  function createNotification({
    companyId,
    recipientUserId = null,
    recipientRole = null,
    type,
    title,
    message,
    createdBy,
  }) {
    db.prepare(`
      INSERT INTO company_notifications (
        id, company_id, recipient_user_id, recipient_role, type, channel,
        title, message, status, created_by_user_id, source, created_at
      ) VALUES (?, ?, ?, ?, ?, 'in_app', ?, ?, 'new', ?, 'inspection_approval', datetime('now'))
    `).run(
      uuidv4(),
      companyId,
      recipientUserId,
      recipientRole,
      type,
      title,
      message,
      createdBy,
    )
  }

  app.get('/api/inspections/:id/approval', authenticate, (req, res) => {
    const companyId = req.user.company_id || 'default'
    const inspection = getInspection(req.params.id, companyId)
    if (!inspection) return res.status(404).json({ error: 'Inspection not found' })

    res.json({
      status: inspection.approval_status || 'draft',
      submitted_at: inspection.submitted_at,
      submitted_by: inspection.submitted_by,
      reviewed_at: inspection.reviewed_at,
      reviewed_by: inspection.reviewed_by,
      comment: inspection.approval_comment,
      history: getHistory(req.params.id, companyId),
    })
  })

  app.post('/api/inspections/:id/submit', authenticate, (req, res) => {
    if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'write' })) return
    const companyId = req.user.company_id || 'default'
    const inspection = getInspection(req.params.id, companyId)
    if (!inspection) return res.status(404).json({ error: 'Inspection not found' })
    if (!inspection.completed) {
      return res.status(400).json({
        error: 'INSPECTION_NOT_COMPLETED',
        message: 'На согласование можно отправить только завершённый осмотр',
      })
    }
    if (
      req.user.role === 'inspector'
      && inspection.inspector_id !== req.user.id
    ) {
      return res.status(403).json({
        error: 'INSPECTION_SUBMIT_FORBIDDEN',
        message: 'Инспектор может отправить только собственный осмотр',
      })
    }
    const currentStatus = inspection.approval_status || 'draft'
    if (!RESUBMIT_STATUSES.has(currentStatus)) {
      return res.status(409).json({
        error: 'INSPECTION_APPROVAL_INVALID_TRANSITION',
        message: 'Осмотр уже отправлен или согласован',
      })
    }

    const comment = normalizeComment(req.body?.comment)
    const submittedAt = new Date().toISOString()
    const transition = db.transaction(() => {
      db.prepare(`
        UPDATE inspections
        SET approval_status = 'submitted', submitted_at = ?, submitted_by = ?,
            reviewed_at = NULL, reviewed_by = NULL, approval_comment = ?
        WHERE id = ? AND company_id = ?
      `).run(submittedAt, req.user.id, comment || null, inspection.id, companyId)
      writeHistory({
        companyId,
        inspectionId: inspection.id,
        fromStatus: currentStatus,
        toStatus: 'submitted',
        comment,
        userId: req.user.id,
        createdAt: submittedAt,
      })
      for (const role of ['manager', 'owner']) {
        createNotification({
          companyId,
          recipientRole: role,
          type: 'inspection_submitted',
          title: 'Осмотр отправлен на согласование',
          message: `${inspection.vehicle_number}: завершённый осмотр ожидает решения`,
          createdBy: req.user.id,
        })
      }
    })
    transition()

    res.json({
      status: 'submitted',
      submitted_at: submittedAt,
      submitted_by: req.user.id,
      reviewed_at: null,
      reviewed_by: null,
      comment: comment || null,
      history: getHistory(inspection.id, companyId),
    })
  })

  app.post('/api/inspections/:id/approval', authenticate, (req, res) => {
    if (!ensureManager(req, res)) return
    if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'write' })) return
    const companyId = req.user.company_id || 'default'
    const inspection = getInspection(req.params.id, companyId)
    if (!inspection) return res.status(404).json({ error: 'Inspection not found' })

    const status = String(req.body?.status || '')
    const comment = normalizeComment(req.body?.comment)
    if (!REVIEW_STATUSES.has(status)) {
      return res.status(400).json({
        error: 'INSPECTION_APPROVAL_STATUS_INVALID',
        message: 'Недопустимый статус согласования',
      })
    }
    if (status !== 'approved' && !comment) {
      return res.status(400).json({
        error: 'INSPECTION_APPROVAL_COMMENT_REQUIRED',
        message: 'Для отказа или возврата укажите причину',
      })
    }
    if ((inspection.approval_status || 'draft') !== 'submitted') {
      return res.status(409).json({
        error: 'INSPECTION_APPROVAL_INVALID_TRANSITION',
        message: 'Решение возможно только для осмотра на согласовании',
      })
    }

    const reviewedAt = new Date().toISOString()
    const transition = db.transaction(() => {
      db.prepare(`
        UPDATE inspections
        SET approval_status = ?, reviewed_at = ?, reviewed_by = ?, approval_comment = ?
        WHERE id = ? AND company_id = ?
      `).run(status, reviewedAt, req.user.id, comment || null, inspection.id, companyId)
      writeHistory({
        companyId,
        inspectionId: inspection.id,
        fromStatus: 'submitted',
        toStatus: status,
        comment,
        userId: req.user.id,
        createdAt: reviewedAt,
      })
      createNotification({
        companyId,
        recipientUserId: inspection.inspector_id,
        type: `inspection_${status}`,
        title: status === 'approved'
          ? 'Осмотр согласован'
          : status === 'rejected'
            ? 'Осмотр отклонён'
            : 'Осмотр требует повторной фиксации',
        message: comment || `${inspection.vehicle_number}: решение по осмотру принято`,
        createdBy: req.user.id,
      })
    })
    transition()

    res.json({
      status,
      submitted_at: inspection.submitted_at,
      submitted_by: inspection.submitted_by,
      reviewed_at: reviewedAt,
      reviewed_by: req.user.id,
      comment: comment || null,
      history: getHistory(inspection.id, companyId),
    })
  })
}
