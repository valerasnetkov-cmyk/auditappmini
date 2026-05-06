import {
  directusRequest,
  isDirectusConfigured,
  upsertAccidentCaseByCaseNumber,
  upsertDamageBySourceDefectId,
  upsertPhotoMetadataBySourcePhotoId,
} from '../services/directus.js'

function parseJson(value) {
  if (!value) return null
  if (typeof value !== 'string') return value

  try {
    return JSON.parse(value)
  } catch {
    return { raw: value }
  }
}

function splitDateTime(value) {
  if (!value || typeof value !== 'string') {
    return { date: null, time: null }
  }

  const normalized = value.trim()
  if (!normalized) {
    return { date: null, time: null }
  }

  const date = normalized.slice(0, 10)
  const timeMatch = normalized.match(/T?(\d{2}:\d{2}(?::\d{2})?)/)

  return {
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    time: timeMatch?.[1] || null,
  }
}

function getInspectionAggregate(db, inspectionId, companyId) {
  const inspection = db.prepare(`
    SELECT i.*, v.number as vehicle_number, v.name as vehicle_name, v.region as vehicle_region,
           v.company_id as vehicle_company_id, u.name as inspector_name
    FROM inspections i
    JOIN vehicles v ON i.vehicle_id = v.id
    JOIN users u ON i.inspector_id = u.id
    WHERE i.id = ? AND i.company_id = ?
  `).get(inspectionId, companyId)

  if (!inspection) {
    return null
  }

  const checklist = db.prepare('SELECT * FROM checklist_items WHERE inspection_id = ? ORDER BY title ASC').all(inspectionId)
  const defects = db.prepare('SELECT * FROM defects WHERE inspection_id = ? ORDER BY created_at ASC').all(inspectionId)
  const photos = db.prepare('SELECT * FROM photos WHERE inspection_id = ? ORDER BY created_at ASC').all(inspectionId)

  return { inspection, checklist, defects, photos }
}

function buildAccidentCasePayload(inspection) {
  const accidentDateTime = splitDateTime(inspection.accident_occurred_at)
  const directusCompanyId = process.env.DIRECTUS_DEFAULT_COMPANY_ID || null
  const payload = {
    case_number: `inspection-${inspection.id}`,
    source_inspection_id: inspection.id,
    accident_date: accidentDateTime.date,
    accident_time: accidentDateTime.time,
    accident_address: inspection.accident_location || null,
    accident_type: inspection.type,
    status: inspection.completed ? 'submitted' : 'draft',
    comment: [
      `source=auditappmini`,
      `inspection_id=${inspection.id}`,
      `vehicle_number=${inspection.vehicle_number}`,
      `vehicle_name=${inspection.vehicle_name}`,
      `inspector=${inspection.inspector_name}`,
    ].join('\n'),
    created_at: inspection.created_at || null,
  }

  if (directusCompanyId) {
    payload.company_id = directusCompanyId
  }

  return payload
}

function buildDamagePayload(defect, accidentCaseId) {
  return {
    accident_case_id: accidentCaseId,
    source_inspection_id: defect.inspection_id,
    source_defect_id: defect.id,
    vehicle_zone: defect.title,
    description: defect.comment || defect.title,
    severity: 'medium',
    created_at: defect.created_at || null,
  }
}

function buildPhotoPayload(photo, accidentCaseId, damageId = null) {
  return {
    accident_case_id: accidentCaseId,
    damage_id: damageId,
    source_inspection_id: photo.inspection_id,
    source_defect_id: photo.defect_id || null,
    source_photo_id: photo.id,
    type: photo.is_required ? 'required' : 'defect',
    url: photo.url,
    geo: parseJson(photo.geo),
    server_time: photo.created_at || null,
    created_at: photo.created_at || null,
  }
}

