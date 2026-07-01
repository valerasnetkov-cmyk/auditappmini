import { ensureCorePlanPrices } from '../services/resourcePlans.js'

function nullableNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function booleanValue(value) {
  return Boolean(Number(value || 0))
}

function mapPublicPlan(row) {
  return {
    code: row.code,
    name: row.name,
    description: row.description || null,
    position: Number(row.position || 0),
    recommended: booleanValue(row.recommended),
    monthlyPriceRub: nullableNumber(row.monthly_price_rub),
    yearlyPriceRub: nullableNumber(row.yearly_price_rub),
    trialMonths: nullableNumber(row.trial_months),
    limits: {
      maxVehicles: nullableNumber(row.max_vehicles),
      maxUsers: nullableNumber(row.max_users),
      maxInspectionsPerMonth: nullableNumber(row.max_inspections_per_month),
      maxStorageMb: nullableNumber(row.max_storage_mb),
      storageLimitGb: nullableNumber(row.storage_limit_gb),
      ocrMonthlyLimit: nullableNumber(row.ocr_monthly_limit),
    },
    features: {
      ocrEnabled: booleanValue(row.ocr_enabled),
      accidentModuleEnabled: booleanValue(row.accident_module_enabled),
      analyticsEnabled: booleanValue(row.analytics_enabled),
      pdfReportEnabled: booleanValue(row.pdf_report_enabled) || booleanValue(row.export_enabled),
      exportEnabled: booleanValue(row.export_enabled),
      apiAccessEnabled: booleanValue(row.api_access_enabled),
      supportLevel: row.support_level || 'basic',
    },
  }
}

export default function registerPublicPlanRoutes({ app, db }) {
  app.get('/api/public/plans', (req, res) => {
    ensureCorePlanPrices(db)
    const plans = db.prepare(`
      SELECT code, name, description, position, recommended, monthly_price_rub, yearly_price_rub,
        trial_months, max_vehicles, max_users, max_inspections_per_month, max_storage_mb,
        storage_limit_gb, ocr_enabled, ocr_monthly_limit, accident_module_enabled,
        analytics_enabled, pdf_report_enabled, export_enabled, api_access_enabled,
        support_level
      FROM plans
      WHERE COALESCE(is_public, 1) = 1 AND COALESCE(status, 'active') = 'active'
      ORDER BY position ASC, name COLLATE NOCASE ASC
    `).all().map(mapPublicPlan)

    res.setHeader('Cache-Control', 'public, max-age=60')
    res.json({ plans })
  })
}
