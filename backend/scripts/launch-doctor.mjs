import dotenv from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const backendRoot = path.resolve(__dirname, '..')

const envPath = path.join(backendRoot, '.env')
const envExamplePath = path.join(backendRoot, '.env.example')

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true })
} else if (fs.existsSync(envExamplePath)) {
  dotenv.config({ path: envExamplePath, quiet: true })
}

const DEFAULT_JWT_SECRET = 'audit-secret-key-2024'
const DEV_JWT_SECRET = 'dev-secret-change-in-production'
const isProduction = process.env.NODE_ENV === 'production'
const errors = []
const warnings = []

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

const jwtSecret = process.env.JWT_SECRET || ''
requireProduction(Boolean(jwtSecret), 'JWT_SECRET is required')
requireProduction(![DEFAULT_JWT_SECRET, DEV_JWT_SECRET].includes(jwtSecret), 'JWT_SECRET must not use a development value')
requireProduction(jwtSecret.length >= 32, 'JWT_SECRET should be at least 32 characters')

const corsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

requireProduction(corsOrigins.length > 0, 'CORS_ORIGINS must be configured')
requireProduction(!corsOrigins.includes('*'), 'CORS_ORIGINS must not include "*"')

if (process.env.ADMIN_EMAIL) {
  const adminPassword = process.env.ADMIN_PASSWORD || ''
  requireProduction(Boolean(adminPassword), 'ADMIN_PASSWORD is required when ADMIN_EMAIL is set')
  requireProduction(adminPassword !== 'admin123', 'ADMIN_PASSWORD must not use the demo value')
  requireProduction(adminPassword.length >= 12, 'ADMIN_PASSWORD should be at least 12 characters')
}

requireProduction(Boolean(process.env.DATABASE_PATH), 'DATABASE_PATH must point to persistent storage')
requireProduction(Boolean(process.env.UPLOAD_DIR), 'UPLOAD_DIR must point to persistent storage')
requireProduction(Boolean(process.env.BACKUP_DIR), 'BACKUP_DIR must be configured')

if (process.env.DIRECTUS_TOKEN) {
  requireProduction(!process.env.DIRECTUS_TOKEN.includes('change-me'), 'DIRECTUS_TOKEN must not use a placeholder value')
}

const databasePath = process.env.DATABASE_PATH ? path.resolve(backendRoot, process.env.DATABASE_PATH) : null
const uploadsDir = process.env.UPLOAD_DIR ? path.resolve(backendRoot, process.env.UPLOAD_DIR) : null
const backupDir = process.env.BACKUP_DIR ? path.resolve(backendRoot, process.env.BACKUP_DIR) : null

warn(!databasePath || fs.existsSync(path.dirname(databasePath)), `Database directory does not exist yet: ${databasePath ? path.dirname(databasePath) : '(not set)'}`)
warn(!uploadsDir || fs.existsSync(uploadsDir), `Upload directory does not exist yet: ${uploadsDir || '(not set)'}`)
warn(!backupDir || fs.existsSync(backupDir), `Backup directory does not exist yet: ${backupDir || '(not set)'}`)

const result = {
  ok: errors.length === 0,
  mode: process.env.NODE_ENV || 'development',
  envFile: fs.existsSync(envPath) ? envPath : fs.existsSync(envExamplePath) ? envExamplePath : null,
  checks: {
    corsOrigins: corsOrigins.length,
    databasePath,
    uploadsDir,
    backupDir,
    adminSeedConfigured: Boolean(process.env.ADMIN_EMAIL),
    directusConfigured: Boolean(process.env.DIRECTUS_TOKEN && process.env.DIRECTUS_URL),
  },
  warnings,
  errors,
}

console.log(JSON.stringify(result, null, 2))

if (errors.length > 0) {
  process.exit(1)
}
