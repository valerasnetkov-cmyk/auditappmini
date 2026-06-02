import 'dotenv/config'
import express from 'express'
import speakeasy from 'speakeasy'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import multer from 'multer'
import path from 'path'
import sharp from 'sharp'
import {
  LICENSE_PLATE_ALLOWED_CYRILLIC,
  normalizeVehicleNumberToCyrillic,
  isValidRussianLicensePlate,
} from './utils/transliteration.js'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { initDatabase, getDb } from './db.js'
import registerCompleteInspectionRoutes from './routes/completeInspection.js'
import registerCompanyRoutes from './routes/companies.js'
import registerSaasAdminRoutes from './routes/adminSaas.js'
import { registerOdometerRoutes, registerVehicleNumberRecognitionRoutes } from './routes/odometer.js'
import { photoRequirements, photoTypeLabels, defectCategories } from './routes/photo-requirements.js'
import { createRateLimiter } from './services/rateLimiter.js'
import { isRedisConfigured, getRedisStatus, pingRedis, shutdownRedis } from './services/redisClient.js'
import { createRequestIdMiddleware } from './middleware/requestId.js'
import { createAccessLogMiddleware } from './middleware/accessLog.js'
import { createSecurityHeadersMiddleware, createCorsMiddleware } from './middleware/security.js'
import { createAuthenticateMiddleware, setAuthCookie, clearAuthCookie } from './middleware/auth.js'
import {
  isProduction,
  JWT_SECRET,
  PUBLIC_REGISTRATION_ENABLED,
  TRUST_PROXY,
  SECURITY_HSTS_ENABLED,
  SECURITY_HSTS_MAX_AGE,
  SECURITY_CSP,
  SECURITY_CROSS_ORIGIN_OPENER_POLICY,
  SECURITY_CROSS_ORIGIN_RESOURCE_POLICY,
  SENSITIVE_RATE_LIMIT_WINDOW_MS,
  SENSITIVE_RATE_LIMIT_MAX,
  AUTH_ACCOUNT_RATE_LIMIT_MAX,
  MFA_LOGIN_TOKEN_TTL,
  MAX_FILE_SIZE,
  MAX_IMAGE_PIXELS,
  JSON_BODY_LIMIT,
  GRACEFUL_SHUTDOWN_TIMEOUT_MS,
  REQUEST_ID_HEADER,
  ACCESS_LOG_FORMAT,
  ACCESS_LOG_SLOW_MS,
  ACCESS_LOG_SKIP_PATHS,
  corsOrigins,
  allowAllCorsOrigins,
} from './config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadsDir = process.env.UPLOAD_DIR
  ? path.resolve(process.cwd(), process.env.UPLOAD_DIR)
  : path.join(__dirname, '../uploads')

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

const app = express()
const PORT = process.env.PORT || 3001
let isShuttingDown = false

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`
    cb(null, uniqueName)
  }
})
const ALLOWED_UPLOAD_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const UPLOAD_MIME_FORMATS = new Map([
  ['image/jpeg', new Set(['jpeg'])],
  ['image/png', new Set(['png'])],
  ['image/webp', new Set(['webp'])],
])
const VEHICLE_STATUSES = new Set(['active', 'repair', 'archived'])
const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_UPLOAD_MIME_TYPES.has(file.mimetype)) {
      cb(null, true)
      return
    }

    cb(new Error('Only image uploads are allowed'))
  },
})

function uploadPhoto(req, res, next) {
  upload.single('photo')(req, res, (err) => {
    if (!err) {
      next()
      return
    }

    if (err.code === 'LIMIT_FILE_SIZE') {
      return sendError(res, 413, `Photo exceeds ${MAX_FILE_SIZE} bytes`)
    }

    return sendError(res, 400, 'Only JPG, PNG and WebP uploads are allowed')
  })
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

const getMimeType = (filename) => {
  const ext = filename.toLowerCase().split('.').pop()
  const types = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' }
  return types[ext] || 'application/octet-stream'
}

const PHOTO_SELECT_COLUMNS = `
  id, inspection_id, defect_id, company_id, photo_type, url, original_url, webp_url, thumb_url,
  original_mime, original_name, width, height, size_original, size_webp, size_thumb, hash,
  geo, is_required, created_at
`

function mimeToExtension(mimetype) {
  if (mimetype === 'image/jpeg') return 'jpg'
  if (mimetype === 'image/png') return 'png'
  if (mimetype === 'image/webp') return 'webp'
  return null
}

function createSharpImage(buffer) {
  return sharp(buffer, {
    failOn: 'error',
    limitInputPixels: MAX_IMAGE_PIXELS,
  })
}

function assertUploadedPhotoFormat(metadata, mimetype) {
  const detectedFormat = String(metadata?.format || '').toLowerCase()
  const allowedFormats = UPLOAD_MIME_FORMATS.get(mimetype)

  if (!allowedFormats?.has(detectedFormat)) {
    throw new Error('Photo content does not match the declared image format')
  }
}

function normalizeStorageSegment(value) {
  return String(value || 'unknown').replace(/[^a-zA-Z0-9_.-]/g, '_') || 'unknown'
}

function buildUploadUrl(relativePath) {
  return `/uploads/${relativePath.replace(/\\/g, '/')}`
}

function resolveUploadPath(relativePath) {
  const input = String(relativePath || '').replace(/\\/g, '/')
  if (!input || input.includes('\0')) return null

  const normalized = path.normalize(input).replace(/\\/g, '/')
  if (!normalized || normalized === '.' || normalized.startsWith('..') || path.isAbsolute(normalized)) return null

  const uploadsRoot = path.resolve(uploadsDir)
  const filePath = path.resolve(uploadsRoot, normalized)
  if (filePath !== uploadsRoot && !filePath.startsWith(`${uploadsRoot}${path.sep}`)) return null

  return { relativePath: normalized, filePath }
}

async function removeFileIfExists(filePath) {
  if (!filePath) return
  try {
    await fs.promises.unlink(filePath)
  } catch (err) {
    if (err?.code !== 'ENOENT') {
      console.warn(`[uploads] Failed to remove file ${filePath}:`, err.message)
    }
  }
}

async function removePhotoFiles(photo) {
  const urls = new Set([photo?.url, photo?.original_url, photo?.webp_url, photo?.thumb_url].filter(Boolean))
  await Promise.all(Array.from(urls).map(async (url) => {
    if (!url.startsWith('/uploads/')) return
    const resolved = resolveUploadPath(url.slice('/uploads/'.length))
    if (resolved) await removeFileIfExists(resolved.filePath)
  }))
}

async function removePhotoFilesForRows(photos) {
  await Promise.all((photos || []).map((photo) => removePhotoFiles(photo)))
}

async function processUploadedPhoto({ tempPath, originalName, mimetype, inspectionId, photoId }) {
  const extension = mimeToExtension(mimetype)
  if (!extension) {
    throw new Error('Unsupported photo format')
  }

  const inspectionSegment = normalizeStorageSegment(inspectionId)
  const photoSegment = normalizeStorageSegment(photoId)
  const relativeDir = `inspections/${inspectionSegment}/photos/${photoSegment}`
  const targetDir = path.join(uploadsDir, relativeDir)
  const originalPath = path.join(targetDir, `original.${extension}`)
  const mainPath = path.join(targetDir, 'main.webp')
  const thumbPath = path.join(targetDir, 'thumb.webp')

  await fs.promises.mkdir(targetDir, { recursive: true })
  await fs.promises.rename(tempPath, originalPath)

  try {
    const originalBuffer = await fs.promises.readFile(originalPath)
    const metadata = await createSharpImage(originalBuffer).metadata()
    assertUploadedPhotoFormat(metadata, mimetype)

    await createSharpImage(originalBuffer)
      .rotate()
      .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(mainPath)

    await createSharpImage(originalBuffer)
      .rotate()
      .resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 76 })
      .toFile(thumbPath)

    const [originalStat, mainStat, thumbStat] = await Promise.all([
      fs.promises.stat(originalPath),
      fs.promises.stat(mainPath),
      fs.promises.stat(thumbPath),
    ])

    return {
      url: buildUploadUrl(`${relativeDir}/main.webp`),
      original_url: buildUploadUrl(`${relativeDir}/original.${extension}`),
      webp_url: buildUploadUrl(`${relativeDir}/main.webp`),
      thumb_url: buildUploadUrl(`${relativeDir}/thumb.webp`),
      original_mime: mimetype,
      original_name: originalName || null,
      width: Number.isFinite(metadata.width) ? metadata.width : null,
      height: Number.isFinite(metadata.height) ? metadata.height : null,
      size_original: originalStat.size,
      size_webp: mainStat.size,
      size_thumb: thumbStat.size,
      hash: crypto.createHash('sha256').update(originalBuffer).digest('hex'),
    }
  } catch (err) {
    await fs.promises.rm(targetDir, { recursive: true, force: true })
    throw err
  }
}

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

function getVehicleByNumber(number, companyId = null) {
  const query = companyId
    ? db.prepare(`
      SELECT id, number, name, status, region, company_id, created_at, last_scheduled_inspection
      FROM vehicles
      WHERE number = ? AND company_id = ?
    `)
    : db.prepare(`
    SELECT id, number, name, status, region, company_id, created_at, last_scheduled_inspection
    FROM vehicles
    WHERE number = ?
  `)

  return companyId ? query.get(number, companyId) : query.get(number)
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

function getRegionByName(name) {
  return db.prepare('SELECT id, name, created_at FROM regions WHERE name = ?').get(name)
}

function getRegionById(id) {
  return db.prepare('SELECT id, name, created_at FROM regions WHERE id = ?').get(id)
}

function countVehiclesByRegion(regionName, companyId = null) {
  const query = companyId
    ? db.prepare('SELECT COUNT(*) as count FROM vehicles WHERE region = ? AND company_id = ?')
    : db.prepare('SELECT COUNT(*) as count FROM vehicles WHERE region = ?')

  const result = companyId ? query.get(regionName, companyId) : query.get(regionName)
  return Number(result?.count || 0)
}

function listRegions(companyId = null) {
  if (companyId) {
    return db.prepare(`
      SELECT r.id, r.name, r.created_at, COUNT(v.id) as vehicle_count
      FROM regions r
      LEFT JOIN vehicles v ON v.region = r.name AND v.company_id = ?
      GROUP BY r.id, r.name, r.created_at
      ORDER BY r.name
    `).all(companyId)
  }

  return db.prepare(`
    SELECT r.id, r.name, r.created_at, COUNT(v.id) as vehicle_count
    FROM regions r
    LEFT JOIN vehicles v ON v.region = r.name
    GROUP BY r.id, r.name, r.created_at
    ORDER BY r.name
  `).all()
}

function getInspectionById(id, companyId = null) {
  const query = companyId
    ? db.prepare('SELECT * FROM inspections WHERE id = ? AND company_id = ?')
    : db.prepare('SELECT * FROM inspections WHERE id = ?')

  return companyId ? query.get(id, companyId) : query.get(id)
}

function getInspectionPhotos(inspectionId, companyId) {
  return db.prepare(`
    SELECT ${PHOTO_SELECT_COLUMNS}
    FROM photos
    WHERE inspection_id = ? AND company_id = ? AND defect_id IS NULL
    ORDER BY created_at ASC
  `).all(inspectionId, companyId)
}

function getDefectsWithPhotos(inspectionId, companyId) {
  const defects = db.prepare(`
    SELECT *
    FROM defects
    WHERE inspection_id = ? AND company_id = ?
    ORDER BY created_at ASC
  `).all(inspectionId, companyId)

  const photos = db.prepare(`
    SELECT ${PHOTO_SELECT_COLUMNS}
    FROM photos
    WHERE inspection_id = ? AND company_id = ? AND defect_id IS NOT NULL
    ORDER BY created_at ASC
  `).all(inspectionId, companyId)

  const photosByDefectId = photos.reduce((acc, photo) => {
    acc[photo.defect_id] = acc[photo.defect_id] || []
    acc[photo.defect_id].push(photo)
    return acc
  }, {})

  return defects.map((defect) => ({
    ...defect,
    photos: photosByDefectId[defect.id] || [],
  }))
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

function createVehicleRecord({ id, number, name, status, region, companyId = 'default' }) {
  return db.prepare(`
    INSERT INTO vehicles (id, number, name, status, region, company_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, number, name, status, region, companyId)
}

