import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { hasResourcePermission } from '../services/resourcePermissions.js'
import { uniqueCompanySlug } from './adminOperations.js'

function toNumber(value) {
  return Number(value || 0)
}

function toNullableNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toNullableBoolean(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'boolean') return value
  return Boolean(Number(value))
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

function normalizePlanStatus(value) {
  return value === 'archived' ? 'archived' : 'active'
}

function normalizePaymentStatus(value) {
  return value === 'cancelled' ? 'cancelled' : 'active'
}

function normalizeSubscriptionStatus(value) {
  return ['active', 'expiring', 'grace', 'expired', 'suspended'].includes(value) ? value : 'active'
}

function normalizeCurrency(value) {
  return normalizeText(value || 'RUB').toUpperCase() || 'RUB'
}

function normalizeDate(value, fallback = null) {
  const text = normalizeText(value)
  if (!text) return fallback
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return fallback
  return date.toISOString().slice(0, 10)
}

function parseJson(value) {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function count(db, sql, params = []) {
  const row = db.prepare(sql).get(...params)
  return toNumber(row?.count)
}

function getUsagePercent(current, limit) {
  const max = toNullableNumber(limit)
  if (!max || max <= 0) return null
  return Math.min(999, Math.round((toNumber(current) / max) * 100))
}

function getLimitRiskLevel(vehiclePercent, userPercent) {
  const maxPercent = Math.max(vehiclePercent || 0, userPercent || 0)
  if (maxPercent >= 100) return 'blocked'
  if (maxPercent >= 80) return 'upsell'
  if (maxPercent >= 60) return 'watch'
  return 'ok'
}

function getCompanyHealthStatus(row) {
  if (row.status === 'inactive') return 'inactive'
  if (!toNumber(row.owners) || !row.plan_code) return 'attention'
  if (!row.max_vehicles && !row.max_users) return 'attention'
  return 'ok'
}

function isOlderThan(dateValue, days) {
  if (!dateValue) return true
  const timestamp = Date.parse(dateValue)
  if (Number.isNaN(timestamp)) return true
  return Date.now() - timestamp > days * 24 * 60 * 60 * 1000
}

function getActivityDropPercent(current, previous) {
  const previousValue = toNumber(previous)
  if (!previousValue) return null
  return Math.max(0, Math.round(((previousValue - toNumber(current)) / previousValue) * 100))
}

function getDaysUntil(value) {
  if (!value) return null
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return null
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  return Math.ceil((date.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
}

function calculateMrrRub(amount, periodStart, periodEnd) {
  const value = toNumber(amount)
  if (!value) return 0
  const start = new Date(`${periodStart}T00:00:00Z`)
  const end = new Date(`${periodEnd}T00:00:00Z`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return value
  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)))
  const months = Math.max(1, days / 30)
  return Math.round(value / months)
}

function createDateBuckets(days = 30) {
  const buckets = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(today)
    date.setDate(today.getDate() - index)
    buckets.push(date.toISOString().slice(0, 10))
  }

  return buckets
}

function rowsToDateMap(rows, field = 'count') {
  return rows.reduce((acc, row) => {
    acc[row.date] = toNumber(row[field])
    return acc
  }, {})
}

function mapLimit(row) {
  if (!row) return null

  return {
    planCode: row.plan_code || null,
    maxVehicles: toNullableNumber(row.max_vehicles),
    maxUsers: toNullableNumber(row.max_users),
    maxStorageMb: toNullableNumber(row.max_storage_mb),
    ocrEnabled: toNullableBoolean(row.ocr_enabled),
    accidentModuleEnabled: toNullableBoolean(row.accident_module_enabled),
    analyticsEnabled: toNullableBoolean(row.analytics_enabled),
    apiAccessEnabled: toNullableBoolean(row.api_access_enabled),
    updatedAt: row.updated_at || null,
  }
}

function mapPlan(row) {
  return {
    code: row.code,
    name: row.name,
    status: row.status || 'active',
    monthlyPriceRub: toNumber(row.monthly_price_rub),
    limits: {
      maxVehicles: toNullableNumber(row.max_vehicles),
      maxUsers: toNullableNumber(row.max_users),
      maxStorageMb: toNullableNumber(row.max_storage_mb),
    },
    features: {
      ocrEnabled: toNullableBoolean(row.ocr_enabled),
      accidentModuleEnabled: toNullableBoolean(row.accident_module_enabled),
      analyticsEnabled: toNullableBoolean(row.analytics_enabled),
      apiAccessEnabled: toNullableBoolean(row.api_access_enabled),
    },
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }
}

function mapSubscription(row) {
  if (!row?.subscription_id) return null

  return {
    id: row.subscription_id,
    companyId: row.id || row.company_id,
    planCode: row.subscription_plan_code || row.plan_code || null,
    status: normalizeSubscriptionStatus(row.subscription_status),
    currentPeriodStart: row.current_period_start || null,
    currentPeriodEnd: row.current_period_end || null,
    graceUntil: row.grace_until || null,
    lastPaymentId: row.last_payment_id || null,
    mrrRub: toNumber(row.mrr_rub),
    autoSuspendEnabled: Boolean(toNumber(row.auto_suspend_enabled)),
    daysUntilEnd: getDaysUntil(row.current_period_end),
  }
}

function mapPayment(row) {
  return {
    id: row.id,
    companyId: row.company_id,
    companyName: row.company_name || null,
    planCode: row.plan_code || null,
    amount: toNumber(row.amount),
    currency: row.currency || 'RUB',
    paymentDate: row.payment_date || null,
    periodStart: row.period_start || null,
    periodEnd: row.period_end || null,
    paymentMethod: row.payment_method || null,
    documentNumber: row.document_number || null,
    comment: row.comment || null,
    status: normalizePaymentStatus(row.status),
    createdBy: row.created_by || null,
    createdByName: row.created_by_name || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }
}

function mapNotification(row) {
  return {
    id: row.id,
    companyId: row.company_id || null,
    companyName: row.company_name || null,
    recipientUserId: row.recipient_user_id || null,
    recipientRole: row.recipient_role || null,
    type: row.type,
    channel: row.channel || 'in_app',
    title: row.title,
    message: row.message || null,
    status: row.status || 'new',
    sentAt: row.sent_at || null,
    readAt: row.read_at || null,
    createdAt: row.created_at || null,
  }
}

function mapAuditLog(row) {
  return {
    id: row.id,
    companyId: row.company_id || null,
    actorUserId: row.actor_user_id || null,
    actorName: row.actor_name || null,
    actorEmail: row.actor_email || null,
    actorRole: row.actor_role || null,
    action: row.action,
    entityType: row.entity_type || null,
    entityId: row.entity_id || null,
    payload: parseJson(row.payload_json),
    createdAt: row.created_at || null,
  }
}

function getPlans(db) {
  return db.prepare(`
    SELECT code, name, max_vehicles, max_users, max_storage_mb, monthly_price_rub, ocr_enabled,
      accident_module_enabled, analytics_enabled, api_access_enabled, status, created_at, updated_at
    FROM plans
    ORDER BY name COLLATE NOCASE ASC
  `).all().map(mapPlan)
}

function getOwnersByCompany(db) {
  const rows = db.prepare(`
    SELECT id, email, name, role, status, company_id, created_at, last_login_at,
      owner_setup_issued_at, owner_setup_expires_at, owner_setup_accepted_at
    FROM users
    WHERE role = 'owner'
    ORDER BY name COLLATE NOCASE ASC, email COLLATE NOCASE ASC
  `).all()

  return rows.reduce((acc, owner) => {
    const companyId = owner.company_id || 'default'
    if (!acc[companyId]) acc[companyId] = []
    acc[companyId].push(mapOwner(owner))
    return acc
  }, {})
}

function getOwnerSetupStatus(owner) {
  if (owner.owner_setup_accepted_at || owner.last_login_at) return 'accepted'
  if (!owner.owner_setup_issued_at) return 'not_sent'

  const expiresAt = owner.owner_setup_expires_at ? new Date(owner.owner_setup_expires_at) : null
  if (expiresAt && Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() < Date.now()) {
    return 'expired'
  }

  return 'pending'
}

function mapOwner(owner) {
  const companyId = owner.company_id || 'default'
  return {
    id: owner.id,
    email: owner.email,
    name: owner.name,
    role: owner.role,
    status: owner.status || 'active',
    company_id: companyId,
    created_at: owner.created_at || null,
    last_login_at: owner.last_login_at || null,
    setup: {
      status: getOwnerSetupStatus(owner),
      issued_at: owner.owner_setup_issued_at || null,
      expires_at: owner.owner_setup_expires_at || null,
      accepted_at: owner.owner_setup_accepted_at || owner.last_login_at || null,
    },
  }
}

