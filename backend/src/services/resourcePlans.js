import { v4 as uuidv4 } from 'uuid'

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function identifier(value) {
  return text(value)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function nullableBoolean(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'boolean') return value
  return Boolean(Number(value))
}

function databaseBoolean(value) {
  return value === null ? null : (value ? 1 : 0)
}

const CORE_PLAN_PRICES_RUB = {
  pilot: 5000,
  standard: 15000,
  enterprise: 50000,
}

export function ensureCorePlanPrices(db) {
  const update = db.prepare(`
    UPDATE plans
    SET monthly_price_rub = ?, updated_at = datetime('now')
    WHERE code = ? AND COALESCE(monthly_price_rub, 0) != ?
  `)
  if (typeof update.run !== 'function') return

  for (const [code, price] of Object.entries(CORE_PLAN_PRICES_RUB)) {
    update.run(price, code, price)
  }
}

export function mapLimit(row) {
  if (!row) return null
  return {
    planCode: row.plan_code || null,
    maxVehicles: nullableNumber(row.max_vehicles),
    maxUsers: nullableNumber(row.max_users),
    maxStorageMb: nullableNumber(row.max_storage_mb),
    ocrEnabled: nullableBoolean(row.ocr_enabled),
    accidentModuleEnabled: nullableBoolean(row.accident_module_enabled),
    analyticsEnabled: nullableBoolean(row.analytics_enabled),
    pdfReportEnabled: nullableBoolean(row.pdf_report_enabled),
    apiAccessEnabled: nullableBoolean(row.api_access_enabled),
    updatedAt: row.updated_at || null,
  }
}

export function mapPlan(row) {
  return {
    code: row.code,
    name: row.name,
    status: row.status || 'active',
    monthlyPriceRub: Number(row.monthly_price_rub || 0),
    limits: {
      maxVehicles: nullableNumber(row.max_vehicles),
      maxUsers: nullableNumber(row.max_users),
      maxStorageMb: nullableNumber(row.max_storage_mb),
    },
    features: {
      ocrEnabled: nullableBoolean(row.ocr_enabled),
      accidentModuleEnabled: nullableBoolean(row.accident_module_enabled),
      analyticsEnabled: nullableBoolean(row.analytics_enabled),
      pdfReportEnabled: nullableBoolean(row.pdf_report_enabled),
      apiAccessEnabled: nullableBoolean(row.api_access_enabled),
    },
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }
}

export function getPlans(db) {
  ensureCorePlanPrices(db)
  return db.prepare(`
    SELECT code, name, max_vehicles, max_users, max_storage_mb, monthly_price_rub, ocr_enabled,
      accident_module_enabled, analytics_enabled, pdf_report_enabled, api_access_enabled, status, created_at, updated_at
    FROM plans
    ORDER BY name COLLATE NOCASE ASC
  `).all().map(mapPlan)
}

export function getPlan(db, code) {
  ensureCorePlanPrices(db)
  return db.prepare(`
    SELECT code, name, max_vehicles, max_users, max_storage_mb, monthly_price_rub,
      ocr_enabled, accident_module_enabled, analytics_enabled, pdf_report_enabled, api_access_enabled,
      status, created_at, updated_at
    FROM plans
    WHERE code = ?
  `).get(code)
}

export function buildLimitPayload(body = {}) {
  return {
    planCode: identifier(body.planCode || body.plan_code || 'pilot') || 'pilot',
    maxVehicles: nullableNumber(body.maxVehicles ?? body.max_vehicles),
    maxUsers: nullableNumber(body.maxUsers ?? body.max_users),
    maxStorageMb: nullableNumber(body.maxStorageMb ?? body.max_storage_mb),
    ocrEnabled: nullableBoolean(body.ocrEnabled ?? body.ocr_enabled),
    accidentModuleEnabled: nullableBoolean(body.accidentModuleEnabled ?? body.accident_module_enabled),
    analyticsEnabled: nullableBoolean(body.analyticsEnabled ?? body.analytics_enabled),
    pdfReportEnabled: nullableBoolean(body.pdfReportEnabled ?? body.pdf_report_enabled),
    apiAccessEnabled: nullableBoolean(body.apiAccessEnabled ?? body.api_access_enabled),
  }
}