function updateVehicleRecord(id, { number, name, status, region, companyId = null }) {
  const query = companyId
    ? db.prepare(`
      UPDATE vehicles SET number = ?, name = ?, status = ?, region = ?
      WHERE id = ? AND company_id = ?
    `)
    : db.prepare(`
    UPDATE vehicles SET number = ?, name = ?, status = ?, region = ?
    WHERE id = ?
  `)

  return companyId
    ? query.run(number.toUpperCase(), name, status, region || null, id, companyId)
    : query.run(number.toUpperCase(), name, status, region || null, id)
}

function recordVehicleStatusChange({ vehicleId, oldStatus, newStatus, reason, changedBy }) {
  return db.prepare(`
    INSERT INTO vehicle_status_history (id, vehicle_id, old_status, new_status, reason, changed_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(uuidv4(), vehicleId, oldStatus, newStatus, reason || null, changedBy)
}

function archiveVehiclesByIds({ ids, companyId, changedBy }) {
  const uniqueIds = [...new Set((Array.isArray(ids) ? ids : []).map((id) => String(id || '').trim()).filter(Boolean))]

  if (uniqueIds.length === 0) {
    return { error: 'Не выбрана техника для архивации', status: 400 }
  }

  if (uniqueIds.length > 500) {
    return { error: 'За один раз можно архивировать не более 500 единиц техники', status: 400 }
  }

  const placeholders = uniqueIds.map(() => '?').join(', ')
  const existingVehicles = db.prepare(`
    SELECT id, status
    FROM vehicles
    WHERE company_id = ? AND id IN (${placeholders})
  `).all(companyId, ...uniqueIds)

  if (existingVehicles.length === 0) {
    return { error: API_MESSAGES.vehicleNotFound, status: 404 }
  }

  const vehiclesToArchive = existingVehicles.filter((vehicle) => vehicle.status !== 'archived')
  if (vehiclesToArchive.length === 0) {
    return {
      requested: uniqueIds.length,
      matched: existingVehicles.length,
      archived: 0,
      skipped: uniqueIds.length,
      ids: [],
    }
  }

  const archiveIds = vehiclesToArchive.map((vehicle) => vehicle.id)
  const archivePlaceholders = archiveIds.map(() => '?').join(', ')

  db.prepare(`
    UPDATE vehicles
    SET status = 'archived'
    WHERE company_id = ? AND id IN (${archivePlaceholders})
  `).run(companyId, ...archiveIds)

  vehiclesToArchive.forEach((vehicle) => {
    recordVehicleStatusChange({
      vehicleId: vehicle.id,
      oldStatus: vehicle.status,
      newStatus: 'archived',
      reason: 'Archived from vehicles list',
      changedBy,
    })
  })

  return {
    requested: uniqueIds.length,
    matched: existingVehicles.length,
    archived: vehiclesToArchive.length,
    skipped: uniqueIds.length - vehiclesToArchive.length,
    ids: archiveIds,
  }
}

function upsertSettingValue(key, value) {
  return db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value))
}

function createRegionRecord(name) {
  return db.prepare(`
    INSERT INTO regions (id, name, created_at)
    VALUES (?, ?, datetime('now'))
  `).run(uuidv4(), name)
}

function deleteRegionRecord(id) {
  return db.prepare('DELETE FROM regions WHERE id = ?').run(id)
}

function ensureRegionRecordByName(name, companyId = null) {
  const regionName = normalizeRegionName(name)
  if (!regionName) return null

  const existing = getRegionByName(regionName)
  if (existing) return existing

  if (countVehiclesByRegion(regionName, companyId) === 0) return null

  createRegionRecord(regionName)
  return getRegionByName(regionName)
}

function getRegionForMutation(id, fallbackName, companyId = null) {
  return getRegionById(id) || ensureRegionRecordByName(fallbackName, companyId)
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

function normalizeRegionName(region) {
  if (typeof region !== 'string') return null
  const trimmed = region.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeVehicleNumber(number) {
  return normalizeVehicleNumberToCyrillic(number)
}

function validateVehiclePayload({ number, name, region }) {
  const normalizedNumber = normalizeVehicleNumber(number)
  const normalizedName = typeof name === 'string' ? name.trim() : ''
  const normalizedRegion = normalizeRegionName(region)

  if (!normalizedNumber || !normalizedName) {
    return { error: API_MESSAGES.vehicleFieldsRequired }
  }

  if (!isValidRussianLicensePlate(normalizedNumber)) {
    return { error: API_MESSAGES.invalidVehicleNumber }
  }

  if (normalizedRegion && !getRegionByName(normalizedRegion)) {
    return { error: API_MESSAGES.invalidRegion }
  }

  return {
    number: normalizedNumber,
    name: normalizedName,
    region: normalizedRegion,
  }
}

function ensureVehicleNumberAvailable(number, currentVehicleId = null, companyId = null) {
  const existingVehicle = getVehicleByNumber(number, companyId)
  if (!existingVehicle) return null
  if (currentVehicleId && existingVehicle.id === currentVehicleId) return null
  return API_MESSAGES.vehicleNumberExists
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

function getWebAppUrl() {
  return (process.env.WEB_APP_URL || process.env.FRONTEND_URL || 'http://localhost:3002').replace(/\/+$/, '')
}

function getOwnerSetupFingerprint(passwordHash) {
  return crypto
    .createHmac('sha256', JWT_SECRET)
    .update(String(passwordHash || ''))
    .digest('hex')
}

function parseDurationSeconds(value, fallbackSeconds) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value)
  }

  const text = String(value || '').trim()
  if (/^\d+$/.test(text)) {
    return Number(text)
  }

  const match = text.match(/^(\d+)\s*([smhd])$/i)
  if (!match) return fallbackSeconds

  const amount = Number(match[1])
  const unit = match[2].toLowerCase()
  const multipliers = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 24 * 60 * 60,
  }

  return amount * multipliers[unit]
}

function createOwnerSetupInvitation(user) {
  const expiresIn = process.env.OWNER_SETUP_TOKEN_TTL || '7d'
  const expiresInSeconds = parseDurationSeconds(expiresIn, 7 * 24 * 60 * 60)
  const nonce = uuidv4()
  const issuedAt = new Date()
  const expiresAt = new Date(issuedAt.getTime() + expiresInSeconds * 1000)
  const owner = db.prepare(`
    SELECT id, email, password, role, status, company_id
    FROM users
    WHERE id = ?
  `).get(user.id)

  if (!owner || owner.role !== 'owner' || owner.status === 'inactive') {
    throw new Error('Owner setup invitation requires an active owner user')
  }

  db.prepare(`
    UPDATE users
    SET owner_setup_nonce = ?,
        owner_setup_issued_at = ?,
        owner_setup_expires_at = ?,
        owner_setup_accepted_at = NULL
    WHERE id = ?
  `).run(nonce, issuedAt.toISOString(), expiresAt.toISOString(), owner.id)

  const token = jwt.sign(
    {
      purpose: 'owner_setup',
      id: owner.id,
      email: owner.email,
      company_id: owner.company_id || 'default',
      setup_fingerprint: getOwnerSetupFingerprint(owner.password),
      setup_nonce: nonce,
    },
    JWT_SECRET,
    { expiresIn },
  )

  return {
    token,
    setup_url: `${getWebAppUrl()}/owner-setup?token=${encodeURIComponent(token)}`,
    expires_in: expiresIn,
    expires_at: expiresAt.toISOString(),
  }
}

function createAuthToken(user) {
  const companyId = user.company_id || 'default'
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name, company_id: companyId },
    JWT_SECRET,
    { expiresIn: '7d' },
  )
}

function createMfaLoginToken(user) {
  return jwt.sign(
    {
      purpose: 'mfa_login',
      id: user.id,
      email: user.email,
      company_id: user.company_id || 'default',
    },
    JWT_SECRET,
    { expiresIn: MFA_LOGIN_TOKEN_TTL },
  )
}

function toAuthUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    company_id: user.company_id || 'default',
  }
}

function sendAuthSession(res, user) {
  const token = createAuthToken(user)
  setAuthCookie(res, token)
  return res.json({
    token,
    user: toAuthUser(user),
  })
}

registerSaasAdminRoutes({ app, db, authenticate, ensureAdmin, sendError, API_MESSAGES, createOwnerSetupInvitation })

function validateAccidentDetails(type, accidentOccurredAt, accidentLocation) {
  if (type !== 'accident') {
    return {
      accidentOccurredAt: accidentOccurredAt || null,
      accidentLocation: accidentLocation?.trim() || null,
    }
  }

  const normalizedOccurredAt = typeof accidentOccurredAt === 'string' ? accidentOccurredAt.trim() : ''
  const normalizedLocation = typeof accidentLocation === 'string' ? accidentLocation.trim() : ''

  if (!normalizedOccurredAt || !normalizedLocation) {
    return { error: API_MESSAGES.accidentDetailsRequired }
  }

  return {
    accidentOccurredAt: normalizedOccurredAt,
    accidentLocation: normalizedLocation,
  }
}

function getAllowedPhotoTypes(inspectionType) {
  const requirements = photoRequirements[inspectionType]
  if (!requirements) return new Set()
  return new Set([...(requirements.required || []), ...(requirements.optional || [])])
}

// ============ AUTH ============

function markUserLogin(userId) {
  try {
    db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(userId)
  } catch (error) {
    console.warn('Unable to update last_login_at:', error.message)
  }
}

app.post('/api/auth/login', ...publicAuthRateLimit, (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return sendError(res, 400, API_MESSAGES.loginCredentialsRequired)
  }

  const normalizedEmail = String(email).trim().toLowerCase()
  const user = db.prepare('SELECT id, email, password, name, role, status, company_id, mfa_enabled, mfa_secret FROM users WHERE email = ?').get(normalizedEmail)
  const passwordHash = user?.password || '$2a$10$J9e3WdYLmopA7LzXnxjx7Oq4FMdt0MBGDGg2po7GTL58e86qfqxxK'
  const passwordOk = bcrypt.compareSync(String(password), passwordHash)

  if (!user || !passwordOk) {
    return sendError(res, 401, API_MESSAGES.invalidCredentials)
  }

  if (user.status === 'inactive') {
    return sendError(res, 403, API_MESSAGES.userInactive)
  }

  // MFA check: if enabled, require MFA verification before issuing JWT
  if (user.mfa_enabled) {
    return res.json({
      mfaRequired: true,
      mfaToken: createMfaLoginToken(user),
      user: toAuthUser(user),
    })
  }

  markUserLogin(user.id)
  return sendAuthSession(res, user)
})

app.post('/api/auth/mfa/verify', ...publicAuthRateLimit, (req, res) => {
  const { mfaToken, token } = req.body || {}

  if (!mfaToken || !token) {
    return sendError(res, 400, 'MFA token and verification code are required')
  }

  let decoded
  try {
    decoded = jwt.verify(mfaToken, JWT_SECRET)
  } catch {
    return sendError(res, 401, API_MESSAGES.invalidToken)
  }

  if (decoded?.purpose !== 'mfa_login' || !decoded.id || !decoded.email) {
    return sendError(res, 401, API_MESSAGES.invalidToken)
  }

  const user = db.prepare(`
    SELECT id, email, password, name, role, status, company_id, mfa_enabled, mfa_secret
    FROM users
    WHERE id = ? AND email = ?
  `).get(decoded.id, decoded.email)

  if (!user) {
    return sendError(res, 401, API_MESSAGES.invalidToken)
  }

  if (user.status === 'inactive') {
    return sendError(res, 403, API_MESSAGES.userInactive)
  }

  if (!user.mfa_enabled || !user.mfa_secret) {
    return sendError(res, 400, 'MFA is not enabled for this user')
  }

  const verified = speakeasy.totp.verify({
    secret: user.mfa_secret,
    encoding: 'base32',
    token: String(token),
    window: 1,
  })

  if (!verified) {
    return sendError(res, 401, 'Invalid MFA token')
  }

  markUserLogin(user.id)
  return sendAuthSession(res, user)
})

app.post('/api/auth/owner-setup', ...publicAuthRateLimit, (req, res) => {
  const { token, password } = req.body || {}

  if (!token || typeof password !== 'string') {
    return sendError(res, 400, API_MESSAGES.registerFieldsRequired)
  }

  if (password.length < 8) {
    return sendError(res, 400, 'Password must contain at least 8 characters')
  }

  let decoded
  try {
    decoded = jwt.verify(token, JWT_SECRET)
  } catch {
    return sendError(res, 401, API_MESSAGES.invalidToken)
  }

  if (decoded?.purpose !== 'owner_setup' || !decoded.id || !decoded.company_id) {
    return sendError(res, 401, API_MESSAGES.invalidToken)
  }

  const user = db.prepare(`
    SELECT id, email, password, name, role, status, company_id, created_at, owner_setup_nonce
    FROM users
    WHERE id = ? AND company_id = ?
  `).get(decoded.id, decoded.company_id)

  if (!user || user.role !== 'owner') {
    return sendError(res, 404, API_MESSAGES.userNotFound)
  }

  if (user.status === 'inactive') {
    return sendError(res, 403, API_MESSAGES.userInactive)
  }

  if (
    decoded.email !== user.email ||
    !decoded.setup_fingerprint ||
    decoded.setup_fingerprint !== getOwnerSetupFingerprint(user.password) ||
    !decoded.setup_nonce ||
    decoded.setup_nonce !== user.owner_setup_nonce
  ) {
    return sendError(res, 401, API_MESSAGES.invalidToken)
  }

  const passwordHash = bcrypt.hashSync(password, 10)
  updateUserRecord(user.id, { passwordHash, status: 'active', companyId: user.company_id })
  db.prepare(`
    UPDATE users
    SET owner_setup_nonce = NULL,
        owner_setup_accepted_at = datetime('now')
    WHERE id = ?
  `).run(user.id)

  const updatedUser = getUserSummaryById(user.id, user.company_id)
  markUserLogin(user.id)
  return sendAuthSession(res, updatedUser)
})

// MFA: setup for company owners to configure managed users; self-service is also allowed.
app.post('/api/users/:id/mfa/setup', authenticate, (req, res) => {
  const userId = req.params.id
  const companyId = req.user.company_id || 'default'
  // Company owners can set MFA for managed users; self-service is allowed for everyone.
  if (!ensureCompanyOwnerOrSelf(req, res, userId, API_MESSAGES.accessDenied)) return

  const user = getUserRecordById(userId, isSelf(req, userId) ? null : companyId)
  if (!user) {
    return sendError(res, 404, API_MESSAGES.userNotFound)
  }
  if (!isSelf(req, userId) && !isAssignableCompanyUserRole(user.role)) {
    return sendError(res, 403, API_MESSAGES.accessDenied)
  }

  const secret = speakeasy.generateSecret({ length: 20 })
  // Save secret into user row
  db.prepare('UPDATE users SET mfa_secret = ? WHERE id = ? AND company_id = ?').run(secret.base32, userId, user.company_id || companyId)
  res.json({ otpauth_url: secret.otpauth_url, secret: secret.base32 })
})

app.post('/api/users/:id/mfa/verify', authenticate, ...authenticatedSensitiveRateLimit, (req, res) => {
  const userId = req.params.id
  const { token } = req.body
  const companyId = req.user.company_id || 'default'
  if (!ensureCompanyOwnerOrSelf(req, res, userId, API_MESSAGES.accessDenied)) return

  const user = db.prepare(`
    SELECT id, email, name, role, company_id, mfa_secret
    FROM users
    WHERE id = ? AND company_id = ?
  `).get(userId, companyId)
  if (!user) return sendError(res, 404, API_MESSAGES.userNotFound)
  if (!isSelf(req, userId) && !isAssignableCompanyUserRole(user.role)) {
    return sendError(res, 403, API_MESSAGES.accessDenied)
  }
  if (!user.mfa_secret) return sendError(res, 400, API_MESSAGES.mfaNotConfigured)
  const verified = speakeasy.totp.verify({ secret: user.mfa_secret, encoding: 'base32', token })
  if (!verified) return sendError(res, 401, API_MESSAGES.invalidMfaCode)
  // Activate MFA for user
  db.prepare('UPDATE users SET mfa_enabled = 1 WHERE id = ? AND company_id = ?').run(userId, companyId)
  return sendAuthSession(res, {
    ...user,
    company_id: user.company_id || companyId,
  })
})

// Legacy public registration endpoint for local/mobile experiments.
// In the SaaS production model companies are created by the resource admin,
// and company users are created by the company owner from the user panel.
app.post('/api/auth/register', ...publicAuthRateLimit, (req, res) => {
  if (!PUBLIC_REGISTRATION_ENABLED) {
    return sendError(res, 403, 'Public registration is disabled')
  }

  const { email, password, name } = req.body
  // Public registration: always register as inspector
  const role = 'inspector'
  if (!email || !password || !name) {
    return sendError(res, 400, API_MESSAGES.registerFieldsRequired)
  }
  const existing = getUserIdByEmail(email)
  if (existing) {
    return sendError(res, 400, API_MESSAGES.userEmailExists)
  }

  const id = uuidv4()
  const hashedPassword = bcrypt.hashSync(password, 10)
  createUserRecord({ id, email, passwordHash: hashedPassword, name, role })

  const user = getUserSummaryById(id)
  return sendAuthSession(res, user)
})

app.post('/api/auth/logout', noStore, (req, res) => {
  clearAuthCookie(res)
  res.status(204).end()
})

app.get('/api/auth/me', authenticate, (req, res) => {
  const user = getUserSummaryById(req.user.id)
  res.json(user)
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

app.get('/api/regions', authenticate, (req, res) => {
  const includeEmpty = req.query.includeEmpty === '1' || req.query.includeEmpty === 'true'
  const companyId = req.user.company_id || 'default'
  const regions = listRegions(companyId)
  const normalizedRegions = regions.map((region) => ({
    ...region,
    vehicle_count: Number(region.vehicle_count || 0),
    vehicleCount: Number(region.vehicle_count || 0),
  }))

  res.json(includeEmpty ? normalizedRegions : normalizedRegions.filter((region) => region.vehicle_count > 0))
})

app.post('/api/regions', authenticate, (req, res) => {
  if (!ensureManager(req, res)) return
  if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'write' })) return

  const regionName = normalizeRegionName(req.body?.name)
  if (!regionName) {
    return sendError(res, 400, API_MESSAGES.regionNameRequired)
  }

  if (getRegionByName(regionName)) {
    return sendError(res, 400, API_MESSAGES.regionAlreadyExists)
  }

  createRegionRecord(regionName)
  const region = getRegionByName(regionName)
  res.status(201).json({ ...region, vehicle_count: 0, vehicleCount: 0 })
})

app.put('/api/regions/:id', authenticate, (req, res) => {
  if (!ensureManager(req, res)) return
  if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'write' })) return

  const companyId = req.user.company_id || 'default'
  
  const region = getRegionForMutation(req.params.id, req.body?.currentName, companyId)
  if (!region) {
    return sendError(res, 404, API_MESSAGES.regionNotFound)
  }
  
  const newName = normalizeRegionName(req.body?.name)
  if (!newName) {
    return sendError(res, 400, API_MESSAGES.regionNameRequired)
  }
  
  const existing = getRegionByName(newName)
  if (existing && existing.id !== region.id) {
    db.prepare('UPDATE vehicles SET region = ? WHERE region = ? AND company_id = ?').run(existing.name, region.name, companyId)
    if (countVehiclesByRegion(region.name) === 0) {
      deleteRegionRecord(region.id)
    }

    const vehicleCount = countVehiclesByRegion(existing.name, companyId)
    return res.json({
      id: existing.id,
      name: existing.name,
      vehicle_count: vehicleCount,
      vehicleCount,
      merged_from: region.name,
      merged_into: existing.name,
    })
  }
  
  db.prepare('UPDATE vehicles SET region = ? WHERE region = ? AND company_id = ?').run(newName, region.name, companyId)
  if (countVehiclesByRegion(region.name) === 0) {
    db.prepare('UPDATE regions SET name = ? WHERE id = ?').run(newName, region.id)
  } else if (!getRegionByName(newName)) {
    createRegionRecord(newName)
  }
  
  const updatedRegion = getRegionByName(newName)
  const vehicleCount = countVehiclesByRegion(newName, companyId)
  res.json({ id: updatedRegion?.id || region.id, name: newName, vehicle_count: vehicleCount, vehicleCount })
})

app.delete('/api/regions/:id', authenticate, (req, res) => {
  if (!ensureManager(req, res)) return
  if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'write' })) return

  const companyId = req.user.company_id || 'default'

  const region = getRegionById(req.params.id)
  if (!region) {
    return sendError(res, 404, API_MESSAGES.regionNotFound)
  }

  db.prepare('UPDATE vehicles SET region = NULL WHERE region = ? AND company_id = ?').run(region.name, companyId)
  if (countVehiclesByRegion(region.name) === 0) {
    deleteRegionRecord(req.params.id)
  }
  res.status(204).send()
})

// ============ VEHICLES ============

app.get('/api/vehicles', authenticate, (req, res) => {
  const { page = 1, limit = 20, search = '', status = 'all' } = req.query
  const offset = (page - 1) * limit
  const companyId = req.user.company_id || 'default'

  let whereClause = 'company_id = ?'
  const params = [companyId]

  if (search) {
    whereClause += ' AND (number LIKE ? OR name LIKE ?)'
    params.push(`%${search}%`, `%${search}%`)
  }

  if (status && status !== 'all') {
    if (!VEHICLE_STATUSES.has(String(status))) {
      return sendError(res, 400, 'Неизвестный статус техники')
    }
    whereClause += ' AND status = ?'
    params.push(status)
  } else {
    whereClause += " AND status != 'archived'"
  }

  const countQuery = db.prepare(`SELECT COUNT(*) as count FROM vehicles WHERE ${whereClause}`)
  const { count } = countQuery.get(...params)

  const query = db.prepare(`
    SELECT id, number, name, status, region, company_id, created_at, last_scheduled_inspection
    FROM vehicles
    WHERE ${whereClause}
    ORDER BY created_at DESC 
    LIMIT ? OFFSET ?
  `)
  const vehicles = query.all(...params, Number(limit), offset)

  // Get last inspection and defects count for each vehicle
  const vehiclesWithStats = vehicles.map(v => {
    const lastInspection = db.prepare(`
      SELECT id, created_at FROM inspections 
      WHERE vehicle_id = ? ORDER BY created_at DESC LIMIT 1
    `).get(v.id)

    const defectsCount = db.prepare(`
      SELECT COUNT(*) as count FROM defects d
      JOIN inspections i ON d.inspection_id = i.id
      WHERE i.vehicle_id = ?
    `).get(v.id).count

    return { ...v, lastInspection, defectsCount: Number(defectsCount) }
  })

  res.json({
    data: vehiclesWithStats,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: count,
      pages: Math.ceil(count / limit)
    }
  })
})

app.get('/api/vehicles/list', authenticate, (req, res) => {
  try {
    const companyId = req.user.company_id || 'default'
    const vehicles = db.prepare(`
      SELECT id, number, name, status, region
      FROM vehicles
      WHERE company_id = ? AND status != 'archived'
      ORDER BY number
    `).all(companyId)
    res.json(vehicles)
  } catch (err) {
    console.error('Vehicles list error:', err)
    return sendInternalError(res, 'Vehicles list error', err)
  }
})

app.get('/api/vehicles/:id/history', authenticate, (req, res) => {
  const companyId = req.user.company_id || 'default'
  const vehicle = getVehicleById(req.params.id, companyId)
  if (!vehicle) {
    return sendError(res, 404, API_MESSAGES.vehicleNotFound)
  }

  const history = db.prepare(`
    SELECT h.*, u.name as changed_by_name
    FROM vehicle_status_history h
    LEFT JOIN users u ON h.changed_by = u.id
    WHERE h.vehicle_id = ?
    ORDER BY h.created_at DESC
  `).all(req.params.id)
  res.json(history)
})

app.get('/api/vehicles/:id/defects', authenticate, (req, res) => {
  const companyId = req.user.company_id || 'default'
  const vehicle = getVehicleById(req.params.id, companyId)
  if (!vehicle) {
    return sendError(res, 404, API_MESSAGES.vehicleNotFound)
  }

  const limit = Number(req.query.limit || 20)
  const defects = db.prepare(`
    SELECT d.id, d.inspection_id, d.title, d.comment, d.created_at, d.status, d.closed_at,
           i.type as inspection_type, i.created_at as inspection_date, i.created_at as inspection_time,
           i.accident_occurred_at, i.accident_location,
           v.id as vehicle_id, v.number as vehicle_number, v.name as vehicle_name, v.region as vehicle_region,
           u.name as inspector_name
    FROM defects d
    JOIN inspections i ON d.inspection_id = i.id
    JOIN vehicles v ON i.vehicle_id = v.id
    JOIN users u ON i.inspector_id = u.id
    WHERE v.id = ? AND v.company_id = ?
    ORDER BY d.created_at DESC
    LIMIT ?
  `).all(req.params.id, companyId, limit)

  const defectsWithPhotos = defects.map((defect) => {
    const photos = db.prepare(`SELECT ${PHOTO_SELECT_COLUMNS} FROM photos WHERE defect_id = ? AND company_id = ? ORDER BY created_at ASC`).all(defect.id, companyId)
    return { ...defect, photos }
  })

  res.json(defectsWithPhotos)
})

app.get('/api/vehicles/:id', authenticate, (req, res) => {
  const companyId = req.user.company_id || 'default'
  const vehicle = getVehicleById(req.params.id, companyId)
  if (!vehicle) {
    return sendError(res, 404, API_MESSAGES.vehicleNotFound)
  }
  res.json(vehicle)
})

app.post('/api/vehicles', authenticate, (req, res) => {
  if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'create' })) return

  const { number, name, status = 'active', region } = req.body
  const companyId = req.user.company_id || 'default'
  if (!VEHICLE_STATUSES.has(String(status))) {
    return sendError(res, 400, 'Неизвестный статус техники')
  }

  const validated = validateVehiclePayload({ number, name, region })
  if (validated.error) {
    return sendError(res, 400, validated.error)
  }

  const duplicateError = ensureVehicleNumberAvailable(validated.number, null, companyId)
  if (duplicateError) {
    return sendError(res, 400, duplicateError)
  }

  const limitViolation = getCompanyLimitViolation(companyId, 'vehicles')
  if (limitViolation) {
    return sendCompanyLimitViolation(res, limitViolation)
  }

  const id = uuidv4()

  createVehicleRecord({
    id,
    number: validated.number,
    name: validated.name,
    status,
    region: validated.region,
    companyId,
  })

  const vehicle = getVehicleById(id, companyId)
  res.status(201).json(vehicle)
})

// POST /api/vehicles/import - bulk import vehicles from CSV
app.post('/api/vehicles/import', authenticate, (req, res) => {
  if (!ensureManager(req, res)) return
  if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'create' })) return

  const companyId = req.user.company_id || 'default'
  
  const { vehicles } = req.body
  if (!Array.isArray(vehicles)) {
    return sendError(res, 400, 'Требуется массив vehicles')
  }
  
  const imported = []
  const errors = []
  const regionsAdded = []
  const vehicleLimitState = getCompanyResourceLimitState(companyId, 'vehicles')
  
  // First pass: collect all unique regions and auto-create them
  const regions = new Set()
  vehicles.forEach(v => {
    if (v.region) regions.add(v.region)
  })
  
  regions.forEach(regionName => {
    const normalized = normalizeRegionName(regionName)
    if (normalized && !getRegionByName(normalized)) {
      createRegionRecord(normalized)
      regionsAdded.push(normalized)
    }
  })
  
  vehicles.forEach((v, idx) => {
    const { number, name, region } = v
    
    // Use normalized region name if provided, otherwise empty
    const normalizedRegion = region ? normalizeRegionName(region) : ''
    
    const validated = validateVehiclePayload({ number, name, region: normalizedRegion })
    if (validated.error) {
      errors.push({ row: idx + 1, error: validated.error })
      return
    }
    
    const duplicateError = ensureVehicleNumberAvailable(validated.number, null, companyId)
    if (duplicateError) {
      errors.push({ row: idx + 1, error: duplicateError })
      return
    }

    if (vehicleLimitState && vehicleLimitState.current + imported.length + 1 > vehicleLimitState.max) {
      errors.push({
        row: idx + 1,
        error: `${API_MESSAGES.vehicleLimitExceeded}. Текущее значение: ${vehicleLimitState.current + imported.length}/${vehicleLimitState.max}.`,
      })
      return
    }
    
    const id = uuidv4()
    createVehicleRecord({
      id,
      number: validated.number,
      name: validated.name,
      status: 'active',
      region: validated.region,
      companyId,
    })
    imported.push({ number: validated.number })
  })
  
  res.json({ imported: imported.length, errors, vehicles: imported, regionsAdded: regionsAdded.length })
})

app.post('/api/vehicles/archive', authenticate, (req, res) => {
  if (!ensureManager(req, res)) return
  if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'write' })) return

  const companyId = req.user.company_id || 'default'
  const result = archiveVehiclesByIds({
    ids: req.body?.ids,
    companyId,
    changedBy: req.user.id,
  })

  if (result.error) {
    return sendError(res, result.status || 400, result.error)
  }

  res.json(result)
})

app.post('/api/vehicles/:id/archive', authenticate, (req, res) => {
  if (!ensureManager(req, res)) return
  if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'write' })) return

  const companyId = req.user.company_id || 'default'
  const result = archiveVehiclesByIds({
    ids: [req.params.id],
    companyId,
    changedBy: req.user.id,
  })

  if (result.error) {
    return sendError(res, result.status || 400, result.error)
  }

  res.json(result)
})

app.put('/api/vehicles/:id', authenticate, (req, res) => {
  if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'write' })) return

  const { number, name, status, region, reason } = req.body
  const companyId = req.user.company_id || 'default'
  if (!VEHICLE_STATUSES.has(String(status))) {
    return sendError(res, 400, 'Неизвестный статус техники')
  }

  const oldVehicle = getVehicleById(req.params.id, companyId)
  if (!oldVehicle) {
    return sendError(res, 404, API_MESSAGES.vehicleNotFound)
  }

  const validated = validateVehiclePayload({ number, name, region })
  if (validated.error) {
    return sendError(res, 400, validated.error)
  }

  const duplicateError = ensureVehicleNumberAvailable(validated.number, req.params.id, companyId)
  if (duplicateError) {
    return sendError(res, 400, duplicateError)
  }

  updateVehicleRecord(req.params.id, {
    number: validated.number,
    name: validated.name,
    status,
    region: validated.region,
    companyId,
  })

  if (oldVehicle.status !== status) {
    recordVehicleStatusChange({
      vehicleId: req.params.id,
      oldStatus: oldVehicle.status,
      newStatus: status,
      reason,
      changedBy: req.user.id
    })
  }

  const vehicle = getVehicleById(req.params.id, companyId)
  res.json(vehicle)
})

app.delete('/api/vehicles/:id', authenticate, (req, res) => {
  if (!ensureManager(req, res)) return
  if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'write' })) return

  const companyId = req.user.company_id || 'default'
  const result = archiveVehiclesByIds({
    ids: [req.params.id],
    companyId,
    changedBy: req.user.id,
  })

  if (result.error) {
    return sendError(res, result.status || 400, result.error)
  }

  res.status(204).send()
})

// ============ INSPECTIONS ============

app.get('/api/inspections', authenticate, (req, res) => {
  const { page = 1, limit = 20, type = '', vehicle = '', from = '', to = '' } = req.query
  const offset = (page - 1) * limit
  const companyId = req.user.company_id || 'default'

  let whereClause = 'i.company_id = ?'
  const params = [companyId]

  if (type) {
    whereClause += ' AND i.type = ?'
    params.push(type)
  }

  if (vehicle) {
    whereClause += ' AND i.vehicle_id = ?'
    params.push(vehicle)
  }

  if (from) {
    whereClause += ' AND i.created_at >= ?'
    params.push(from)
  }

  if (to) {
    whereClause += ' AND i.created_at <= ?'
    params.push(to + ' 23:59:59')
  }

  const countQuery = db.prepare(`SELECT COUNT(*) as count FROM inspections i WHERE ${whereClause}`)
  const { count } = countQuery.get(...params)

  const query = db.prepare(`
    SELECT i.id, i.vehicle_id, i.type, i.completed, i.created_at, i.accident_occurred_at, i.accident_location,
           v.number as vehicle_number, v.name as vehicle_name, v.region as vehicle_region, u.name as inspector_name,
           (SELECT COUNT(*) FROM defects WHERE inspection_id = i.id) as defects_count
    FROM inspections i
    JOIN vehicles v ON i.vehicle_id = v.id
    JOIN users u ON i.inspector_id = u.id
    WHERE ${whereClause}
    ORDER BY i.created_at DESC 
    LIMIT ? OFFSET ?
  `)
  const inspections = query.all(...params, Number(limit), offset)

  res.json({
    data: inspections,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: count,
      pages: Math.ceil(count / limit)
    }
  })
})

app.get('/api/vehicles/:vehicleId/inspections', authenticate, (req, res) => {
  const { page = 1, limit = 5 } = req.query
  const offset = (page - 1) * limit
  const companyId = req.user.company_id || 'default'

  const vehicle = getVehicleById(req.params.vehicleId, companyId)
  if (!vehicle) {
    return sendError(res, 404, API_MESSAGES.vehicleNotFound)
  }

  const countQuery = db.prepare('SELECT COUNT(*) as count FROM inspections WHERE vehicle_id = ? AND company_id = ?')
  const { count } = countQuery.get(req.params.vehicleId, companyId)

  const query = db.prepare(`
    SELECT i.id, i.vehicle_id, i.type, i.completed, i.created_at,
           v.number as vehicle_number, v.name as vehicle_name, v.region as vehicle_region,
           u.name as inspector_name,
           (SELECT COUNT(*) FROM defects WHERE inspection_id = i.id) as defects_count
    FROM inspections i
    JOIN vehicles v ON i.vehicle_id = v.id
    JOIN users u ON i.inspector_id = u.id
    WHERE i.vehicle_id = ? AND i.company_id = ?
    ORDER BY i.created_at DESC 
    LIMIT ? OFFSET ?
  `)
  const inspections = query.all(req.params.vehicleId, companyId, Number(limit), offset)

  res.json({
    data: inspections,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: count,
      pages: Math.ceil(count / limit)
    }
  })
})

app.post('/api/inspections', authenticate, (req, res) => {
  if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'create' })) return

  const { vehicle_id, type = 'quick', checklist = [], accident_occurred_at = null, accident_location = null } = req.body
  const companyId = req.user.company_id || 'default'

  if (type === 'accident' && !ensureCompanyFeatureEnabled(req, res, 'accident_module_enabled', API_MESSAGES.accidentModuleDisabled)) {
    return
  }

  const vehicle = getVehicleById(vehicle_id, companyId)
  if (!vehicle) {
    return sendError(res, 404, API_MESSAGES.vehicleNotFound)
  }

  const accidentValidation = validateAccidentDetails(type, accident_occurred_at, accident_location)
  if (accidentValidation.error) {
    return sendError(res, 400, accidentValidation.error)
  }
  const id = uuidv4()

  db.prepare(`
    INSERT INTO inspections (id, vehicle_id, inspector_id, type, completed, accident_occurred_at, accident_location, company_id)
    VALUES (?, ?, ?, ?, 0, ?, ?, ?)
  `).run(id, vehicle_id, req.user.id, type, accidentValidation.accidentOccurredAt, accidentValidation.accidentLocation, companyId)

  if (type === 'scheduled') {
    db.prepare('UPDATE vehicles SET last_scheduled_inspection = datetime("now") WHERE id = ? AND company_id = ?').run(vehicle_id, companyId)
  }

  const insertChecklist = db.prepare(`
    INSERT INTO checklist_items (id, inspection_id, title, result, comment)
    VALUES (?, ?, ?, ?, ?)
  `)

  checklist.forEach(item => {
    const itemId = uuidv4()
    insertChecklist.run(itemId, id, item.title, item.result ? 1 : 0, item.comment || null)
    // Defects are now created via dedicated API call '/api/inspections/:id/defects'
  })

  // Completion is deferred to /api/inspections/:id/complete

  const inspection = getInspectionById(id, companyId)
  res.status(201).json(inspection)
})

// Create a defect for a specific inspection
app.post('/api/inspections/:id/defects', authenticate, (req, res) => {
  if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'write' })) return

  const inspectionId = req.params.id
  const { title, comment } = req.body
  const companyId = req.user.company_id || 'default'
  if (!title) return sendError(res, 400, API_MESSAGES.defectTitleRequired || 'Заголовок дефекта обязателен')
  const inspection = db.prepare('SELECT * FROM inspections WHERE id = ? AND company_id = ?').get(inspectionId, companyId)
  if (!inspection) return sendError(res, 404, API_MESSAGES.inspectionNotFound)
  const defectId = uuidv4()
  db.prepare(`INSERT INTO defects (id, inspection_id, title, comment, status, company_id, created_at) VALUES (?, ?, ?, ?, 'open', ?, datetime('now'))`).run(defectId, inspectionId, title, comment || null, companyId)
  const defect = db.prepare('SELECT * FROM defects WHERE id = ?').get(defectId)
  res.status(201).json(defect)
})

app.post('/api/inspections/:id/photos', authenticate, (req, res, next) => {
  if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'create' })) return
  next()
}, uploadPhoto, async (req, res) => {
  const inspectionId = req.params.id
  const companyId = req.user.company_id || 'default'
  const inspection = db.prepare('SELECT id, type FROM inspections WHERE id = ? AND company_id = ?').get(inspectionId, companyId)
  if (!inspection) {
    await removeFileIfExists(req.file?.path)
    return sendError(res, 404, API_MESSAGES.inspectionNotFound)
  }

  if (!req.file) {
    return sendError(res, 400, 'Photo is required')
  }

  const photoType = String(req.body.photo_type || req.body.photoType || '').trim()
  if (!getAllowedPhotoTypes(inspection.type).has(photoType)) {
    await removeFileIfExists(req.file?.path)
    return sendError(res, 400, API_MESSAGES.invalidPhotoType)
  }

  const id = uuidv4()
  const geo = req.body.geo || null
  const isRequired = (photoRequirements[inspection.type]?.required || []).includes(photoType) ? 1 : 0

  try {
    const processed = await processUploadedPhoto({
      tempPath: req.file.path,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      inspectionId,
      photoId: id,
    })

    db.prepare(`
      INSERT INTO photos (
        id, inspection_id, defect_id, company_id, photo_type, url,
        original_url, webp_url, thumb_url, original_mime, original_name,
        width, height, size_original, size_webp, size_thumb, hash,
        geo, is_required
      )
      VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      inspectionId,
      companyId,
      photoType,
      processed.url,
      processed.original_url,
      processed.webp_url,
      processed.thumb_url,
      processed.original_mime,
      processed.original_name,
      processed.width,
      processed.height,
      processed.size_original,
      processed.size_webp,
      processed.size_thumb,
      processed.hash,
      geo,
      isRequired,
    )
  } catch (err) {
    await removeFileIfExists(req.file?.path)
    console.warn('[uploads] Failed to process inspection photo:', err.message)
    return sendError(res, 400, 'Photo could not be processed')
  }

  const photo = db.prepare(`
    SELECT ${PHOTO_SELECT_COLUMNS}
    FROM photos
    WHERE id = ? AND company_id = ?
  `).get(id, companyId)

  res.status(201).json(photo)
})

