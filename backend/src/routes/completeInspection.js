export default function registerCompleteInspectionRoutes({ app, db, API_MESSAGES, getInspectionById, authenticate, photoRequirements, ensureOperationalWriteAllowed = null }) {
  const sendError = (res, status, message) => res.status(status).json({ error: message })

  app.post('/api/inspections/:id/complete', authenticate, async (req, res) => {
    if (ensureOperationalWriteAllowed && !ensureOperationalWriteAllowed(req, res, { mode: 'write' })) return

    const inspectionId = req.params.id
    const companyId = req.user.company_id || 'default'
    const inspection = db.prepare('SELECT * FROM inspections WHERE id = ? AND company_id = ?').get(inspectionId, companyId)

    if (!inspection) {
      return sendError(res, 404, API_MESSAGES.inspectionNotFound)
    }

    if (inspection.completed) {
      return res.json(inspection)
    }

    if ((inspection.type === 'quick' || inspection.type === 'scheduled') && !inspection.odometer_value) {
      return sendError(res, 400, API_MESSAGES?.odometerValueRequired || 'РЈРєР°Р¶РёС‚Рµ РїСЂРѕР±РµРі')
    }

    if (inspection.type === 'accident') {
      if (!inspection.accident_occurred_at) {
        return sendError(res, 400, 'РЈРєР°Р¶РёС‚Рµ РІСЂРµРјСЏ Р”РўРџ')
      }

      if (!inspection.accident_location) {
        return sendError(res, 400, 'РЈРєР°Р¶РёС‚Рµ РјРµСЃС‚Рѕ Р”РўРџ')
      }
    }

    if (photoRequirements && photoRequirements[inspection.type]) {
      const required = photoRequirements[inspection.type].required || []
      const inspectionPhotos = db.prepare(`
        SELECT p.photo_type
        FROM photos p
        WHERE p.inspection_id = ? AND p.company_id = ? AND p.defect_id IS NULL
      `).all(inspectionId, companyId)
      const uploadedPhotoTypes = new Set(inspectionPhotos.map((photo) => photo.photo_type).filter(Boolean))
      const missingPhotos = required.filter((photoType) => !uploadedPhotoTypes.has(photoType))

      if (missingPhotos.length > 0) {
        return res.status(400).json({
          error: API_MESSAGES?.photosRequiredForInspection || 'Загрузите все обязательные фото осмотра',
          missingPhotos,
        })
      }
    }

    if (inspection.type === 'scheduled') {
      const checklistItems = db.prepare('SELECT result FROM checklist_items WHERE inspection_id = ?').all(inspectionId)
      const uncheckedItems = checklistItems.filter((item) => item.result === null || item.result === undefined)

      if (uncheckedItems.length > 0) {
        return sendError(res, 400, 'Р—Р°РїРѕР»РЅРёС‚Рµ РІСЃРµ РїСѓРЅРєС‚С‹ С‡РµРє-Р»РёСЃС‚Р°')
      }
    }

    const defects = db.prepare('SELECT id FROM defects WHERE inspection_id = ?').all(inspectionId)

    for (const defect of defects) {
      const photoCount = db.prepare('SELECT COUNT(*) as count FROM photos WHERE defect_id = ? AND company_id = ?').get(defect.id, companyId)?.count || 0

      if (photoCount <= 0) {
        return sendError(res, 400, API_MESSAGES?.photosRequiredForDefect || 'Рљ РєР°Р¶РґРѕРјСѓ РґРµС„РµРєС‚Сѓ РЅСѓР¶РЅРѕ С„РѕС‚Рѕ')
      }
    }

    db.prepare('UPDATE inspections SET completed = 1 WHERE id = ? AND company_id = ?').run(inspectionId, companyId)
    res.json(getInspectionById(inspectionId, companyId))
  })
}


