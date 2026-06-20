import 'dotenv/config'
import express from 'express'
import { getDb } from './db.js'
import registerCompleteInspectionRoutes from './routes/completeInspection.js'
import registerHealthRoutes from './routes/health.js'
import registerCompanyRoutes from './routes/companies.js'
import registerCompanyUsageRoutes from './routes/companyUsage.js'
import registerAuthRoutes, { createOwnerSetupInvitationFactory } from './routes/auth.js'
import registerSaasAdminRoutes from './routes/adminSaas.js'
import registerAdminBillingRoutes from './routes/adminBilling.js'
import registerAdminOperationsRoutes from './routes/adminOperations.js'
import registerPilotRequestRoutes from './routes/pilotRequests.js'
import registerRegionRoutes from './routes/regions.js'
import registerVehicleRoutes from './routes/vehicles.js'
import registerInspectionRoutes from './routes/inspections.js'
import registerDefectRoutes from './routes/defects.js'
import registerPhotoRoutes from './routes/photos.js'
import registerInspectionReportRoutes from './routes/reports.js'
import registerInspectionApprovalRoutes from './routes/inspectionApproval.js'
import registerDashboardRoutes from './routes/dashboard.js'
import registerAnalyticsRoutes from './routes/analytics.js'
import registerUserRoutes from './routes/users.js'
import registerSettingsRoutes from './routes/settings.js'
import registerProtectedUploadRoutes from './routes/uploads.js'
import registerDemoDataSeedRoutes from './seed/demoData.js'
import { registerOdometerRoutes, registerVehicleNumberRecognitionRoutes } from './routes/odometer.js'
import { photoRequirements, photoTypeLabels, registerPhotoRequirementRoutes } from './routes/photo-requirements.js'
import { createCompanyPolicy } from './services/companyPolicy.js'
import { createInspectionReadinessService } from './services/inspectionReadiness.js'
import { createInspectionScheduleService } from './services/inspectionSchedule.js'
import { createRoleGuards } from './services/roleGuards.js'
import { createUserStore } from './services/users.js'
import {
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
import { createAuthRateLimitMiddlewares, noStore } from './middleware/authRateLimit.js'
import { isTenantUserEndpoint } from './middleware/tenantEndpoints.js'
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

const {
  publicAuthRateLimit,
  authenticatedSensitiveRateLimit,
} = createAuthRateLimitMiddlewares({
  sensitiveWindowMs: SENSITIVE_RATE_LIMIT_WINDOW_MS,
  sensitiveIpMax: SENSITIVE_RATE_LIMIT_MAX,
  sensitiveAccountMax: AUTH_ACCOUNT_RATE_LIMIT_MAX,
})

registerHealthRoutes({
  app,
  getDb: () => db,
  isAppShuttingDown,
  sendError,
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
  geo, is_required, client_photo_id, upload_status, captured_at, captured_lat, captured_lng,
  watermark_url, watermark_generated_at, created_at
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

function getVehicleById(id, companyId = null) {
  const query = companyId
    ? db.prepare(`
      SELECT v.id, v.number, v.name, v.status, v.region, v.company_id, v.created_at,
             c.created_at AS company_created_at,
             v.primary_photo_url, v.primary_photo_original_url, v.primary_photo_webp_url,
             v.primary_photo_thumb_url, v.primary_photo_source,
             v.last_scheduled_inspection, v.quick_inspection_interval_days,
             v.planned_inspection_interval_days,
             (
               SELECT COALESCE(i.completed_at, i.created_at) FROM inspections i
               WHERE i.vehicle_id = v.id AND i.company_id = v.company_id
                 AND i.type = 'quick' AND i.completed = 1
               ORDER BY COALESCE(i.completed_at, i.created_at) DESC, i.id DESC LIMIT 1
             ) AS last_quick_inspection_at,
             (
               SELECT COALESCE(i.completed_at, i.created_at) FROM inspections i
               WHERE i.vehicle_id = v.id AND i.company_id = v.company_id
                 AND i.type = 'scheduled' AND i.completed = 1
               ORDER BY COALESCE(i.completed_at, i.created_at) DESC, i.id DESC LIMIT 1
             ) AS last_planned_inspection_at
      FROM vehicles v
      LEFT JOIN companies c ON c.id = v.company_id
      WHERE v.id = ? AND v.company_id = ?
    `)
    : db.prepare(`
    SELECT v.id, v.number, v.name, v.status, v.region, v.company_id, v.created_at,
           c.created_at AS company_created_at,
           v.primary_photo_url, v.primary_photo_original_url, v.primary_photo_webp_url,
           v.primary_photo_thumb_url, v.primary_photo_source,
           v.last_scheduled_inspection, v.quick_inspection_interval_days,
           v.planned_inspection_interval_days,
           (
             SELECT COALESCE(i.completed_at, i.created_at) FROM inspections i
             WHERE i.vehicle_id = v.id AND i.company_id = v.company_id
               AND i.type = 'quick' AND i.completed = 1
             ORDER BY COALESCE(i.completed_at, i.created_at) DESC, i.id DESC LIMIT 1
           ) AS last_quick_inspection_at,
           (
             SELECT COALESCE(i.completed_at, i.created_at) FROM inspections i
             WHERE i.vehicle_id = v.id AND i.company_id = v.company_id
               AND i.type = 'scheduled' AND i.completed = 1
             ORDER BY COALESCE(i.completed_at, i.created_at) DESC, i.id DESC LIMIT 1
           ) AS last_planned_inspection_at
    FROM vehicles v
    LEFT JOIN companies c ON c.id = v.company_id
    WHERE v.id = ?
  `)

  const vehicle = companyId ? query.get(id, companyId) : query.get(id)
  return vehicle
    ? inspectionSchedule.enrichVehicle(vehicle, companyId || vehicle.company_id || 'default')
    : vehicle
}

function getInspectionById(id, companyId = null) {
  const query = companyId
    ? db.prepare('SELECT * FROM inspections WHERE id = ? AND company_id = ?')
    : db.prepare('SELECT * FROM inspections WHERE id = ?')

  return companyId ? query.get(id, companyId) : query.get(id)
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

const userStore = createUserStore({ db })
const {
  getUserSummaryById,
  getUserIdByEmail,
  getUserRecordById,
  createUserRecord,
  updateUserRecord,
} = userStore

const roleGuards = createRoleGuards({ sendError, API_MESSAGES })
const {
  isAdmin,
  isCompanyOwner,
  isSelf,
  ensureManager,
  ensureCompanyOwner,
  ensureCompanyOwnerOrSelf,
  ensureAdmin,
  canAssignRole,
  isAssignableCompanyUserRole,
} = roleGuards

const companyPolicy = createCompanyPolicy({ db, sendError, API_MESSAGES })
const {
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
} = companyPolicy
const inspectionReadiness = createInspectionReadinessService({
  db,
  photoRequirements,
  photoTypeLabels,
})
const inspectionSchedule = createInspectionScheduleService({ db, readSettings })

// Register the complete-inspection route after API_MESSAGES is defined
registerCompleteInspectionRoutes({
  app,
  db,
  API_MESSAGES,
  getInspectionById,
  authenticate,
  inspectionReadiness,
  ensureOperationalWriteAllowed: ensureCompanyOperationalWriteAllowed,
})

// Register company routes
registerCompanyRoutes({ app, db, authenticate, isAdmin })

// Register odometer and vehicle number recognition routes
registerOdometerRoutes({
  app,
  db,
  authenticate,
  API_MESSAGES,
  upload,
  ensureOcrAvailable,
  recordOcrUsage: planLimits.recordOcrUsage,
  ensureOperationalWriteAllowed: ensureCompanyOperationalWriteAllowed,
})
registerVehicleNumberRecognitionRoutes({
  app,
  db,
  authenticate,
  API_MESSAGES,
  upload,
  ensureOcrAvailable,
  recordOcrUsage: planLimits.recordOcrUsage,
  ensureOperationalWriteAllowed: ensureCompanyOperationalWriteAllowed,
})

function sendInternalError(res, scope, err) {
  console.error(`${scope}:`, err)
  return res.status(500).json({ error: API_MESSAGES.internalServerError })
}

const createOwnerSetupInvitation = createOwnerSetupInvitationFactory({ db })
registerAdminOperationsRoutes({ app, db, authenticate })
registerPilotRequestRoutes({ app, db, authenticate, createOwnerSetupInvitation })
registerSaasAdminRoutes({ app, db, authenticate, ensureAdmin, sendError, API_MESSAGES, createOwnerSetupInvitation })
registerAdminBillingRoutes({ app, db, authenticate, ensureAdmin, planLimits })

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
  planLimits,
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
  inspectionSchedule,
  uploadPhoto,
  processUploadedPhoto,
  removeFileIfExists,
  removePhotoFiles,
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
  ensureCompanyResourceAvailable,
  ensureCompanyOperationalWriteAllowed,
  removePhotoFilesForRows,
  inspectionReadiness,
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
  ensureManager,
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

registerInspectionReportRoutes({
  app,
  db,
  authenticate,
  inspectionReadiness,
  PHOTO_SELECT_COLUMNS,
  ensureCompanyFeatureEnabled,
})

registerInspectionApprovalRoutes({
  app,
  db,
  authenticate,
  ensureManager,
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
  inspectionSchedule,
})

registerPhotoRequirementRoutes({ app, authenticate })

// ============ NOTIFICATIONS ============

registerDashboardRoutes({
  app,
  db,
  authenticate,
  readSettings,
  sendInternalError,
  inspectionSchedule,
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
