import { v4 as uuidv4 } from 'uuid'
import { hasResourcePermission } from '../services/resourcePermissions.js'
import {
  getSubscriptionAlertsSummary,
  scanSubscriptionAlerts as runSubscriptionAlertScan,
} from '../services/subscriptionAlerts.js'
import {
  buildPaymentPayload,
  getExpiringSubscriptions,
  getPayments,
  getPaymentSummary,
  mapPayment,
  recalculateCompanySubscription,
} from '../services/resourceBilling.js'
import {
  buildLimitPayload,
  buildPlanPayload,
  buildPlanUpdatePayload,
  getPlan,
  getPlans,
  mapPlan,
  upsertCompanyLimits,
} from '../services/resourcePlans.js'
import {
  deactivateOwner,
  findUserByEmail,
  getOwner,
  mapOwner,
  saveCompanyOwner,
  updateOwner,
} from '../services/resourceOwners.js'
import {
  getCompanies,
  getCompany,
  hasCompanyOperationalData,
} from '../services/resourceCompanies.js'
import {
  getNotification,
  getResourceAlerts,
  markNotificationRead,
} from '../services/resourceActivity.js'
import {
  buildResourceAdminStats,
  buildResourceCompanyDetails,
} from '../services/resourceAdminStats.js'
import { generateWatermarkedPhoto } from '../services/photoUpload.js'
import { buildPhotoWatermarkLines } from '../utils/photoWatermark.js'
import { uniqueCompanySlug } from './adminOperations.js'

export { buildResourceAdminStats, buildSaasAdminStats } from '../services/resourceAdminStats.js'

