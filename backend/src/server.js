import 'dotenv/config'
import express from 'express'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import { LICENSE_PLATE_ALLOWED_CYRILLIC } from './utils/transliteration.js'
import fs from 'fs'
import { initDatabase, getDb } from './db.js'
import registerCompleteInspectionRoutes from './routes/completeInspection.js'
import registerCompanyRoutes from './routes/companies.js'
import registerAuthRoutes, { createOwnerSetupInvitationFactory } from './routes/auth.js'
import registerSaasAdminRoutes from './routes/adminSaas.js'
import registerRegionRoutes from './routes/regions.js'
import registerVehicleRoutes from './routes/vehicles.js'
import registerInspectionRoutes from './routes/inspections.js'
import registerDefectRoutes from './routes/defects.js'
import registerPhotoRoutes from './routes/photos.js'
import { registerOdometerRoutes, registerVehicleNumberRecognitionRoutes } from './routes/odometer.js'
import { photoRequirements, photoTypeLabels, defectCategories } from './routes/photo-requirements.js'
import { createRateLimiter } from './services/rateLimiter.js'
import { isRedisConfigured, getRedisStatus, pingRedis, shutdownRedis } from './services/redisClient.js'
import {
  uploadsDir,
  upload,
  isUploadMiddlewareError,
  getMimeType,
  buildUploadUrl,
  resolveUploadPath,
  removePhotoFilesForRows,
  uploadPhoto,
  removeFileIfExists,
  removePhotoFiles,
  processUploadedPhoto,
} from './services/photoUpload.js'
import { createRequestIdMiddleware } from './middleware/requestId.js'
import { createAccessLogMiddleware } from './middleware/accessLog.js'
import { createSecurityHeadersMiddleware, createCorsMiddleware } from './middleware/security.js'
import { createAuthenticateMiddleware } from './middleware/auth.js'
import {
  isProduction,
  TRUST_PROXY,
  SECURITY_HSTS_ENABLED,
  SECURITY_HSTS_MAX_AGE,
  SECURITY_CSP,
  SECURITY_CROSS_ORIGIN_OPENER_POLICY,
  SECURITY_CROSS_ORIGIN_RESOURCE_POLICY,
  SENSITIVE_RATE_LIMIT_WINDOW_MS,
  SENSITIVE_RATE_LIMIT_MAX,
  AUTH_ACCOUNT_RATE_LIMIT_MAX,
  JSON_BODY_LIMIT,
  GRACEFUL_SHUTDOWN_TIMEOUT_MS,
  REQUEST_ID_HEADER,
  ACCESS_LOG_FORMAT,
  ACCESS_LOG_SLOW_MS,
  ACCESS_LOG_SKIP_PATHS,
  corsOrigins,
  allowAllCorsOrigins,
} from './config.js'

const app = express()
const PORT = process.env.PORT || 3001
let isShuttingDown = false

app.disable('x-powered-by')
app.set('trust proxy', TRUST_PROXY)

app.use(createRequestIdMiddleware({ headerName: REQUEST_ID_HEADER }))
app.use(createAccessLogMiddleware({
  format: ACCESS_LOG_FORMAT,
  slowMs: ACCESS_LOG_SLOW_MS,
  skipPaths: ACCESS_LOG_SKIP_PATHS,
}))
app.use(createSecurityHeadersMiddleware({
  csp: SECURITY_CSP,
  crossOriginOpenerPolicy: SECURITY_CROSS_ORIGIN_OPENER_POLICY,
  crossOriginResourcePolicy: SECURITY_CROSS_ORIGIN_RESOURCE_POLICY,
  hstsEnabled: SECURITY_HSTS_ENABLED,
  hstsMaxAge: SECURITY_HSTS_MAX_AGE,
}))
app.use(createCorsMiddleware({
  allowAllOrigins: allowAllCorsOrigins,
  origins: corsOrigins,
  requestIdHeader: REQUEST_ID_HEADER,
}))

app.use(express.json({ limit: JSON_BODY_LIMIT }))

function sendError(res, status, message) {
  return res.status(status).json({ error: message })
}

function normalizeRateLimitPath(pathname) {
  return String(pathname || '')
    .replace(/^\/api\/users\/[^/]+\/mfa\/verify$/, '/api/users/:id/mfa/verify')
    .replace(/^\/api\/auth\/mfa\/verify$/, '/api/auth/mfa/verify')
}

function sensitiveIpRateLimitKey(req) {
  return [
    'ip',
    req.ip,
    req.method,
    normalizeRateLimitPath(req.path),
  ].join(':')
}

function sensitiveAccountRateLimitKey(req) {
  const accountKey = String(req.body?.email || req.params?.id || req.body?.token || '').trim().toLowerCase()
  return [
    'account',
    req.ip,
    req.method,
    normalizeRateLimitPath(req.path),
    accountKey,
  ].join(':')
}

function noStore(req, res, next) {
  res.setHeader('Cache-Control', 'no-store')
  next()
}

const sensitiveIpRateLimit = createRateLimiter({
  name: 'sensitive-ip',
  windowMs: SENSITIVE_RATE_LIMIT_WINDOW_MS,
  max: SENSITIVE_RATE_LIMIT_MAX,
  keyGenerator: sensitiveIpRateLimitKey,
})

const sensitiveAccountRateLimit = createRateLimiter({
  name: 'sensitive-account',
  windowMs: SENSITIVE_RATE_LIMIT_WINDOW_MS,
  max: AUTH_ACCOUNT_RATE_LIMIT_MAX,
  keyGenerator: sensitiveAccountRateLimitKey,
})

const publicAuthRateLimit = [noStore, sensitiveIpRateLimit, sensitiveAccountRateLimit]
const authenticatedSensitiveRateLimit = [noStore, sensitiveIpRateLimit]

function isTenantUserEndpoint(pathname) {
  const path = String(pathname || '')
  return [
    '/api/vehicles',
    '/api/inspections',
    '/api/defects',
    '/api/photos',
    '/api/users',
    '/api/dashboard',
    '/api/analytics',
    '/api/notifications',
    '/api/settings',
    '/api/company',
    '/api/companies',
    '/api/regions',
    '/api/photo-requirements',
    '/api/defect-categories',
    '/api/seed',
    '/uploads',
  ].some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}

function buildLivenessPayload() {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    uptimeSeconds: Math.round(process.uptime()),
    version: '1.0.0',
    service: 'audit-backend',
  }
}

async function checkUploadsWritable() {
  const probePath = path.join(uploadsDir, `.healthcheck-${process.pid}-${Date.now()}.tmp`)
  await fs.promises.mkdir(uploadsDir, { recursive: true })
  await fs.promises.writeFile(probePath, 'ok', 'utf8')
  await fs.promises.unlink(probePath)
  return true
}

