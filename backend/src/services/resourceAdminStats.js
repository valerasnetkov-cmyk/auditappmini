import {
  getExpiringSubscriptions,
  getPayments,
  getPaymentSummary,
} from './resourceBilling.js'
import {
  getCompanies,
} from './resourceCompanies.js'
import {
  getCompanyAlerts,
  getCompanyAuditLogs,
  getResourceAlerts,
} from './resourceActivity.js'
import {
  getPlans,
} from './resourcePlans.js'
import {
  buildLimitUsage,
  buildRiskCenter,
  getBillingSummary,
} from './resourceInsights.js'
import {
  buildHealthCenter,
  getActivationFunnel,
  getActivityTrend,
  getOcrStats,
  getPlanBreakdown,
  getProductActivity,
  getStorageStats,
  getTotals,
} from './resourceDashboard.js'
import {
  getSubscriptionAlertsSummary,
} from './subscriptionAlerts.js'

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
    alerts: getSubscriptionAlertsSummary(db),
    recent_alerts: getResourceAlerts(db, { limit: 10 }),
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

export function buildResourceCompanyDetails(db, companyId) {
  const company = getCompanies(db).find((item) => item.id === companyId)
  if (!company) return null

  return {
    company,
    owners: company.ownerUsers || [],
    limits: company.limits || null,
    subscription: company.subscription || null,
    payments: getPayments(db, { companyId: company.id, limit: 80 }),
    alerts: getCompanyAlerts(db, company.id, { limit: 80 }),
    auditLogs: getCompanyAuditLogs(db, company.id, { limit: 100 }),
    plans: getPlans(db),
  }
}
