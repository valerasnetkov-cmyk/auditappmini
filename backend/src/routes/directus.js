import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import {
  directusRequest,
  isDirectusConfigured,
  listItems,
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

const DIRECTUS_COLLECTIONS = [
  'companies',
  'company_owners',
  'plans',
  'company_limits',
  'saas_metric_snapshots',
]

const LEGACY_SYNC_COLLECTIONS = [
  'accident_cases',
  'damages',
  'photos',
  'fraud_checks',
]

function normalizeText(value) {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'bigint') return String(value)
  return ''
}

function normalizeStatus(value) {
  return value === 'inactive' ? 'inactive' : 'active'
}

function normalizeCompanyId(value) {
  if (!value) return null
  const directValue = normalizeText(value)
  if (directValue) return directValue
  if (typeof value === 'object') {
    const objectId = normalizeText(value.id)
    if (objectId) return objectId
  }
  return null
}

function normalizeNullableInteger(value) {
  if (value === null || value === undefined || value === '') return null
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric < 0) return null
  return Math.floor(numeric)
}

function normalizeNullableBoolean(value) {
  if (value === null || value === undefined || value === '') return null
  if (value === true || value === 1 || value === '1' || value === 'true') return 1
  if (value === false || value === 0 || value === '0' || value === 'false') return 0
  return null
}

function normalizeCompanyPayload(company) {
  const id = normalizeText(company.id)
  const slug = normalizeText(company.slug) || id
  const name = normalizeText(company.name)

  if (!id || !slug || !name) return null

  return {
    id,
    slug,
    name,
    region_code: normalizeText(company.region) || null,
    data_residency: normalizeText(company.country) || null,
    status: normalizeStatus(company.status),
  }
}

function normalizeOwnerPayload(owner) {
  const companyId = normalizeCompanyId(owner.company_id)
  const email = normalizeText(owner.email).toLowerCase()
  const name = normalizeText(owner.name)

  if (!companyId || !email || !name) return null

  return {
    company_id: companyId,
    email,
    name,
    status: normalizeStatus(owner.status),
  }
}

function normalizeCompanyLimitPayload(limit) {
  const companyId = normalizeCompanyId(limit.company_id)
  if (!companyId) return null

  return {
    id: normalizeText(limit.id) || uuidv4(),
    company_id: companyId,
    plan_code: normalizeText(limit.plan_code) || null,
    max_vehicles: normalizeNullableInteger(limit.max_vehicles),
    max_users: normalizeNullableInteger(limit.max_users),
    max_storage_mb: normalizeNullableInteger(limit.max_storage_mb),
    ocr_enabled: normalizeNullableBoolean(limit.ocr_enabled),
    accident_module_enabled: normalizeNullableBoolean(limit.accident_module_enabled),
    analytics_enabled: normalizeNullableBoolean(limit.analytics_enabled),
    api_access_enabled: normalizeNullableBoolean(limit.api_access_enabled),
    updated_at: normalizeText(limit.updated_at) || new Date().toISOString(),
  }
}

function getLocalCompany(db, companyId) {
  return db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId)
}

