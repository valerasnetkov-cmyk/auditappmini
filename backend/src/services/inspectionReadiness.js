export const CHECKLIST_REQUIREMENTS = {
  quick: [
    'Внешний вид',
    'Повреждения кузова',
    'Колёса',
    'Стёкла',
    'Госномер',
  ],
  scheduled: [
    'Внешний вид',
    'Повреждения кузова',
    'Лакокрасочное покрытие',
    'Стёкла',
    'Фары',
    'Зеркала',
    'Двери',
    'Госномер',
    'Нет видимых повреждений подвески',
    'Нет течей амортизаторов',
    'Шины без критичных повреждений',
    'Нет видимых подтёков',
    'Тормозные шланги без повреждений',
    'Стояночный тормоз работает',
    'Аккумулятор без повреждений',
    'Проводка без повреждений',
    'Приборная панель без ошибок',
    'Ближний свет',
    'Дальний свет',
    'Габариты',
    'Стоп-сигналы',
    'Поворотники',
  ],
  accident: [
    'Повреждения кузова',
    'Остекление',
    'Ходовая',
    'Кузов',
    'Безопасность',
  ],
}

function normalizeTitle(value) {
  return String(value || '').trim().toLocaleLowerCase('ru-RU').replaceAll('ё', 'е')
}

function missing(code, field, label) {
  return { code, field, label }
}

export function createInspectionReadinessService({ db, photoRequirements, photoTypeLabels }) {
  function getReadiness(inspectionId, companyId) {
    const inspection = db.prepare(`
      SELECT i.*, v.number AS vehicle_number, v.name AS vehicle_name
      FROM inspections i
      JOIN vehicles v ON v.id = i.vehicle_id
      WHERE i.id = ? AND i.company_id = ?
    `).get(inspectionId, companyId)

    if (!inspection) return null

    const missingItems = []
    const requiredPhotos = photoRequirements[inspection.type]?.required || []
    const uploadedPhotos = db.prepare(`
      SELECT photo_type
      FROM photos
      WHERE inspection_id = ?
        AND company_id = ?
        AND defect_id IS NULL
        AND COALESCE(upload_status, 'uploaded') = 'uploaded'
    `).all(inspectionId, companyId)
    const uploadedPhotoTypes = new Set(uploadedPhotos.map((photo) => photo.photo_type).filter(Boolean))

    requiredPhotos.forEach((photoType) => {
      if (!uploadedPhotoTypes.has(photoType)) {
        missingItems.push(missing(
          'missing_required_photo',
          photoType,
          photoTypeLabels.ru[photoType] || photoType,
        ))
      }
    })

    const checklistItems = db.prepare(`
      SELECT id, title, result
      FROM checklist_items
      WHERE inspection_id = ?
    `).all(inspectionId)
    const checklistByTitle = new Map(checklistItems.map((item) => [normalizeTitle(item.title), item]))
    const requiredChecklistTitles = new Set(
      (CHECKLIST_REQUIREMENTS[inspection.type] || []).map(normalizeTitle),
    )

    ;(CHECKLIST_REQUIREMENTS[inspection.type] || []).forEach((title) => {
      const item = checklistByTitle.get(normalizeTitle(title))
      if (!item || item.result === null || item.result === undefined) {
        missingItems.push(missing('missing_checklist_result', normalizeTitle(title), title))
      }
    })
    checklistItems.forEach((item) => {
      if (
        (item.result === null || item.result === undefined)
        && !requiredChecklistTitles.has(normalizeTitle(item.title))
      ) {
        missingItems.push(missing('missing_checklist_result', item.id, item.title))
      }
    })

    const failedItems = checklistItems.filter((item) => Number(item.result) === 0)
    const defects = db.prepare(`
      SELECT id, checklist_item_id, title
      FROM defects
      WHERE inspection_id = ? AND company_id = ?
    `).all(inspectionId, companyId)
    const defectByChecklistId = new Map(defects.map((defect) => [defect.checklist_item_id, defect]))

    failedItems.forEach((item) => {
      if (!defectByChecklistId.has(item.id)) {
        missingItems.push(missing('missing_defect', item.id, `Дефект: ${item.title}`))
      }
    })

    defects.forEach((defect) => {
      const photoCount = db.prepare(`
        SELECT COUNT(*) AS count
        FROM photos
        WHERE defect_id = ?
          AND company_id = ?
          AND COALESCE(upload_status, 'uploaded') = 'uploaded'
      `).get(defect.id, companyId)?.count || 0
      if (photoCount === 0) {
        missingItems.push(missing('missing_defect_photo', defect.id, `Фото дефекта: ${defect.title}`))
      }
    })

    if (inspection.type === 'quick' || inspection.type === 'scheduled') {
      if (inspection.odometer_value === null || inspection.odometer_value === undefined) {
        missingItems.push(missing('missing_odometer_value', 'odometer_value', 'Пробег'))
      }
      if (!inspection.odometer_confirmed_at) {
        missingItems.push(missing('missing_odometer_confirmation', 'odometer_confirmed_at', 'Подтверждение пробега'))
      }
    }

    if (inspection.type === 'accident') {
      if (!inspection.accident_occurred_at) {
        missingItems.push(missing('missing_accident_time', 'accident_occurred_at', 'Дата и время ДТП'))
      }
      if (!inspection.accident_location) {
        missingItems.push(missing('missing_accident_location', 'accident_location', 'Место ДТП'))
      }
      const hasConfirmedOdometer = inspection.odometer_value !== null
        && inspection.odometer_value !== undefined
        && Boolean(inspection.odometer_confirmed_at)
        && uploadedPhotoTypes.has('odometer')
      if (!hasConfirmedOdometer && !String(inspection.odometer_unavailable_reason || '').trim()) {
        missingItems.push(missing(
          'missing_odometer_or_reason',
          'odometer_unavailable_reason',
          'Пробег с фото или причина недоступности одометра',
        ))
      }
    }

    return {
      inspectionId,
      inspectionType: inspection.type,
      completed: Boolean(inspection.completed),
      ready: missingItems.length === 0,
      missing: missingItems,
    }
  }

  return { getReadiness }
}

export function sendInspectionCompletedError(res) {
  return res.status(409).json({
    error: 'INSPECTION_ALREADY_COMPLETED',
    message: 'Завершённый осмотр нельзя изменять',
  })
}
