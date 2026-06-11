import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getSecret } from './services/secretStore.js'
import {
  hasEnvValue,
  parsePositiveIntegerEnv,
  parseTrustProxy,
  normalizeHeaderName,
  parseAccessLogSkipPaths,
  isValidAccessLogSkipPath,
} from './utils/env.js'
import { assertPositiveInteger, assertOneOf } from './utils/asserts.js'

export const isProduction = process.env.NODE_ENV === 'production'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const backendRoot = path.resolve(__dirname, '..')

export const JWT_SECRET = getSecret('JWT_SECRET', { allowRandomFallback: !isProduction })

export const PUBLIC_REGISTRATION_ENABLED = process.env.PUBLIC_REGISTRATION_ENABLED
  ? process.env.PUBLIC_REGISTRATION_ENABLED === 'true'
  : false

export const PUBLIC_DEMO_ENABLED = process.env.PUBLIC_DEMO_ENABLED
  ? process.env.PUBLIC_DEMO_ENABLED === 'true'
  : false

export const TRUST_PROXY = parseTrustProxy(process.env.TRUST_PROXY)

export const SECURITY_HSTS_ENABLED = process.env.SECURITY_HSTS_ENABLED
  ? process.env.SECURITY_HSTS_ENABLED === 'true'
  : isProduction

export const SECURITY_HSTS_MAX_AGE = parsePositiveIntegerEnv('SECURITY_HSTS_MAX_AGE', 15552000)

export const SECURITY_CSP = process.env.SECURITY_CSP
  || "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"

export const SECURITY_CROSS_ORIGIN_OPENER_POLICY = process.env.SECURITY_CROSS_ORIGIN_OPENER_POLICY || 'same-origin'

export const SECURITY_CROSS_ORIGIN_RESOURCE_POLICY = process.env.SECURITY_CROSS_ORIGIN_RESOURCE_POLICY || 'same-site'

export const SENSITIVE_RATE_LIMIT_WINDOW_MS = parsePositiveIntegerEnv('SENSITIVE_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000)

export const SENSITIVE_RATE_LIMIT_MAX = parsePositiveIntegerEnv('SENSITIVE_RATE_LIMIT_MAX', isProduction ? 60 : 500)

export const AUTH_ACCOUNT_RATE_LIMIT_MAX = parsePositiveIntegerEnv('AUTH_ACCOUNT_RATE_LIMIT_MAX', isProduction ? 20 : 500)

export const MFA_LOGIN_TOKEN_TTL = process.env.MFA_LOGIN_TOKEN_TTL || '5m'

export const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'audit_session'

export const AUTH_COOKIE_MAX_AGE_SECONDS = parsePositiveIntegerEnv('AUTH_COOKIE_MAX_AGE_SECONDS', 7 * 24 * 60 * 60)

export const AUTH_COOKIE_SECURE = process.env.AUTH_COOKIE_SECURE
  ? process.env.AUTH_COOKIE_SECURE === 'true'
  : isProduction

export const AUTH_COOKIE_SAME_SITE = process.env.AUTH_COOKIE_SAME_SITE || 'Lax'

export const MAX_FILE_SIZE = Number(process.env.MAX_FILE_SIZE || 15 * 1024 * 1024)

export const MAX_IMAGE_PIXELS = parsePositiveIntegerEnv('MAX_IMAGE_PIXELS', 40_000_000)

export const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || '2mb'

export const GRACEFUL_SHUTDOWN_TIMEOUT_MS = parsePositiveIntegerEnv('GRACEFUL_SHUTDOWN_TIMEOUT_MS', 10000)

export const REQUEST_ID_HEADER = normalizeHeaderName(process.env.REQUEST_ID_HEADER || 'x-request-id')

export const ACCESS_LOG_FORMAT = process.env.ACCESS_LOG_FORMAT || (isProduction ? 'json' : 'text')

export const ACCESS_LOG_SLOW_MS = parsePositiveIntegerEnv('ACCESS_LOG_SLOW_MS', 1000)

export const ACCESS_LOG_SKIP_PATHS = parseAccessLogSkipPaths(process.env.ACCESS_LOG_SKIP_PATHS || '')

export const corsOrigins = (process.env.CORS_ORIGINS
  || 'http://localhost:3000,http://localhost:3002,http://localhost:8083,http://localhost:8081,http://localhost:8082')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean)

export const allowAllCorsOrigins = corsOrigins.includes('*')

const UNSAFE_JWT_SECRETS = new Set(['audit-secret-key-2024', 'dev-secret-change-in-production'])
const ALLOWED_ACCESS_LOG_FORMATS = ['json', 'text', 'off']
const ALLOWED_COOP_VALUES = ['same-origin', 'same-origin-allow-popups', 'unsafe-none']
const ALLOWED_CORP_VALUES = ['same-origin', 'same-site', 'cross-origin']
const ALLOWED_COOKIE_SAME_SITE = ['Strict', 'Lax', 'None']
const SAFE_OWNER_DEFAULT_PASSWORD = 'admin123'

function isPathInside(parentPath, targetPath) {
  const relativePath = path.relative(parentPath, targetPath)
  return relativePath === '' || (relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath))
}

function hasTemporaryPathSegment(targetPath) {
  return targetPath
    .split(path.sep)
    .some((segment) => segment.toLowerCase().startsWith('.tmp'))
}