function getCompanies(db) {
  const rows = db.prepare(`
    SELECT
      c.id,
      c.slug,
      c.name,
      c.region_code,
      c.data_residency,
      COALESCE(c.status, 'active') as status,
      c.created_at,
      COALESCE(users.users, 0) as users,
      COALESCE(owners.owners, 0) as owners,
      COALESCE(usage.vehicles, 0) as vehicles,
      COALESCE(usage.inspections, 0) as inspections,
      COALESCE(usage.inspections_30d, 0) as inspections_30d,
      COALESCE(usage.inspections_prev_30d, 0) as inspections_prev_30d,
      COALESCE(usage.accidents, 0) as accidents,
      COALESCE(usage.defects, 0) as defects,
      COALESCE(usage.photos, 0) as photos,
      usage.last_activity_at,
      COALESCE(plan.monthly_price_rub, 0) as monthly_price_rub,
      plan.name as plan_name,
      limits.plan_code,
      limits.max_vehicles,
      limits.max_users,
      limits.max_storage_mb,
      limits.ocr_enabled,
      limits.accident_module_enabled,
      limits.analytics_enabled,
      limits.api_access_enabled,
      limits.updated_at,
      subscription.id as subscription_id,
      subscription.plan_code as subscription_plan_code,
      subscription.status as subscription_status,
      subscription.current_period_start,
      subscription.current_period_end,
      subscription.grace_until,
      subscription.last_payment_id,
      subscription.mrr_rub,
      subscription.auto_suspend_enabled
    FROM companies c
    LEFT JOIN company_limits limits ON limits.company_id = c.id
    LEFT JOIN company_subscriptions subscription ON subscription.company_id = c.id
    LEFT JOIN (
      SELECT company_id, COUNT(*) as users
      FROM users
      WHERE role NOT IN ('admin', 'resource_manager')
      GROUP BY company_id
    ) users ON users.company_id = c.id
    LEFT JOIN (
      SELECT company_id, COUNT(*) as owners
      FROM users
      WHERE role = 'owner' AND COALESCE(status, 'active') = 'active'
      GROUP BY company_id
    ) owners ON owners.company_id = c.id
    LEFT JOIN (
      SELECT
        c2.id as company_id,
        (SELECT COUNT(*) FROM vehicles v WHERE v.company_id = c2.id) as vehicles,
        (SELECT COUNT(*) FROM inspections i WHERE i.company_id = c2.id) as inspections,
        (SELECT COUNT(*) FROM inspections i WHERE i.company_id = c2.id AND i.created_at >= datetime('now', '-30 days')) as inspections_30d,
        (SELECT COUNT(*) FROM inspections i WHERE i.company_id = c2.id AND i.created_at < datetime('now', '-30 days') AND i.created_at >= datetime('now', '-60 days')) as inspections_prev_30d,
        (SELECT COUNT(*) FROM inspections i WHERE i.company_id = c2.id AND i.type = 'accident') as accidents,
        (SELECT COUNT(*) FROM defects d WHERE d.company_id = c2.id) as defects,
        (SELECT COUNT(*) FROM photos p WHERE p.company_id = c2.id) as photos,
        (SELECT MAX(i.created_at) FROM inspections i WHERE i.company_id = c2.id) as last_activity_at
      FROM companies c2
    ) usage ON usage.company_id = c.id
    LEFT JOIN plans plan ON plan.code = limits.plan_code
    ORDER BY c.name COLLATE NOCASE ASC
  `).all()
  const ownersByCompany = getOwnersByCompany(db)

  return rows.map((row) => {
    const vehicles = toNumber(row.vehicles)
    const users = toNumber(row.users)
    const vehiclesUsagePercent = getUsagePercent(vehicles, row.max_vehicles)
    const usersUsagePercent = getUsagePercent(users, row.max_users)
    const limitRisk = getLimitRiskLevel(vehiclesUsagePercent, usersUsagePercent)
    const inactiveRisk = row.status !== 'inactive' && isOlderThan(row.last_activity_at, 14)

    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      region_code: row.region_code || null,
      data_residency: row.data_residency || null,
      status: row.status,
      created_at: row.created_at || null,
      users,
      owners: toNumber(row.owners),
      lastActivityAt: row.last_activity_at || null,
      inspections30d: toNumber(row.inspections_30d),
      previousInspections30d: toNumber(row.inspections_prev_30d),
      activityDropPercent: getActivityDropPercent(row.inspections_30d, row.inspections_prev_30d),
      vehiclesLimit: toNullableNumber(row.max_vehicles),
      usersLimit: toNullableNumber(row.max_users),
      vehiclesUsagePercent,
      usersUsagePercent,
      healthStatus: getCompanyHealthStatus(row),
      riskStatus: inactiveRisk ? 'churn' : limitRisk,
      usage: {
        vehicles,
        inspections: toNumber(row.inspections),
        accidents: toNumber(row.accidents),
        defects: toNumber(row.defects),
        photos: toNumber(row.photos),
      },
      billing: {
        planName: row.plan_name || null,
        monthlyPriceRub: toNumber(row.monthly_price_rub),
        monthlyRevenueRub: row.status === 'inactive'
          ? 0
          : (toNumber(row.mrr_rub) || toNumber(row.monthly_price_rub)),
      },
      ownerUsers: ownersByCompany[row.id] || [],
      limits: mapLimit(row),
      subscription: mapSubscription(row),
    }
  })
}

function listHealthCompanies(db, sql) {
  return db.prepare(sql).all().map((company) => ({
    id: company.id,
    slug: company.slug || null,
    name: company.name,
    status: company.status || 'active',
  }))
}

function getServiceHealth(db) {
  const companiesWithoutOwnerList = listHealthCompanies(db, `
    SELECT c.id, c.slug, c.name, COALESCE(c.status, 'active') as status
    FROM companies c
    LEFT JOIN users u ON u.company_id = c.id AND u.role = 'owner' AND COALESCE(u.status, 'active') = 'active'
    WHERE u.id IS NULL
    ORDER BY c.name COLLATE NOCASE ASC
    LIMIT 20
  `)
  const companiesWithoutLimitsList = listHealthCompanies(db, `
    SELECT c.id, c.slug, c.name, COALESCE(c.status, 'active') as status
    FROM companies c
    LEFT JOIN company_limits l ON l.company_id = c.id
    WHERE l.company_id IS NULL
    ORDER BY c.name COLLATE NOCASE ASC
    LIMIT 20
  `)

  return {
    companiesWithoutOwner: companiesWithoutOwnerList.length,
    companiesWithoutLimits: companiesWithoutLimitsList.length,
    companiesWithoutOwnerList,
    companiesWithoutLimitsList,
  }
}

