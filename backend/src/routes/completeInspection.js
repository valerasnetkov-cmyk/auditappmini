export default function registerCompleteInspectionRoutes({ app, db, API_MESSAGES, getInspectionById, authenticate, photoRequirements }) {
  const sendError = (res, status, message) => res.status(status).json({ error: message })

  app.post('/api/inspections/:id/complete', authenticate, async (req, res) => {
    const inspectionId = req.params.id
    const inspection = db.prepare('SELECT * FROM inspections WHERE id = ?').get(inspectionId)

    if (!inspection) {
      return sendError(res, 404, API_MESSAGES.inspectionNotFound)
    }

    if (inspection.completed) {
      return res.json(inspection)
    }

    if ((inspection.type === 'quick' || inspection.type === 'scheduled') && !inspection.odometer_value) {
      return sendError(res, 400, API_MESSAGES?.odometerValueRequired || 'Укажите пробег')
    }

    if (inspection.type === 'accident') {
      if (!inspection.accident_occurred_at) {
        return sendError(res, 400, 'Укажите время ДТП')
      }

      if (!inspection.accident_location) {
        return sendError(res, 400, 'Укажите место ДТП')
      }
    }

    if (photoRequirements && photoRequirements[inspection.type]) {
      const required = photoRequirements[inspection.type].required || []
      const inspectionPhotos = db.prepare(`
        SELECT p.*, d.title as defect_title
        FROM photos p
        LEFT JOIN defects d ON p.defect_id = d.id
        WHERE p.inspection_id = ?
      `).all(inspectionId)

      if (required.length > 0 && inspectionPhotos.length === 0) {
        return sendError(res, 400, API_MESSAGES?.photosRequiredForDefect || 'Загрузите обязательные фото')
      }
    }

    if (inspection.type === 'scheduled') {
      const checklistItems = db.prepare('SELECT result FROM checklist_items WHERE inspection_id = ?').all(inspectionId)
      const uncheckedItems = checklistItems.filter((item) => item.result === null || item.result === undefined)

      if (uncheckedItems.length > 0) {
        return sendError(res, 400, 'Заполните все пункты чек-листа')
      }
    }

    const defects = db.prepare('SELECT id FROM defects WHERE inspection_id = ?').all(inspectionId)

    for (const defect of defects) {
      const photoCount = db.prepare('SELECT COUNT(*) as count FROM photos WHERE defect_id = ?').get(defect.id)?.count || 0

      if (photoCount <= 0) {
        return sendError(res, 400, API_MESSAGES?.photosRequiredForDefect || 'К каждому дефекту нужно фото')
      }
    }

    db.prepare('UPDATE inspections SET completed = 1 WHERE id = ?').run(inspectionId)
    res.json(getInspectionById(inspectionId))
  })
}
