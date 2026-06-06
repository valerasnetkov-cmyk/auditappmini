import { v4 as uuidv4 } from 'uuid'

const LIMIT_FIELDS = {
  vehicles: 'max_vehicles',
  users: 'max_users',
  inspections_month: 'max_inspections_per_month',
  storage_gb: 'storage_limit_gb',
  ocr_month: 'ocr_monthly_limit',
}

const FEATURE_FIELDS = {
  ocr_enabled: 'ocr_enabled',
  accident_module_enabled: 'accident_module_enabled',
  analytics_enabled: 'analytics_enabled',
  export_enabled: 'export_enabled',
  api_access_enabled: 'api_access_enabled',
  custom_branding_enabled: 'custom_branding_enabled',
  regional_storage_enabled: 'regional_storage_enabled',
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function nullableBoolean(value) {
  if (value === null || value === undefined || value === '') return null
  return Boolean(Number(value))
}

function currentPeriod() {
  return new Date().toISOString().slice(0, 7)
}

export function createPlanLimitsService({ db }) {
  function getPlan(code) {
    if (!code) return null
    return db.prepare('SELECT * FROM plans WHERE code = ?').get(code) || null
  }

  function getResolvedPolicy(companyId) {
    const overrides = db.prepare('SELECT * FROM company_limits WHERE company_id = ?').get(companyId) || null
    const billing = db.prepare('SELECT * FROM company_billing WHERE company_id = ?').get(companyId) || null
    const subscription = db.prepare('SELECT * FROM company_subscriptions WHERE company_id = ?').get(companyId) || null
    const planCode = overrides?.plan_code || billing?.plan_code || subscription?.plan_code || 'pilot'
    const plan = getPlan(planCode) || getPlan('pilot')

    const resolveLimit = (field) => nullableNumber(overrides?.[field]) ?? nullableNumber(plan?.[field])
    const resolveFeature = (field) => {
      const override = nullableBoolean(overrides?.[field])
      if (override !== null) return override
      const planValue = nullableBoolean(plan?.[field])
      return planValue !== false
    }

    return {
      planCode,
      plan,
      overrides,
      billing,
      subscription,
      limits: Object.fromEntries(
        Object.entries(LIMIT_FIELDS).map(([key, field]) => [key, resolveLimit(field)]),
      ),
      features: Object.fromEntries(
        Object.entries(FEATURE_FIELDS).map(([key, field]) => [key, resolveFeature(field)]),
      ),
      supportLevel: overrides?.support_level || plan?.support_level || 'basic',
    }
  }

  function getUsage(companyId, resource) {
    if (resource === 'vehicles') {
      return Number(db.prepare('SELECT COUNT(*) count FROM vehicles WHERE company_id = ?').get(companyId)?.count || 0)
    }
    if (resource === 'users') {
      return Number(db.prepare("SELECT COUNT(*) count FROM users WHERE company_id = ? AND role != 'admin'").get(companyId)?.count || 0)
    }
    if (resource === 'inspections_month') {
      return Number(db.prepare(`
        SELECT COUNT(*) count
        FROM inspections
        WHERE company_id = ? AND strftime('%Y-%m', created_at) = ?
      `).get(companyId, currentPeriod())?.count || 0)
    }
    if (resource === 'ocr_month') {
      return Number(db.prepare(`
        SELECT COUNT(*) count
        FROM company_ocr_usage
        WHERE company_id = ? AND strftime('%Y-%m', created_at) = ?
      `).get(companyId, currentPeriod())?.count || 0)
    }
    if (resource === 'storage_gb') {
      const bytes = Number(db.prepare(`
        SELECT COALESCE(SUM(
          COALESCE(size_original, 0) + COALESCE(size_webp, 0) + COALESCE(size_thumb, 0)
        ), 0) bytes
        FROM photos
        WHERE company_id = ?
      `).get(companyId)?.bytes || 0)
      return Math.round((bytes / (1024 ** 3)) * 100) / 100
    }
    return 0
  }

  function getLimitState(companyId, resource) {
    const policy = getResolvedPolicy(companyId)
    const limit = policy.limits[resource] ?? null
    const used = getUsage(companyId, resource)
    return {
      resource,
      used,
      limit,
      period: ['inspections_month', 'ocr_month'].includes(resource) ? currentPeriod() : null,
      unlimited: limit === null,
    }
  }

  function getLimitViolation(companyId, resource, increment = 1) {
    const state = getLimitState(companyId, resource)
    if (state.limit === null || state.used + increment <= state.limit) return null
    return { ...state, requested: increment }
  }

  function isFeatureEnabled(companyId, featureField) {
    return getResolvedPolicy(companyId).features[featureField] !== false
  }

  function recordOcrUsage(companyId, recognitionType) {
    db.prepare(`
      INSERT INTO company_ocr_usage (id, company_id, recognition_type, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `).run(uuidv4(), companyId, recognitionType)
  }

  return {
    getPlan,
    getResolvedPolicy,
    getUsage,
    getLimitState,
    getLimitViolation,
    isFeatureEnabled,
    recordOcrUsage,
    currentPeriod,
  }
}
