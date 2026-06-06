export function createCompanyPolicy({ db, sendError, API_MESSAGES }) {
  function normalizeCompanyLimit(value) {
    if (value === undefined || value === null || value === '') return null
    const number = Number(value)
    return Number.isFinite(number) && number >= 0 ? Math.floor(number) : null
  }

  function normalizeCompanyFeatureFlag(value) {
    if (value === undefined || value === null || value === '') return null
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value !== 0

    const normalized = String(value).trim().toLowerCase()
    if (['0', 'false', 'off', 'no', 'disabled'].includes(normalized)) return false
    if (['1', 'true', 'on', 'yes', 'enabled'].includes(normalized)) return true

    return null
  }

  function getCompanyLimits(companyId) {
    return db.prepare(`
      SELECT *
      FROM company_limits
      WHERE company_id = ?
    `).get(companyId)
  }

  function getCompanyResourceUsage(companyId, resource) {
    if (resource === 'vehicles') {
      return Number(db.prepare('SELECT COUNT(*) as count FROM vehicles WHERE company_id = ?').get(companyId)?.count || 0)
    }

    if (resource === 'users') {
      return Number(db.prepare(`
        SELECT COUNT(*) as count
        FROM users
        WHERE company_id = ? AND role != 'admin'
      `).get(companyId)?.count || 0)
    }

    return 0
  }

  function getCompanyResourceLimitState(companyId, resource) {
    const limits = getCompanyLimits(companyId)
    const field = resource === 'vehicles' ? 'max_vehicles' : resource === 'users' ? 'max_users' : null
    if (!field) return null

    const max = normalizeCompanyLimit(limits?.[field])
    if (max === null) return null

    return {
      resource,
      max,
      current: getCompanyResourceUsage(companyId, resource),
    }
  }

  function getCompanyLimitViolation(companyId, resource, increment = 1) {
    const state = getCompanyResourceLimitState(companyId, resource)
    if (!state || state.current + increment <= state.max) return null

    return {
      ...state,
      requested: increment,
      message: resource === 'vehicles'
        ? API_MESSAGES.vehicleLimitExceeded
        : API_MESSAGES.userLimitExceeded,
    }
  }

  function sendCompanyLimitViolation(res, violation) {
    return sendError(res, 409, `${violation.message}. Текущее значение: ${violation.current}/${violation.max}.`)
  }

  function isCompanyFeatureEnabled(companyId, featureField) {
    const limits = getCompanyLimits(companyId)
    const flag = normalizeCompanyFeatureFlag(limits?.[featureField])

    // Backward-compatible default: missing limits or unset flags mean "enabled".
    return flag !== false
  }

  function getCompanyFeatureDisabledMessage(featureField) {
    if (featureField === 'ocr_enabled') return API_MESSAGES.ocrFeatureDisabled
    if (featureField === 'analytics_enabled') return API_MESSAGES.analyticsFeatureDisabled
    if (featureField === 'accident_module_enabled') return API_MESSAGES.accidentModuleDisabled

    return API_MESSAGES.companyFeatureDisabled
  }

  function ensureCompanyFeatureEnabled(req, res, featureField, message = null) {
    const companyId = req.user?.company_id || 'default'
    if (isCompanyFeatureEnabled(companyId, featureField)) return true

    sendError(res, 403, message || getCompanyFeatureDisabledMessage(featureField))
    return false
  }

  function getCompanyOperationalRestriction(companyId, mode = 'write') {
    const company = db.prepare(`
      SELECT id, COALESCE(status, 'active') as status
      FROM companies
      WHERE id = ?
    `).get(companyId)

    if (company?.status === 'inactive') {
      return {
        status: 'inactive',
        message: API_MESSAGES.companyInactive,
      }
    }

    const subscription = db.prepare(`
      SELECT status
      FROM company_subscriptions
      WHERE company_id = ?
    `).get(companyId)
    const status = subscription?.status

    if (status === 'suspended') {
      return {
        status,
        message: API_MESSAGES.subscriptionSuspended,
      }
    }

    if (status === 'expired' && mode === 'create') {
      return {
        status,
        message: API_MESSAGES.subscriptionExpired,
      }
    }

    return null
  }

  function ensureCompanyOperationalWriteAllowed(req, res, { mode = 'write' } = {}) {
    const companyId = req.user?.company_id || 'default'
    const restriction = getCompanyOperationalRestriction(companyId, mode)
    if (!restriction) return true

    sendError(res, 403, restriction.message)
    return false
  }

  return {
    normalizeCompanyLimit,
    normalizeCompanyFeatureFlag,
    getCompanyLimits,
    getCompanyResourceUsage,
    getCompanyResourceLimitState,
    getCompanyLimitViolation,
    sendCompanyLimitViolation,
    ensureCompanyFeatureEnabled,
    ensureCompanyOperationalWriteAllowed,
  }
}