function buildDirectusPreview(aggregate) {
  const { inspection, checklist, defects, photos } = aggregate

  return {
    configured: isDirectusConfigured(),
    accident_case: buildAccidentCasePayload(inspection),
    checklist_items: checklist.map((item) => ({
      title: item.title,
      result: item.result === null || item.result === undefined ? null : Boolean(item.result),
      comment: item.comment || null,
    })),
    damages: defects.map((defect) => buildDamagePayload(defect, '<directus_accident_case_id>')),
    photos: photos.map((photo) => buildPhotoPayload(photo, '<directus_accident_case_id>')),
    source: {
      inspection_id: inspection.id,
      inspection_type: inspection.type,
      vehicle_id: inspection.vehicle_id,
      vehicle_number: inspection.vehicle_number,
      vehicle_name: inspection.vehicle_name,
      vehicle_region: inspection.vehicle_region,
      inspector_name: inspection.inspector_name,
    },
  }
}

async function syncInspectionToDirectus(aggregate) {
  const preview = buildDirectusPreview(aggregate)
  const accidentCaseResult = await upsertAccidentCaseByCaseNumber(preview.accident_case)
  const accidentCase = accidentCaseResult.data
  const accidentCaseId = accidentCase?.id

  if (!accidentCaseId) {
    throw new Error('Directus did not return accident case id')
  }

  const damageResults = []
  const photoResults = []

  for (const defect of aggregate.defects) {
    const damageResult = await upsertDamageBySourceDefectId(buildDamagePayload(defect, accidentCaseId))
    const damage = damageResult.data
    damageResults.push({
      action: damageResult.action,
      data: damage,
    })

    const defectPhotos = aggregate.photos.filter((photo) => photo.defect_id === defect.id)
    for (const photo of defectPhotos) {
      const photoResult = await upsertPhotoMetadataBySourcePhotoId(buildPhotoPayload(photo, accidentCaseId, damage?.id || null))
      photoResults.push({
        action: photoResult.action,
        data: photoResult.data,
      })
    }
  }

  const standalonePhotos = aggregate.photos.filter((photo) => !photo.defect_id)
  for (const photo of standalonePhotos) {
    const photoResult = await upsertPhotoMetadataBySourcePhotoId(buildPhotoPayload(photo, accidentCaseId))
    photoResults.push({
      action: photoResult.action,
      data: photoResult.data,
    })
  }

  return {
    accident_case_action: accidentCaseResult.action,
    child_sync_strategy: 'upsert_by_source_id',
    accident_case: accidentCase,
    damages: damageResults,
    photos: photoResults,
  }
}

export default function registerDirectusIntegrationRoutes({ app, db, authenticate, ensureManager, sendError, API_MESSAGES }) {
  app.get('/api/integrations/directus/status', authenticate, (req, res) => {
    res.json({
      configured: isDirectusConfigured(),
      url: process.env.DIRECTUS_URL || 'http://localhost:8055',
      collections: [
        'companies',
        'vehicles',
        'accident_cases',
        'accident_participants',
        'damages',
        'photos',
        'odometer_recognitions',
        'plate_recognitions',
        'fraud_checks',
      ],
    })
  })

  app.get('/api/integrations/directus/inspections/:id/preview', authenticate, (req, res) => {
    if (!ensureManager(req, res)) return

    const aggregate = getInspectionAggregate(db, req.params.id, req.user.company_id || 'default')
    if (!aggregate) {
      return sendError(res, 404, API_MESSAGES.inspectionNotFound)
    }

    res.json(buildDirectusPreview(aggregate))
  })

  app.post('/api/integrations/directus/inspections/:id/sync', authenticate, async (req, res) => {
    if (!ensureManager(req, res)) return

    if (!isDirectusConfigured()) {
      return sendError(res, 503, 'Directus is not configured')
    }

    const aggregate = getInspectionAggregate(db, req.params.id, req.user.company_id || 'default')
    if (!aggregate) {
      return sendError(res, 404, API_MESSAGES.inspectionNotFound)
    }

    try {
      const directusHealth = await directusRequest('/server/health')
      const result = await syncInspectionToDirectus(aggregate)
      res.json({ ok: true, directus_health: directusHealth, result })
    } catch (error) {
      res.status(502).json({
        ok: false,
        error: error instanceof Error ? error.message : 'Directus sync failed',
      })
    }
  })
}