// (Legacy duplicate complete route removed)

// (Legacy duplicate complete route removed)

app.get('/api/inspections/:id', authenticate, (req, res) => {
  const companyId = req.user.company_id || 'default'
  const inspection = db.prepare(`
    SELECT i.*, v.number as vehicle_number, v.name as vehicle_name, u.name as inspector_name
    FROM inspections i
    JOIN vehicles v ON i.vehicle_id = v.id
    JOIN users u ON i.inspector_id = u.id
    WHERE i.id = ? AND i.company_id = ?
  `).get(req.params.id, companyId)

  if (!inspection) {
    return sendError(res, 404, API_MESSAGES.inspectionNotFound)
  }

  const checklist = db.prepare('SELECT * FROM checklist_items WHERE inspection_id = ?').all(req.params.id)
  const defects = getDefectsWithPhotos(req.params.id, companyId)
  const photos = getInspectionPhotos(req.params.id, companyId)

  res.json({ ...inspection, checklist_items: checklist, defects, photos })
})

app.put('/api/inspections/:id', authenticate, async (req, res) => {
  if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'write' })) return

  const companyId = req.user.company_id || 'default'
  const inspection = db.prepare('SELECT * FROM inspections WHERE id = ? AND company_id = ?').get(req.params.id, companyId)
  if (!inspection) {
    return sendError(res, 404, API_MESSAGES.inspectionNotFound)
  }

  const { checklist = [], accident_occurred_at = null, accident_location = null } = req.body
  const accidentValidation = validateAccidentDetails(inspection.type, accident_occurred_at, accident_location)
  if (accidentValidation.error) {
    return sendError(res, 400, accidentValidation.error)
  }

  db.prepare(`
    UPDATE inspections
    SET accident_occurred_at = ?, accident_location = ?, odometer_value = ?, odometer_unit = ?
    WHERE id = ? AND company_id = ?
  `).run(
    accidentValidation.accidentOccurredAt,
    accidentValidation.accidentLocation,
    req.body.odometer_value ?? inspection.odometer_value ?? null,
    req.body.odometer_unit ?? inspection.odometer_unit ?? 'km',
    req.params.id,
    companyId,
  )

  const existingChecklistItems = db.prepare(`
    SELECT id, title
    FROM checklist_items
    WHERE inspection_id = ?
  `).all(req.params.id)
  const existingChecklistById = new Map(existingChecklistItems.map((item) => [item.id, item]))
  const existingChecklistByTitle = new Map(existingChecklistItems.map((item) => [item.title, item]))
  const existingDefects = db.prepare(`
    SELECT id, title, checklist_item_id
    FROM defects
    WHERE inspection_id = ? AND company_id = ?
    ORDER BY created_at ASC
  `).all(req.params.id, companyId)
  const existingDefectsByChecklistItemId = new Map()
  const existingDefectsByTitle = new Map()

  existingDefects.forEach((defect) => {
    if (defect.checklist_item_id && !existingDefectsByChecklistItemId.has(defect.checklist_item_id)) {
      existingDefectsByChecklistItemId.set(defect.checklist_item_id, defect)
    }

    if (!existingDefectsByTitle.has(defect.title)) {
      existingDefectsByTitle.set(defect.title, defect)
    }
  })

  const insertChecklist = db.prepare(`
    INSERT INTO checklist_items (id, inspection_id, title, result, comment)
    VALUES (?, ?, ?, ?, ?)
  `)
  const updateChecklist = db.prepare(`
    UPDATE checklist_items
    SET result = ?, comment = ?
    WHERE id = ?
  `)
  const deleteChecklist = db.prepare('DELETE FROM checklist_items WHERE id = ?')

  const insertDefect = db.prepare(`
    INSERT INTO defects (id, inspection_id, checklist_item_id, title, comment, company_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `)
  const updateDefect = db.prepare(`
    UPDATE defects
    SET checklist_item_id = ?, title = ?, comment = ?
    WHERE id = ? AND company_id = ?
  `)
  const selectDefectPhotos = db.prepare(`SELECT ${PHOTO_SELECT_COLUMNS} FROM photos WHERE defect_id = ? AND company_id = ?`)
  const deleteDefectPhotos = db.prepare('DELETE FROM photos WHERE defect_id = ? AND company_id = ?')
  const deleteDefect = db.prepare('DELETE FROM defects WHERE id = ? AND company_id = ?')
  const retainedChecklistItemIds = new Set()
  const photosToRemove = []

  checklist.forEach((item) => {
    const existingChecklistItem = (item.id && existingChecklistById.get(item.id)) || existingChecklistByTitle.get(item.title)
    const checklistItemId = existingChecklistItem?.id || item.id || uuidv4()
    retainedChecklistItemIds.add(checklistItemId)

    if (existingChecklistItem) {
      updateChecklist.run(item.result ? 1 : 0, item.comment || null, existingChecklistItem.id)
    } else {
      insertChecklist.run(checklistItemId, req.params.id, item.title, item.result ? 1 : 0, item.comment || null)
    }

    const existingDefect = existingDefectsByChecklistItemId.get(checklistItemId) || existingDefectsByTitle.get(item.title)
    if (!item.result) {
      if (existingDefect) {
        updateDefect.run(checklistItemId, item.title, item.comment || null, existingDefect.id, companyId)
      } else {
        insertDefect.run(uuidv4(), req.params.id, checklistItemId, item.title, item.comment || null, companyId)
      }
      return
    }

    if (existingDefect) {
      photosToRemove.push(...selectDefectPhotos.all(existingDefect.id, companyId))
      deleteDefectPhotos.run(existingDefect.id, companyId)
      deleteDefect.run(existingDefect.id, companyId)
    }
  })

  existingChecklistItems.forEach((item) => {
    if (!retainedChecklistItemIds.has(item.id)) {
      deleteChecklist.run(item.id)
    }
  })

  existingDefects.forEach((defect) => {
    if (defect.checklist_item_id && !retainedChecklistItemIds.has(defect.checklist_item_id)) {
      photosToRemove.push(...selectDefectPhotos.all(defect.id, companyId))
      deleteDefectPhotos.run(defect.id, companyId)
      deleteDefect.run(defect.id, companyId)
    }
  })

  await removePhotoFilesForRows(photosToRemove)

  const updatedInspection = db.prepare(`
    SELECT i.*, v.number as vehicle_number, v.name as vehicle_name, u.name as inspector_name
    FROM inspections i
    JOIN vehicles v ON i.vehicle_id = v.id
    JOIN users u ON i.inspector_id = u.id
    WHERE i.id = ? AND i.company_id = ?
  `).get(req.params.id, companyId)

  const updatedChecklist = db.prepare('SELECT * FROM checklist_items WHERE inspection_id = ?').all(req.params.id)
  const updatedDefects = getDefectsWithPhotos(req.params.id, companyId)
  const photos = getInspectionPhotos(req.params.id, companyId)

  res.json({ ...updatedInspection, checklist_items: updatedChecklist, defects: updatedDefects, photos })
})