function assertProductionPersistentPath(name) {
  const value = process.env[name] || ''

  if (!path.isAbsolute(value)) {
    throw new Error(`${name} must be an absolute persistent storage path in production`)
  }

  const resolvedPath = path.resolve(value)

  if (isPathInside(backendRoot, resolvedPath)) {
    throw new Error(`${name} must point outside the application release directory in production`)
  }

  if (hasTemporaryPathSegment(resolvedPath)) {
    throw new Error(`${name} must not point to temporary storage in production`)
  }
}

export function assertProductionConfig() {
  if (!isProduction) return

  if (!process.env.JWT_SECRET || UNSAFE_JWT_SECRETS.has(JWT_SECRET) || JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be set to a strong production value')
  }

  if (allowAllCorsOrigins) {
    throw new Error('CORS_ORIGINS cannot include "*" in production')
  }

  if (!process.env.DATABASE_PATH) {
    throw new Error('DATABASE_PATH must point to persistent storage in production')
  }

  if (!process.env.UPLOAD_DIR) {
    throw new Error('UPLOAD_DIR must point to persistent storage in production')
  }

  if (!process.env.BACKUP_DIR) {
    throw new Error('BACKUP_DIR must be configured in production')
  }

  assertProductionPersistentPath('DATABASE_PATH')
  assertProductionPersistentPath('UPLOAD_DIR')
  assertProductionPersistentPath('BACKUP_DIR')

  if (process.env.ADMIN_EMAIL) {
    const adminPassword = process.env.ADMIN_PASSWORD || ''
    if (!adminPassword || adminPassword === SAFE_OWNER_DEFAULT_PASSWORD || adminPassword.length < 12) {
      throw new Error('ADMIN_PASSWORD must be changed before production admin seeding')
    }
  }

  if (PUBLIC_REGISTRATION_ENABLED) {
    throw new Error('PUBLIC_REGISTRATION_ENABLED must be false in production; company users are created by company owners')
  }

  if (PUBLIC_DEMO_ENABLED && String(process.env.PUBLIC_DEMO_PASSWORD || '').trim().length < 12) {
    throw new Error('PUBLIC_DEMO_PASSWORD must contain at least 12 characters when public demo is enabled')
  }

  if (!hasEnvValue('TRUST_PROXY')) {
    throw new Error('TRUST_PROXY must be set explicitly in production')
  }

  assertPositiveInteger(SECURITY_HSTS_MAX_AGE, 'SECURITY_HSTS_MAX_AGE')
  assertPositiveInteger(SENSITIVE_RATE_LIMIT_WINDOW_MS, 'SENSITIVE_RATE_LIMIT_WINDOW_MS')
  assertPositiveInteger(SENSITIVE_RATE_LIMIT_MAX, 'SENSITIVE_RATE_LIMIT_MAX')
  assertPositiveInteger(AUTH_ACCOUNT_RATE_LIMIT_MAX, 'AUTH_ACCOUNT_RATE_LIMIT_MAX')
  assertPositiveInteger(AUTH_COOKIE_MAX_AGE_SECONDS, 'AUTH_COOKIE_MAX_AGE_SECONDS')
  assertPositiveInteger(MAX_IMAGE_PIXELS, 'MAX_IMAGE_PIXELS')
  assertPositiveInteger(GRACEFUL_SHUTDOWN_TIMEOUT_MS, 'GRACEFUL_SHUTDOWN_TIMEOUT_MS')
  assertPositiveInteger(ACCESS_LOG_SLOW_MS, 'ACCESS_LOG_SLOW_MS')

  if (!SECURITY_CSP.trim()) {
    throw new Error('SECURITY_CSP must not be empty')
  }

  if (!SECURITY_CSP.includes("default-src 'none'") || !SECURITY_CSP.includes("frame-ancestors 'none'")) {
    throw new Error("SECURITY_CSP must include default-src 'none' and frame-ancestors 'none'")
  }

  assertOneOf(SECURITY_CROSS_ORIGIN_OPENER_POLICY, ALLOWED_COOP_VALUES, 'SECURITY_CROSS_ORIGIN_OPENER_POLICY')
  assertOneOf(SECURITY_CROSS_ORIGIN_RESOURCE_POLICY, ALLOWED_CORP_VALUES, 'SECURITY_CROSS_ORIGIN_RESOURCE_POLICY')
  assertOneOf(AUTH_COOKIE_SAME_SITE, ALLOWED_COOKIE_SAME_SITE, 'AUTH_COOKIE_SAME_SITE')

  if (AUTH_COOKIE_SAME_SITE === 'None' && !AUTH_COOKIE_SECURE) {
    throw new Error('AUTH_COOKIE_SECURE must be true when AUTH_COOKIE_SAME_SITE=None')
  }

  if (!ALLOWED_ACCESS_LOG_FORMATS.includes(ACCESS_LOG_FORMAT)) {
    throw new Error('ACCESS_LOG_FORMAT must be one of: json, text, off')
  }

  if (!ACCESS_LOG_SKIP_PATHS.every(isValidAccessLogSkipPath)) {
    throw new Error('ACCESS_LOG_SKIP_PATHS must contain comma-separated absolute URL paths')
  }
}

assertProductionConfig()
