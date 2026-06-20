import { getOwnersByCompany } from './resourceOwners.js'
import { mapLimit } from './resourcePlans.js'

const DAY_MS = 86400000
const number = (value) => Number(value || 0)

function nullableNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function daysUntil(value, now = new Date()) {
  if (!value) return null
  const target = new Date(`${String(value).slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(target.getTime())) return null
  const today = new Date(now)
  today.setUTCHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / DAY_MS)
}

export function getUsagePercent(current, limit) {
  const maximum = nullableNumber(limit)
  if (!maximum || maximum <= 0) return null
  return Math.min(999, Math.round((number(current) / maximum) * 100))
}

export function getLimitRiskLevel(vehiclePercent, userPercent) {
  const maximum = Math.max(vehiclePercent || 0, userPercent || 0)
  if (maximum >= 100) return 'blocked'
  if (maximum >= 80) return 'upsell'
  if (maximum >= 60) return 'watch'
  return 'ok'
}

export function isOlderThan(dateValue, days, now = new Date()) {
  if (!dateValue) return true
  const timestamp = Date.parse(dateValue)
  if (Number.isNaN(timestamp)) return true
  return now.getTime() - timestamp > days * DAY_MS
}

export function getActivityDropPercent(current, previous) {
  const previousValue = number(previous)
  if (!previousValue) return null
  return Math.max(0, Math.round(((previousValue - number(current)) / previousValue) * 100))
}

function mapSubscription(row) {
  if (!row?.subscription_id) return null
  const status = ['trial', 'active', 'expiring', 'grace', 'expired', 'suspended'].includes(row.subscription_status)
    ? row.subscription_status
    : 'active'
  return {
    id: row.subscription_id,
    companyId: row.id || row.company_id,
    planCode: row.subscription_plan_code || row.plan_code || null,
    status,
    currentPeriodStart: row.current_period_start || null,
    currentPeriodEnd: row.current_period_end || null,
    graceUntil: row.grace_until || null,
    lastPaymentId: row.last_payment_id || null,
    mrrRub: number(row.mrr_rub),
    autoSuspendEnabled: Boolean(number(row.auto_suspend_enabled)),
    daysUntilEnd: daysUntil(row.current_period_end),
  }
}

function getCompanyHealthStatus(row) {
  if (row.status === 'inactive') return 'inactive'
  if (!number(row.owners) || !row.plan_code) return 'attention'
  if (!row.max_vehicles && !row.max_users) return 'attention'
  return 'ok'
}

export function getCompanies(db) {
  const rows = db.prepare(`
    SELECT c.id, c.slug, c.name, c.region_code, c.data_residency,
      COALESCE(c.status, 'active') status, c.created_at,
      COALESCE(users.users, 0) users, COALESCE(owners.owners, 0) owners,
      COALESCE(usage.vehicles, 0) vehicles, COALESCE(usage.inspections, 0) inspections,
      COALESCE(usage.inspections_30d, 0) inspections_30d,
      COALESCE(usage.inspections_prev_30d, 0) inspections_prev_30d,
      COALESCE(usage.accidents, 0) accidents, COALESCE(usage.defects, 0) defects,
      COALESCE(usage.photos, 0) photos, usage.last_activity_at,
      COALESCE(plan.monthly_price_rub, 0) monthly_price_rub, plan.name plan_name,
      limits.plan_code, limits.max_vehicles, limits.max_users, limits.max_storage_mb,
      limits.ocr_enabled, limits.accident_module_enabled, limits.analytics_enabled,
      limits.pdf_report_enabled, limits.api_access_enabled, limits.updated_at,
      subscription.id subscription_id, subscription.plan_code subscription_plan_code,
      subscription.status subscription_status, subscription.current_period_start,
      subscription.current_period_end, subscription.grace_until,
      subscription.last_payment_id, subscription.mrr_rub, subscription.auto_suspend_enabled
    FROM companies c
    LEFT JOIN company_limits limits ON limits.company_id = c.id
    LEFT JOIN company_subscriptions subscription ON subscription.company_id = c.id
    LEFT JOIN (
      SELECT company_id, COUNT(*) users FROM users
      WHERE role NOT IN ('admin', 'resource_manager') GROUP BY company_id
    ) users ON users.company_id = c.id
    LEFT JOIN (
      SELECT company_id, COUNT(*) owners FROM users
      WHERE role = 'owner' AND COALESCE(status, 'active') = 'active' GROUP BY company_id
    ) owners ON owners.company_id = c.id
    LEFT JOIN (
      SELECT c2.id company_id,
        (SELECT COUNT(*) FROM vehicles v WHERE v.company_id = c2.id) vehicles,
        (SELECT COUNT(*) FROM inspections i WHERE i.company_id = c2.id) inspections,
        (SELECT COUNT(*) FROM inspections i WHERE i.company_id = c2.id AND i.created_at >= datetime('now', '-30 days')) inspections_30d,
        (SELECT COUNT(*) FROM inspections i WHERE i.company_id = c2.id AND i.created_at < datetime('now', '-30 days') AND i.created_at >= datetime('now', '-60 days')) inspections_prev_30d,
        (SELECT COUNT(*) FROM inspections i WHERE i.company_id = c2.id AND i.type = 'accident') accidents,
        (SELECT COUNT(*) FROM defects d WHERE d.company_id = c2.id) defects,
        (SELECT COUNT(*) FROM photos p WHERE p.company_id = c2.id) photos,
        (SELECT MAX(i.created_at) FROM inspections i WHERE i.company_id = c2.id) last_activity_at
      FROM companies c2
    ) usage ON usage.company_id = c.id
    LEFT JOIN plans plan ON plan.code = limits.plan_code
    ORDER BY c.name COLLATE NOCASE ASC
  `).all()
  const ownersByCompany = getOwnersByCompany(db)

  return rows.map((row) => {
    const vehicles = number(row.vehicles)
    const users = number(row.users)
    const vehiclesUsagePercent = getUsagePercent(vehicles, row.max_vehicles)
    const usersUsagePercent = getUsagePercent(users, row.max_users)
    const inactiveRisk = row.status !== 'inactive' && isOlderThan(row.last_activity_at, 14)
    return {
      id: row.id, slug: row.slug, name: row.name,
      region_code: row.region_code || null, data_residency: row.data_residency || null,
      status: row.status, created_at: row.created_at || null, users,
      owners: number(row.owners), lastActivityAt: row.last_activity_at || null,
      inspections30d: number(row.inspections_30d),
      previousInspections30d: number(row.inspections_prev_30d),
      activityDropPercent: getActivityDropPercent(row.inspections_30d, row.inspections_prev_30d),
      vehiclesLimit: nullableNumber(row.max_vehicles), usersLimit: nullableNumber(row.max_users),
      vehiclesUsagePercent, usersUsagePercent, healthStatus: getCompanyHealthStatus(row),
      riskStatus: inactiveRisk ? 'churn' : getLimitRiskLevel(vehiclesUsagePercent, usersUsagePercent),
      usage: {
        vehicles, inspections: number(row.inspections), accidents: number(row.accidents),
        defects: number(row.defects), photos: number(row.photos),
      },
      billing: {
        planName: row.plan_name || null, monthlyPriceRub: number(row.monthly_price_rub),
        monthlyRevenueRub: row.status === 'inactive' ? 0 : (number(row.mrr_rub) || number(row.monthly_price_rub)),
      },
      ownerUsers: ownersByCompany[row.id] || [],
      limits: mapLimit(row),
      subscription: mapSubscription(row),
    }
  })
}

export function getCompany(db, id) {
  return db.prepare(`
    SELECT id, slug, name, region_code, data_residency,
      COALESCE(access_mode, 'standard') access_mode,
      COALESCE(status, 'active') status, created_at
    FROM companies WHERE id = ?
  `).get(id)
}

export function hasCompanyOperationalData(db, companyId) {
  return ['users', 'vehicles', 'inspections', 'defects', 'photos'].some((table) => {
    const row = db.prepare(`SELECT COUNT(*) count FROM ${table} WHERE company_id = ?`).get(companyId)
    return number(row?.count) > 0
  })
}