app.delete('/api/inspections/:id', authenticate, async (req, res) => {
  if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'write' })) return

  const { id } = req.params
  const companyId = req.user.company_id || 'default'
  
  const inspection = db.prepare('SELECT * FROM inspections WHERE id = ? AND company_id = ?').get(id, companyId)
  if (!inspection) {
    return sendError(res, 404, API_MESSAGES.inspectionNotFound)
  }
  
  const photos = db.prepare(`SELECT ${PHOTO_SELECT_COLUMNS} FROM photos WHERE inspection_id = ? AND company_id = ?`).all(id, companyId)
  db.prepare('DELETE FROM checklist_items WHERE inspection_id = ?').run(id)
  db.prepare('DELETE FROM defects WHERE inspection_id = ?').run(id)
  db.prepare('DELETE FROM photos WHERE inspection_id = ? AND company_id = ?').run(id, companyId)
  db.prepare('DELETE FROM inspections WHERE id = ? AND company_id = ?').run(id, companyId)
  await removePhotoFilesForRows(photos)
  
  res.status(204).send()
})

// ============ DEFECTS ============

app.get('/api/defects', authenticate, (req, res) => {
  const { page = 1, limit = 20, search = '', vehicle = '', from = '', to = '' } = req.query
  const offset = (page - 1) * limit
  const companyId = req.user.company_id || 'default'

  let whereClause = 'd.company_id = ?'
  const params = [companyId]

  if (search) {
    whereClause += ' AND (d.title LIKE ? OR d.comment LIKE ?)'
    params.push(`%${search}%`, `%${search}%`)
  }

  if (vehicle) {
    whereClause += ' AND v.id = ?'
    params.push(vehicle)
  }

  if (from) {
    whereClause += ' AND d.created_at >= ?'
    params.push(from)
  }

  if (to) {
    whereClause += ' AND d.created_at <= ?'
    params.push(to + ' 23:59:59')
  }

  const countQuery = db.prepare(`SELECT COUNT(*) as count FROM defects d JOIN inspections i ON d.inspection_id = i.id JOIN vehicles v ON i.vehicle_id = v.id WHERE ${whereClause}`)
  const { count } = countQuery.get(...params)

  const query = db.prepare(`
    SELECT d.id, d.inspection_id, d.title, d.comment, d.created_at as created_at, d.status as status, d.closed_at as closed_at,
           i.type as inspection_type, i.created_at as inspection_date, i.created_at as inspection_time,
           i.accident_occurred_at, i.accident_location,
           v.id as vehicle_id, v.number as vehicle_number, v.name as vehicle_name, v.region as vehicle_region,
           u.name as inspector_name
    FROM defects d
    JOIN inspections i ON d.inspection_id = i.id
    JOIN vehicles v ON i.vehicle_id = v.id
    JOIN users u ON i.inspector_id = u.id
    WHERE ${whereClause}
    ORDER BY d.created_at DESC 
    LIMIT ? OFFSET ?
  `)
  const defects = query.all(...params, Number(limit), offset)

  const defectsWithPhotos = defects.map(defect => {
    const photos = db.prepare(`SELECT ${PHOTO_SELECT_COLUMNS} FROM photos WHERE defect_id = ? AND company_id = ?`).all(defect.id, companyId)
    return { ...defect, photos }
  })

  res.json({
    data: defectsWithPhotos,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: count,
      pages: Math.ceil(count / limit)
    }
  })
})

