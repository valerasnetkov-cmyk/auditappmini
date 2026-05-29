import dotenv from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const backendRoot = path.resolve(__dirname, '..')

const DEFAULT_JWT_SECRET = 'audit-secret-key-2024'
const DEV_JWT_SECRET = 'dev-secret-change-in-production'
const PLACEHOLDER_PATTERNS = [/replace-with/i, /change-me/i, /example\.com/i]
const errors = []
const warnings = []

function parseArgs(argv) {
  const result = {
    envFile: process.env.LAUNCH_ENV_FILE || '',
    mode: process.env.LAUNCH_DOCTOR_MODE || '',
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--production') {
      result.mode = 'production'
      continue
    }

    if (arg === '--env-file' || arg === '--doctor-env-file') {
      result.envFile = argv[index + 1] || ''
      index += 1
      continue
    }

    if (arg.startsWith('--env-file=')) {
      result.envFile = arg.slice('--env-file='.length)
      continue
    }

    if (arg.startsWith('--doctor-env-file=')) {
      result.envFile = arg.slice('--doctor-env-file='.length)
      continue
    }

    if (arg === '--mode') {
      result.mode = argv[index + 1] || ''
      index += 1
      continue
    }

    if (arg.startsWith('--mode=')) {
      result.mode = arg.slice('--mode='.length)
      continue
    }

    warnings.push(`Unknown argument ignored: ${arg}`)
  }

  return result
}

function resolveEnvPath(value) {
  if (!value) return null
  return path.isAbsolute(value) ? value : path.resolve(backendRoot, value)
}

const args = parseArgs(process.argv.slice(2))
const defaultEnvPath = path.join(backendRoot, '.env')
const envExamplePath = path.join(backendRoot, '.env.example')
const explicitEnvPath = resolveEnvPath(args.envFile)
let loadedEnvPath = null

if (explicitEnvPath) {
  if (fs.existsSync(explicitEnvPath)) {
    dotenv.config({ path: explicitEnvPath, quiet: true })
    loadedEnvPath = explicitEnvPath
  } else {
    errors.push(`Env file not found: ${explicitEnvPath}`)
  }
} else if (fs.existsSync(defaultEnvPath)) {
  dotenv.config({ path: defaultEnvPath, quiet: true })
  loadedEnvPath = defaultEnvPath
} else if (fs.existsSync(envExamplePath)) {
  dotenv.config({ path: envExamplePath, quiet: true })
  loadedEnvPath = envExamplePath
}

const allowedModes = new Set(['development', 'test', 'production'])
const doctorMode = args.mode || process.env.NODE_ENV || 'development'
const isProduction = doctorMode === 'production'

if (!allowedModes.has(doctorMode)) {
  warnings.push(`Unknown mode "${doctorMode}"; using non-production checks`)
}

function requireProduction(condition, message) {
  if (condition) return
  if (isProduction) {
    errors.push(message)
  } else {
    warnings.push(`[production] ${message}`)
  }
}

function warn(condition, message) {
  if (!condition) warnings.push(message)
}

function looksPlaceholder(value) {
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value || ''))
}

function readBooleanEnv(name, defaultValue = false) {
  const value = process.env[name]
  if (value == null || value === '') return defaultValue
  return value === 'true'
}

function hasEnvValue(name) {
  return process.env[name] != null && process.env[name] !== ''
}

function readPositiveIntegerEnv(name, defaultValue) {
  if (!hasEnvValue(name)) return defaultValue

  const parsed = Number(process.env[name])
  return Number.isInteger(parsed) && parsed > 0 ? parsed : Number.NaN
}

