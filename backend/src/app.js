import 'dotenv/config'
import express from 'express'
import path from 'path'
import fs from 'fs'
import { getDb } from './db.js'
import registerCompleteInspectionRoutes from './routes/completeInspection.js'
import registerCompanyRoutes from './routes/companies.js'
import registerCompanyUsageRoutes from './routes/companyUsage.js'
import registerAuthRoutes, { createOwnerSetupInvitationFactory } from './routes/auth.js'
import registerSaasAdminRoutes from './routes/adminSaas.js'
import registerRegionRoutes from './routes/regions.js'
import registerVehicleRoutes from './routes/vehicles.js'
import registerInspectionRoutes from './routes/inspections.js'
import registerDefectRoutes from './routes/defects.js'
import registerPhotoRoutes from './routes/photos.js'
import registerDashboardRoutes from './routes/dashboard.js'
import registerAnalyticsRoutes from './routes/analytics.js'
import registerUserRoutes from './routes/users.js'
import registerSettingsRoutes from './routes/settings.js'
import registerProtectedUploadRoutes from './routes/uploads.js'
import registerDemoDataSeedRoutes from './seed/demoData.js'
import { registerOdometerRoutes, registerVehicleNumberRecognitionRoutes } from './routes/odometer.js'
import { photoRequirements, registerPhotoRequirementRoutes } from './routes/photo-requirements.js'
import { createRateLimiter } from './services/rateLimiter.js'
import { isRedisConfigured, getRedisStatus, pingRedis } from './services/redisClient.js'
import {
  uploadsDir,
  upload,
  isUploadMiddlewareError,
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
  REQUEST_ID_HEADER,
  ACCESS_LOG_FORMAT,
  ACCESS_LOG_SLOW_MS,
  ACCESS_LOG_SKIP_PATHS,
  corsOrigins,
  allowAllCorsOrigins,
} from './config.js'

export function createApp({ getIsShuttingDown = () => false } = {}) {
const app = express()

function isAppShuttingDown() {
  return Boolean(getIsShuttingDown())
}

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
    shutdown: !isAppShuttingDown(),
    database: false,
    uploads: false,
    redis: !isRedisConfigured(),
  }
  const errors = []

  if (isAppShuttingDown()) {
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
  if (!isAppShuttingDown()) {
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

registerProtectedUploadRoutes({
  app,
  authenticate,
  getDb: () => db,
  sendError,
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

registerCompanyUsageRoutes({
  app,
  db,
  authenticate,
  API_MESSAGES,
  getCompanyLimits,
  getCompanyResourceUsage,
  normalizeCompanyLimit,
  normalizeCompanyFeatureFlag,
  ensureCompanyOwner,
})

// ============ USERS ============

registerUserRoutes({
  app,
  db,
  authenticate,
  sendError,
  sendCompanyLimitViolation,
  API_MESSAGES,
  getUserIdByEmail,
  getUserRecordById,
  createUserRecord,
  updateUserRecord,
  getCompanyLimitViolation,
  ensureCompanyOwner,
  ensureCompanyOwnerOrSelf,
  ensureCompanyOperationalWriteAllowed,
  isCompanyOwner,
  isSelf,
  canAssignRole,
  isAssignableCompanyUserRole,
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

registerSettingsRoutes({
  app,
  db,
  authenticate,
  readSettings,
  ensureManager,
  ensureCompanyOperationalWriteAllowed,
  API_MESSAGES,
})

registerPhotoRequirementRoutes({ app, authenticate })

// ============ NOTIFICATIONS ============

registerDashboardRoutes({
  app,
  db,
  authenticate,
  readSettings,
  sendInternalError,
})

// ============ SEED DATA ============

registerDemoDataSeedRoutes({
  app,
  db,
  authenticate,
  ensureManager,
  API_MESSAGES,
  createUserRecord,
  getUserIdByEmail,
})

// ============ ANALYTICS ============

registerAnalyticsRoutes({
  app,
  db,
  authenticate,
  API_MESSAGES,
  ensureCompanyFeatureEnabled,
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

return app
}

export default createApp
