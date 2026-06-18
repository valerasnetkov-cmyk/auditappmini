export default function registerCompleteInspectionRoutes({
  app,
  db,
  API_MESSAGES,
  getInspectionById,
  authenticate,
  inspectionReadiness,
  ensureOperationalWriteAllowed = null,
}) {
  app.post('/api/inspections/:id/complete', authenticate, (req, res) => {
    if (ensureOperationalWriteAllowed && !ensureOperationalWriteAllowed(req, res, { mode: 'write' })) return

    const inspectionId = req.params.id
    const companyId = req.user.company_id || 'default'
    const inspection = getInspectionById(inspectionId, companyId)

    if (!inspection) {
      return res.status(404).json({ error: API_MESSAGES.inspectionNotFound })
    }

    if (inspection.completed) {
      return res.json(inspection)
    }

    const readiness = inspectionReadiness.getReadiness(inspectionId, companyId)
    if (!readiness?.ready) {
      return res.status(400).json({
        error: 'INSPECTION_COMPLETION_BLOCKED',
        message: 'Осмотр нельзя завершить: не хватает обязательных данных',
        missing: readiness?.missing || [],
      })
    }

    const completedAt = new Date().toISOString()
    db.prepare(`
      UPDATE inspections
      SET completed = 1, completed_at = ?
      WHERE id = ? AND company_id = ?
    `).run(completedAt, inspectionId, companyId)

    if (inspection.type === 'scheduled') {
      db.prepare(`
        UPDATE vehicles
        SET last_scheduled_inspection = ?
        WHERE id = ? AND company_id = ?
      `).run(completedAt, inspection.vehicle_id, companyId)
    }

    res.json(getInspectionById(inspectionId, companyId))
  })
}