app.get('/api/defects/:id', authenticate, (req, res) => {
  const companyId = req.user.company_id || 'default'
  const defect = db.prepare(`
    SELECT d.id, d.inspection_id, d.title, d.comment, d.created_at, d.status, d.closed_at,
           i.type as inspection_type, i.created_at as inspection_date, i.created_at as inspection_time,
           i.accident_occurred_at, i.accident_location,
           v.id as vehicle_id, v.number as vehicle_number, v.name as vehicle_name, v.region as vehicle_region,
           u.name as inspector_name
    FROM defects d
    JOIN inspections i ON d.inspection_id = i.id
    JOIN vehicles v ON i.vehicle_id = v.id
    JOIN users u ON i.inspector_id = u.id
    WHERE d.id = ? AND d.company_id = ?
  `).get(req.params.id, companyId)

  if (!defect) {
    return sendError(res, 404, API_MESSAGES.defectNotFound)
  }

  const photos = db.prepare(`SELECT ${PHOTO_SELECT_COLUMNS} FROM photos WHERE defect_id = ? AND company_id = ? ORDER BY created_at ASC`).all(req.params.id, companyId)
  res.json({ ...defect, photos })
})

// Close a defect (set status to 'closed' and log history)
app.post('/api/defects/:id/close', authenticate, (req, res) => {
  if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'write' })) return

  const defectId = req.params.id
  const companyId = req.user.company_id || 'default'
  const defect = db.prepare('SELECT id, status, closed_at FROM defects WHERE id = ? AND company_id = ?').get(defectId, companyId)
  if (!defect) return sendError(res, 404, API_MESSAGES.defectNotFound)
  if (defect.status === 'closed') {
    return res.json({ id: defectId, status: 'closed', closed_at: defect.closed_at })
  }

  const now = new Date().toISOString()
  db.prepare('UPDATE defects SET status = ?, closed_at = ? WHERE id = ? AND company_id = ?').run('closed', now, defectId, companyId)
  const historyId = uuidv4()
  db.prepare('INSERT INTO defect_history (id, defect_id, status, changed_at, changed_by) VALUES (?, ?, ?, ?, ?)').run(historyId, defectId, 'closed', now, req.user?.id ?? null)
  const updated = db.prepare('SELECT id, inspection_id, title, comment, status, created_at, closed_at FROM defects WHERE id = ? AND company_id = ?').get(defectId, companyId)
  res.json(updated)
})