function getTotals(db) {
  const row = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM companies) as companies,
      (SELECT COUNT(*) FROM companies WHERE COALESCE(status, 'active') = 'active') as activeCompanies,
      (SELECT COUNT(DISTINCT company_id) FROM inspections WHERE created_at >= datetime('now', '-7 days')) as activeCompanies7d,
      (SELECT COUNT(DISTINCT company_id) FROM inspections WHERE created_at >= datetime('now', '-30 days')) as activeCompanies30d,
      (SELECT COUNT(*) FROM companies WHERE status = 'inactive') as inactiveCompanies,
      (SELECT COUNT(*) FROM users WHERE role NOT IN ('admin', 'resource_manager')) as tenantUsers,
      (SELECT COUNT(*) FROM users WHERE role = 'owner') as owners,
      (SELECT COUNT(*) FROM users WHERE role = 'manager') as managers,
      (SELECT COUNT(*) FROM users WHERE role = 'inspector') as inspectors,
      (SELECT COUNT(*) FROM plans) as plans,
      (SELECT COUNT(*) FROM vehicles) as vehicles,
      (SELECT COUNT(*) FROM inspections) as inspections,
      (SELECT COUNT(*) FROM inspections WHERE created_at >= datetime('now', '-24 hours')) as inspections24h,
      (SELECT COUNT(*) FROM inspections WHERE created_at >= datetime('now', '-7 days')) as inspections7d,
      (SELECT COUNT(*) FROM inspections WHERE type = 'accident') as accidents,
      (SELECT COUNT(*) FROM defects) as defects,
      (SELECT COUNT(*) FROM photos) as photos,
      (SELECT COUNT(*) FROM inspections WHERE created_at >= datetime('now', '-30 days')) as inspections30d,
      (SELECT COUNT(*) FROM inspections WHERE type = 'accident' AND created_at >= datetime('now', '-30 days')) as accidents30d,
      (SELECT COUNT(*) FROM inspections WHERE type = 'quick' AND created_at >= datetime('now', '-30 days')) as quickInspections30d,
      (SELECT COUNT(*) FROM inspections WHERE type = 'scheduled' AND created_at >= datetime('now', '-30 days')) as scheduledInspections30d,
      (SELECT COUNT(*) FROM inspections WHERE COALESCE(completed, 0) = 1) as completedInspections,
      (SELECT COUNT(*) FROM inspections WHERE COALESCE(completed, 0) = 0) as unfinishedInspections,
      (SELECT COUNT(DISTINCT inspector_id) FROM inspections WHERE created_at >= datetime('now', '-30 days')) as activeInspectors30d,
      (SELECT COUNT(*) FROM defects WHERE status = 'open') as openDefects,
      (SELECT COUNT(*) FROM vehicles WHERE status = 'active') as activeVehicles,
      (SELECT COUNT(*) FROM vehicles WHERE status = 'repair') as repairVehicles
  `).get()

  return {
    companies: toNumber(row?.companies),
    activeCompanies: toNumber(row?.activeCompanies),
    activeCompanies7d: toNumber(row?.activeCompanies7d),
    activeCompanies30d: toNumber(row?.activeCompanies30d),
    inactiveCompanies: toNumber(row?.inactiveCompanies),
    tenantUsers: toNumber(row?.tenantUsers),
    owners: toNumber(row?.owners),
    managers: toNumber(row?.managers),
    inspectors: toNumber(row?.inspectors),
    plans: toNumber(row?.plans),
    vehicles: toNumber(row?.vehicles),
    inspections: toNumber(row?.inspections),
    inspections24h: toNumber(row?.inspections24h),
    inspections7d: toNumber(row?.inspections7d),
    accidents: toNumber(row?.accidents),
    defects: toNumber(row?.defects),
    photos: toNumber(row?.photos),
    inspections30d: toNumber(row?.inspections30d),
    accidents30d: toNumber(row?.accidents30d),
    quickInspections30d: toNumber(row?.quickInspections30d),
    scheduledInspections30d: toNumber(row?.scheduledInspections30d),
    completedInspections: toNumber(row?.completedInspections),
    unfinishedInspections: toNumber(row?.unfinishedInspections),
    activeInspectors30d: toNumber(row?.activeInspectors30d),
    openDefects: toNumber(row?.openDefects),
    activeVehicles: toNumber(row?.activeVehicles),
    repairVehicles: toNumber(row?.repairVehicles),
  }
}

function getBillingSummary(companies, plans = []) {
  const activeCompanies = companies.filter((company) => company.status !== 'inactive')
  const monthlyRevenueRub = activeCompanies.reduce((sum, company) => sum + toNumber(company.billing?.monthlyRevenueRub), 0)
  const paidCompanies = activeCompanies.filter((company) => toNumber(company.billing?.monthlyRevenueRub) > 0).length
  const recommendedPlan = [...plans]
    .filter((plan) => plan.status !== 'archived' && toNumber(plan.monthlyPriceRub) > 0)
    .sort((a, b) => toNumber(a.monthlyPriceRub) - toNumber(b.monthlyPriceRub))[0]
  const activeFreeCompanies = activeCompanies.filter((company) => !toNumber(company.billing?.monthlyRevenueRub) && toNumber(company.inspections30d) > 0).length
  const potentialMrr = activeFreeCompanies * toNumber(recommendedPlan?.monthlyPriceRub)

  return {
    currency: 'RUB',
    monthlyRevenueRub,
    annualRevenueRub: monthlyRevenueRub * 12,
    paidCompanies,
    freeCompanies: activeCompanies.length - paidCompanies,
    trialCompanies: activeCompanies.length - paidCompanies,
    activeFreeCompanies,
    potentialMrr,
    recommendedPlanCode: recommendedPlan?.code || null,
    trialToPaidConversionRate: activeCompanies.length ? Math.round((paidCompanies / activeCompanies.length) * 100) : null,
    averageRevenuePerActiveCompanyRub: activeCompanies.length ? Math.round(monthlyRevenueRub / activeCompanies.length) : 0,
  }
}

function getPaymentSummary(db) {
  const row = db.prepare(`
    SELECT
      SUM(CASE WHEN status != 'cancelled' AND payment_date >= date('now', 'start of month') THEN amount ELSE 0 END) as paidThisMonthRub,
      COUNT(CASE WHEN status != 'cancelled' AND payment_date >= date('now', 'start of month') THEN 1 END) as paymentsThisMonth,
      AVG(CASE WHEN status != 'cancelled' THEN amount END) as averagePaymentRub
    FROM company_payments
  `).get()

  const subscriptionRow = db.prepare(`
    SELECT
      COUNT(CASE WHEN status = 'expiring' THEN 1 END) as expiringCount,
      COUNT(CASE WHEN status = 'grace' THEN 1 END) as graceCount,
      COUNT(CASE WHEN status = 'expired' THEN 1 END) as expiredCount,
      COUNT(CASE WHEN status = 'suspended' THEN 1 END) as suspendedCount,
      SUM(CASE WHEN status IN ('active', 'expiring') AND current_period_end <= date('now', '+30 days') THEN mrr_rub ELSE 0 END) as expectedRenewalsRub
    FROM company_subscriptions
  `).get()

  return {
    paidThisMonthRub: toNumber(row?.paidThisMonthRub),
    paymentsThisMonth: toNumber(row?.paymentsThisMonth),
    averagePaymentRub: Math.round(toNumber(row?.averagePaymentRub)),
    expectedRenewalsRub: toNumber(subscriptionRow?.expectedRenewalsRub),
    expiringCount: toNumber(subscriptionRow?.expiringCount),
    graceCount: toNumber(subscriptionRow?.graceCount),
    expiredCount: toNumber(subscriptionRow?.expiredCount),
    suspendedCount: toNumber(subscriptionRow?.suspendedCount),
  }
}

function getPayments(db, { limit = 100 } = {}) {
  return db.prepare(`
    SELECT
      p.*,
      c.name as company_name,
      u.name as created_by_name
    FROM company_payments p
    LEFT JOIN companies c ON c.id = p.company_id
    LEFT JOIN users u ON u.id = p.created_by
    ORDER BY p.payment_date DESC, p.created_at DESC
    LIMIT ?
  `).all(limit).map(mapPayment)
}

function getCompanyPayments(db, companyId, { limit = 50 } = {}) {
  return db.prepare(`
    SELECT
      p.*,
      c.name as company_name,
      u.name as created_by_name
    FROM company_payments p
    LEFT JOIN companies c ON c.id = p.company_id
    LEFT JOIN users u ON u.id = p.created_by
    WHERE p.company_id = ?
    ORDER BY p.payment_date DESC, p.created_at DESC
    LIMIT ?
  `).all(companyId, limit).map(mapPayment)
}

function getExpiringSubscriptions(db, { limit = 20 } = {}) {
  return db.prepare(`
    SELECT
      s.id as subscription_id,
      s.company_id,
      c.name as companyName,
      c.slug as companySlug,
      s.plan_code as subscription_plan_code,
      s.status as subscription_status,
      s.current_period_start,
      s.current_period_end,
      s.grace_until,
      s.last_payment_id,
      s.mrr_rub,
      s.auto_suspend_enabled,
      p.payment_date as lastPaymentDate,
      p.amount as lastPaymentAmount,
      owner.email as ownerEmail,
      owner.name as ownerName
    FROM company_subscriptions s
    JOIN companies c ON c.id = s.company_id
    LEFT JOIN company_payments p ON p.id = s.last_payment_id
    LEFT JOIN users owner ON owner.company_id = c.id AND owner.role = 'owner' AND COALESCE(owner.status, 'active') = 'active'
    WHERE s.status IN ('expiring', 'grace', 'expired', 'suspended')
      OR s.current_period_end <= date('now', '+14 days')
    GROUP BY s.id
    ORDER BY s.current_period_end ASC
    LIMIT ?
  `).all(limit).map((row) => ({
    id: row.subscription_id,
    companyId: row.company_id,
    companyName: row.companyName,
    companySlug: row.companySlug || null,
    ownerEmail: row.ownerEmail || null,
    ownerName: row.ownerName || null,
    planCode: row.subscription_plan_code || null,
    status: normalizeSubscriptionStatus(row.subscription_status),
    currentPeriodStart: row.current_period_start || null,
    currentPeriodEnd: row.current_period_end || null,
    graceUntil: row.grace_until || null,
    daysUntilEnd: getDaysUntil(row.current_period_end),
    lastPaymentId: row.last_payment_id || null,
    lastPaymentDate: row.lastPaymentDate || null,
    lastPaymentAmount: toNumber(row.lastPaymentAmount),
    mrrRub: toNumber(row.mrr_rub),
  }))
}

function getAlerts(db, { limit = 200 } = {}) {
  return db.prepare(`
    SELECT n.*, c.name as company_name
    FROM company_notifications n
    LEFT JOIN companies c ON c.id = n.company_id
    WHERE COALESCE(n.recipient_role, 'admin') = 'admin'
      AND n.recipient_user_id IS NULL
    ORDER BY
      CASE WHEN n.status = 'new' THEN 0 ELSE 1 END,
      n.created_at DESC
    LIMIT ?
  `).all(limit).map(mapNotification)
}

function getCompanyAlerts(db, companyId, { limit = 50 } = {}) {
  return db.prepare(`
    SELECT n.*, c.name as company_name
    FROM company_notifications n
    LEFT JOIN companies c ON c.id = n.company_id
    WHERE n.company_id = ?
    ORDER BY
      CASE WHEN n.status = 'new' THEN 0 ELSE 1 END,
      n.created_at DESC
    LIMIT ?
  `).all(companyId, limit).map(mapNotification)
}

function getAlertsSummary(db) {
  const row = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as unread,
      SUM(CASE WHEN type LIKE 'subscription_expiring_%' AND status = 'new' THEN 1 ELSE 0 END) as expiring,
      SUM(CASE WHEN type IN ('subscription_expired', 'subscription_grace_started', 'subscription_suspended') AND status = 'new' THEN 1 ELSE 0 END) as critical
    FROM company_notifications
    WHERE COALESCE(recipient_role, 'admin') = 'admin'
      AND recipient_user_id IS NULL
  `).get()

  return {
    total: toNumber(row?.total),
    unread: toNumber(row?.unread),
    expiring: toNumber(row?.expiring),
    critical: toNumber(row?.critical),
  }
}

