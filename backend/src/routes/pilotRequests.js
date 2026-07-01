import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { PILOT_REQUEST_RATE_LIMIT_MAX, PILOT_REQUEST_RATE_LIMIT_WINDOW_MS } from '../config.js'
import { createRateLimiter } from '../services/rateLimiter.js'
import { hasResourcePermission } from '../services/resourcePermissions.js'
import { anonymizeExpiredPilotRequests, PILOT_REQUEST_STATUSES } from '../services/pilotRequests.js'
import { sendTelegramAdminAlert } from '../services/telegramBot.js'
import { slugifyCompanyName, uniqueCompanySlug } from './adminOperations.js'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_PATTERN = /^[+\d][\d\s()-]{6,24}$/
const SOURCE_PATTERN = /^[a-z0-9_.:-]{1,80}$/i
const PREFERRED_PLAN_CODES = new Set(['pilot', 'standard', 'enterprise'])

function text(value, maxLength = 1000) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function nullableText(value, maxLength = 1000) {
  return text(value, maxLength) || null
}

function normalizeEmail(value) {
  return text(value, 254).toLowerCase()
}

function normalizeSource(value) {
  const normalized = text(value, 80)
  return SOURCE_PATTERN.test(normalized) ? normalized : 'landing'
}

function normalizePreferredPlanCode(value) {
  const normalized = text(value, 80).toLowerCase()
  return PREFERRED_PLAN_CODES.has(normalized) ? normalized : 'pilot'
}