// Reopen a defect (set status to 'open', clear closed_at, add history)
app.post('/api/defects/:id/reopen', authenticate, (req, res) => {
  if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'write' })) return

  const defectId = req.params.id
  const companyId = req.user.company_id || 'default'
  const defect = db.prepare('SELECT id, status FROM defects WHERE id = ? AND company_id = ?').get(defectId, companyId)
  if (!defect) return sendError(res, 404, API_MESSAGES.defectNotFound)
  if (defect.status !== 'closed') {
    return res.json({ id: defectId, status: defect.status })
  }

  const now = new Date().toISOString()
  db.prepare('UPDATE defects SET status = ?, closed_at = NULL WHERE id = ? AND company_id = ?').run('open', defectId, companyId)
  const historyId = uuidv4()
  db.prepare('INSERT INTO defect_history (id, defect_id, status, changed_at, changed_by) VALUES (?, ?, ?, ?, ?)').run(historyId, defectId, 'open', now, req.user?.id ?? null)
  const updated = db.prepare('SELECT id, inspection_id, title, comment, status, created_at, closed_at FROM defects WHERE id = ? AND company_id = ?').get(defectId, companyId)
  res.json(updated)
})

// Get defect history
app.get('/api/defects/:id/history', authenticate, (req, res) => {
  const defectId = req.params.id
  const companyId = req.user.company_id || 'default'
  const defect = db.prepare('SELECT id FROM defects WHERE id = ? AND company_id = ?').get(defectId, companyId)
  if (!defect) return sendError(res, 404, API_MESSAGES.defectNotFound)

  const history = db.prepare('SELECT id, defect_id, status, changed_at, changed_by FROM defect_history WHERE defect_id = ? ORDER BY changed_at DESC').all(defectId)
  res.json(history)
})