function getCompanyAuditLogs(db, companyId, { limit = 80 } = {}) {
  return db.prepare(`
    SELECT
      log.*,
      actor.name as actor_name,
      actor.email as actor_email
    FROM audit_logs log
    LEFT JOIN users actor ON actor.id = log.actor_user_id
    WHERE log.company_id = ?
    ORDER BY log.created_at DESC
    LIMIT ?
  `).all(companyId, limit).map(mapAuditLog)
}

function getPlanBreakdown(db) {
  return db.prepare(`
    SELECT
      COALESCE(l.plan_code, 'unassigned') as planCode,
      COALESCE(p.name, 'Без тарифа') as planName,
      COALESCE(p.monthly_price_rub, 0) as monthlyPriceRub,
      COUNT(c.id) as companies,
      SUM(CASE WHEN COALESCE(c.status, 'active') = 'active' THEN 1 ELSE 0 END) as activeCompanies,
      SUM(CASE WHEN COALESCE(c.status, 'active') = 'active' THEN COALESCE(p.monthly_price_rub, 0) ELSE 0 END) as monthlyRevenueRub,
      SUM((SELECT COUNT(*) FROM vehicles v WHERE v.company_id = c.id)) as vehicles,
      SUM((SELECT COUNT(*) FROM inspections i WHERE i.company_id = c.id)) as inspections,
      SUM((SELECT COUNT(*) FROM inspections i WHERE i.company_id = c.id AND i.type = 'accident')) as accidents
    FROM companies c
    LEFT JOIN company_limits l ON l.company_id = c.id
    LEFT JOIN plans p ON p.code = l.plan_code
    GROUP BY COALESCE(l.plan_code, 'unassigned'), COALESCE(p.name, 'Без тарифа'), COALESCE(p.monthly_price_rub, 0)
    ORDER BY activeCompanies DESC, companies DESC, planName COLLATE NOCASE ASC
  `).all().map((row) => ({
    planCode: row.planCode,
    planName: row.planName,
    monthlyPriceRub: toNumber(row.monthlyPriceRub),
    companies: toNumber(row.companies),
    activeCompanies: toNumber(row.activeCompanies),
    monthlyRevenueRub: toNumber(row.monthlyRevenueRub),
    usage: {
      vehicles: toNumber(row.vehicles),
      inspections: toNumber(row.inspections),
      accidents: toNumber(row.accidents),
    },
  }))
}

function getActivityTrend(db) {
  return db.prepare(`
    SELECT
      date(created_at) as date,
      COUNT(*) as inspections,
      SUM(CASE WHEN type = 'accident' THEN 1 ELSE 0 END) as accidents
    FROM inspections
    WHERE created_at >= datetime('now', '-29 days')
    GROUP BY date(created_at)
    ORDER BY date(created_at) ASC
  `).all().map((row) => ({
    date: row.date,
    inspections: toNumber(row.inspections),
    accidents: toNumber(row.accidents),
  }))
}

function getProductActivity(db, companies, totals) {
  const dates = createDateBuckets(30)
  const inspectionRows = db.prepare(`
    SELECT date(created_at) as date, COUNT(*) as count
    FROM inspections
    WHERE created_at >= datetime('now', '-29 days')
    GROUP BY date(created_at)
  `).all()
  const defectRows = db.prepare(`
    SELECT date(created_at) as date, COUNT(*) as count
    FROM defects
    WHERE created_at >= datetime('now', '-29 days')
    GROUP BY date(created_at)
  `).all()
  const photoRows = db.prepare(`
    SELECT date(created_at) as date, COUNT(*) as count
    FROM photos
    WHERE created_at >= datetime('now', '-29 days')
    GROUP BY date(created_at)
  `).all()
  const accidentRows = db.prepare(`
    SELECT date(created_at) as date, COUNT(*) as count
    FROM inspections
    WHERE type = 'accident' AND created_at >= datetime('now', '-29 days')
    GROUP BY date(created_at)
  `).all()
  const typeRows = db.prepare(`
    SELECT
      date(created_at) as date,
      SUM(CASE WHEN type = 'quick' THEN 1 ELSE 0 END) as quick,
      SUM(CASE WHEN type = 'scheduled' THEN 1 ELSE 0 END) as scheduled,
      SUM(CASE WHEN type = 'accident' THEN 1 ELSE 0 END) as accident
    FROM inspections
    WHERE created_at >= datetime('now', '-29 days')
    GROUP BY date(created_at)
  `).all()

  const inspectionsByDate = rowsToDateMap(inspectionRows)
  const defectsByDate = rowsToDateMap(defectRows)
  const photosByDate = rowsToDateMap(photoRows)
  const accidentsByDate = rowsToDateMap(accidentRows)
  const typeByDate = typeRows.reduce((acc, row) => {
    acc[row.date] = {
      quick: toNumber(row.quick),
      scheduled: toNumber(row.scheduled),
      accident: toNumber(row.accident),
    }
    return acc
  }, {})

  const totalInspections = toNumber(totals.inspections)
  const completedInspections = toNumber(totals.completedInspections)
  const activeCompanies30d = Math.max(1, toNumber(totals.activeCompanies30d))

  return {
    kpi: {
      inspections24h: toNumber(totals.inspections24h),
      inspections7d: toNumber(totals.inspections7d),
      inspections30d: toNumber(totals.inspections30d),
      quickInspections30d: toNumber(totals.quickInspections30d),
      scheduledInspections30d: toNumber(totals.scheduledInspections30d),
      accidentInspections30d: toNumber(totals.accidents30d),
      completedInspections,
      unfinishedInspections: toNumber(totals.unfinishedInspections),
      completionRate: totalInspections ? Math.round((completedInspections / totalInspections) * 100) : 0,
      averagePhotosPerInspection: totalInspections ? Math.round((toNumber(totals.photos) / totalInspections) * 10) / 10 : 0,
      defectsPer100Inspections: totalInspections ? Math.round((toNumber(totals.defects) / totalInspections) * 100) : 0,
      activeInspectors30d: toNumber(totals.activeInspectors30d),
      averageInspectionsPerActiveCompany30d: Math.round(toNumber(totals.inspections30d) / activeCompanies30d),
    },
    series30d: dates.map((date) => ({
      date,
      inspections: inspectionsByDate[date] || 0,
      defects: defectsByDate[date] || 0,
      accidents: accidentsByDate[date] || 0,
      photos: photosByDate[date] || 0,
    })),
    inspectionTypesSeries30d: dates.map((date) => ({
      date,
      quick: typeByDate[date]?.quick || 0,
      scheduled: typeByDate[date]?.scheduled || 0,
      accident: typeByDate[date]?.accident || 0,
    })),
    companyWorkload: [...companies]
      .sort((a, b) => ((b.usage?.inspections || 0) + (b.usage?.photos || 0)) - ((a.usage?.inspections || 0) + (a.usage?.photos || 0)))
      .slice(0, 10)
      .map((company) => ({
        companyId: company.id,
        companyName: company.name,
        vehicles: company.usage?.vehicles || 0,
        inspections: company.usage?.inspections || 0,
        defects: company.usage?.defects || 0,
        accidents: company.usage?.accidents || 0,
        photos: company.usage?.photos || 0,
      })),
  }
}

function getStorageStats(db) {
  const row = db.prepare(`
    SELECT
      COUNT(*) as totalPhotos,
      SUM(CASE WHEN created_at >= datetime('now', '-30 days') THEN 1 ELSE 0 END) as photos30d,
      SUM(COALESCE(size_original, 0) + COALESCE(size_webp, 0) + COALESCE(size_thumb, 0)) as totalStorageBytes,
      AVG(size_original) as avgOriginalSizeBytes,
      AVG(size_webp) as avgWebpSizeBytes,
      SUM(CASE
        WHEN size_original IS NOT NULL AND size_webp IS NOT NULL AND size_original > size_webp
        THEN size_original - size_webp
        ELSE 0
      END) as estimatedSavedBytes
    FROM photos
  `).get()
  const byCompany = db.prepare(`
    SELECT
      c.id as companyId,
      c.name as companyName,
      COUNT(p.id) as photos,
      SUM(COALESCE(p.size_original, 0) + COALESCE(p.size_webp, 0) + COALESCE(p.size_thumb, 0)) as storageBytes
    FROM companies c
    LEFT JOIN photos p ON p.company_id = c.id
    GROUP BY c.id, c.name
    ORDER BY storageBytes DESC, photos DESC, c.name COLLATE NOCASE ASC
    LIMIT 10
  `).all().map((item) => ({
    companyId: item.companyId,
    companyName: item.companyName,
    photos: toNumber(item.photos),
    storageBytes: toNumber(item.storageBytes),
  }))

  return {
    totalPhotos: toNumber(row?.totalPhotos),
    photos30d: toNumber(row?.photos30d),
    totalStorageBytes: toNumber(row?.totalStorageBytes),
    avgOriginalSizeBytes: row?.avgOriginalSizeBytes === null ? null : Math.round(toNumber(row?.avgOriginalSizeBytes)),
    avgWebpSizeBytes: row?.avgWebpSizeBytes === null ? null : Math.round(toNumber(row?.avgWebpSizeBytes)),
    estimatedSavedBytes: toNumber(row?.estimatedSavedBytes),
    uploadErrors: 0,
    webpErrors: 0,
    byCompany,
  }
}