async function buildReadinessPayload() {
  const checks = {
    shutdown: !isShuttingDown,
    database: false,
    uploads: false,
    redis: !isRedisConfigured(),
  }
  const errors = []

  if (isShuttingDown) {
    errors.push('Server is shutting down')
  }

  try {
    const result = db.prepare('SELECT 1 as ok').get()
    checks.database = Number(result?.ok) === 1
    if (!checks.database) {
      errors.push('Database query did not return expected result')
    }
  } catch (error) {
    errors.push(`Database check failed: ${error.message}`)
  }

  try {
    checks.uploads = await checkUploadsWritable()
  } catch (error) {
    errors.push(`Uploads check failed: ${error.message}`)
  }

  if (isRedisConfigured()) {
    try {
      const ping = await pingRedis()
      checks.redis = ping.ok
      if (!ping.ok) {
        errors.push(`Redis ping failed: ${ping.reason || 'unknown'}`)
      }
    } catch (error) {
      checks.redis = false
      errors.push(`Redis check failed: ${error.message}`)
    }
  }

  const ok = Object.values(checks).every(Boolean)

  return {
    ...buildLivenessPayload(),
    status: ok ? 'ok' : 'error',
    ready: ok,
    checks,
    errors,
    redis: isRedisConfigured() ? getRedisStatus() : { configured: false },
  }
}

app.get(['/health', '/api/health', '/api/health/live'], (req, res) => {
  res.json(buildLivenessPayload())
})

app.get('/api/health/ready', async (req, res) => {
  const payload = await buildReadinessPayload()
  res.status(payload.ready ? 200 : 503).json(payload)
})

app.use((req, res, next) => {
  if (!isShuttingDown) {
    next()
    return
  }

  res.setHeader('Connection', 'close')
  return sendError(res, 503, 'Server is shutting down')
})

const authenticate = createAuthenticateMiddleware({
  getDb: () => db,
  getApiMessages: () => API_MESSAGES,
  sendError,
  isTenantUserEndpoint,
})

const PHOTO_SELECT_COLUMNS = `
  id, inspection_id, defect_id, company_id, photo_type, url, original_url, webp_url, thumb_url,
  original_mime, original_name, width, height, size_original, size_webp, size_thumb, hash,
  geo, is_required, created_at
`

// Protected uploads - require authentication and tenant ownership.
app.get('/uploads/*', authenticate, (req, res) => {
  const resolved = resolveUploadPath(req.params[0])
  if (!resolved) {
    return sendError(res, 400, 'Invalid upload path')
  }

  const url = buildUploadUrl(resolved.relativePath)
  const companyId = req.user.company_id || 'default'
  const photo = db.prepare(`
    SELECT id
    FROM photos
    WHERE company_id = ?
      AND (url = ? OR original_url = ? OR webp_url = ? OR thumb_url = ?)
  `).get(companyId, url, url, url, url)

  if (!photo) {
    return sendError(res, 404, 'Photo not found')
  }

  const filePath = resolved.filePath
  if (!fs.existsSync(filePath)) {
    return sendError(res, 404, 'Photo file not found')
  }

  res.setHeader('Content-Type', getMimeType(filePath))
  res.setHeader('Cache-Control', 'private, max-age=31536000')
  res.sendFile(filePath)
})

const db = getDb()
const NUMERIC_SETTING_KEYS = new Set(['scheduled_inspection_days', 'notification_days_before', 'timezone_offset'])

function readSettings() {
  const settings = db.prepare('SELECT key, value FROM settings').all()
  const result = {}

  settings.forEach((setting) => {
    result[setting.key] = NUMERIC_SETTING_KEYS.has(setting.key) ? Number(setting.value) : setting.value
  })

  return result
}

function getUserSummaryById(id, companyId = null) {
  const query = companyId
    ? db.prepare('SELECT id, email, name, role, status, company_id FROM users WHERE id = ? AND company_id = ?')
    : db.prepare('SELECT id, email, name, role, status, company_id FROM users WHERE id = ?')

  return companyId ? query.get(id, companyId) : query.get(id)
}

function getUserIdByEmail(email) {
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
  return user?.id ?? null
}

function getUserRecordById(id, companyId = null) {
  const query = companyId
    ? db.prepare('SELECT id, email, name, role, status, company_id, created_at FROM users WHERE id = ? AND company_id = ?')
    : db.prepare('SELECT id, email, name, role, status, company_id, created_at FROM users WHERE id = ?')

  return companyId ? query.get(id, companyId) : query.get(id)
}

function getVehicleById(id, companyId = null) {
  const query = companyId
    ? db.prepare(`
      SELECT id, number, name, status, region, company_id, created_at, last_scheduled_inspection
      FROM vehicles
      WHERE id = ? AND company_id = ?
    `)
    : db.prepare(`
    SELECT id, number, name, status, region, company_id, created_at, last_scheduled_inspection
    FROM vehicles
    WHERE id = ?
  `)

  return companyId ? query.get(id, companyId) : query.get(id)
}

function normalizeCompanyLimit(value) {
  if (value === null || value === undefined || value === '') return null
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric < 0) return null
  return Math.floor(numeric)
}