app.post('/api/defects/:id/photos', authenticate, (req, res, next) => {
  if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'create' })) return
  next()
}, uploadPhoto, async (req, res) => {
  const { geo } = req.body
  const companyId = req.user.company_id || 'default'
  const defect = db.prepare('SELECT id, inspection_id FROM defects WHERE id = ? AND company_id = ?').get(req.params.id, companyId)
  if (!defect) {
    await removeFileIfExists(req.file?.path)
    return sendError(res, 404, API_MESSAGES.defectNotFound)
  }
  if (!req.file) return sendError(res, 400, 'Photo is required')

  const id = uuidv4()

  try {
    const processed = await processUploadedPhoto({
      tempPath: req.file.path,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      inspectionId: defect.inspection_id,
      photoId: id,
    })

    db.prepare(`
      INSERT INTO photos (
        id, inspection_id, defect_id, company_id, photo_type, url,
        original_url, webp_url, thumb_url, original_mime, original_name,
        width, height, size_original, size_webp, size_thumb, hash,
        geo, is_required
      )
      VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(
      id,
      defect.inspection_id,
      req.params.id,
      companyId,
      processed.url,
      processed.original_url,
      processed.webp_url,
      processed.thumb_url,
      processed.original_mime,
      processed.original_name,
      processed.width,
      processed.height,
      processed.size_original,
      processed.size_webp,
      processed.size_thumb,
      processed.hash,
      geo || null,
    )
  } catch (err) {
    await removeFileIfExists(req.file?.path)
    console.warn('[uploads] Failed to process defect photo:', err.message)
    return sendError(res, 400, 'Photo could not be processed')
  }

  const photo = db.prepare(`SELECT ${PHOTO_SELECT_COLUMNS} FROM photos WHERE id = ? AND company_id = ?`).get(id, companyId)
  res.status(201).json(photo)
})

app.delete('/api/photos/:id', authenticate, async (req, res) => {
  if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'write' })) return

  const { id } = req.params
  const companyId = req.user.company_id || 'default'
  const photo = db.prepare(`
    SELECT ${PHOTO_SELECT_COLUMNS}
    FROM photos p
    WHERE p.id = ? AND p.company_id = ?
  `).get(id, companyId)

  if (!photo) {
    return sendError(res, 404, 'Photo not found')
  }

  db.prepare('DELETE FROM photos WHERE id = ?').run(id)
  await removePhotoFiles(photo)
  res.status(204).send()
})

app.put('/api/defects/:id', authenticate, (req, res) => {
  if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'write' })) return

  const { title, comment } = req.body
  const companyId = req.user.company_id || 'default'
  const defect = db.prepare('SELECT id FROM defects WHERE id = ? AND company_id = ?').get(req.params.id, companyId)
  if (!defect) return sendError(res, 404, API_MESSAGES.defectNotFound)
  
  db.prepare('UPDATE defects SET title = ?, comment = ? WHERE id = ? AND company_id = ?')
    .run(title, comment || null, req.params.id, companyId)
  
  const updatedDefect = db.prepare('SELECT * FROM defects WHERE id = ? AND company_id = ?').get(req.params.id, companyId)
  res.json(updatedDefect)
})

app.delete('/api/defects/:id', authenticate, async (req, res) => {
  if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'write' })) return

  const { id } = req.params
  const companyId = req.user.company_id || 'default'
  const defect = db.prepare('SELECT id FROM defects WHERE id = ? AND company_id = ?').get(id, companyId)
  if (!defect) return sendError(res, 404, API_MESSAGES.defectNotFound)
  
  const photos = db.prepare(`SELECT ${PHOTO_SELECT_COLUMNS} FROM photos WHERE defect_id = ? AND company_id = ?`).all(id, companyId)
  db.prepare('DELETE FROM photos WHERE defect_id = ? AND company_id = ?').run(id, companyId)
  db.prepare('DELETE FROM defects WHERE id = ? AND company_id = ?').run(id, companyId)
  await removePhotoFilesForRows(photos)
  
  res.status(204).send()
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
  if (err instanceof multer.MulterError) {
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
