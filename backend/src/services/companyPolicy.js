import { createPlanLimitsService } from './planLimits.js'

export function createCompanyPolicy({ db, sendError, API_MESSAGES }) {
  const planLimits = createPlanLimitsService({ db })

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
    return planLimits.getUsage(companyId, resource)
  }

  function getCompanyResourceLimitState(companyId, resource) {
    const state = planLimits.getLimitState(companyId, resource)
    if (state.limit === null) return null
    return {
      resource,
      max: state.limit,
      current: state.used,
      period: state.period,
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
    const error = violation.resource === 'vehicles'
      ? 'vehicle_limit_exceeded'
      : violation.resource === 'users'
        ? 'user_limit_exceeded'
        : 'inspection_limit_exceeded'
    const message = violation.resource === 'vehicles'
      ? 'Достигнут лимит техники по текущему тарифу.'
      : violation.resource === 'users'
        ? 'Достигнут лимит пользователей по текущему тарифу.'
        : 'Достигнут месячный лимит осмотров по текущему тарифу.'

    return res.status(409).json({
      error,
      message,
      limit: violation.max,
      used: violation.current,
      ...(violation.period ? { period: violation.period } : {}),
      ...(violation.resource === 'vehicles' || violation.resource === 'users'
        ? { upgrade_cta: 'Свяжитесь с поддержкой для увеличения лимита.' }
        : {}),
    })
  }

  function isCompanyFeatureEnabled(companyId, featureField) {
    return planLimits.isFeatureEnabled(companyId, featureField)
  }

  function getCompanyFeatureDisabledMessage(featureField) {
    if (featureField === 'ocr_enabled') return API_MESSAGES.ocrFeatureDisabled
    if (featureField === 'analytics_enabled') return API_MESSAGES.analyticsFeatureDisabled
    if (featureField === 'accident_module_enabled') return API_MESSAGES.accidentModuleDisabled
    if (featureField === 'pdf_report_enabled') return 'PDF-отчёты недоступны на текущем тарифе'

    return API_MESSAGES.companyFeatureDisabled
  }

  function ensureCompanyFeatureEnabled(req, res, featureField, message = null) {
    const companyId = req.user?.company_id || 'default'
    if (isCompanyFeatureEnabled(companyId, featureField)) return true

    const errors = {
      ocr_enabled: 'ocr_disabled_by_plan',
      analytics_enabled: 'analytics_disabled_by_plan',
      accident_module_enabled: 'accident_module_disabled_by_plan',
      pdf_report_enabled: 'pdf_report_disabled_by_plan',
      export_enabled: 'export_disabled_by_plan',
    }
    res.status(403).json({
      error: errors[featureField] || 'feature_disabled_by_plan',
      message: message || getCompanyFeatureDisabledMessage(featureField),
    })
    return false
  }

  function ensureCompanyResourceAvailable(req, res, resource, increment = 1) {
    const companyId = req.user?.company_id || 'default'
    const violation = getCompanyLimitViolation(companyId, resource, increment)
    if (!violation) return true
    sendCompanyLimitViolation(res, violation)
    return false
  }

  function ensureOcrAvailable(req, res) {
    const companyId = req.user?.company_id || 'default'
    if (!ensureCompanyFeatureEnabled(req, res, 'ocr_enabled', 'OCR недоступен на текущем тарифе.')) return false
    const violation = planLimits.getLimitViolation(companyId, 'ocr_month')
    if (!violation) return true

    res.status(409).json({
      error: 'ocr_limit_exceeded',
      message: 'Достигнут месячный лимит распознаваний OCR.',
      limit: violation.limit,
      used: violation.used,
      period: violation.period,
    })
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

    const policy = planLimits.getResolvedPolicy(companyId)
    const billingStatus = policy.billing?.billing_status
    const trialExpired = billingStatus === 'trial'
      && policy.billing?.trial_until
      && String(policy.billing.trial_until).slice(0, 10) < new Date().toISOString().slice(0, 10)
    const legacyStatus = policy.subscription?.status
    const status = legacyStatus === 'suspended' || legacyStatus === 'expired'
      ? legacyStatus
      : trialExpired ? 'expired' : billingStatus || legacyStatus

    if (status === 'suspended' || status === 'archived') {
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
    ensureCompanyResourceAvailable,
    ensureOcrAvailable,
    ensureCompanyOperationalWriteAllowed,
    planLimits,
  }
}