function normalizeCompanyFeatureFlag(value) {
  if (value === null || value === undefined || value === '') return null
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

function buildCompanyResourceUsage(companyId, resource) {
  const limits = getCompanyLimits(companyId)
  const field = resource === 'vehicles' ? 'max_vehicles' : resource === 'users' ? 'max_users' : null
  const current = getCompanyResourceUsage(companyId, resource)
  const max = field ? normalizeCompanyLimit(limits?.[field]) : null
  const remaining = max === null ? null : Math.max(max - current, 0)
  const percent = max === null || max <= 0 ? null : Math.min(100, Math.round((current / max) * 100))

  return {
    current,
    max,
    remaining,
    percent,
    unlimited: max === null,
    exceeded: max !== null && current > max,
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

function buildCompanyFeatureAccess(limits, featureField) {
  const configured = normalizeCompanyFeatureFlag(limits?.[featureField])

  return {
    enabled: configured !== false,
    configured,
  }
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

function getDaysUntilDate(value) {
  if (!value) return null
  const target = new Date(value)
  if (Number.isNaN(target.getTime())) return null

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  target.setUTCHours(0, 0, 0, 0)

  return Math.ceil((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
}

function getCompanySubscriptionSummary(companyId) {
  const subscription = db.prepare(`
    SELECT id, plan_code, status, current_period_start, current_period_end,
           grace_until, mrr_rub, updated_at
    FROM company_subscriptions
    WHERE company_id = ?
  `).get(companyId)

  if (!subscription) return null

  return {
    id: subscription.id,
    planCode: subscription.plan_code || null,
    status: subscription.status || 'active',
    currentPeriodStart: subscription.current_period_start || null,
    currentPeriodEnd: subscription.current_period_end || null,
    graceUntil: subscription.grace_until || null,
    mrrRub: Number(subscription.mrr_rub || 0),
    daysUntilEnd: getDaysUntilDate(subscription.current_period_end),
    updatedAt: subscription.updated_at || null,
  }
}

function buildCompanyServiceWarnings(company, subscription) {
  const warnings = []

  if (company?.status === 'inactive') {
    warnings.push({
      type: 'company_inactive',
      severity: 'danger',
      title: 'Компания отключена',
      message: API_MESSAGES.companyInactive,
    })
  }

  if (!subscription) return warnings

  if (subscription.status === 'suspended') {
    warnings.push({
      type: 'subscription_suspended',
      severity: 'danger',
      title: 'Подписка приостановлена',
      message: API_MESSAGES.subscriptionSuspended,
    })
    return warnings
  }

  if (subscription.status === 'expired') {
    warnings.push({
      type: 'subscription_expired',
      severity: 'danger',
      title: 'Тариф истек',
      message: API_MESSAGES.subscriptionExpired,
    })
    return warnings
  }

  if (subscription.status === 'grace') {
    warnings.push({
      type: 'subscription_grace',
      severity: 'warning',
      title: 'Идет льготный период',
      message: subscription.graceUntil
        ? `Продлите тариф до ${subscription.graceUntil}, чтобы избежать приостановки.`
        : 'Продлите тариф, чтобы избежать приостановки.',
    })
    return warnings
  }

  if (subscription.status === 'expiring' || (subscription.daysUntilEnd !== null && subscription.daysUntilEnd <= 14)) {
    const days = subscription.daysUntilEnd
    warnings.push({
      type: 'subscription_expiring',
      severity: days !== null && days <= 3 ? 'warning' : 'info',
      title: 'Тариф скоро закончится',
      message: days !== null
        ? `До окончания тарифа осталось ${Math.max(days, 0)} дн.`
        : 'Проверьте дату окончания тарифа.',
    })
  }

  return warnings
}

function getCompanyServiceNotifications(companyId, user) {
  return db.prepare(`
    SELECT id, type, title, message, status, created_at
    FROM company_notifications
    WHERE company_id = ?
      AND (
        recipient_user_id = ?
        OR (recipient_user_id IS NULL AND recipient_role = ?)
        OR (recipient_user_id IS NULL AND recipient_role IN ('company_owner', 'tenant') AND ? = 'owner')
      )
      AND COALESCE(recipient_role, '') != 'admin'
    ORDER BY CASE WHEN status = 'new' THEN 0 ELSE 1 END, created_at DESC
    LIMIT 5
  `).all(companyId, user?.id || '', user?.role || '', user?.role || '').map((item) => ({
    id: item.id,
    type: item.type,
    title: item.title,
    message: item.message || null,
    status: item.status || 'new',
    createdAt: item.created_at || null,
  }))
}

function getServiceNotificationRecipients(companyId) {
  return db.prepare(`
    SELECT id, email, name, role, status, service_notifications_enabled, service_notification_types
    FROM users
    WHERE company_id = ?
      AND role IN ('owner', 'manager')
      AND COALESCE(status, 'active') = 'active'
    ORDER BY CASE role WHEN 'owner' THEN 0 ELSE 1 END, name COLLATE NOCASE
  `).all(companyId).map((user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status || 'active',
    serviceNotificationsEnabled: user.role === 'owner' ? true : Boolean(user.service_notifications_enabled),
    serviceNotificationTypes: parseJsonArray(user.service_notification_types),
    locked: user.role === 'owner',
  }))
}

function parseJsonArray(value) {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}

function writeTenantAuditLog(req, action, entityType, entityId, payload = null) {
  try {
    db.prepare(`
      INSERT INTO audit_logs (id, company_id, actor_user_id, actor_role, action, entity_type, entity_id, payload_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      req.user?.company_id || 'default',
      req.user?.id || null,
      req.user?.role || null,
      action,
      entityType,
      entityId,
      payload ? JSON.stringify(payload) : null,
    )
  } catch (error) {
    console.warn('Unable to write tenant audit log:', error.message)
  }
}

function getInspectionById(id, companyId = null) {
  const query = companyId
    ? db.prepare('SELECT * FROM inspections WHERE id = ? AND company_id = ?')
    : db.prepare('SELECT * FROM inspections WHERE id = ?')

  return companyId ? query.get(id, companyId) : query.get(id)
}

function createUserRecord({ id, email, passwordHash, name, role, status = 'active', companyId = 'default', ignoreExisting = false }) {
  const statement = ignoreExisting
    ? db.prepare('INSERT OR IGNORE INTO users (id, email, password, name, role, status, company_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
    : db.prepare('INSERT INTO users (id, email, password, name, role, status, company_id) VALUES (?, ?, ?, ?, ?, ?, ?)')

  return statement.run(id, email, passwordHash, name, role, status, companyId)
}

function updateUserRecord(id, { email, name, role, status, passwordHash, companyId = null }) {
  const update = (sql, params) => {
    if (!companyId) {
      return db.prepare(sql).run(...params)
    }

    return db.prepare(`${sql} AND company_id = ?`).run(...params, companyId)
  }

  if (email !== undefined) {
    update('UPDATE users SET email = ? WHERE id = ?', [email, id])
  }

  if (name !== undefined) {
    update('UPDATE users SET name = ? WHERE id = ?', [name, id])
  }

  if (role !== undefined) {
    update('UPDATE users SET role = ? WHERE id = ?', [role, id])
  }

  if (status !== undefined) {
    update('UPDATE users SET status = ? WHERE id = ?', [status, id])
  }

  if (passwordHash !== undefined) {
    update('UPDATE users SET password = ? WHERE id = ?', [passwordHash, id])
  }
}

function upsertSettingValue(key, value) {
  return db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value))
}

function randomInteger(maxExclusive) {
  return Math.floor(Math.random() * maxExclusive)
}

function randomItem(items) {
  return items[randomInteger(items.length)]
}

function randomDateBetween(startDate, endDate) {
  const start = startDate.getTime()
  const end = endDate.getTime()
  const timestamp = start + Math.random() * Math.max(end - start, 1)
  return new Date(timestamp)
}

function generateDemoVehicleNumber() {
  const pickLetter = () => LICENSE_PLATE_ALLOWED_CYRILLIC[Math.floor(Math.random() * LICENSE_PLATE_ALLOWED_CYRILLIC.length)]
  const digits = String(Math.floor(Math.random() * 1000)).padStart(3, '0')
  const regionNumber = String(10 + Math.floor(Math.random() * 190)).padStart(2, '0')
  return `${pickLetter()}${digits}${pickLetter()}${pickLetter()}${regionNumber}`
}

const API_MESSAGES = {
  authRequired: 'Authorization required',
  invalidToken: 'Invalid token',
  loginCredentialsRequired: 'Enter email and password',
  invalidCredentials: 'Invalid email or password',
  userNotFound: 'User not found',
    invalidPassword: 'Invalid password',
    userInactive: 'User is inactive',
  accessDenied: 'Access denied',
  mfaNotConfigured: 'MFA not configured',
  invalidMfaCode: 'Invalid MFA code',
  registerFieldsRequired: 'Enter email, password and name',
  userEmailExists: 'User with this email already exists',
    managersOnly: 'Access only for managers',
    companyOwnersOnly: 'Access only for company owners',
    adminsOnly: 'Access only for admins',
  allFieldsRequired: 'Fill in all fields',
  emailAlreadyUsed: 'Email already used',
  noAccess: 'No access',
  selfDeleteForbidden: 'Cannot delete yourself',
  vehicleFieldsRequired: 'Enter vehicle number and name',
  vehicleNumberExists: 'Vehicle with this number already exists',
  invalidVehicleNumber: 'Некорректный номер. Используйте формат А123ВС77 или А123ВС177. Разрешены только А, В, Е, К, М, Н, О, Р, С, Т, У, Х',
  vehicleNotFound: 'Vehicle not found',
  vehicleLimitExceeded: 'Лимит техники компании исчерпан. Обратитесь к администратору ресурса',
  userLimitExceeded: 'Лимит пользователей компании исчерпан. Обратитесь к администратору ресурса',
  companyFeatureDisabled: 'Функция отключена для тарифа компании. Обратитесь к администратору ресурса',
  ocrFeatureDisabled: 'OCR отключен для тарифа компании. Обратитесь к администратору ресурса',
  analyticsFeatureDisabled: 'Аналитика отключена для тарифа компании. Обратитесь к администратору ресурса',
  accidentModuleDisabled: 'Модуль ДТП отключен для тарифа компании. Обратитесь к администратору ресурса',
  companyInactive: 'Компания отключена администратором ресурса',
  subscriptionExpired: 'Срок действия тарифа истек. Новые операции временно недоступны до продления',
  subscriptionSuspended: 'Подписка компании приостановлена. Операционный контур доступен только для чтения',
  regionNameRequired: 'Enter region name',
  regionNotFound: 'Region not found',
  regionInUse: 'Cannot delete region while it is used in vehicle cards',
  invalidRegion: 'Select region from directory',
  inspectionNotFound: 'Inspection not found',
  defectNotFound: 'Defect not found',
  invalidPhotoType: 'Invalid photo type',
  photosRequiredForInspection: 'Upload all required inspection photos',
  accidentDetailsRequired: 'Укажите время и место ДТП',
  demoDataCreated: 'Demo data created',
  odometerValueRequired: 'Enter correct odometer value',
  odometerPhotoRequired: 'Фото одометра обязательно',
  odometerRequiresManualConfirmation: 'Требуется ручное подтверждение показаний',
  vehicleNumberRequired: 'Enter vehicle number',
  vehicleNumberPhotoRequired: 'Фото номера обязательно',
  vehicleNumberRequiresConfirmation: 'Требуется подтверждение номера инспектором',
  internalServerError: 'Internal server error',
}

// Register the complete-inspection route after API_MESSAGES is defined
registerCompleteInspectionRoutes({ app, db, API_MESSAGES, getInspectionById, authenticate, photoRequirements, ensureOperationalWriteAllowed: ensureCompanyOperationalWriteAllowed })

// Register company routes
registerCompanyRoutes({ app, db, authenticate, isAdmin })

// Register odometer and vehicle number recognition routes
registerOdometerRoutes({ app, db, authenticate, API_MESSAGES, upload, ensureFeatureEnabled: ensureCompanyFeatureEnabled, ensureOperationalWriteAllowed: ensureCompanyOperationalWriteAllowed })
registerVehicleNumberRecognitionRoutes({ app, db, authenticate, API_MESSAGES, upload, ensureFeatureEnabled: ensureCompanyFeatureEnabled, ensureOperationalWriteAllowed: ensureCompanyOperationalWriteAllowed })

function sendInternalError(res, scope, err) {
  console.error(`${scope}:`, err)
  return res.status(500).json({ error: API_MESSAGES.internalServerError })
}

const ASSIGNABLE_USER_ROLES = new Set(['inspector', 'manager'])

function isManager(req) {
  return req.user?.role === 'manager' || req.user?.role === 'owner'
}

function isAdmin(req) {
  return req.user?.role === 'admin'
}

function isCompanyOwner(req) {
  return req.user?.role === 'owner'
}

function isSelf(req, userId) {
  return req.user?.id === userId
}

function ensureManager(req, res, message = API_MESSAGES.managersOnly) {
  if (isManager(req)) return true
  sendError(res, 403, message)
  return false
}

function ensureManagerOrSelf(req, res, userId, message = API_MESSAGES.noAccess) {
  if (isManager(req) || isSelf(req, userId)) return true
  sendError(res, 403, message)
  return false
}

function ensureCompanyOwner(req, res, message = API_MESSAGES.companyOwnersOnly) {
  if (isCompanyOwner(req)) return true
  sendError(res, 403, message)
  return false
}

function ensureCompanyOwnerOrSelf(req, res, userId, message = API_MESSAGES.noAccess) {
  if (isCompanyOwner(req) || isSelf(req, userId)) return true
  sendError(res, 403, message)
  return false
}

function ensureAdmin(req, res, message = API_MESSAGES.adminsOnly) {
  if (isAdmin(req)) return true
  sendError(res, 403, message)
  return false
}

function canAssignRole(req, role) {
  if (!role || !ASSIGNABLE_USER_ROLES.has(role)) return false
  return isCompanyOwner(req)
}

function isAssignableCompanyUserRole(role) {
  return ASSIGNABLE_USER_ROLES.has(role)
}

const createOwnerSetupInvitation = createOwnerSetupInvitationFactory({ db })
registerSaasAdminRoutes({ app, db, authenticate, ensureAdmin, sendError, API_MESSAGES, createOwnerSetupInvitation })

// ============ AUTH ============

registerAuthRoutes({
  app,
  db,
  authenticate,
  publicAuthRateLimit,
  authenticatedSensitiveRateLimit,
  noStore,
  sendError,
  API_MESSAGES,
  getUserSummaryById,
  getUserIdByEmail,
  getUserRecordById,
  createUserRecord,
  updateUserRecord,
  ensureCompanyOwnerOrSelf,
  isSelf,
  isAssignableCompanyUserRole,
})

app.get('/api/company/usage', authenticate, (req, res) => {
  const companyId = req.user.company_id || 'default'
  const company = db.prepare(`
    SELECT id, slug, name, status
    FROM companies
    WHERE id = ?
  `).get(companyId) || {
    id: companyId,
    slug: companyId,
    name: 'Компания',
    status: 'active',
  }
  const limits = getCompanyLimits(companyId)
  const subscription = getCompanySubscriptionSummary(companyId)

  res.json({
    company,
    plan: {
      code: limits?.plan_code || subscription?.planCode || null,
    },
    subscription,
    serviceWarnings: buildCompanyServiceWarnings(company, subscription),
    alerts: getCompanyServiceNotifications(companyId, req.user),
    usage: {
      vehicles: buildCompanyResourceUsage(companyId, 'vehicles'),
      users: buildCompanyResourceUsage(companyId, 'users'),
    },
    limits: {
      maxStorageMb: normalizeCompanyLimit(limits?.max_storage_mb),
    },
    features: {
      ocr: buildCompanyFeatureAccess(limits, 'ocr_enabled'),
      accidentModule: buildCompanyFeatureAccess(limits, 'accident_module_enabled'),
      analytics: buildCompanyFeatureAccess(limits, 'analytics_enabled'),
      apiAccess: buildCompanyFeatureAccess(limits, 'api_access_enabled'),
    },
    updatedAt: limits?.updated_at || null,
  })
})

app.get('/api/company/service-notification-recipients', authenticate, (req, res) => {
  if (!ensureCompanyOwner(req, res)) return

  const companyId = req.user.company_id || 'default'
  res.json({
    recipients: getServiceNotificationRecipients(companyId),
  })
})

app.put('/api/company/service-notification-recipients', authenticate, (req, res) => {
  if (!ensureCompanyOwner(req, res)) return

  const companyId = req.user.company_id || 'default'
  const recipients = Array.isArray(req.body?.recipients) ? req.body.recipients : []
  const managerIds = new Set(
    recipients
      .filter((item) => item && typeof item.id === 'string')
      .filter((item) => Boolean(item.serviceNotificationsEnabled))
      .map((item) => item.id),
  )

  const managers = db.prepare(`
    SELECT id
    FROM users
    WHERE company_id = ? AND role = 'manager' AND COALESCE(status, 'active') = 'active'
  `).all(companyId)
  const validManagerIds = new Set(managers.map((manager) => manager.id))
  const enabledIds = [...managerIds].filter((id) => validManagerIds.has(id))

  db.prepare(`
    UPDATE users
    SET service_notifications_enabled = 0,
        service_notification_types = NULL
    WHERE company_id = ? AND role = 'manager'
  `).run(companyId)

  if (enabledIds.length) {
    db.prepare(`
      UPDATE users
      SET service_notifications_enabled = 1,
          service_notification_types = ?
      WHERE company_id = ? AND role = 'manager' AND id IN (${enabledIds.map(() => '?').join(',')})
    `).run(JSON.stringify(['subscription', 'system', 'limits']), companyId, ...enabledIds)
  }

  writeTenantAuditLog(req, 'service_notification_recipients_updated', 'company', companyId, {
    enabledManagerIds: enabledIds,
  })

  res.json({
    recipients: getServiceNotificationRecipients(companyId),
  })
})

// ============ USERS ============

app.get('/api/users', authenticate, (req, res) => {
  if (!ensureCompanyOwner(req, res)) return
  const companyId = req.user.company_id || 'default'
  
  const users = db.prepare(`
    SELECT id, email, name, role, status, company_id, created_at, mfa_enabled FROM users WHERE company_id = ? ORDER BY created_at DESC
  `).all(companyId)
  
  res.json(users)
})

app.get('/api/users/:id', authenticate, (req, res) => {
  if (!ensureCompanyOwnerOrSelf(req, res, req.params.id)) return

  const companyId = req.user.company_id || 'default'
  const user = getUserRecordById(req.params.id, isSelf(req, req.params.id) ? null : companyId)
  if (!user) {
    return sendError(res, 404, API_MESSAGES.userNotFound)
  }
  res.json(user)
})

app.post('/api/users', authenticate, (req, res) => {
  if (!ensureCompanyOwner(req, res)) return
  if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'write' })) return

  const companyId = req.user.company_id || 'default'
  
  const { email, password, name, role = 'inspector' } = req.body
  
  if (!email || !password || !name) {
    return sendError(res, 400, API_MESSAGES.allFieldsRequired)
  }

  if (!canAssignRole(req, role)) {
    return sendError(res, 403, API_MESSAGES.accessDenied)
  }
  
  const existing = getUserIdByEmail(email)
  if (existing) {
    return sendError(res, 400, API_MESSAGES.emailAlreadyUsed)
  }

  const limitViolation = getCompanyLimitViolation(companyId, 'users')
  if (limitViolation) {
    return sendCompanyLimitViolation(res, limitViolation)
  }
  
  const id = uuidv4()
  const hashedPassword = bcrypt.hashSync(password, 10)

  createUserRecord({ id, email, passwordHash: hashedPassword, name, role, companyId })
  
  const user = getUserRecordById(id, companyId)
  res.status(201).json(user)
})

app.put('/api/users/:id', authenticate, (req, res) => {
  if (!ensureCompanyOwnerOrSelf(req, res, req.params.id)) return
  if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'write' })) return

  const companyId = req.user.company_id || 'default'
  const targetUser = getUserRecordById(req.params.id, isSelf(req, req.params.id) ? null : companyId)
  if (!targetUser) {
    return sendError(res, 404, API_MESSAGES.userNotFound)
  }
  
  const { email, name, role, password } = req.body
  
  if (!isCompanyOwner(req)) {
    // Users can only update their own name
    if (name) {
      updateUserRecord(req.params.id, { name, companyId: targetUser.company_id })
    }
  } else {
    // Company owners can manage managers and inspectors in their own company.
    if (!isSelf(req, req.params.id) && !isAssignableCompanyUserRole(targetUser.role)) {
      return sendError(res, 403, API_MESSAGES.accessDenied)
    }

    const requestedRole = role === targetUser.role ? undefined : role
    if (isSelf(req, req.params.id) && !isAssignableCompanyUserRole(targetUser.role) && requestedRole !== undefined) {
      return sendError(res, 403, API_MESSAGES.accessDenied)
    }
    if (requestedRole !== undefined && !canAssignRole(req, requestedRole)) {
      return sendError(res, 403, API_MESSAGES.accessDenied)
    }

    if (email) {
      const existing = getUserIdByEmail(email)
      if (existing && existing !== req.params.id) {
        return sendError(res, 400, API_MESSAGES.emailAlreadyUsed)
      }
    }

    const passwordHash = password ? bcrypt.hashSync(password, 10) : undefined
    updateUserRecord(req.params.id, { email, name, role: requestedRole, passwordHash, companyId: targetUser.company_id })
  }
  
  const user = getUserRecordById(req.params.id, targetUser.company_id)
  res.json(user)
})

app.delete('/api/users/:id', authenticate, (req, res) => {
  if (!ensureCompanyOwner(req, res)) return
  if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'write' })) return
  
  if (isSelf(req, req.params.id)) {
    return sendError(res, 400, API_MESSAGES.selfDeleteForbidden)
  }

  const companyId = req.user.company_id || 'default'
  const user = getUserRecordById(req.params.id, companyId)
  if (!user) {
    return sendError(res, 404, API_MESSAGES.userNotFound)
  }
  if (!isAssignableCompanyUserRole(user.role)) {
    return sendError(res, 403, API_MESSAGES.accessDenied)
  }
  
  db.prepare('DELETE FROM users WHERE id = ? AND company_id = ?').run(req.params.id, companyId)
  res.status(204).send()
})

// ============ REGIONS ============

registerRegionRoutes({
  app,
  db,
  authenticate,
  sendError,
  API_MESSAGES,
  ensureManager,
  ensureCompanyOperationalWriteAllowed,
})

// ============ VEHICLES ============

registerVehicleRoutes({
  app,
  db,
  authenticate,
  sendError,
  sendInternalError,
  sendCompanyLimitViolation,
  API_MESSAGES,
  PHOTO_SELECT_COLUMNS,
  getVehicleById,
  getCompanyLimitViolation,
  getCompanyResourceLimitState,
  ensureManager,
  ensureCompanyOperationalWriteAllowed,
})

// ============ INSPECTIONS ============

registerInspectionRoutes({
  app,
  db,
  authenticate,
  sendError,
  API_MESSAGES,
  PHOTO_SELECT_COLUMNS,
  getVehicleById,
  getInspectionById,
  ensureCompanyFeatureEnabled,
  ensureCompanyOperationalWriteAllowed,
  removePhotoFilesForRows,
})

// ============ DEFECTS ============

registerDefectRoutes({
  app,
  db,
  authenticate,
  sendError,
  API_MESSAGES,
  PHOTO_SELECT_COLUMNS,
  ensureCompanyOperationalWriteAllowed,
  removePhotoFilesForRows,
})

// ============ PHOTOS ============

registerPhotoRoutes({
  app,
  db,
  authenticate,
  sendError,
  API_MESSAGES,
  PHOTO_SELECT_COLUMNS,
  photoRequirements,
  uploadPhoto,
  processUploadedPhoto,
  removeFileIfExists,
  removePhotoFiles,
  ensureCompanyOperationalWriteAllowed,
})

// ============ SETTINGS ============

app.get('/api/settings', authenticate, (req, res) => {
  res.json(readSettings())
})

app.put('/api/settings', authenticate, (req, res) => {
  if (!ensureManager(req, res, API_MESSAGES.settingsManagerOnly)) return
  if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'write' })) return
  
  const { scheduled_inspection_days, notification_days_before, timezone_offset } = req.body
  
  if (scheduled_inspection_days !== undefined) {
    upsertSettingValue('scheduled_inspection_days', scheduled_inspection_days)
  }
  if (notification_days_before !== undefined) {
    upsertSettingValue('notification_days_before', notification_days_before)
  }
  if (timezone_offset !== undefined) {
    upsertSettingValue('timezone_offset', timezone_offset)
  }
  return res.json(readSettings())
  
})

// Get photo requirements for an inspection type
app.get('/api/photo-requirements/:type', authenticate, (req, res) => {
  const { type } = req.params
  if (!photoRequirements[type]) {
    return res.status(400).json({ error: 'Неизвестный тип осмотра' })
  }
  res.json({
    type,
    requirements: photoRequirements[type],
    labels: photoTypeLabels.ru  // Default to Russian labels
  })
})

// Get defect categories
app.get('/api/defect-categories', authenticate, (req, res) => {
  res.json({
    categories: defectCategories.ru  // Default to Russian
  })
})

// ============ NOTIFICATIONS ============

app.get('/api/notifications', authenticate, (req, res) => {
  try {
    const settings = readSettings()
    const scheduledDays = Number(settings.scheduled_inspection_days ?? 30)
    const notifyDays = Number(settings.notification_days_before ?? 3)
    const companyId = req.user.company_id || 'default'
    
    const vehicles = db.prepare('SELECT id, number, name, last_scheduled_inspection FROM vehicles WHERE status = ? AND company_id = ?').all('active', companyId)

    const now = new Date()
    const notifications = vehicles.map(v => {
      const defaultLastDate = new Date(now.getTime() - 1000 * 24 * 60 * 60 * 1000)
      const lastDateStr = v.last_scheduled_inspection || defaultLastDate.toISOString().split('T')[0]
      const lastDate = new Date(lastDateStr)
      const nextDue = new Date(lastDate)
      nextDue.setDate(nextDue.getDate() + scheduledDays)
      const daysUntil = Math.ceil((nextDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      return {
        vehicle_id: v.id,
        vehicle_number: v.number,
        vehicle_name: v.name,
        last_inspection: v.last_scheduled_inspection,
        next_due: nextDue.toISOString().split('T')[0],
        days_until: daysUntil,
        is_overdue: daysUntil <= 0
      }
    }).filter(n => n.days_until <= notifyDays)
      .sort((a, b) => a.days_until - b.days_until)

    res.json(notifications)
  } catch (err) {
    console.error('Notifications error:', err)
    return sendInternalError(res, 'Notifications error', err)
  }
})

// ============ DASHBOARD STATS ============

app.get('/api/dashboard/stats', authenticate, (req, res) => {
  const today = new Date().toISOString().split('T')[0]
  const companyId = req.user.company_id || 'default'

  const totalVehicles = db.prepare('SELECT COUNT(*) as count FROM vehicles WHERE company_id = ?').get(companyId).count
  const totalInspections = db.prepare('SELECT COUNT(*) as count FROM inspections WHERE company_id = ?').get(companyId).count
  
  const todayInspections = db.prepare(`
    SELECT COUNT(*) as count FROM inspections 
    WHERE company_id = ? AND date(created_at) = date(?)
  `).get(companyId, today).count

  const vehiclesWithDefects = db.prepare(`
    SELECT COUNT(DISTINCT v.id) as count
    FROM vehicles v
    JOIN inspections i ON i.vehicle_id = v.id
    JOIN defects d ON d.inspection_id = i.id
    WHERE v.company_id = ?
  `).get(companyId).count

  res.json({
    totalVehicles,
    totalInspections,
    inspectionsToday: todayInspections,
    vehiclesWithDefects
  })
})

// ============ SEED DATA ============

app.post('/api/seed', authenticate, (req, res) => {
  if (!ensureManager(req, res)) return

  const { vehicles = 50, inspections = 100 } = req.body

  // Create default company if none exists
  const existingCompanies = db.prepare('SELECT COUNT(*) as count FROM companies').get().count
  if (existingCompanies === 0) {
    db.prepare(`
      INSERT INTO companies (id, slug, name, region_code, data_residency, api_cluster_key, storage_cluster_key, ocr_cluster_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'default',
      'default',
      'Тестовая компания',
      'RU-MOS',
      'Russia',
      'default-key',
      'default-storage',
      'default-ocr'
    )
  }

  // Try to update all records to use default (may fail if column doesn't exist yet)
  try {
    db.prepare('UPDATE users SET company_id = ? WHERE company_id IS NULL OR company_id = ? OR company_id = ?').run('default', 'default', 'default')
    db.prepare('UPDATE vehicles SET company_id = ? WHERE company_id IS NULL OR company_id = ? OR company_id = ?').run('default', 'default', 'default')
    db.prepare('UPDATE inspections SET company_id = ? WHERE company_id IS NULL OR company_id = ? OR company_id = ?').run('default', 'default', 'default')
    db.prepare('UPDATE defects SET company_id = ? WHERE company_id IS NULL OR company_id = ? OR company_id = ?').run('default', 'default', 'default')
  } catch (e) {
    console.log('Note: Some company_id columns may not exist yet:', e.message)
  }

  // Create demo users
  const demoUsers = [
    { email: 'demo_inspector_1@example.com', name: 'Иванов Иван', role: 'inspector' },
    { email: 'demo_inspector_2@example.com', name: 'Петров Петр', role: 'inspector' },
    { email: 'demo_manager@example.com', name: 'Сидоров Сидор', role: 'manager' }
  ]

  const userIds = []

  demoUsers.forEach(user => {
    const id = uuidv4()
    const hashedPassword = bcrypt.hashSync('demo123', 10)
    createUserRecord({ id, email: user.email, passwordHash: hashedPassword, name: user.name, role: user.role, ignoreExisting: true })

    const persistedUserId = getUserIdByEmail(user.email)
    if (persistedUserId) {
      userIds.push(persistedUserId)
    }
  })

// Create vehicles
  const now = new Date()
  const vehicleRecords = []
  const latestScheduledInspectionByVehicle = new Map()
  const insertVehicle = db.prepare(`
    INSERT INTO vehicles (id, number, name, status, region, company_id, created_at, last_scheduled_inspection)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const carNames = ['ГАЗель Next', 'ГАЗель Бизнес', 'Соболь', 'Ford Transit', 'Mercedes Sprinter', 'Volkswagen Crafter']
  const statuses = ['active', 'repair']
  const regions = ['Москва', 'Московская обл.', 'Санкт-Петербург', 'Краснодар', 'Екатеринбург', 'Новосибирск']
  const companyId = 'default'

  for (let i = 1; i <= vehicles; i++) {
    const id = uuidv4()
    const number = generateDemoVehicleNumber()
    const name = randomItem(carNames)
    const status = randomItem(statuses)
    const region = randomItem(regions)
    const createdAt = randomDateBetween(new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000), now).toISOString()

    insertVehicle.run(id, number, name, status, region, companyId, createdAt, null)
    vehicleRecords.push({ id, createdAt })
  }

  // Create inspections
  const insertInspection = db.prepare(`
    INSERT INTO inspections (id, vehicle_id, inspector_id, type, completed, accident_occurred_at, accident_location, company_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const insertChecklist = db.prepare(`
    INSERT INTO checklist_items (id, inspection_id, title, result)
    VALUES (?, ?, ?, ?)
  `)

  const insertDefect = db.prepare(`
    INSERT INTO defects (id, inspection_id, title, comment, company_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  const quickItems = ['Внешний вид', 'Повреждения кузова', 'Колёса', 'Стекла', 'Госномер']
  const scheduledItems = ['Внешний вид', 'Повреждения кузова', 'Лакокрасочное покрытие', 'Колёса', 'Стекла', 'Фары', 'Зеркала', 'Двери', 'Госномер', 'Двигатель', 'Салон', 'Приборная панель']
  const accidentItems = ['Повреждения кузова', 'Остекление', 'Ходовая', 'Кузов', 'Безопасность']

  for (let i = 0; i < inspections; i++) {
    const insId = uuidv4()
    const vehicle = randomItem(vehicleRecords)
    const vehicleId = vehicle.id
    const userId = randomItem(userIds.slice(0, 2))
    const type = Math.random() > 0.3 ? (Math.random() > 0.7 ? 'accident' : 'quick') : 'scheduled'
    const items = type === 'quick' ? quickItems : type === 'scheduled' ? scheduledItems : accidentItems

    const inspectionDate = randomDateBetween(new Date(vehicle.createdAt), now)
    const inspectionDateIso = inspectionDate.toISOString()
    const accidentOccurredAt = type === 'accident'
      ? new Date(inspectionDate.getTime() - randomInteger(6 * 60 * 60 * 1000)).toISOString()
      : null
    const accidentLocation = type === 'accident' ? `${randomItem(regions)}, участок ${1 + randomInteger(25)}` : null

    insertInspection.run(insId, vehicleId, userId, type, 1, accidentOccurredAt, accidentLocation, companyId, inspectionDateIso)

    if (type === 'scheduled') {
      const previousScheduledDate = latestScheduledInspectionByVehicle.get(vehicleId)
      if (!previousScheduledDate || previousScheduledDate < inspectionDateIso) {
        latestScheduledInspectionByVehicle.set(vehicleId, inspectionDateIso)
      }
    }

    items.forEach(title => {
      const itemId = uuidv4()
      const result = Math.random() > 0.2
      insertChecklist.run(itemId, insId, title, result ? 1 : 0)

      if (!result) {
        const defectId = uuidv4()
        const defectDateIso = new Date(inspectionDate.getTime() + randomInteger(4 * 60 * 60 * 1000)).toISOString()
        insertDefect.run(defectId, insId, title, 'Зафиксировано при осмотре', companyId, defectDateIso)
      }
    })
  }

  const updateVehicleSchedule = db.prepare('UPDATE vehicles SET last_scheduled_inspection = ? WHERE id = ?')
  latestScheduledInspectionByVehicle.forEach((inspectionDate, vehicleId) => {
    updateVehicleSchedule.run(inspectionDate, vehicleId)
  })

  res.json({ message: API_MESSAGES.demoDataCreated, vehicles: vehicleRecords.length, inspections })
})

// ============ ANALYTICS ============

app.get('/api/analytics/overview', authenticate, (req, res) => {
  const { from = '', to = '' } = req.query
  const now = new Date()
  const companyId = req.user.company_id || 'default'

  if (!ensureCompanyFeatureEnabled(req, res, 'analytics_enabled', API_MESSAGES.analyticsFeatureDisabled)) {
    return
  }
  
  let dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  let dateTo = now
  
  if (from) dateFrom = new Date(from)
  if (to) dateTo = new Date(to + ' 23:59:59')

  // Total stats by company
  const totalVehicles = db.prepare('SELECT COUNT(*) as count FROM vehicles WHERE company_id = ?').get(companyId).count
  const totalInspections = db.prepare('SELECT COUNT(*) as count FROM inspections WHERE company_id = ?').get(companyId).count
  const totalDefects = db.prepare('SELECT COUNT(*) as count FROM defects WHERE company_id = ?').get(companyId).count

  // Week stats by company
  const weekInspections = db.prepare(`
    SELECT COUNT(*) as count FROM inspections WHERE company_id = ? AND created_at >= ?
  `).get(companyId, dateFrom.toISOString()).count

  const weekDefects = db.prepare(`
    SELECT COUNT(*) as count FROM defects WHERE company_id = ? AND created_at >= ?
  `).get(companyId, dateFrom.toISOString()).count

  // Month stats
  const monthFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const monthInspections = db.prepare(`
    SELECT COUNT(*) as count FROM inspections WHERE company_id = ? AND created_at >= ?
  `).get(companyId, monthFrom.toISOString()).count

  // Vehicles by status
  const vehiclesByStatus = db.prepare(`
    SELECT status, COUNT(*) as count FROM vehicles WHERE company_id = ? GROUP BY status
  `).all(companyId)

  // Inspections by type
  const inspectionsByType = db.prepare(`
    SELECT type, COUNT(*) as count FROM inspections WHERE company_id = ? GROUP BY type
  `).all(companyId)

  // Accident stats
  const totalAccidents = db.prepare(`SELECT COUNT(*) as count FROM inspections WHERE company_id = ? AND type = 'accident'`).get(companyId).count
  const lastAccident = db.prepare(`
    SELECT i.created_at FROM inspections i WHERE i.company_id = ? AND i.type = 'accident' ORDER BY created_at DESC LIMIT 1
  `).get(companyId)
  
  let daysWithoutAccident = null
  if (lastAccident) {
    const lastDate = new Date(lastAccident.created_at)
    daysWithoutAccident = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24))
  } else {
    daysWithoutAccident = totalInspections > 0 ? Math.floor((now - new Date('2024-01-01')) / (1000 * 60 * 60 * 24)) : 0
  }

  // Recent accidents
  const recentAccidents = db.prepare(`
    SELECT i.id, i.created_at, v.number as vehicle_number, v.name as vehicle_name,
           u.name as inspector_name,
           (SELECT COUNT(*) FROM defects WHERE inspection_id = i.id) as defects_count
    FROM inspections i
    JOIN vehicles v ON i.vehicle_id = v.id
    JOIN users u ON i.inspector_id = u.id
    WHERE i.company_id = ? AND i.type = 'accident'
    ORDER BY i.created_at DESC
    LIMIT 10
  `).all(companyId)

  // Daily inspections for date range
  const dailyInspections = db.prepare(`
    SELECT DATE(created_at) as date, COUNT(*) as count 
    FROM inspections 
    WHERE company_id = ? AND created_at >= ? AND created_at <= ?
    GROUP BY DATE(created_at)
    ORDER BY date
  `).all(companyId, dateFrom.toISOString(), dateTo.toISOString())

  // Top vehicles with defects
  const topDefectiveVehicles = db.prepare(`
    SELECT v.id, v.number, v.name, COUNT(d.id) as defects_count
    FROM vehicles v
    JOIN inspections i ON i.vehicle_id = v.id
    JOIN defects d ON d.inspection_id = i.id
    WHERE v.company_id = ?
    GROUP BY v.id
    ORDER BY defects_count DESC
    LIMIT 10
  `).all(companyId)

  res.json({
    total: { vehicles: totalVehicles, inspections: totalInspections, defects: totalDefects },
    week: { inspections: weekInspections, defects: weekDefects },
    month: { inspections: monthInspections },
    vehiclesByStatus,
    inspectionsByType,
    dailyInspections,
    topDefectiveVehicles,
    accidents: {
      total: totalAccidents,
      daysWithoutAccident,
      recent: recentAccidents
    },
    vehiclesByRegion: db.prepare(`
      SELECT COALESCE(region, 'Не указано') as region, COUNT(*) as count
      FROM vehicles
      WHERE company_id = ?
      GROUP BY region
      ORDER BY count DESC
    `).all(companyId),
    inspectionsByRegion: db.prepare(`
      SELECT COALESCE(v.region, 'Не указано') as region, COUNT(*) as count
      FROM inspections i
      JOIN vehicles v ON i.vehicle_id = v.id
      WHERE i.company_id = ?
      GROUP BY v.region
      ORDER BY count DESC
    `).all(companyId),
    defectsByRegion: db.prepare(`
      SELECT COALESCE(v.region, 'Не указано') as region, COUNT(d.id) as count
      FROM defects d
      JOIN inspections i ON d.inspection_id = i.id
      JOIN vehicles v ON i.vehicle_id = v.id
      WHERE d.company_id = ?
      GROUP BY v.region
      ORDER BY count DESC
    `).all(companyId)
  })
})

app.get('/api/analytics/export/excel', authenticate, (req, res) => {
  const { type = 'vehicles' } = req.query
  const companyId = req.user.company_id || 'default'

  if (!ensureCompanyFeatureEnabled(req, res, 'analytics_enabled', API_MESSAGES.analyticsFeatureDisabled)) {
    return
  }

  let data
  let filename

  if (type === 'vehicles') {
    data = db.prepare(`
      SELECT v.number, v.name, v.status, v.region, v.created_at,
             (SELECT COUNT(*) FROM inspections WHERE vehicle_id = v.id) as inspections_count,
             (SELECT COUNT(*) FROM defects d JOIN inspections i ON d.inspection_id = i.id WHERE i.vehicle_id = v.id) as defects_count
      FROM vehicles v
      WHERE v.company_id = ?
      ORDER BY v.number
    `).all(companyId)
    filename = 'vehicles.json'
  } else if (type === 'inspections') {
    data = db.prepare(`
      SELECT i.id, v.number as vehicle_number, v.name as vehicle_name, 
             i.type, i.completed, i.created_at, i.accident_occurred_at, i.accident_location,
             u.name as inspector_name,
             (SELECT COUNT(*) FROM defects WHERE inspection_id = i.id) as defects_count
      FROM inspections i
      JOIN vehicles v ON i.vehicle_id = v.id
      JOIN users u ON i.inspector_id = u.id
      WHERE i.company_id = ?
      ORDER BY i.created_at DESC
      LIMIT 1000
    `).all(companyId)
    filename = 'inspections.json'
  } else if (type === 'defects') {
    data = db.prepare(`
      SELECT d.title, d.comment, d.status, d.created_at,
             v.number as vehicle_number, v.name as vehicle_name,
             i.type as inspection_type
      FROM defects d
      JOIN inspections i ON d.inspection_id = i.id
      JOIN vehicles v ON i.vehicle_id = v.id
      WHERE d.company_id = ?
      ORDER BY d.created_at DESC
      LIMIT 1000
    `).all(companyId)
    filename = 'defects.json'
  }

  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`)
  res.json({ data, exportedAt: new Date().toISOString() })
})

app.use((err, req, res, next) => {
  if (isUploadMiddlewareError(err)) {
    return sendError(res, 400, err.message)
  }

  if (err?.message === 'Only image uploads are allowed') {
    return sendError(res, 400, 'Only image uploads are allowed')
  }

  if (err?.type === 'entity.too.large') {
    return sendError(res, 413, 'Request body is too large')
  }

  if (err instanceof SyntaxError && 'body' in err) {
    return sendError(res, 400, 'Invalid JSON body')
  }

  return next(err)
})

let server = null
const openSockets = new Set()

function forceCloseOpenSockets() {
  for (const socket of openSockets) {
    socket.destroy()
  }
  openSockets.clear()
}

function gracefulShutdown(signal) {
  if (isShuttingDown) {
    console.log(`[shutdown] ${signal} received while shutdown is already in progress`)
    return
  }

  isShuttingDown = true
  console.log(`[shutdown] ${signal} received; stopping HTTP server`)

  if (!server) {
    process.exit(0)
    return
  }

  const shutdownTimer = setTimeout(() => {
    console.error(`[shutdown] Forced shutdown after ${GRACEFUL_SHUTDOWN_TIMEOUT_MS}ms`)
    forceCloseOpenSockets()
    process.exit(1)
  }, GRACEFUL_SHUTDOWN_TIMEOUT_MS)
  shutdownTimer.unref?.()

  server.close((err) => {
    clearTimeout(shutdownTimer)

    if (err) {
      console.error('[shutdown] HTTP server closed with error:', err)
      process.exit(1)
      return
    }

    if (isRedisConfigured()) {
      shutdownRedis()
        .catch((shutdownErr) => {
          console.error('[shutdown] Redis shutdown error:', shutdownErr)
        })
        .finally(() => {
          console.log('[shutdown] HTTP server closed gracefully')
          process.exit(0)
        })
      return
    }

    console.log('[shutdown] HTTP server closed gracefully')
    process.exit(0)
  })

  server.closeIdleConnections?.()
}

process.once('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.once('SIGINT', () => gracefulShutdown('SIGINT'))

if (typeof process.send === 'function') {
  process.on('message', (message) => {
    if (message === 'shutdown') {
      gracefulShutdown('IPC_SHUTDOWN')
    }
  })
}

initDatabase().then(() => {
  server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`вњ… Server running on http://0.0.0.0:${PORT}`)
  })

  server.on('connection', (socket) => {
    openSockets.add(socket)
    socket.on('close', () => {
      openSockets.delete(socket)
    })
  })
}).catch(err => {
  console.error('Failed to initialize database:', err)
  process.exit(1)
})