function toNumber(value) {
  return Number(value || 0)
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeIdentifier(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizeStatus(value) {
  return value === 'inactive' ? 'inactive' : 'active'
}

function addDaysDate(days, now = new Date()) {
  const date = new Date(now)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function count(db, sql, params = []) {
  const row = db.prepare(sql).get(...params)
  return toNumber(row?.count)
}

function sendCompanyNotFound(res, sendError) {
  return sendError(res, 404, 'Company not found')
}

function writeAuditLog(db, req, { companyId = null, action, entityType, entityId, payload = null }) {
  db.prepare(`
    INSERT INTO audit_logs (id, company_id, actor_user_id, actor_role, action, entity_type, entity_id, payload_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    uuidv4(),
    companyId,
    req.user?.id || null,
    req.user?.role || null,
    action,
    entityType,
    entityId,
    payload ? JSON.stringify(payload) : null,
  )
}

export function scanSubscriptionAlerts(db, { actorUserId = null, actorRole = 'system' } = {}) {
  return runSubscriptionAlertScan(db, {
    actorUserId,
    actorRole,
  })
}

export default function registerSaasAdminRoutes({ app, db, authenticate, ensureAdmin, sendError, API_MESSAGES, createOwnerSetupInvitation }) {
  function requireAdmin(req, res) {
    if (req.user?.role === 'admin') return true
    const path = req.path
    const method = req.method
    let permission = 'dashboard.view'
    if (path.includes('/payments')) permission = method === 'GET' ? 'payments.view' : 'payments.manage'
    else if (path.includes('/alerts')) permission = method === 'GET' ? 'notifications.view' : 'notifications.manage'
    else if (path.includes('/plans')) permission = method === 'GET' ? 'plans.view' : 'plans.manage'
    else if (path.includes('/companies') || path.includes('/owners')) permission = method === 'GET' ? 'companies.view' : 'companies.manage'
    if (hasResourcePermission(db, req.user, permission)) return true
    return ensureAdmin(req, res)
  }

  app.get(['/api/admin/resource/stats', '/api/admin/saas/stats'], authenticate, (req, res) => {
    if (!requireAdmin(req, res)) return

    try {
      const stats = buildResourceAdminStats(db)
      if (req.user?.role !== 'admin' && !hasResourcePermission(db, req.user, 'payments.view')) {
        delete stats.billing
        delete stats.recent_payments
        delete stats.expiring_subscriptions
        stats.companies = stats.companies.map(({ billing: _billing, ...company }) => company)
      }
      res.json(stats)
    } catch (error) {
      console.error('Resource admin stats error:', error)
      sendError(res, 500, API_MESSAGES.internalServerError)
    }
  })

  app.get('/api/admin/resource/companies', authenticate, (req, res) => {
    if (!requireAdmin(req, res)) return
    res.json(getCompanies(db))
  })

  app.get(['/api/admin/resource/companies/:id', '/api/admin/saas/companies/:id'], authenticate, (req, res) => {
    if (!requireAdmin(req, res)) return
    const details = buildResourceCompanyDetails(db, req.params.id)
    if (!details) return sendCompanyNotFound(res, sendError)
    if (req.user?.role !== 'admin' && !hasResourcePermission(db, req.user, 'payments.view')) {
      details.payments = []
      delete details.company.billing
    }
    if (req.user?.role !== 'admin' && !hasResourcePermission(db, req.user, 'notifications.view')) {
      details.alerts = []
    }
    res.json(details)
  })

  app.post('/api/admin/resource/companies/:id/photos/:photoId/watermark', authenticate, async (req, res) => {
    if (!requireAdmin(req, res)) return
    const photo = db.prepare(`
      SELECT p.*, c.name AS company_name, i.type AS inspection_type,
             v.number AS vehicle_number, v.name AS vehicle_name,
             d.title AS defect_title
      FROM photos p
      JOIN companies c ON c.id = p.company_id
      LEFT JOIN inspections i ON i.id = p.inspection_id AND i.company_id = p.company_id
      LEFT JOIN vehicles v ON v.id = i.vehicle_id AND v.company_id = p.company_id
      LEFT JOIN defects d ON d.id = p.defect_id AND d.company_id = p.company_id
      WHERE p.company_id = ? AND p.id = ?
    `).get(req.params.id, req.params.photoId)

    if (!photo) return sendError(res, 404, 'Photo not found')

    try {
      const watermarkUrl = await generateWatermarkedPhoto({
        photo,
        lines: buildPhotoWatermarkLines({
          photo,
          companyName: photo.company_name,
          vehicleNumber: photo.vehicle_number,
          inspection: {
            id: photo.inspection_id,
            type: photo.inspection_type,
          },
        }),
      })
      const generatedAt = new Date().toISOString()
      db.prepare(`
        UPDATE photos
        SET watermark_url = ?, watermark_generated_at = ?
        WHERE id = ? AND company_id = ?
      `).run(watermarkUrl, generatedAt, photo.id, photo.company_id)

      res.json({
        ...photo,
        watermark_url: watermarkUrl,
        watermark_generated_at: generatedAt,
      })
    } catch (error) {
      console.error('[resource-admin] failed to watermark photo:', error)
      sendError(res, 500, 'Не удалось сформировать фото с водяным знаком')
    }
  })

  app.get(['/api/admin/resource/alerts', '/api/admin/saas/alerts'], authenticate, (req, res) => {
    if (!requireAdmin(req, res)) return
    res.json({
      alerts: getResourceAlerts(db, { limit: 200 }),
      summary: getSubscriptionAlertsSummary(db),
      expiringSubscriptions: getExpiringSubscriptions(db, { limit: 100 }),
    })
  })

  app.post(['/api/admin/resource/alerts/scan', '/api/admin/saas/alerts/scan'], authenticate, (req, res) => {
    if (!requireAdmin(req, res)) return
    const result = scanSubscriptionAlerts(db, {
      actorUserId: req.user?.id || null,
      actorRole: req.user?.role || 'admin',
    })
    res.json({
      result,
      alerts: getResourceAlerts(db, { limit: 200 }),
      summary: getSubscriptionAlertsSummary(db),
      expiringSubscriptions: getExpiringSubscriptions(db, { limit: 100 }),
    })
  })

  app.post(['/api/admin/resource/alerts/:id/read', '/api/admin/saas/alerts/:id/read'], authenticate, (req, res) => {
    if (!requireAdmin(req, res)) return

    const alert = getNotification(db, req.params.id)
    if (!alert) return sendError(res, 404, 'Alert not found')

    res.json(markNotificationRead(db, alert.id))
  })

  app.get(['/api/admin/resource/payments', '/api/admin/saas/payments'], authenticate, (req, res) => {
    if (!requireAdmin(req, res)) return
    res.json({
      payments: getPayments(db, { limit: 200 }),
      expiringSubscriptions: getExpiringSubscriptions(db, { limit: 100 }),
      summary: getPaymentSummary(db),
      companies: getCompanies(db),
      plans: getPlans(db),
    })
  })

  app.post(['/api/admin/resource/payments', '/api/admin/saas/payments'], authenticate, (req, res) => {
    if (!requireAdmin(req, res)) return

    const payload = buildPaymentPayload(req.body)
    if (!payload.companyId || !payload.planCode || !payload.amount || !payload.periodStart || !payload.periodEnd) {
      return sendError(res, 400, 'Company, plan, amount and payment period are required')
    }

    const company = getCompany(db, payload.companyId)
    if (!company) return sendCompanyNotFound(res, sendError)

    const plan = getPlan(db, payload.planCode)
    if (!plan) return sendError(res, 404, 'Plan not found')

    if (payload.periodEnd < payload.periodStart) {
      return sendError(res, 400, 'Payment period end must be after period start')
    }

    const id = uuidv4()
    db.prepare(`
      INSERT INTO company_payments (
        id, company_id, plan_code, amount, currency, payment_date, period_start, period_end,
        payment_method, document_number, comment, status, created_by, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, datetime('now'), datetime('now'))
    `).run(
      id,
      payload.companyId,
      payload.planCode,
      payload.amount,
      payload.currency,
      payload.paymentDate,
      payload.periodStart,
      payload.periodEnd,
      payload.paymentMethod,
      payload.documentNumber,
      payload.comment,
      req.user?.id || null,
    )

    const subscription = recalculateCompanySubscription(db, payload.companyId)
    writeAuditLog(db, req, {
      companyId: payload.companyId,
      action: 'payment_added',
      entityType: 'company_payment',
      entityId: id,
      payload,
    })

    const payment = getPayments(db, { limit: 1 }).find((item) => item.id === id) || mapPayment(db.prepare('SELECT * FROM company_payments WHERE id = ?').get(id))
    res.status(201).json({ payment, subscription })
  })

  app.post(['/api/admin/resource/payments/:id/cancel', '/api/admin/saas/payments/:id/cancel'], authenticate, (req, res) => {
    if (!requireAdmin(req, res)) return

    const payment = db.prepare('SELECT * FROM company_payments WHERE id = ?').get(req.params.id)
    if (!payment) return sendError(res, 404, 'Payment not found')
    if (payment.status === 'cancelled') return res.json({ payment: mapPayment(payment), subscription: recalculateCompanySubscription(db, payment.company_id) })

    db.prepare(`
      UPDATE company_payments
      SET status = 'cancelled', comment = COALESCE(NULLIF(?, ''), comment), updated_at = datetime('now')
      WHERE id = ?
    `).run(normalizeText(req.body?.comment), payment.id)

    const subscription = recalculateCompanySubscription(db, payment.company_id)
    writeAuditLog(db, req, {
      companyId: payment.company_id,
      action: 'payment_cancelled',
      entityType: 'company_payment',
      entityId: payment.id,
      payload: { reason: normalizeText(req.body?.comment) || null },
    })

    res.json({ payment: mapPayment(db.prepare('SELECT * FROM company_payments WHERE id = ?').get(payment.id)), subscription })
  })

  app.post('/api/admin/resource/companies', authenticate, (req, res) => {
    if (!requireAdmin(req, res)) return

    const name = normalizeText(req.body?.name)
    const slug = normalizeIdentifier(req.body?.slug) || uniqueCompanySlug(db, name)
    const id = normalizeIdentifier(req.body?.id || slug)

    if (!id || !slug || !name) {
      return sendError(res, 400, 'Company id, slug and name are required')
    }

    const exists = db.prepare('SELECT id FROM companies WHERE id = ? OR slug = ?').get(id, slug)
    if (exists) {
      return sendError(res, 409, 'Company already exists')
    }

    db.prepare(`
      INSERT INTO companies (id, slug, name, region_code, data_residency, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id,
      slug,
      name,
      normalizeText(req.body?.region_code) || null,
      normalizeText(req.body?.data_residency) || null,
      normalizeStatus(req.body?.status),
    )

    upsertCompanyLimits(db, id, buildLimitPayload(req.body?.limits || { planCode: 'pilot' }))
    const trialPeriodStart = new Date().toISOString().slice(0, 10)
    const trialPeriodEnd = addDaysDate(30)
    db.prepare(`
      INSERT OR IGNORE INTO company_billing (
        id, company_id, plan_code, billing_status, trial_until, created_by_user_id, created_at, updated_at
      ) VALUES (?, ?, ?, 'trial', ?, ?, datetime('now'), datetime('now'))
    `).run(uuidv4(), id, req.body?.limits?.planCode || 'pilot', trialPeriodEnd, req.user.id)
    db.prepare(`
      INSERT OR IGNORE INTO company_subscriptions (
        id, company_id, plan_code, status, current_period_start, current_period_end,
        grace_until, mrr_rub, auto_suspend_enabled, created_at, updated_at
      ) VALUES (?, ?, ?, 'trial', ?, ?, NULL, 0, 0, datetime('now'), datetime('now'))
    `).run(uuidv4(), id, req.body?.limits?.planCode || 'pilot', trialPeriodStart, trialPeriodEnd)

    writeAuditLog(db, req, {
      companyId: id,
      action: 'company_created',
      entityType: 'company',
      entityId: id,
      payload: { slug, name, trialDays: 30, trialUntil: trialPeriodEnd },
    })

    res.status(201).json(getCompany(db, id))
  })

  app.put('/api/admin/resource/companies/:id', authenticate, (req, res) => {
    if (!requireAdmin(req, res)) return

    const existing = getCompany(db, req.params.id)
    if (!existing) return sendCompanyNotFound(res, sendError)
    if (
      existing.access_mode === 'demo_readonly'
      && (
        (req.body?.slug !== undefined && normalizeIdentifier(req.body.slug) !== existing.slug)
        || (req.body?.name !== undefined && normalizeText(req.body.name) !== existing.name)
        || (req.body?.status !== undefined && normalizeStatus(req.body.status) !== existing.status)
      )
    ) {
      return sendError(res, 409, 'Public demo identity and status are managed by provisioning')
    }

    const slug = req.body?.slug === undefined ? existing.slug : normalizeIdentifier(req.body.slug)
    const name = req.body?.name === undefined ? existing.name : normalizeText(req.body.name)
    if (req.user?.role !== 'admin' && slug !== existing.slug) {
      return sendError(res, 403, 'Only the main resource administrator can change company slug')
    }

    if (!slug || !name) {
      return sendError(res, 400, 'Company slug and name are required')
    }

    const duplicate = db.prepare('SELECT id FROM companies WHERE slug = ? AND id != ?').get(slug, existing.id)
    if (duplicate) {
      return sendError(res, 409, 'Company slug already exists')
    }

    db.prepare(`
      UPDATE companies
      SET slug = ?, name = ?, region_code = ?, data_residency = ?, status = ?
      WHERE id = ?
    `).run(
      slug,
      name,
      req.body?.region_code === undefined ? existing.region_code : (normalizeText(req.body.region_code) || null),
      req.body?.data_residency === undefined ? existing.data_residency : (normalizeText(req.body.data_residency) || null),
      req.body?.status === undefined ? existing.status : normalizeStatus(req.body.status),
      existing.id,
    )

    writeAuditLog(db, req, {
      companyId: existing.id,
      action: 'company_updated',
      entityType: 'company',
      entityId: existing.id,
      payload: {
        slug,
        name,
        status: req.body?.status === undefined ? existing.status : normalizeStatus(req.body.status),
      },
    })

    res.json(getCompany(db, existing.id))
  })

  app.delete('/api/admin/resource/companies/:id', authenticate, (req, res) => {
    if (!requireAdmin(req, res)) return

    const existing = getCompany(db, req.params.id)
    if (!existing) return sendCompanyNotFound(res, sendError)
    if (existing.access_mode === 'demo_readonly') {
      return sendError(res, 409, 'Public demo company cannot be deleted')
    }

    if (hasCompanyOperationalData(db, existing.id)) {
      return sendError(res, 409, 'Company contains tenant data; set status inactive instead of deleting')
    }

    db.prepare('DELETE FROM company_limits WHERE company_id = ?').run(existing.id)
    db.prepare('DELETE FROM company_billing_events WHERE company_id = ?').run(existing.id)
    db.prepare('DELETE FROM company_billing WHERE company_id = ?').run(existing.id)
    writeAuditLog(db, req, {
      companyId: existing.id,
      action: 'company_deleted',
      entityType: 'company',
      entityId: existing.id,
      payload: { slug: existing.slug, name: existing.name },
    })
    db.prepare('DELETE FROM companies WHERE id = ?').run(existing.id)
    res.status(204).send()
  })

  app.post('/api/admin/resource/companies/:id/owners', authenticate, (req, res) => {
    if (!requireAdmin(req, res)) return

    const company = getCompany(db, req.params.id)
    if (!company) return sendCompanyNotFound(res, sendError)

    const email = normalizeText(req.body?.email).toLowerCase()
    const name = normalizeText(req.body?.name)
    if (!email || !name) {
      return sendError(res, 400, 'Owner email and name are required')
    }

    const existing = findUserByEmail(db, email)
    if (existing && (existing.role !== 'owner' || existing.company_id !== company.id)) {
      return sendError(res, 409, 'Email is already used outside this company owner role')
    }

    const owner = saveCompanyOwner(db, {
      existing,
      companyId: company.id,
      email,
      name,
      status: normalizeStatus(req.body?.status),
    })

    let setup = null
    if (req.body?.issue_setup_link !== false && createOwnerSetupInvitation) {
      setup = createOwnerSetupInvitation(owner)
    }

    writeAuditLog(db, req, {
      companyId: company.id,
      action: existing ? 'owner_updated' : 'owner_created',
      entityType: 'user',
      entityId: owner.id,
      payload: { email, name },
    })

    res.status(existing ? 200 : 201).json({ ...mapOwner(owner), setup })
  })

  app.put('/api/admin/resource/owners/:id', authenticate, (req, res) => {
    if (!requireAdmin(req, res)) return

    const owner = getOwner(db, req.params.id)
    if (!owner) return sendError(res, 404, 'Owner not found')

    const email = normalizeText(req.body?.email || owner.email).toLowerCase()
    const duplicate = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, owner.id)
    if (duplicate) {
      return sendError(res, 409, 'Email is already used')
    }

    const updatedOwner = updateOwner(db, owner, {
      email,
      name: normalizeText(req.body?.name || owner.name),
      status: req.body?.status === undefined ? owner.status : normalizeStatus(req.body.status),
    })

    writeAuditLog(db, req, {
      companyId: owner.company_id,
      action: 'owner_updated',
      entityType: 'user',
      entityId: owner.id,
      payload: { email, name: normalizeText(req.body?.name || owner.name) },
    })

    res.json(mapOwner(updatedOwner))
  })

  app.post('/api/admin/resource/owners/:id/setup-link', authenticate, (req, res) => {
    if (!requireAdmin(req, res)) return

    const owner = getOwner(db, req.params.id)
    if (!owner) return sendError(res, 404, 'Owner not found')
    if ((owner.status || 'active') === 'inactive') return sendError(res, 409, 'Inactive owner cannot receive setup link')
    if (!createOwnerSetupInvitation) return sendError(res, 500, 'Owner setup invitations are not configured')

    const setup = createOwnerSetupInvitation(owner)
    const updatedOwner = getOwner(db, owner.id)

    writeAuditLog(db, req, {
      companyId: owner.company_id,
      action: 'owner_setup_link_issued',
      entityType: 'user',
      entityId: owner.id,
      payload: { email: owner.email, expiresAt: setup.expires_at },
    })

    res.json({ ...mapOwner(updatedOwner), setup })
  })

  app.delete('/api/admin/resource/owners/:id', authenticate, (req, res) => {
    if (!requireAdmin(req, res)) return

    const owner = getOwner(db, req.params.id)
    if (!owner) return sendError(res, 404, 'Owner not found')

    deactivateOwner(db, owner.id)
    writeAuditLog(db, req, {
      companyId: owner.company_id,
      action: 'owner_deactivated',
      entityType: 'user',
      entityId: owner.id,
    })
    res.status(204).send()
  })

  app.put('/api/admin/resource/companies/:id/limits', authenticate, (req, res) => {
    if (!requireAdmin(req, res)) return

    const company = getCompany(db, req.params.id)
    if (!company) return sendCompanyNotFound(res, sendError)

    const payload = buildLimitPayload(req.body || {})
    if (payload.planCode && !getPlan(db, payload.planCode)) {
      return sendError(res, 400, 'Plan does not exist')
    }

    const limits = upsertCompanyLimits(db, company.id, payload)
    writeAuditLog(db, req, {
      companyId: company.id,
      action: 'company_limits_updated',
      entityType: 'company_limits',
      entityId: company.id,
      payload: limits,
    })
    res.json(limits)
  })

  app.get('/api/admin/resource/plans', authenticate, (req, res) => {
    if (!requireAdmin(req, res)) return
    res.json(getPlans(db))
  })

  app.post('/api/admin/resource/plans', authenticate, (req, res) => {
    if (!requireAdmin(req, res)) return

    const payload = buildPlanPayload(req.body || {})
    if (!payload.code || !payload.name) {
      return sendError(res, 400, 'Plan code and name are required')
    }

    if (getPlan(db, payload.code)) {
      return sendError(res, 409, 'Plan already exists')
    }

    db.prepare(`
      INSERT INTO plans (
        code, name, max_vehicles, max_users, max_storage_mb, ocr_enabled,
        accident_module_enabled, analytics_enabled, pdf_report_enabled, api_access_enabled, monthly_price_rub, status, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      payload.code,
      payload.name,
      payload.maxVehicles,
      payload.maxUsers,
      payload.maxStorageMb,
      payload.ocrEnabled === null ? null : (payload.ocrEnabled ? 1 : 0),
      payload.accidentModuleEnabled === null ? null : (payload.accidentModuleEnabled ? 1 : 0),
      payload.analyticsEnabled === null ? null : (payload.analyticsEnabled ? 1 : 0),
      payload.pdfReportEnabled === null ? null : (payload.pdfReportEnabled ? 1 : 0),
      payload.apiAccessEnabled === null ? null : (payload.apiAccessEnabled ? 1 : 0),
      payload.monthlyPriceRub,
      payload.status,
    )

    writeAuditLog(db, req, {
      action: 'plan_created',
      entityType: 'plan',
      entityId: payload.code,
      payload,
    })

    res.status(201).json(mapPlan(getPlan(db, payload.code)))
  })

  app.put('/api/admin/resource/plans/:code', authenticate, (req, res) => {
    if (!requireAdmin(req, res)) return

    const existing = getPlan(db, req.params.code)
    if (!existing) return sendError(res, 404, 'Plan not found')

    const payload = buildPlanUpdatePayload(existing, req.body || {})
    if (!payload.name) {
      return sendError(res, 400, 'Plan name is required')
    }

    db.prepare(`
      UPDATE plans
      SET name = ?, max_vehicles = ?, max_users = ?, max_storage_mb = ?, ocr_enabled = ?,
        accident_module_enabled = ?, analytics_enabled = ?, pdf_report_enabled = ?, api_access_enabled = ?, monthly_price_rub = ?, status = ?, updated_at = datetime('now')
      WHERE code = ?
    `).run(
      payload.name,
      payload.maxVehicles,
      payload.maxUsers,
      payload.maxStorageMb,
      payload.ocrEnabled === null ? null : (payload.ocrEnabled ? 1 : 0),
      payload.accidentModuleEnabled === null ? null : (payload.accidentModuleEnabled ? 1 : 0),
      payload.analyticsEnabled === null ? null : (payload.analyticsEnabled ? 1 : 0),
      payload.pdfReportEnabled === null ? null : (payload.pdfReportEnabled ? 1 : 0),
      payload.apiAccessEnabled === null ? null : (payload.apiAccessEnabled ? 1 : 0),
      payload.monthlyPriceRub,
      payload.status,
      existing.code,
    )

    writeAuditLog(db, req, {
      action: 'plan_updated',
      entityType: 'plan',
      entityId: existing.code,
      payload,
    })

    res.json(mapPlan(getPlan(db, existing.code)))
  })

  app.delete('/api/admin/resource/plans/:code', authenticate, (req, res) => {
    if (!requireAdmin(req, res)) return

    const existing = getPlan(db, req.params.code)
    if (!existing) return sendError(res, 404, 'Plan not found')

    const used = count(db, 'SELECT COUNT(*) as count FROM company_limits WHERE plan_code = ?', [existing.code])
    if (used > 0) {
      return sendError(res, 409, 'Plan is used by company limits')
    }

    db.prepare('DELETE FROM plans WHERE code = ?').run(existing.code)
    writeAuditLog(db, req, {
      action: 'plan_deleted',
      entityType: 'plan',
      entityId: existing.code,
      payload: { name: existing.name },
    })
    res.status(204).send()
  })
}