export function buildPlanPayload(body = {}) {
  return {
    code: identifier(body.code),
    name: text(body.name),
    status: body.status === 'archived' ? 'archived' : 'active',
    maxVehicles: nullableNumber(body.maxVehicles ?? body.max_vehicles),
    maxUsers: nullableNumber(body.maxUsers ?? body.max_users),
    maxStorageMb: nullableNumber(body.maxStorageMb ?? body.max_storage_mb),
    ocrEnabled: nullableBoolean(body.ocrEnabled ?? body.ocr_enabled),
    accidentModuleEnabled: nullableBoolean(body.accidentModuleEnabled ?? body.accident_module_enabled),
    analyticsEnabled: nullableBoolean(body.analyticsEnabled ?? body.analytics_enabled),
    pdfReportEnabled: nullableBoolean(body.pdfReportEnabled ?? body.pdf_report_enabled),
    apiAccessEnabled: nullableBoolean(body.apiAccessEnabled ?? body.api_access_enabled),
    monthlyPriceRub: nullableNumber(body.monthlyPriceRub ?? body.monthly_price_rub),
  }
}

export function buildPlanUpdatePayload(existing, body = {}) {
  const value = (camel, snake, existingValue, normalize) => (
    body[camel] === undefined && body[snake] === undefined
      ? normalize(existingValue)
      : normalize(body[camel] ?? body[snake])
  )
  return {
    code: existing.code,
    name: body.name === undefined ? existing.name : text(body.name),
    status: body.status === undefined
      ? (existing.status || 'active')
      : (body.status === 'archived' ? 'archived' : 'active'),
    maxVehicles: value('maxVehicles', 'max_vehicles', existing.max_vehicles, nullableNumber),
    maxUsers: value('maxUsers', 'max_users', existing.max_users, nullableNumber),
    maxStorageMb: value('maxStorageMb', 'max_storage_mb', existing.max_storage_mb, nullableNumber),
    ocrEnabled: value('ocrEnabled', 'ocr_enabled', existing.ocr_enabled, nullableBoolean),
    accidentModuleEnabled: value(
      'accidentModuleEnabled',
      'accident_module_enabled',
      existing.accident_module_enabled,
      nullableBoolean,
    ),
    analyticsEnabled: value('analyticsEnabled', 'analytics_enabled', existing.analytics_enabled, nullableBoolean),
    pdfReportEnabled: value('pdfReportEnabled', 'pdf_report_enabled', existing.pdf_report_enabled, nullableBoolean),
    apiAccessEnabled: value('apiAccessEnabled', 'api_access_enabled', existing.api_access_enabled, nullableBoolean),
    monthlyPriceRub: value('monthlyPriceRub', 'monthly_price_rub', existing.monthly_price_rub, nullableNumber),
  }
}

export function upsertCompanyLimits(db, companyId, payload) {
  db.prepare(`
    INSERT INTO company_limits (
      id, company_id, plan_code, max_vehicles, max_users, max_storage_mb, ocr_enabled,
      accident_module_enabled, analytics_enabled, pdf_report_enabled, api_access_enabled, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(company_id) DO UPDATE SET
      plan_code = excluded.plan_code,
      max_vehicles = excluded.max_vehicles,
      max_users = excluded.max_users,
      max_storage_mb = excluded.max_storage_mb,
      ocr_enabled = excluded.ocr_enabled,
      accident_module_enabled = excluded.accident_module_enabled,
      analytics_enabled = excluded.analytics_enabled,
      pdf_report_enabled = excluded.pdf_report_enabled,
      api_access_enabled = excluded.api_access_enabled,
      updated_at = datetime('now')
  `).run(
    uuidv4(),
    companyId,
    payload.planCode,
    payload.maxVehicles,
    payload.maxUsers,
    payload.maxStorageMb,
    databaseBoolean(payload.ocrEnabled),
    databaseBoolean(payload.accidentModuleEnabled),
    databaseBoolean(payload.analyticsEnabled),
    databaseBoolean(payload.pdfReportEnabled),
    databaseBoolean(payload.apiAccessEnabled),
  )
  return mapLimit(db.prepare('SELECT * FROM company_limits WHERE company_id = ?').get(companyId))
}