function getOcrStats(db, companies) {
  const odometerSuccess = count(db, `SELECT COUNT(*) as count FROM inspections WHERE odometer_recognized_at IS NOT NULL`)
  return {
    plateAttempts: 0,
    plateSuccess: 0,
    plateSuccessRate: null,
    plateManualCorrections: 0,
    odometerAttempts: odometerSuccess,
    odometerSuccess,
    odometerSuccessRate: odometerSuccess ? 100 : null,
    avgConfidence: null,
    errors: 0,
    companiesWithOcrDisabled: companies.filter((company) => !company.limits?.ocrEnabled).length,
  }
}

function getActivationFunnel(db) {
  const row = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM companies) as companiesCreated,
      (SELECT COUNT(DISTINCT c.id)
        FROM companies c
        JOIN users u ON u.company_id = c.id AND u.role = 'owner') as ownerAssigned,
      (SELECT COUNT(DISTINCT c.id)
        FROM companies c
        JOIN users u ON u.company_id = c.id AND u.role = 'owner' AND u.last_login_at IS NOT NULL) as ownerLoggedIn,
      (SELECT COUNT(DISTINCT company_id) FROM vehicles) as vehicleAdded,
      (SELECT COUNT(DISTINCT company_id) FROM inspections) as firstInspectionCreated,
      (SELECT COUNT(*)
        FROM (
          SELECT company_id
          FROM inspections
          GROUP BY company_id
          HAVING COUNT(*) >= 5
        )) as fiveInspectionsReached,
      (SELECT COUNT(DISTINCT company_id)
        FROM inspections
        WHERE created_at >= datetime('now', '-30 days')) as active30d
  `).get()

  const companiesCreated = toNumber(row?.companiesCreated)
  const active30d = toNumber(row?.active30d)

  return {
    activationRate: companiesCreated ? Math.round((active30d / companiesCreated) * 100) : 0,
    funnel: {
      companiesCreated,
      ownerAssigned: toNumber(row?.ownerAssigned),
      ownerLoggedIn: toNumber(row?.ownerLoggedIn),
      vehicleAdded: toNumber(row?.vehicleAdded),
      firstInspectionCreated: toNumber(row?.firstInspectionCreated),
      fiveInspectionsReached: toNumber(row?.fiveInspectionsReached),
      active30d,
    },
  }
}

function buildHealthCenter(db, companies) {
  const serviceHealth = getServiceHealth(db)
  const inactiveCompanies14d = companies.filter(
    (company) => company.status !== 'inactive' && isOlderThan(company.lastActivityAt, 14),
  ).length
  const companiesWithoutPlan = companies.filter((company) => !company.limits?.planCode).length
  const unfinishedInspectionsOlderThan24h = count(db, `
    SELECT COUNT(*) as count
    FROM inspections
    WHERE COALESCE(completed, 0) = 0 AND created_at < datetime('now', '-24 hours')
  `)
  const defectsWithoutPhotos = count(db, `
    SELECT COUNT(*) as count
    FROM defects d
    LEFT JOIN photos p ON p.defect_id = d.id
    WHERE p.id IS NULL
  `)
  const accidentInspectionsWithoutRequiredData = count(db, `
    SELECT COUNT(*) as count
    FROM inspections
    WHERE type = 'accident'
      AND (accident_occurred_at IS NULL OR accident_location IS NULL OR trim(accident_location) = '')
  `)
  const orphanRecords = {
    vehicles: count(db, `SELECT COUNT(*) as count FROM vehicles v LEFT JOIN companies c ON c.id = v.company_id WHERE c.id IS NULL`),
    inspections: count(db, `SELECT COUNT(*) as count FROM inspections i LEFT JOIN companies c ON c.id = i.company_id WHERE c.id IS NULL`),
    defects: count(db, `SELECT COUNT(*) as count FROM defects d LEFT JOIN companies c ON c.id = d.company_id WHERE c.id IS NULL`),
    photos: count(db, `SELECT COUNT(*) as count FROM photos p LEFT JOIN companies c ON c.id = p.company_id WHERE c.id IS NULL`),
    users: count(db, `SELECT COUNT(*) as count FROM users u LEFT JOIN companies c ON c.id = u.company_id WHERE u.role NOT IN ('admin', 'resource_manager') AND c.id IS NULL`),
  }

  return {
    ...serviceHealth,
    companiesWithoutPlan,
    inactiveCompanies14d,
    orphanRecords,
    unfinishedInspectionsOlderThan24h,
    defectsWithoutPhotos,
    accidentInspectionsWithoutRequiredData,
    items: [
      {
        key: 'companies_without_owner',
        severity: serviceHealth.companiesWithoutOwner ? 'high' : 'ok',
        title: 'Компании без владельца',
        description: 'Нужно назначить владельца, чтобы компания могла управлять своей командой.',
        count: serviceHealth.companiesWithoutOwner,
        actionLabel: 'Назначить владельца',
        actionHref: '/saas-admin/companies',
      },
      {
        key: 'companies_without_limits',
        severity: serviceHealth.companiesWithoutLimits ? 'high' : 'ok',
        title: 'Компании без лимитов',
        description: 'Без лимитов нельзя корректно контролировать тариф и потребление.',
        count: serviceHealth.companiesWithoutLimits,
        actionLabel: 'Настроить лимиты',
        actionHref: '/saas-admin/companies',
      },
      {
        key: 'inactive_14d',
        severity: inactiveCompanies14d ? 'medium' : 'ok',
        title: 'Нет активности 14+ дней',
        description: 'Кандидаты на customer success контакт или проверку запуска.',
        count: inactiveCompanies14d,
        actionLabel: 'Проверить запуск',
        actionHref: '/saas-admin/dashboard',
      },
      {
        key: 'data_quality',
        severity: unfinishedInspectionsOlderThan24h + defectsWithoutPhotos + accidentInspectionsWithoutRequiredData ? 'medium' : 'ok',
        title: 'Качество данных',
        description: 'Незавершенные осмотры, дефекты без фото или ДТП без обязательных полей.',
        count: unfinishedInspectionsOlderThan24h + defectsWithoutPhotos + accidentInspectionsWithoutRequiredData,
        actionLabel: 'Смотреть агрегаты',
        actionHref: '/saas-admin/dashboard',
      },
    ],
  }
}

function buildLimitUsage(companies) {
  const usage = companies.map((company) => ({
    companyId: company.id,
    companyName: company.name,
    planCode: company.limits?.planCode || null,
    vehiclesUsed: company.usage?.vehicles || 0,
    vehiclesLimit: company.vehiclesLimit,
    vehiclesUsagePercent: company.vehiclesUsagePercent,
    usersUsed: company.users || 0,
    usersLimit: company.usersLimit,
    usersUsagePercent: company.usersUsagePercent,
    ocrEnabled: Boolean(company.limits?.ocrEnabled),
    accidentModuleEnabled: Boolean(company.limits?.accidentModuleEnabled),
    analyticsEnabled: Boolean(company.limits?.analyticsEnabled),
    apiAccessEnabled: Boolean(company.limits?.apiAccessEnabled),
    riskLevel: getLimitRiskLevel(company.vehiclesUsagePercent, company.usersUsagePercent),
  }))

  return {
    companiesNearVehicleLimit: usage.filter((company) => (company.vehiclesUsagePercent || 0) >= 80).length,
    companiesNearUserLimit: usage.filter((company) => (company.usersUsagePercent || 0) >= 80).length,
    disabledModules: {
      ocr: usage.filter((company) => !company.ocrEnabled).length,
      accidentModule: usage.filter((company) => !company.accidentModuleEnabled).length,
      analytics: usage.filter((company) => !company.analyticsEnabled).length,
      apiAccess: usage.filter((company) => !company.apiAccessEnabled).length,
    },
    usage,
  }
}

function buildRiskCenter(companies, plans) {
  const paidPlans = plans
    .filter((plan) => plan.status !== 'archived' && toNumber(plan.monthlyPriceRub) > 0)
    .sort((a, b) => toNumber(a.monthlyPriceRub) - toNumber(b.monthlyPriceRub))
  const fallbackPaidPlan = paidPlans[0] || null

  const churn = companies
    .filter((company) => company.status !== 'inactive' && isOlderThan(company.lastActivityAt, 14))
    .map((company) => ({
      companyId: company.id,
      companyName: company.name,
      planCode: company.limits?.planCode || null,
      lastActivityAt: company.lastActivityAt,
      inspections30d: company.inspections30d || 0,
      previousInspections30d: company.previousInspections30d || 0,
      activityDropPercent: company.activityDropPercent,
      riskLevel: company.lastActivityAt ? 'medium' : 'high',
      reasons: company.lastActivityAt ? ['Нет осмотров больше 14 дней'] : ['Не было осмотров'],
      recommendedAction: 'Связаться с владельцем компании и проверить запуск',
    }))

  const upsell = companies
    .filter((company) => {
      const nearLimit = (company.vehiclesUsagePercent || 0) >= 70 || (company.usersUsagePercent || 0) >= 70
      const activeUsage = (company.inspections30d || 0) >= 30 || (company.usage?.accidents || 0) > 0
      const freeActive = !toNumber(company.billing?.monthlyRevenueRub) && (company.inspections30d || 0) > 0
      return company.status !== 'inactive' && (nearLimit || freeActive || activeUsage)
    })
    .map((company) => {
      const currentPrice = toNumber(company.billing?.monthlyPriceRub)
      const recommendedPlan = paidPlans.find((plan) => toNumber(plan.monthlyPriceRub) > currentPrice) || fallbackPaidPlan
      return {
        companyId: company.id,
        companyName: company.name,
        currentPlanCode: company.limits?.planCode || null,
        recommendedPlanCode: recommendedPlan?.code || null,
        reason: (company.vehiclesUsagePercent || 0) >= 80 || (company.usersUsagePercent || 0) >= 80
          ? 'Использование лимитов выше 80%'
          : 'Активная компания без платного MRR',
        potentialMrr: Math.max(0, toNumber(recommendedPlan?.monthlyPriceRub) - currentPrice),
        vehiclesUsagePercent: company.vehiclesUsagePercent,
        usersUsagePercent: company.usersUsagePercent,
        inspections30d: company.inspections30d || 0,
      }
    })

  return {
    churnRiskCompanies: churn.length,
    upsellCandidates: upsell.length,
    churn,
    upsell,
  }
}

export function buildResourceAdminStats(db) {
  const companies = getCompanies(db)
  const plans = getPlans(db)
  const totals = getTotals(db)
  const health = buildHealthCenter(db, companies)
  const paymentSummary = getPaymentSummary(db)

  return {
    generated_at: new Date().toISOString(),
    totals: {
      ...totals,
      companiesWithoutOwner: health.companiesWithoutOwner,
      companiesWithoutLimits: health.companiesWithoutLimits,
    },
    billing: {
      ...getBillingSummary(companies, plans),
      ...paymentSummary,
    },
    alerts: getAlertsSummary(db),
    recent_alerts: getAlerts(db, { limit: 10 }),
    recent_payments: getPayments(db, { limit: 10 }),
    expiring_subscriptions: getExpiringSubscriptions(db, { limit: 20 }),
    plan_breakdown: getPlanBreakdown(db),
    activity_trend: getActivityTrend(db),
    activity: getProductActivity(db, companies, totals),
    storage: getStorageStats(db),
    ocr: getOcrStats(db, companies),
    service_health: health,
    activation: getActivationFunnel(db),
    health_center: health,
    limit_usage: buildLimitUsage(companies),
    risk_center: buildRiskCenter(companies, plans),
    companies,
    plans,
  }
}

export const buildSaasAdminStats = buildResourceAdminStats

function buildResourceCompanyDetails(db, companyId) {
  const company = getCompanies(db).find((item) => item.id === companyId)
  if (!company) return null

  return {
    company,
    owners: company.ownerUsers || [],
    limits: company.limits || null,
    subscription: company.subscription || null,
    payments: getCompanyPayments(db, company.id, { limit: 80 }),
    alerts: getCompanyAlerts(db, company.id, { limit: 80 }),
    auditLogs: getCompanyAuditLogs(db, company.id, { limit: 100 }),
    plans: getPlans(db),
  }
}

function getCompany(db, id) {
  return db.prepare(`
    SELECT id, slug, name, region_code, data_residency,
           COALESCE(access_mode, 'standard') AS access_mode,
           COALESCE(status, 'active') as status, created_at
    FROM companies
    WHERE id = ?
  `).get(id)
}

function sendCompanyNotFound(res, sendError) {
  return sendError(res, 404, 'Company not found')
}

function getPlan(db, code) {
  return db.prepare(`
    SELECT code, name, max_vehicles, max_users, max_storage_mb, monthly_price_rub, ocr_enabled,
      accident_module_enabled, analytics_enabled, api_access_enabled, status, created_at, updated_at
    FROM plans
    WHERE code = ?
  `).get(code)
}

function buildLimitPayload(body = {}) {
  return {
    planCode: normalizeIdentifier(body.planCode || body.plan_code || 'pilot') || 'pilot',
    maxVehicles: toNullableNumber(body.maxVehicles ?? body.max_vehicles),
    maxUsers: toNullableNumber(body.maxUsers ?? body.max_users),
    maxStorageMb: toNullableNumber(body.maxStorageMb ?? body.max_storage_mb),
    ocrEnabled: toNullableBoolean(body.ocrEnabled ?? body.ocr_enabled),
    accidentModuleEnabled: toNullableBoolean(body.accidentModuleEnabled ?? body.accident_module_enabled),
    analyticsEnabled: toNullableBoolean(body.analyticsEnabled ?? body.analytics_enabled),
    apiAccessEnabled: toNullableBoolean(body.apiAccessEnabled ?? body.api_access_enabled),
  }
}

function buildPlanPayload(body = {}) {
  const code = normalizeIdentifier(body.code)
  const name = normalizeText(body.name)

  return {
    code,
    name,
    status: normalizePlanStatus(body.status),
    maxVehicles: toNullableNumber(body.maxVehicles ?? body.max_vehicles),
    maxUsers: toNullableNumber(body.maxUsers ?? body.max_users),
    maxStorageMb: toNullableNumber(body.maxStorageMb ?? body.max_storage_mb),
    ocrEnabled: toNullableBoolean(body.ocrEnabled ?? body.ocr_enabled),
    accidentModuleEnabled: toNullableBoolean(body.accidentModuleEnabled ?? body.accident_module_enabled),
    analyticsEnabled: toNullableBoolean(body.analyticsEnabled ?? body.analytics_enabled),
    apiAccessEnabled: toNullableBoolean(body.apiAccessEnabled ?? body.api_access_enabled),
    monthlyPriceRub: toNullableNumber(body.monthlyPriceRub ?? body.monthly_price_rub),
  }
}

function buildPlanUpdatePayload(existing, body = {}) {
  return {
    code: existing.code,
    name: body.name === undefined ? existing.name : normalizeText(body.name),
    status: body.status === undefined ? (existing.status || 'active') : normalizePlanStatus(body.status),
    maxVehicles: body.maxVehicles === undefined && body.max_vehicles === undefined
      ? toNullableNumber(existing.max_vehicles)
      : toNullableNumber(body.maxVehicles ?? body.max_vehicles),
    maxUsers: body.maxUsers === undefined && body.max_users === undefined
      ? toNullableNumber(existing.max_users)
      : toNullableNumber(body.maxUsers ?? body.max_users),
    maxStorageMb: body.maxStorageMb === undefined && body.max_storage_mb === undefined
      ? toNullableNumber(existing.max_storage_mb)
      : toNullableNumber(body.maxStorageMb ?? body.max_storage_mb),
    ocrEnabled: body.ocrEnabled === undefined && body.ocr_enabled === undefined
      ? toNullableBoolean(existing.ocr_enabled)
      : toNullableBoolean(body.ocrEnabled ?? body.ocr_enabled),
    accidentModuleEnabled: body.accidentModuleEnabled === undefined && body.accident_module_enabled === undefined
      ? toNullableBoolean(existing.accident_module_enabled)
      : toNullableBoolean(body.accidentModuleEnabled ?? body.accident_module_enabled),
    analyticsEnabled: body.analyticsEnabled === undefined && body.analytics_enabled === undefined
      ? toNullableBoolean(existing.analytics_enabled)
      : toNullableBoolean(body.analyticsEnabled ?? body.analytics_enabled),
    apiAccessEnabled: body.apiAccessEnabled === undefined && body.api_access_enabled === undefined
      ? toNullableBoolean(existing.api_access_enabled)
      : toNullableBoolean(body.apiAccessEnabled ?? body.api_access_enabled),
    monthlyPriceRub: body.monthlyPriceRub === undefined && body.monthly_price_rub === undefined
      ? toNullableNumber(existing.monthly_price_rub)
      : toNullableNumber(body.monthlyPriceRub ?? body.monthly_price_rub),
  }
}

function upsertCompanyLimits(db, companyId, payload) {
  db.prepare(`
    INSERT INTO company_limits (
      id, company_id, plan_code, max_vehicles, max_users, max_storage_mb, ocr_enabled,
      accident_module_enabled, analytics_enabled, api_access_enabled, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(company_id) DO UPDATE SET
      plan_code = excluded.plan_code,
      max_vehicles = excluded.max_vehicles,
      max_users = excluded.max_users,
      max_storage_mb = excluded.max_storage_mb,
      ocr_enabled = excluded.ocr_enabled,
      accident_module_enabled = excluded.accident_module_enabled,
      analytics_enabled = excluded.analytics_enabled,
      api_access_enabled = excluded.api_access_enabled,
      updated_at = datetime('now')
  `).run(
    uuidv4(),
    companyId,
    payload.planCode,
    payload.maxVehicles,
    payload.maxUsers,
    payload.maxStorageMb,
    payload.ocrEnabled === null ? null : (payload.ocrEnabled ? 1 : 0),
    payload.accidentModuleEnabled === null ? null : (payload.accidentModuleEnabled ? 1 : 0),
    payload.analyticsEnabled === null ? null : (payload.analyticsEnabled ? 1 : 0),
    payload.apiAccessEnabled === null ? null : (payload.apiAccessEnabled ? 1 : 0),
  )

  return mapLimit(db.prepare('SELECT * FROM company_limits WHERE company_id = ?').get(companyId))
}

function hasCompanyOperationalData(db, companyId) {
  return ['users', 'vehicles', 'inspections', 'defects', 'photos'].some((table) => (
    count(db, `SELECT COUNT(*) as count FROM ${table} WHERE company_id = ?`, [companyId]) > 0
  ))
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

function buildPaymentPayload(body = {}) {
  const paymentDate = normalizeDate(body.paymentDate ?? body.payment_date, new Date().toISOString().slice(0, 10))
  const periodStart = normalizeDate(body.periodStart ?? body.period_start, paymentDate)
  const periodEnd = normalizeDate(body.periodEnd ?? body.period_end)

  return {
    companyId: normalizeIdentifier(body.companyId ?? body.company_id),
    planCode: normalizeIdentifier(body.planCode ?? body.plan_code),
    amount: toNumber(body.amount),
    currency: normalizeCurrency(body.currency),
    paymentDate,
    periodStart,
    periodEnd,
    paymentMethod: normalizeText(body.paymentMethod ?? body.payment_method) || null,
    documentNumber: normalizeText(body.documentNumber ?? body.document_number) || null,
    comment: normalizeText(body.comment) || null,
  }
}

function recalculateCompanySubscription(db, companyId) {
  const payment = db.prepare(`
    SELECT *
    FROM company_payments
    WHERE company_id = ? AND status != 'cancelled'
    ORDER BY period_end DESC, payment_date DESC, created_at DESC
    LIMIT 1
  `).get(companyId)

  if (!payment) {
    db.prepare(`
      UPDATE company_subscriptions
      SET status = 'expired', last_payment_id = NULL, mrr_rub = 0, updated_at = datetime('now')
      WHERE company_id = ?
    `).run(companyId)
    return null
  }

  const today = new Date().toISOString().slice(0, 10)
  const daysUntilEnd = getDaysUntil(payment.period_end)
  const graceUntilDate = new Date(`${payment.period_end}T00:00:00Z`)
  graceUntilDate.setUTCDate(graceUntilDate.getUTCDate() + 7)
  const graceUntil = graceUntilDate.toISOString().slice(0, 10)
  let status = 'active'
  if (payment.period_end < today) {
    status = graceUntil >= today ? 'grace' : 'expired'
  } else if (daysUntilEnd !== null && daysUntilEnd <= 14) {
    status = 'expiring'
  }

  const mrrRub = calculateMrrRub(payment.amount, payment.period_start, payment.period_end)
  const existing = db.prepare('SELECT id FROM company_subscriptions WHERE company_id = ?').get(companyId)
  const subscriptionId = existing?.id || uuidv4()

  db.prepare(`
    INSERT INTO company_subscriptions (
      id, company_id, plan_code, status, current_period_start, current_period_end,
      grace_until, last_payment_id, mrr_rub, auto_suspend_enabled, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))
    ON CONFLICT(company_id) DO UPDATE SET
      plan_code = excluded.plan_code,
      status = excluded.status,
      current_period_start = excluded.current_period_start,
      current_period_end = excluded.current_period_end,
      grace_until = excluded.grace_until,
      last_payment_id = excluded.last_payment_id,
      mrr_rub = excluded.mrr_rub,
      updated_at = datetime('now')
  `).run(
    subscriptionId,
    companyId,
    payment.plan_code,
    status,
    payment.period_start,
    payment.period_end,
    graceUntil,
    payment.id,
    mrrRub,
  )

  return db.prepare('SELECT * FROM company_subscriptions WHERE company_id = ?').get(companyId)
}

function createNotificationOnce(db, {
  companyId,
  recipientUserId = null,
  recipientRole = 'admin',
  type,
  title,
  message,
}) {
  const exists = db.prepare(`
    SELECT id
    FROM company_notifications
    WHERE company_id = ?
      AND type = ?
      AND COALESCE(recipient_user_id, '') = COALESCE(?, '')
      AND COALESCE(recipient_role, '') = COALESCE(?, '')
      AND COALESCE(message, '') = COALESCE(?, '')
    LIMIT 1
  `).get(companyId, type, recipientUserId || '', recipientRole || '', message || '')

  if (exists) return false

  db.prepare(`
    INSERT INTO company_notifications (
      id, company_id, recipient_user_id, recipient_role, type, channel, title, message, status, sent_at, created_at
    )
    VALUES (?, ?, ?, ?, ?, 'in_app', ?, ?, 'new', datetime('now'), datetime('now'))
  `).run(uuidv4(), companyId, recipientUserId, recipientRole, type, title, message)

  return true
}

function getCompanyServiceNotificationRecipients(db, companyId) {
  return db.prepare(`
    SELECT id, email, name, role, status, service_notifications_enabled, service_notification_types
    FROM users
    WHERE company_id = ?
      AND COALESCE(status, 'active') = 'active'
      AND (
        role = 'owner'
        OR (role = 'manager' AND COALESCE(service_notifications_enabled, 0) = 1)
      )
    ORDER BY CASE role WHEN 'owner' THEN 0 ELSE 1 END, created_at ASC
  `).all(companyId)
}

function createNotificationForAudience(db, payload) {
  let created = 0

  if (createNotificationOnce(db, { ...payload, recipientUserId: null, recipientRole: 'admin' })) {
    created += 1
  }

  getCompanyServiceNotificationRecipients(db, payload.companyId).forEach((recipient) => {
    if (createNotificationOnce(db, {
      ...payload,
      recipientUserId: recipient.id,
      recipientRole: recipient.role,
    })) {
      created += 1
    }
  })

  return created
}

export function scanSubscriptionAlerts(db, { actorUserId = null, actorRole = 'system' } = {}) {
  const subscriptions = db.prepare(`
    SELECT
      s.*,
      c.name as company_name,
      owner.id as owner_id,
      owner.email as owner_email
    FROM company_subscriptions s
    JOIN companies c ON c.id = s.company_id
    LEFT JOIN users owner ON owner.company_id = c.id AND owner.role = 'owner' AND COALESCE(owner.status, 'active') = 'active'
    GROUP BY s.id
  `).all()
  const today = new Date().toISOString().slice(0, 10)
  const thresholds = [14, 7, 3, 1]
  let createdNotifications = 0
  let updatedSubscriptions = 0

  subscriptions.forEach((subscription) => {
    const daysUntilEnd = getDaysUntil(subscription.current_period_end)
    let nextStatus = normalizeSubscriptionStatus(subscription.status)

    if (subscription.current_period_end && subscription.current_period_end < today) {
      const graceUntil = subscription.grace_until || subscription.current_period_end
      if (graceUntil >= today) {
        nextStatus = 'grace'
      } else {
        nextStatus = toNumber(subscription.auto_suspend_enabled) ? 'suspended' : 'expired'
      }
    } else if (daysUntilEnd !== null && daysUntilEnd <= 14) {
      nextStatus = 'expiring'
    } else {
      nextStatus = 'active'
    }

    if (nextStatus !== subscription.status) {
      db.prepare(`
        UPDATE company_subscriptions
        SET status = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(nextStatus, subscription.id)
      updatedSubscriptions += 1

      db.prepare(`
        INSERT INTO audit_logs (id, company_id, actor_user_id, actor_role, action, entity_type, entity_id, payload_json)
        VALUES (?, ?, ?, ?, ?, 'company_subscription', ?, ?)
      `).run(
        uuidv4(),
        subscription.company_id,
        actorUserId,
        actorRole,
        'subscription_status_changed',
        subscription.id,
        JSON.stringify({ from: subscription.status, to: nextStatus }),
      )
    }

    if (daysUntilEnd !== null && thresholds.includes(daysUntilEnd)) {
      const type = `subscription_expiring_${daysUntilEnd}d`
      const message = `Тариф компании "${subscription.company_name}" заканчивается ${subscription.current_period_end}.`
      if (createNotificationForAudience(db, {
        companyId: subscription.company_id,
        recipientRole: 'admin',
        type,
        title: `Тариф заканчивается через ${daysUntilEnd} дн.`,
        message,
        periodEnd: subscription.current_period_end,
      })) {
        createdNotifications += 1
      }
    }

    if (nextStatus === 'grace') {
      const message = `Тариф компании "${subscription.company_name}" перешел в grace period до ${subscription.grace_until || subscription.current_period_end}.`
      if (createNotificationForAudience(db, {
        companyId: subscription.company_id,
        recipientRole: 'admin',
        type: 'subscription_grace_started',
        title: 'Подписка перешла в grace period',
        message,
      })) {
        createdNotifications += 1
      }
    }

    if (nextStatus === 'expired' || nextStatus === 'suspended') {
      const message = `Тариф компании "${subscription.company_name}" имеет статус ${nextStatus}.`
      if (createNotificationForAudience(db, {
        companyId: subscription.company_id,
        recipientRole: 'admin',
        type: nextStatus === 'suspended' ? 'subscription_suspended' : 'subscription_expired',
        title: nextStatus === 'suspended' ? 'Компания приостановлена' : 'Подписка просрочена',
        message,
      })) {
        createdNotifications += 1
      }
    }
  })

  return {
    scannedSubscriptions: subscriptions.length,
    updatedSubscriptions,
    createdNotifications,
    summary: getAlertsSummary(db),
  }
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

  app.get(['/api/admin/resource/alerts', '/api/admin/saas/alerts'], authenticate, (req, res) => {
    if (!requireAdmin(req, res)) return
    res.json({
      alerts: getAlerts(db, { limit: 200 }),
      summary: getAlertsSummary(db),
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
      alerts: getAlerts(db, { limit: 200 }),
      summary: getAlertsSummary(db),
      expiringSubscriptions: getExpiringSubscriptions(db, { limit: 100 }),
    })
  })

  app.post(['/api/admin/resource/alerts/:id/read', '/api/admin/saas/alerts/:id/read'], authenticate, (req, res) => {
    if (!requireAdmin(req, res)) return

    const alert = db.prepare('SELECT * FROM company_notifications WHERE id = ?').get(req.params.id)
    if (!alert) return sendError(res, 404, 'Alert not found')

    db.prepare(`
      UPDATE company_notifications
      SET status = 'read', read_at = datetime('now')
      WHERE id = ?
    `).run(alert.id)

    res.json(mapNotification(db.prepare(`
      SELECT n.*, c.name as company_name
      FROM company_notifications n
      LEFT JOIN companies c ON c.id = n.company_id
      WHERE n.id = ?
    `).get(alert.id)))
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
    db.prepare(`
      INSERT OR IGNORE INTO company_billing (
        id, company_id, plan_code, billing_status, trial_until, created_by_user_id, created_at, updated_at
      ) VALUES (?, ?, ?, 'trial', date('now', '+3 months'), ?, datetime('now'), datetime('now'))
    `).run(uuidv4(), id, req.body?.limits?.planCode || 'pilot', req.user.id)

    writeAuditLog(db, req, {
      companyId: id,
      action: 'company_created',
      entityType: 'company',
      entityId: id,
      payload: { slug, name },
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

    const existing = db.prepare('SELECT id, role, company_id FROM users WHERE email = ?').get(email)
    if (existing && (existing.role !== 'owner' || existing.company_id !== company.id)) {
      return sendError(res, 409, 'Email is already used outside this company owner role')
    }

    const userId = existing?.id || uuidv4()
    const passwordHash = bcrypt.hashSync(uuidv4(), 10)

    if (existing) {
      db.prepare(`
        UPDATE users
        SET name = ?, role = 'owner', status = ?, company_id = ?
        WHERE id = ?
      `).run(name, normalizeStatus(req.body?.status), company.id, userId)
    } else {
      db.prepare(`
        INSERT INTO users (id, email, password, name, role, status, company_id)
        VALUES (?, ?, ?, ?, 'owner', ?, ?)
      `).run(userId, email, passwordHash, name, normalizeStatus(req.body?.status), company.id)
    }

    const owner = db.prepare(`
      SELECT id, email, name, role, status, company_id, created_at, last_login_at,
        owner_setup_issued_at, owner_setup_expires_at, owner_setup_accepted_at
      FROM users
      WHERE id = ?
    `).get(userId)

    let setup = null
    if (req.body?.issue_setup_link !== false && createOwnerSetupInvitation) {
      setup = createOwnerSetupInvitation(owner)
    }

    writeAuditLog(db, req, {
      companyId: company.id,
      action: existing ? 'owner_updated' : 'owner_created',
      entityType: 'user',
      entityId: userId,
      payload: { email, name },
    })

    res.status(existing ? 200 : 201).json({ ...mapOwner(owner), setup })
  })

  app.put('/api/admin/resource/owners/:id', authenticate, (req, res) => {
    if (!requireAdmin(req, res)) return

    const owner = db.prepare('SELECT id, email, name, role, status, company_id FROM users WHERE id = ? AND role = ?').get(req.params.id, 'owner')
    if (!owner) return sendError(res, 404, 'Owner not found')

    const email = normalizeText(req.body?.email || owner.email).toLowerCase()
    const duplicate = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, owner.id)
    if (duplicate) {
      return sendError(res, 409, 'Email is already used')
    }

    const emailChanged = email !== owner.email
    db.prepare(`
      UPDATE users
      SET email = ?,
          name = ?,
          status = ?,
          owner_setup_nonce = CASE WHEN ? THEN NULL ELSE owner_setup_nonce END,
          owner_setup_issued_at = CASE WHEN ? THEN NULL ELSE owner_setup_issued_at END,
          owner_setup_expires_at = CASE WHEN ? THEN NULL ELSE owner_setup_expires_at END,
          owner_setup_accepted_at = CASE WHEN ? THEN NULL ELSE owner_setup_accepted_at END
      WHERE id = ? AND role = 'owner'
    `).run(
      email,
      normalizeText(req.body?.name || owner.name),
      req.body?.status === undefined ? owner.status : normalizeStatus(req.body.status),
      emailChanged ? 1 : 0,
      emailChanged ? 1 : 0,
      emailChanged ? 1 : 0,
      emailChanged ? 1 : 0,
      owner.id,
    )

    writeAuditLog(db, req, {
      companyId: owner.company_id,
      action: 'owner_updated',
      entityType: 'user',
      entityId: owner.id,
      payload: { email, name: normalizeText(req.body?.name || owner.name) },
    })

    const updatedOwner = db.prepare(`
      SELECT id, email, name, role, status, company_id, created_at, last_login_at,
        owner_setup_issued_at, owner_setup_expires_at, owner_setup_accepted_at
      FROM users
      WHERE id = ?
    `).get(owner.id)

    res.json(mapOwner(updatedOwner))
  })

  app.post('/api/admin/resource/owners/:id/setup-link', authenticate, (req, res) => {
    if (!requireAdmin(req, res)) return

    const owner = db.prepare(`
      SELECT id, email, name, role, status, company_id, created_at, last_login_at,
        owner_setup_issued_at, owner_setup_expires_at, owner_setup_accepted_at
      FROM users
      WHERE id = ? AND role = ?
    `).get(req.params.id, 'owner')
    if (!owner) return sendError(res, 404, 'Owner not found')
    if ((owner.status || 'active') === 'inactive') return sendError(res, 409, 'Inactive owner cannot receive setup link')
    if (!createOwnerSetupInvitation) return sendError(res, 500, 'Owner setup invitations are not configured')

    const setup = createOwnerSetupInvitation(owner)
    const updatedOwner = db.prepare(`
      SELECT id, email, name, role, status, company_id, created_at, last_login_at,
        owner_setup_issued_at, owner_setup_expires_at, owner_setup_accepted_at
      FROM users
      WHERE id = ?
    `).get(owner.id)

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

    const owner = db.prepare('SELECT id, company_id FROM users WHERE id = ? AND role = ?').get(req.params.id, 'owner')
    if (!owner) return sendError(res, 404, 'Owner not found')

    db.prepare(`
      UPDATE users
      SET status = 'inactive',
          owner_setup_nonce = NULL,
          owner_setup_issued_at = NULL,
          owner_setup_expires_at = NULL
      WHERE id = ? AND role = 'owner'
    `).run(owner.id)
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
        accident_module_enabled, analytics_enabled, api_access_enabled, monthly_price_rub, status, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      payload.code,
      payload.name,
      payload.maxVehicles,
      payload.maxUsers,
      payload.maxStorageMb,
      payload.ocrEnabled === null ? null : (payload.ocrEnabled ? 1 : 0),
      payload.accidentModuleEnabled === null ? null : (payload.accidentModuleEnabled ? 1 : 0),
      payload.analyticsEnabled === null ? null : (payload.analyticsEnabled ? 1 : 0),
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
        accident_module_enabled = ?, analytics_enabled = ?, api_access_enabled = ?, monthly_price_rub = ?, status = ?, updated_at = datetime('now')
      WHERE code = ?
    `).run(
      payload.name,
      payload.maxVehicles,
      payload.maxUsers,
      payload.maxStorageMb,
      payload.ocrEnabled === null ? null : (payload.ocrEnabled ? 1 : 0),
      payload.accidentModuleEnabled === null ? null : (payload.accidentModuleEnabled ? 1 : 0),
      payload.analyticsEnabled === null ? null : (payload.analyticsEnabled ? 1 : 0),
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
