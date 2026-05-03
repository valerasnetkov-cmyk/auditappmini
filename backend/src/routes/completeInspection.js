// Unified complete-inspection route logic extracted as a separate module
export default function registerCompleteInspectionRoutes({ app, db, API_MESSAGES, getInspectionById, authenticate, photoRequirements }) {
  const sendError = (res, status, message) => res.status(status).json({ error: message })

  // POST /api/inspections/:id/complete - complete inspection with photo validation
  app.post('/api/inspections/:id/complete', authenticate, async (req, res) => {
    const inspectionId = req.params.id

    // Inspection exists?
    const inspection = db.prepare('SELECT * FROM inspections WHERE id = ?').get(inspectionId)
    if (!inspection) {
      return sendError(res, 404, API_MESSAGES.inspectionNotFound)
    }

    // Already completed?
    if (inspection.completed) {
      return res.json(inspection)
    }

    // VALIDATION 1: Check odometer for quick and scheduled inspections
    if (inspection.type === 'quick' || inspection.type === 'scheduled') {
      if (!inspection.odometer_value) {
        return sendError(res, 400, API_MESSAGES?.odometerValueRequired || 'Укажите пробег')
      }
    }

    // VALIDATION 2: Check accident details for accident inspections
    if (inspection.type === 'accident') {
      if (!inspection.accident_occurred_at) {
        return sendError(res, 400, 'Укажите время ДТП')
      }
      if (!inspection.accident_location) {
        return sendError(res, 400, 'Укажите место ДТП')
      }
    }

    // VALIDATION 3: Check required photos by type
    if (photoRequirements && photoRequirements[inspection.type]) {
      const required = photoRequirements[inspection.type].required || []
      const inspectionPhotos = db.prepare(`
        SELECT p.*, d.title as defect_title 
        FROM photos p 
        LEFT JOIN defects d ON p.defect_id = d.id 
        WHERE p.inspection_id = ?
      `).all(inspectionId)
      
      // Check if we have at least one required photo type
      // In MVP, just check total photo count; in full version, check photo types
      if (required.length > 0 && inspectionPhotos.length === 0) {
        return sendError(res, 400, API_MESSAGES?.photosRequiredForDefect || 'Загрузите обязательные фото')
      }
    }

    // VALIDATION 4: For scheduled inspections, verify checklist is complete
    if (inspection.type === 'scheduled') {
      const checklistItems = db.prepare('SELECT result FROM checklist_items WHERE inspection_id = ?').all(inspectionId)
      const uncheckedItems = checklistItems.filter(item => !item.result)
      if (uncheckedItems.length > 0) {
        return sendError(res, 400, 'Заполните все пункты чек-листа')
      }
    }

    // Get defects for this inspection
    const defects = db.prepare('SELECT id FROM defects WHERE inspection_id = ?').all(inspectionId)

    // If there are defects, each must have at least one photo
    if (defects && defects.length > 0) {
      // For scheduled inspections, verify technical sections are filled
      if (inspection.type === 'scheduled') {
        // Check that all required technical sections are covered
        // (This would require checklist_items validation)
      }

      // Each defect must have at least one photo
      for (const d of defects) {
        const photoCount = db.prepare('SELECT COUNT(*) as c FROM photos WHERE defect_id = ?').get(d.id)?.c || 0
        if (photoCount <= 0) {
          return sendError(res, 400, API_MESSAGES?.photosRequiredForDefect || 'К каждому дефекту нужно фото')
        }
      }

      // At least one photo across all defects
      const totalPhotos = defects.reduce((acc, d) => acc + (db.prepare('SELECT COUNT(*) as c FROM photos WHERE defect_id = ?').get(d.id)?.c || 0), 0)
      if (totalPhotos <= 0) {
        return sendError(res, 400, API_MESSAGES?.photosRequiredForDefect || 'Загрузите фото дефектов')
      }
    }

    // Mark as completed
    db.prepare('UPDATE inspections SET completed = 1 WHERE id = ?').run(inspectionId)
    res.json(getInspectionById(inspectionId))
  })
}