function readCsvEnv(name) {
  return (process.env[name] || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

function isValidAccessLogSkipPath(pathname) {
  return (
    typeof pathname === 'string' &&
    pathname.startsWith('/') &&
    pathname.length <= 256 &&
    !/\s/.test(pathname) &&
    !pathname.includes('..')
  )
}

const jwtSecret = process.env.JWT_SECRET || ''
requireProduction(Boolean(jwtSecret), 'JWT_SECRET is required')
requireProduction(![DEFAULT_JWT_SECRET, DEV_JWT_SECRET].includes(jwtSecret), 'JWT_SECRET must not use a development value')
requireProduction(!looksPlaceholder(jwtSecret), 'JWT_SECRET must not use a placeholder value')
requireProduction(jwtSecret.length >= 32, 'JWT_SECRET should be at least 32 characters')

const corsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

requireProduction(corsOrigins.length > 0, 'CORS_ORIGINS must be configured')
requireProduction(!corsOrigins.includes('*'), 'CORS_ORIGINS must not include "*"')
requireProduction(!corsOrigins.some(looksPlaceholder), 'CORS_ORIGINS must not use placeholder origins')

if (process.env.ADMIN_EMAIL) {
  const adminPassword = process.env.ADMIN_PASSWORD || ''
  requireProduction(!looksPlaceholder(process.env.ADMIN_EMAIL), 'ADMIN_EMAIL must not use a placeholder value')
  requireProduction(Boolean(adminPassword), 'ADMIN_PASSWORD is required when ADMIN_EMAIL is set')
  requireProduction(adminPassword !== 'admin123', 'ADMIN_PASSWORD must not use the demo value')
  requireProduction(!looksPlaceholder(adminPassword), 'ADMIN_PASSWORD must not use a placeholder value')
  requireProduction(adminPassword.length >= 12, 'ADMIN_PASSWORD should be at least 12 characters')
}

requireProduction(Boolean(process.env.DATABASE_PATH), 'DATABASE_PATH must point to persistent storage')
requireProduction(Boolean(process.env.UPLOAD_DIR), 'UPLOAD_DIR must point to persistent storage')
requireProduction(Boolean(process.env.BACKUP_DIR), 'BACKUP_DIR must be configured')

if (process.env.WEB_APP_URL) {
  requireProduction(!looksPlaceholder(process.env.WEB_APP_URL), 'WEB_APP_URL must not use a placeholder value')
}

const publicRegistrationEnabled = readBooleanEnv('PUBLIC_REGISTRATION_ENABLED', false)
requireProduction(!publicRegistrationEnabled, 'PUBLIC_REGISTRATION_ENABLED must be false in production')
requireProduction(hasEnvValue('TRUST_PROXY'), 'TRUST_PROXY must be set explicitly in production')

const securityHstsEnabled = readBooleanEnv('SECURITY_HSTS_ENABLED', isProduction)
const securityHstsMaxAge = readPositiveIntegerEnv('SECURITY_HSTS_MAX_AGE', 15552000)
const securityCsp = process.env.SECURITY_CSP || "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
const securityCrossOriginOpenerPolicy = process.env.SECURITY_CROSS_ORIGIN_OPENER_POLICY || 'same-origin'
const securityCrossOriginResourcePolicy = process.env.SECURITY_CROSS_ORIGIN_RESOURCE_POLICY || 'same-site'
const authCookieName = process.env.AUTH_COOKIE_NAME || 'audit_session'
const authCookieMaxAgeSeconds = readPositiveIntegerEnv('AUTH_COOKIE_MAX_AGE_SECONDS', 7 * 24 * 60 * 60)
const authCookieSecure = readBooleanEnv('AUTH_COOKIE_SECURE', isProduction)
const authCookieSameSite = process.env.AUTH_COOKIE_SAME_SITE || 'Lax'
const sensitiveRateLimitWindowMs = readPositiveIntegerEnv('SENSITIVE_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000)
const sensitiveRateLimitMax = readPositiveIntegerEnv('SENSITIVE_RATE_LIMIT_MAX', isProduction ? 60 : 500)
const authAccountRateLimitMax = readPositiveIntegerEnv('AUTH_ACCOUNT_RATE_LIMIT_MAX', isProduction ? 20 : 500)
const maxImagePixels = readPositiveIntegerEnv('MAX_IMAGE_PIXELS', 40_000_000)
const gracefulShutdownTimeoutMs = readPositiveIntegerEnv('GRACEFUL_SHUTDOWN_TIMEOUT_MS', 10000)
const requestIdHeader = (process.env.REQUEST_ID_HEADER || 'x-request-id').trim().toLowerCase()
const accessLogFormat = process.env.ACCESS_LOG_FORMAT || (isProduction ? 'json' : 'text')
const accessLogSlowMs = readPositiveIntegerEnv('ACCESS_LOG_SLOW_MS', 1000)
const accessLogSkipPaths = readCsvEnv('ACCESS_LOG_SKIP_PATHS')

requireProduction(Number.isInteger(securityHstsMaxAge), 'SECURITY_HSTS_MAX_AGE must be a positive integer')
requireProduction(Boolean(securityCsp.trim()), 'SECURITY_CSP must not be empty')
requireProduction(securityCsp.includes("default-src 'none'"), 'SECURITY_CSP should deny default sources for API responses')
requireProduction(securityCsp.includes("frame-ancestors 'none'"), 'SECURITY_CSP should deny framing')
requireProduction(['same-origin', 'same-origin-allow-popups', 'unsafe-none'].includes(securityCrossOriginOpenerPolicy), 'SECURITY_CROSS_ORIGIN_OPENER_POLICY has an unsupported value')
requireProduction(['same-origin', 'same-site', 'cross-origin'].includes(securityCrossOriginResourcePolicy), 'SECURITY_CROSS_ORIGIN_RESOURCE_POLICY has an unsupported value')
requireProduction(/^[A-Za-z0-9._~-]+$/.test(authCookieName), 'AUTH_COOKIE_NAME must be a safe cookie name')
requireProduction(Number.isInteger(authCookieMaxAgeSeconds), 'AUTH_COOKIE_MAX_AGE_SECONDS must be a positive integer')
requireProduction(['Strict', 'Lax', 'None'].includes(authCookieSameSite), 'AUTH_COOKIE_SAME_SITE must be Strict, Lax or None')
requireProduction(authCookieSameSite !== 'None' || authCookieSecure, 'AUTH_COOKIE_SECURE must be true when AUTH_COOKIE_SAME_SITE=None')
requireProduction(Number.isInteger(sensitiveRateLimitWindowMs), 'SENSITIVE_RATE_LIMIT_WINDOW_MS must be a positive integer')
requireProduction(Number.isInteger(sensitiveRateLimitMax), 'SENSITIVE_RATE_LIMIT_MAX must be a positive integer')
requireProduction(Number.isInteger(authAccountRateLimitMax), 'AUTH_ACCOUNT_RATE_LIMIT_MAX must be a positive integer')
requireProduction(Number.isInteger(maxImagePixels), 'MAX_IMAGE_PIXELS must be a positive integer')
requireProduction(Number.isInteger(gracefulShutdownTimeoutMs), 'GRACEFUL_SHUTDOWN_TIMEOUT_MS must be a positive integer')
requireProduction(Number.isInteger(accessLogSlowMs), 'ACCESS_LOG_SLOW_MS must be a positive integer')
requireProduction(sensitiveRateLimitMax <= 300, 'SENSITIVE_RATE_LIMIT_MAX should be 300 or lower in production')
requireProduction(authAccountRateLimitMax <= 100, 'AUTH_ACCOUNT_RATE_LIMIT_MAX should be 100 or lower in production')
requireProduction(['json', 'text', 'off'].includes(accessLogFormat), 'ACCESS_LOG_FORMAT must be one of: json, text, off')
requireProduction(/^[a-z0-9!#$%&'*+.^_`|~-]+$/.test(requestIdHeader), 'REQUEST_ID_HEADER must be a valid HTTP header name')
requireProduction(accessLogSkipPaths.every(isValidAccessLogSkipPath), 'ACCESS_LOG_SKIP_PATHS must contain comma-separated absolute URL paths')

const databasePath = process.env.DATABASE_PATH ? path.resolve(backendRoot, process.env.DATABASE_PATH) : null
const uploadsDir = process.env.UPLOAD_DIR ? path.resolve(backendRoot, process.env.UPLOAD_DIR) : null
const backupDir = process.env.BACKUP_DIR ? path.resolve(backendRoot, process.env.BACKUP_DIR) : null

warn(!databasePath || fs.existsSync(path.dirname(databasePath)), `Database directory does not exist yet: ${databasePath ? path.dirname(databasePath) : '(not set)'}`)
warn(!uploadsDir || fs.existsSync(uploadsDir), `Upload directory does not exist yet: ${uploadsDir || '(not set)'}`)
warn(!backupDir || fs.existsSync(backupDir), `Backup directory does not exist yet: ${backupDir || '(not set)'}`)

const result = {
  ok: errors.length === 0,
  mode: doctorMode,
  envFile: loadedEnvPath || explicitEnvPath,
  envFileExists: loadedEnvPath ? fs.existsSync(loadedEnvPath) : false,
  checks: {
    corsOrigins: corsOrigins.length,
    databasePath,
    uploadsDir,
    backupDir,
    adminSeedConfigured: Boolean(process.env.ADMIN_EMAIL),
    publicRegistrationEnabled,
    trustProxy: process.env.TRUST_PROXY || null,
    securityHstsEnabled,
    securityHstsMaxAge,
    securityCsp,
    securityCrossOriginOpenerPolicy,
    securityCrossOriginResourcePolicy,
    authCookieName,
    authCookieMaxAgeSeconds,
    authCookieSecure,
    authCookieSameSite,
    sensitiveRateLimitWindowMs,
    sensitiveRateLimitMax,
    authAccountRateLimitMax,
    maxImagePixels,
    gracefulShutdownTimeoutMs,
    requestIdHeader,
    accessLogFormat,
    accessLogSlowMs,
    accessLogSkipPaths,
    resourceAdminConfigured: true,
  },
  warnings,
  errors,
}

console.log(JSON.stringify(result, null, 2))

if (errors.length > 0) {
  process.exit(1)
}
