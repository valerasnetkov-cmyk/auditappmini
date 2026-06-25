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

function getCompanyRecentPhotos(db, companyId, limit = 24) {
  return db.prepare(`
    SELECT p.id, p.inspection_id, p.defect_id, p.company_id, p.photo_type,
           p.url, p.original_url, p.webp_url, p.thumb_url, p.original_mime, p.original_name,
           p.width, p.height, p.size_original, p.size_webp, p.size_thumb, p.hash,
           p.geo, p.is_required, p.client_photo_id, p.upload_status, p.captured_at,
           p.captured_lat, p.captured_lng, p.watermark_url, p.watermark_generated_at, p.created_at,
           i.type AS inspection_type, i.completed_at AS inspection_completed_at,
           v.number AS vehicle_number, v.name AS vehicle_name,
           d.title AS defect_title
    FROM photos p
    LEFT JOIN inspections i ON i.id = p.inspection_id AND i.company_id = p.company_id
    LEFT JOIN vehicles v ON v.id = i.vehicle_id AND v.company_id = p.company_id
    LEFT JOIN defects d ON d.id = p.defect_id AND d.company_id = p.company_id
    WHERE p.company_id = ?
    ORDER BY datetime(COALESCE(p.captured_at, p.created_at)) DESC, p.id DESC
    LIMIT ?
  `).all(companyId, limit)
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
    recentPhotos: getCompanyRecentPhotos(db, company.id),
    plans: getPlans(db),
  }
}