function upsertLocalCompany(db, company) {
  const existingById = db.prepare('SELECT id FROM companies WHERE id = ?').get(company.id)
  const existingBySlug = db.prepare('SELECT id FROM companies WHERE slug = ?').get(company.slug)

  if (existingBySlug && existingBySlug.id !== company.id) {
    return { action: 'skipped', id: existingBySlug.id, reason: 'slug_conflict' }
  }

  if (existingById) {
    db.prepare(`
      UPDATE companies
      SET slug = ?, name = ?, region_code = ?, data_residency = ?, status = ?
      WHERE id = ?
    `).run(company.slug, company.name, company.region_code, company.data_residency, company.status, company.id)

    return { action: 'updated', id: company.id }
  }

  db.prepare(`
    INSERT INTO companies (id, slug, name, region_code, data_residency, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(company.id, company.slug, company.name, company.region_code, company.data_residency, company.status)

  return { action: 'created', id: company.id }
}

function upsertLocalOwner(db, owner) {
  const existing = db.prepare('SELECT id, role FROM users WHERE email = ?').get(owner.email)
  const passwordHash = bcrypt.hashSync(uuidv4(), 10)

  if (existing?.role === 'admin') {
    return { action: 'skipped', id: existing.id, reason: 'admin_email_conflict', user: null }
  }

  if (existing) {
    db.prepare(`
      UPDATE users
      SET name = ?, role = 'owner', status = ?, company_id = ?
      WHERE id = ?
    `).run(owner.name, owner.status, owner.company_id, existing.id)

    const user = db.prepare('SELECT id, email, name, role, status, company_id FROM users WHERE id = ?').get(existing.id)
    return { action: 'updated', id: existing.id, user }
  }

  const id = uuidv4()
  db.prepare(`
    INSERT INTO users (id, email, password, name, role, status, company_id)
    VALUES (?, ?, ?, ?, 'owner', ?, ?)
  `).run(id, owner.email, passwordHash, owner.name, owner.status, owner.company_id)

  const user = db.prepare('SELECT id, email, name, role, status, company_id FROM users WHERE id = ?').get(id)
  return { action: 'created', id, user }
}

function upsertLocalCompanyLimit(db, limit) {
  const existing = db.prepare('SELECT id FROM company_limits WHERE company_id = ?').get(limit.company_id)

  if (existing) {
    db.prepare(`
      UPDATE company_limits
      SET id = ?,
          plan_code = ?,
          max_vehicles = ?,
          max_users = ?,
          max_storage_mb = ?,
          ocr_enabled = ?,
          accident_module_enabled = ?,
          analytics_enabled = ?,
          api_access_enabled = ?,
          updated_at = ?
      WHERE company_id = ?
    `).run(
      limit.id,
      limit.plan_code,
      limit.max_vehicles,
      limit.max_users,
      limit.max_storage_mb,
      limit.ocr_enabled,
      limit.accident_module_enabled,
      limit.analytics_enabled,
      limit.api_access_enabled,
      limit.updated_at,
      limit.company_id,
    )

    return { action: 'updated', id: limit.id, company_id: limit.company_id }
  }

  db.prepare(`
    INSERT INTO company_limits (
      id,
      company_id,
      plan_code,
      max_vehicles,
      max_users,
      max_storage_mb,
      ocr_enabled,
      accident_module_enabled,
      analytics_enabled,
      api_access_enabled,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    limit.id,
    limit.company_id,
    limit.plan_code,
    limit.max_vehicles,
    limit.max_users,
    limit.max_storage_mb,
    limit.ocr_enabled,
    limit.accident_module_enabled,
    limit.analytics_enabled,
    limit.api_access_enabled,
    limit.updated_at,
  )

  return { action: 'created', id: limit.id, company_id: limit.company_id }
}

async function listOptionalDirectusItems(collection) {
  try {
    return {
      items: await listItems(collection, { limit: -1 }),
      warning: null,
    }
  } catch (error) {
    return {
      items: [],
      warning: `Optional collection ${collection} is not available: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

function deactivateMissingOwners(db, companyIds, activeOwnerEmails) {
  if (!companyIds.size) return 0

  let deactivated = 0
  const owners = db.prepare(`
    SELECT id, email, company_id
    FROM users
    WHERE role = 'owner' AND status = 'active'
  `).all()

  owners.forEach((owner) => {
    if (!companyIds.has(owner.company_id)) return
    if (activeOwnerEmails.has(String(owner.email).toLowerCase())) return

    db.prepare('UPDATE users SET status = ? WHERE id = ?').run('inactive', owner.id)
    deactivated += 1
  })

  return deactivated
}

export async function syncCompaniesAndOwnersFromDirectus(db, { issueSetupLinks, createOwnerSetupInvitation }) {
  const [directusCompanies, directusOwners, directusLimitsResult] = await Promise.all([
    listItems('companies', { limit: -1 }),
    listItems('company_owners', { limit: -1 }),
    listOptionalDirectusItems('company_limits'),
  ])

  const companies = directusCompanies.map(normalizeCompanyPayload).filter(Boolean)
  const owners = directusOwners.map(normalizeOwnerPayload).filter(Boolean)
  const companyLimits = directusLimitsResult.items.map(normalizeCompanyLimitPayload).filter(Boolean)
  const localCompanyIds = new Set()
  const activeOwnerEmails = new Set()
  const companyResults = []
  const ownerResults = []
  const limitResults = []
  const setupLinks = []

  companies.forEach((company) => {
    const result = upsertLocalCompany(db, company)
    companyResults.push({ ...result, source_id: company.id, slug: company.slug })
    if (result.action !== 'skipped') {
      localCompanyIds.add(company.id)
    }
  })

  owners.forEach((owner) => {
    const company = getLocalCompany(db, owner.company_id)
    if (!company) {
      ownerResults.push({ action: 'skipped', email: owner.email, company_id: owner.company_id, reason: 'company_not_found' })
      return
    }

    const result = upsertLocalOwner(db, owner)
    ownerResults.push({
      action: result.action,
      id: result.id,
      email: owner.email,
      company_id: owner.company_id,
      status: owner.status,
      reason: result.reason,
    })

    if (owner.status === 'active' && result.user) {
      activeOwnerEmails.add(owner.email)
      if (result.action === 'created' || issueSetupLinks) {
        setupLinks.push({
          user_id: result.user.id,
          email: result.user.email,
          company_id: result.user.company_id,
          ...createOwnerSetupInvitation(result.user),
        })
      }
    }
  })

  companyLimits.forEach((limit) => {
    const company = getLocalCompany(db, limit.company_id)
    if (!company) {
      limitResults.push({ action: 'skipped', company_id: limit.company_id, reason: 'company_not_found' })
      return
    }

    limitResults.push(upsertLocalCompanyLimit(db, limit))
  })

  const deactivatedMissingOwners = deactivateMissingOwners(db, localCompanyIds, activeOwnerEmails)

  return {
    companies: companyResults,
    owners: ownerResults,
    company_limits: limitResults,
    setup_links: setupLinks,
    deactivated_missing_owners: deactivatedMissingOwners,
    warnings: [directusLimitsResult.warning].filter(Boolean),
  }
}

export default function registerDirectusIntegrationRoutes({ app, db, authenticate, ensureAdmin, sendError, API_MESSAGES, createOwnerSetupInvitation }) {
  app.get('/api/integrations/directus/status', authenticate, (req, res) => {
    if (!ensureAdmin(req, res)) return

    res.json({
      configured: isDirectusConfigured(),
      url: process.env.DIRECTUS_URL || 'http://localhost:8055',
      collections: DIRECTUS_COLLECTIONS,
      legacy_sync_collections: LEGACY_SYNC_COLLECTIONS,
    })
  })

  app.post('/api/integrations/directus/provisioning/sync', authenticate, async (req, res) => {
    if (!ensureAdmin(req, res)) return

    if (!isDirectusConfigured()) {
      return sendError(res, 503, 'Directus is not configured')
    }

    try {
      const result = await syncCompaniesAndOwnersFromDirectus(db, {
        issueSetupLinks: req.body?.issue_setup_links === true,
        createOwnerSetupInvitation,
      })

      res.json({ ok: true, result })
    } catch (error) {
      res.status(502).json({
        ok: false,
        error: error instanceof Error ? error.message : 'Directus provisioning sync failed',
      })
    }
  })

  app.get('/api/integrations/directus/inspections/:id/preview', authenticate, (req, res) => {
    if (!ensureAdmin(req, res)) return

    const aggregate = getInspectionAggregate(db, req.params.id, req.user.company_id || 'default')
    if (!aggregate) {
      return sendError(res, 404, API_MESSAGES.inspectionNotFound)
    }

    res.json(buildDirectusPreview(aggregate))
  })

  app.post('/api/integrations/directus/inspections/:id/sync', authenticate, async (req, res) => {
    if (!ensureAdmin(req, res)) return

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