function addDaysDate(days, now = new Date()) {
  const date = new Date(now)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function writeAudit(db, req, action, entityId, payload = null, companyId = null) {
  db.prepare(`
    INSERT INTO audit_logs (
      id, company_id, actor_user_id, actor_role, action, entity_type, entity_id, payload_json
    ) VALUES (?, ?, ?, ?, ?, 'pilot_request', ?, ?)
  `).run(
    uuidv4(),
    companyId,
    req.user?.id || null,
    req.user?.role || 'public',
    action,
    entityId,
    payload ? JSON.stringify(payload) : null,
  )
}

function requirePermission(db, permission) {
  return (req, res, next) => {
    if (hasResourcePermission(db, req.user, permission)) return next()
    return res.status(403).json({ error: 'Access denied' })
  }
}

function mapPilotRequest(row) {
  if (!row) return null
  return {
    id: row.id,
    companyName: row.company_name,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    vehicleCount: row.vehicle_count,
    region: row.region,
    preferredPlanCode: row.preferred_plan_code || null,
    comment: row.comment,
    status: row.status,
    assignedUserId: row.assigned_user_id,
    assignedUserName: row.assigned_user_name || null,
    internalComment: row.internal_comment,
    rejectionReason: row.rejection_reason,
    source: row.source,
    utmSource: row.utm_source,
    utmMedium: row.utm_medium,
    utmCampaign: row.utm_campaign,
    utmContent: row.utm_content,
    utmTerm: row.utm_term,
    consentGiven: Boolean(row.consent_given),
    consentAt: row.consent_at,
    linkedCompanyId: row.linked_company_id,
    convertedAt: row.converted_at,
    anonymizedAt: row.anonymized_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function getRequest(db, id) {
  return mapPilotRequest(db.prepare(`
    SELECT request.*, assigned.name AS assigned_user_name
    FROM pilot_requests request
    LEFT JOIN users assigned ON assigned.id = request.assigned_user_id
    WHERE request.id = ?
  `).get(id))
}

function getSummary(db) {
  const rows = db.prepare(`
    SELECT status, COUNT(*) AS count
    FROM pilot_requests
    GROUP BY status
  `).all()
  const summary = { total: 0, new: 0, inProgress: 0, approved: 0, rejected: 0, converted: 0 }
  rows.forEach((row) => {
    const count = Number(row.count || 0)
    summary.total += count
    if (row.status === 'new') summary.new = count
    if (row.status === 'in_progress') summary.inProgress = count
    if (row.status === 'approved') summary.approved = count
    if (row.status === 'rejected') summary.rejected = count
    if (row.status === 'converted') summary.converted = count
  })
  return summary
}

function planLimits(plan, overrides = {}) {
  const numberValue = (value, fallback) => (
    value === null || value === undefined || value === '' ? fallback : Number(value)
  )
  const booleanValue = (value, fallback) => (
    value === null || value === undefined ? Boolean(fallback) : Boolean(value)
  )
  return {
    maxVehicles: numberValue(overrides.maxVehicles, plan.max_vehicles),
    maxUsers: numberValue(overrides.maxUsers, plan.max_users),
    maxInspectionsPerMonth: numberValue(overrides.maxInspectionsPerMonth, plan.max_inspections_per_month),
    maxStorageMb: numberValue(overrides.maxStorageMb, plan.max_storage_mb),
    storageLimitGb: numberValue(overrides.storageLimitGb, plan.storage_limit_gb),
    ocrEnabled: booleanValue(overrides.ocrEnabled, plan.ocr_enabled),
    ocrMonthlyLimit: numberValue(overrides.ocrMonthlyLimit, plan.ocr_monthly_limit),
    accidentModuleEnabled: booleanValue(overrides.accidentModuleEnabled, plan.accident_module_enabled),
    analyticsEnabled: booleanValue(overrides.analyticsEnabled, plan.analytics_enabled),
    pdfReportEnabled: booleanValue(overrides.pdfReportEnabled, plan.pdf_report_enabled),
    exportEnabled: booleanValue(overrides.exportEnabled, plan.export_enabled),
    apiAccessEnabled: booleanValue(overrides.apiAccessEnabled, plan.api_access_enabled),
    customBrandingEnabled: booleanValue(overrides.customBrandingEnabled, plan.custom_branding_enabled),
    regionalStorageEnabled: booleanValue(overrides.regionalStorageEnabled, plan.regional_storage_enabled),
    supportLevel: text(overrides.supportLevel || plan.support_level, 40) || 'basic',
  }
}

export default function registerPilotRequestRoutes({
  app,
  db,
  authenticate,
  createOwnerSetupInvitation,
}) {
  const publicRateLimit = createRateLimiter({
    name: 'pilot-request-ip',
    windowMs: PILOT_REQUEST_RATE_LIMIT_WINDOW_MS,
    max: PILOT_REQUEST_RATE_LIMIT_MAX,
    keyGenerator: (req) => `ip:${req.ip}:POST:/api/public/pilot-requests`,
  })

  app.post('/api/public/pilot-requests', publicRateLimit, (req, res) => {
    if (text(req.body?.website, 200)) {
      return res.status(201).json({ accepted: true })
    }

    const companyName = text(req.body?.companyName, 200)
    const contactName = text(req.body?.contactName, 160)
    const contactEmail = normalizeEmail(req.body?.contactEmail)
    const contactPhone = text(req.body?.contactPhone, 32)
    const vehicleCount = Number(req.body?.vehicleCount)
    const consentGiven = req.body?.consentGiven === true

    if (!companyName || !contactName || !contactEmail || !contactPhone || !Number.isInteger(vehicleCount)) {
      return res.status(400).json({ error: 'Заполните обязательные поля формы' })
    }
    if (!EMAIL_PATTERN.test(contactEmail)) return res.status(400).json({ error: 'Укажите корректный рабочий email' })
    if (!PHONE_PATTERN.test(contactPhone)) return res.status(400).json({ error: 'Укажите корректный телефон' })
    if (vehicleCount < 1 || vehicleCount > 100000) return res.status(400).json({ error: 'Количество техники должно быть от 1 до 100 000' })
    if (!consentGiven) return res.status(400).json({ error: 'Необходимо согласие на обработку данных' })

    const duplicate = db.prepare(`
      SELECT id
      FROM pilot_requests
      WHERE lower(company_name) = lower(?)
        AND lower(contact_email) = lower(?)
        AND created_at >= datetime('now', '-24 hours')
      ORDER BY created_at DESC
      LIMIT 1
    `).get(companyName, contactEmail)
    if (duplicate) return res.status(201).json({ accepted: true })

    const id = uuidv4()
    db.prepare(`
      INSERT INTO pilot_requests (
        id, company_name, contact_name, contact_email, contact_phone, vehicle_count,
        region, preferred_plan_code, comment, status, source, utm_source, utm_medium, utm_campaign,
        utm_content, utm_term, consent_given, consent_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?, ?, 1, datetime('now'))
    `).run(
      id,
      companyName,
      contactName,
      contactEmail,
      contactPhone,
      vehicleCount,
      nullableText(req.body?.region, 160),
      normalizePreferredPlanCode(req.body?.preferredPlanCode || req.body?.planCode),
      nullableText(req.body?.comment, 2000),
      normalizeSource(req.body?.source),
      nullableText(req.body?.utmSource, 160),
      nullableText(req.body?.utmMedium, 160),
      nullableText(req.body?.utmCampaign, 160),
      nullableText(req.body?.utmContent, 160),
      nullableText(req.body?.utmTerm, 160),
    )
    writeAudit(db, req, 'pilot_request.created', id, {
      source: normalizeSource(req.body?.source),
      preferredPlanCode: normalizePreferredPlanCode(req.body?.preferredPlanCode || req.body?.planCode),
    })
    void sendTelegramAdminAlert({
      type: 'pilot_request_created',
      title: 'Новая заявка на пилот',
      message: `Компания: ${companyName}. Статус: новая заявка.`,
      url: '/saas-admin/pilot-requests',
      severity: 'info',
      entityKey: id,
    }).catch((error) => console.warn('[telegram] pilot request alert skipped:', error.message))
    return res.status(201).json({ accepted: true })
  })

  app.get(
    '/api/admin/resource/pilot-requests/summary',
    authenticate,
    requirePermission(db, 'pilot_requests.view'),
    (req, res) => res.json(getSummary(db)),
  )

  app.get(
    '/api/admin/resource/pilot-requests/assignees',
    authenticate,
    requirePermission(db, 'pilot_requests.view'),
    (req, res) => {
      const users = db.prepare(`
        SELECT id, name, email, role
        FROM users
        WHERE role IN ('admin', 'resource_manager') AND status = 'active'
        ORDER BY CASE role WHEN 'admin' THEN 0 ELSE 1 END, name COLLATE NOCASE
      `).all()
      res.json({ users })
    },
  )

  app.get(
    '/api/admin/resource/pilot-requests',
    authenticate,
    requirePermission(db, 'pilot_requests.view'),
    (req, res) => {
      const clauses = []
      const params = []
      const search = text(req.query.search, 200)
      if (search) {
        clauses.push(`(
          request.company_name LIKE ? OR request.contact_name LIKE ?
          OR request.contact_email LIKE ? OR request.contact_phone LIKE ?
        )`)
        const pattern = `%${search}%`
        params.push(pattern, pattern, pattern, pattern)
      }
      if (PILOT_REQUEST_STATUSES.includes(req.query.status)) {
        clauses.push('request.status = ?')
        params.push(req.query.status)
      }
      if (text(req.query.assignedUserId, 80)) {
        clauses.push('request.assigned_user_id = ?')
        params.push(text(req.query.assignedUserId, 80))
      }
      if (req.query.unassigned === 'true') clauses.push('request.assigned_user_id IS NULL')
      if (text(req.query.region, 160)) {
        clauses.push('request.region LIKE ?')
        params.push(`%${text(req.query.region, 160)}%`)
      }
      if (text(req.query.dateFrom, 20)) {
        clauses.push('date(request.created_at) >= date(?)')
        params.push(text(req.query.dateFrom, 20))
      }
      if (text(req.query.dateTo, 20)) {
        clauses.push('date(request.created_at) <= date(?)')
        params.push(text(req.query.dateTo, 20))
      }
      const rows = db.prepare(`
        SELECT request.*, assigned.name AS assigned_user_name
        FROM pilot_requests request
        LEFT JOIN users assigned ON assigned.id = request.assigned_user_id
        ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
        ORDER BY
          CASE request.status
            WHEN 'new' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'approved' THEN 2
            WHEN 'rejected' THEN 3 ELSE 4
          END,
          request.created_at DESC
        LIMIT 500
      `).all(...params)
      res.json({ requests: rows.map(mapPilotRequest), summary: getSummary(db) })
    },
  )

  app.get(
    '/api/admin/resource/pilot-requests/:id',
    authenticate,
    requirePermission(db, 'pilot_requests.view'),
    (req, res) => {
      const request = getRequest(db, req.params.id)
      if (!request) return res.status(404).json({ error: 'Заявка не найдена' })
      res.json(request)
    },
  )

  app.get(
    '/api/admin/resource/pilot-requests/:id/conversion-preview',
    authenticate,
    requirePermission(db, 'pilot_requests.view'),
    requirePermission(db, 'companies.manage'),
    (req, res) => {
      const request = getRequest(db, req.params.id)
      if (!request) return res.status(404).json({ error: 'Заявка не найдена' })
      const preferredPlanCode = normalizePreferredPlanCode(request.preferredPlanCode)
      const plan = db.prepare('SELECT * FROM plans WHERE code = ? AND status = ?').get(preferredPlanCode, 'active')
        || db.prepare('SELECT * FROM plans WHERE code = ? AND status = ?').get('pilot', 'active')
      if (!plan) return res.status(409).json({ error: 'Тариф pilot недоступен' })
      res.json({
        companyName: request.companyName,
        slug: uniqueCompanySlug(db, request.companyName),
        regionCode: request.region || '',
        dataResidency: '',
        ownerName: request.contactName || '',
        ownerEmail: request.contactEmail || '',
        planCode: plan.code,
        limits: planLimits(plan),
      })
    },
  )

  app.put(
    '/api/admin/resource/pilot-requests/:id',
    authenticate,
    requirePermission(db, 'pilot_requests.manage'),
    (req, res) => {
      const existing = getRequest(db, req.params.id)
      if (!existing) return res.status(404).json({ error: 'Заявка не найдена' })
      if (existing.status === 'converted') return res.status(409).json({ error: 'Преобразованную заявку изменять нельзя' })

      const nextStatus = req.body?.status === undefined ? existing.status : req.body.status
      if (!PILOT_REQUEST_STATUSES.includes(nextStatus) || nextStatus === 'converted') {
        return res.status(400).json({ error: 'Некорректный статус заявки' })
      }
      const rejectionReason = req.body?.rejectionReason === undefined
        ? existing.rejectionReason
        : nullableText(req.body.rejectionReason, 1000)
      if (nextStatus === 'rejected' && !rejectionReason) {
        return res.status(400).json({ error: 'Укажите причину отказа' })
      }

      const assignedUserId = req.body?.assignedUserId === undefined
        ? existing.assignedUserId
        : nullableText(req.body.assignedUserId, 80)
      if (assignedUserId && !db.prepare(`
        SELECT id FROM users
        WHERE id = ? AND role IN ('admin', 'resource_manager') AND status = 'active'
      `).get(assignedUserId)) {
        return res.status(400).json({ error: 'Ответственный сотрудник недоступен' })
      }

      const companyName = req.body?.companyName === undefined ? existing.companyName : text(req.body.companyName, 200)
      const contactName = req.body?.contactName === undefined ? existing.contactName : text(req.body.contactName, 160)
      const contactEmail = req.body?.contactEmail === undefined ? existing.contactEmail : normalizeEmail(req.body.contactEmail)
      const contactPhone = req.body?.contactPhone === undefined ? existing.contactPhone : text(req.body.contactPhone, 32)
      const vehicleCount = req.body?.vehicleCount === undefined ? existing.vehicleCount : Number(req.body.vehicleCount)
      if (!companyName || !contactName || !EMAIL_PATTERN.test(contactEmail || '') || !PHONE_PATTERN.test(contactPhone || '')) {
        return res.status(400).json({ error: 'Проверьте название компании и контактные данные' })
      }
      if (!Number.isInteger(vehicleCount) || vehicleCount < 1 || vehicleCount > 100000) {
        return res.status(400).json({ error: 'Количество техники должно быть от 1 до 100 000' })
      }
      const preferredPlanCode = req.body?.preferredPlanCode === undefined
        ? normalizePreferredPlanCode(existing.preferredPlanCode)
        : normalizePreferredPlanCode(req.body.preferredPlanCode)

      db.prepare(`
        UPDATE pilot_requests
        SET company_name = ?, contact_name = ?, contact_email = ?, contact_phone = ?,
            vehicle_count = ?, region = ?, preferred_plan_code = ?, comment = ?, status = ?, assigned_user_id = ?,
            internal_comment = ?, rejection_reason = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(
        companyName,
        contactName,
        contactEmail,
        contactPhone,
        vehicleCount,
        req.body?.region === undefined ? existing.region : nullableText(req.body.region, 160),
        preferredPlanCode,
        req.body?.comment === undefined ? existing.comment : nullableText(req.body.comment, 2000),
        nextStatus,
        assignedUserId,
        req.body?.internalComment === undefined
          ? existing.internalComment
          : nullableText(req.body.internalComment, 4000),
        nextStatus === 'rejected' ? rejectionReason : null,
        existing.id,
      )
      writeAudit(db, req, 'pilot_request.updated', existing.id, {
        statusFrom: existing.status,
        statusTo: nextStatus,
        assignedUserId,
        preferredPlanCode,
      })
      res.json(getRequest(db, existing.id))
    },
  )

  app.post(
    '/api/admin/resource/pilot-requests/:id/anonymize',
    authenticate,
    requirePermission(db, 'pilot_requests.manage'),
    (req, res) => {
      const existing = getRequest(db, req.params.id)
      if (!existing) return res.status(404).json({ error: 'Заявка не найдена' })
      if (existing.status === 'converted') return res.status(409).json({ error: 'Заявка связана с действующей компанией' })
      db.prepare(`
        UPDATE pilot_requests
        SET contact_name = NULL, contact_email = NULL, contact_phone = NULL, comment = NULL,
            anonymized_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).run(existing.id)
      writeAudit(db, req, 'pilot_request.anonymized', existing.id)
      res.json(getRequest(db, existing.id))
    },
  )

  app.post(
    '/api/admin/resource/pilot-requests/:id/convert',
    authenticate,
    requirePermission(db, 'pilot_requests.manage'),
    requirePermission(db, 'companies.manage'),
    (req, res) => {
      const existing = getRequest(db, req.params.id)
      if (!existing) return res.status(404).json({ error: 'Заявка не найдена' })
      if (existing.status === 'converted' || existing.linkedCompanyId) {
        return res.status(409).json({ error: 'Заявка уже преобразована в компанию' })
      }
      if (existing.status !== 'approved') {
        return res.status(409).json({ error: 'Сначала одобрите заявку' })
      }

      const companyName = text(req.body?.companyName || existing.companyName, 200)
      const requestedSlug = text(req.body?.slug, 120)
      const slug = requestedSlug ? slugifyCompanyName(requestedSlug) : uniqueCompanySlug(db, companyName)
      const regionCode = nullableText(req.body?.regionCode || existing.region, 80)
      const ownerName = text(req.body?.ownerName || existing.contactName, 160)
      const ownerEmail = normalizeEmail(req.body?.ownerEmail || existing.contactEmail)
      const planCode = text(req.body?.planCode || 'pilot', 80).toLowerCase()
      if (!companyName || !ownerName || !EMAIL_PATTERN.test(ownerEmail)) {
        return res.status(400).json({ error: 'Проверьте данные компании и владельца' })
      }
      if (!slug) return res.status(400).json({ error: 'Укажите корректный slug' })
      if (requestedSlug && db.prepare('SELECT id FROM companies WHERE slug = ?').get(slug)) {
        return res.status(409).json({ error: 'Slug уже используется' })
      }

      const plan = db.prepare('SELECT * FROM plans WHERE code = ? AND status = ?').get(planCode, 'active')
      if (!plan) return res.status(400).json({ error: 'Выбранный тариф недоступен' })
      const emailConflict = db.prepare('SELECT id FROM users WHERE lower(email) = lower(?)').get(ownerEmail)
      if (emailConflict) return res.status(409).json({ error: 'Email владельца уже используется' })

      const companyId = uuidv4()
      const ownerId = uuidv4()
      const limits = planLimits(plan, req.body?.limits || {})
      const trialPeriodStart = new Date().toISOString().slice(0, 10)
      const trialPeriodEnd = addDaysDate(30)
      let setup = null

      db.exec('BEGIN IMMEDIATE')
      try {
        db.prepare(`
          INSERT INTO companies (id, slug, name, region_code, data_residency, status)
          VALUES (?, ?, ?, ?, ?, 'active')
        `).run(companyId, slug, companyName, regionCode, nullableText(req.body?.dataResidency, 80))
        db.prepare(`
          INSERT INTO company_limits (
            id, company_id, plan_code, max_vehicles, max_users, max_inspections_per_month,
            max_storage_mb, storage_limit_gb, ocr_enabled, ocr_monthly_limit,
            accident_module_enabled, analytics_enabled, pdf_report_enabled, export_enabled, api_access_enabled,
            custom_branding_enabled, regional_storage_enabled, support_level, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `).run(
          uuidv4(), companyId, planCode, limits.maxVehicles, limits.maxUsers,
          limits.maxInspectionsPerMonth, limits.maxStorageMb, limits.storageLimitGb,
          limits.ocrEnabled ? 1 : 0, limits.ocrMonthlyLimit,
          limits.accidentModuleEnabled ? 1 : 0, limits.analyticsEnabled ? 1 : 0,
          limits.pdfReportEnabled ? 1 : 0,
          limits.exportEnabled ? 1 : 0, limits.apiAccessEnabled ? 1 : 0,
          limits.customBrandingEnabled ? 1 : 0, limits.regionalStorageEnabled ? 1 : 0,
          limits.supportLevel,
        )
        db.prepare(`
          INSERT INTO company_billing (
            id, company_id, plan_code, billing_status, trial_until,
            created_by_user_id, created_at, updated_at
          ) VALUES (?, ?, ?, 'trial', ?, ?, datetime('now'), datetime('now'))
        `).run(uuidv4(), companyId, planCode, trialPeriodEnd, req.user.id)
        db.prepare(`
          INSERT INTO company_subscriptions (
            id, company_id, plan_code, status, current_period_start, current_period_end,
            grace_until, mrr_rub, auto_suspend_enabled, created_at, updated_at
          ) VALUES (?, ?, ?, 'trial', ?, ?, NULL, 0, 0, datetime('now'), datetime('now'))
        `).run(uuidv4(), companyId, planCode, trialPeriodStart, trialPeriodEnd)
        db.prepare(`
          INSERT INTO users (id, email, password, name, role, status, company_id)
          VALUES (?, ?, ?, ?, 'owner', 'active', ?)
        `).run(ownerId, ownerEmail, bcrypt.hashSync(uuidv4(), 10), ownerName, companyId)
        setup = createOwnerSetupInvitation({ id: ownerId })
        db.prepare(`
          UPDATE pilot_requests
          SET status = 'converted', linked_company_id = ?, converted_at = datetime('now'),
              updated_at = datetime('now')
          WHERE id = ?
        `).run(companyId, existing.id)
        writeAudit(db, req, 'pilot_request.converted', existing.id, {
          companyId,
          planCode,
          ownerId,
          trialDays: 30,
          trialUntil: trialPeriodEnd,
        }, companyId)
        db.exec('COMMIT')
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }

      void sendTelegramAdminAlert({
        type: 'company_created',
        title: 'Компания создана',
        message: companyName,
        url: `/saas-admin/companies/${encodeURIComponent(companyId)}`,
        severity: 'info',
        entityKey: companyId,
      }).catch((error) => console.warn('[telegram] company conversion alert skipped:', error.message))

      res.status(201).json({
        request: getRequest(db, existing.id),
        company: { id: companyId, slug, name: companyName, planCode },
        owner: { id: ownerId, name: ownerName, email: ownerEmail },
        setup,
      })
    },
  )

  app.post(
    '/api/admin/resource/pilot-requests/anonymize-expired',
    authenticate,
    requirePermission(db, 'pilot_requests.manage'),
    (req, res) => {
      const result = anonymizeExpiredPilotRequests(db)
      writeAudit(db, req, 'pilot_request.retention_run', 'retention', result)
      res.json(result)
    },
  )
}
