import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const mobileRoot = path.resolve(__dirname, '..')
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
  return path.isAbsolute(value) ? value : path.resolve(mobileRoot, value)
}

function parseEnvFile(filePath) {
  if (!filePath) return {}

  const values = {}
  const content = fs.readFileSync(filePath, 'utf8')

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const separatorIndex = line.indexOf('=')
    if (separatorIndex === -1) continue

    const key = line.slice(0, separatorIndex).trim()
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '')
    values[key] = value
  }

  return values
}

const args = parseArgs(process.argv.slice(2))
const candidateEnvFiles = ['.env.production', '.env.local', '.env', '.env.example']
const explicitEnvFile = resolveEnvPath(args.envFile)
let envFile = null

if (explicitEnvFile) {
  if (fs.existsSync(explicitEnvFile)) {
    envFile = explicitEnvFile
  } else {
    errors.push(`Env file not found: ${explicitEnvFile}`)
  }
} else {
  envFile = candidateEnvFiles
    .map((name) => path.join(mobileRoot, name))
    .find((filePath) => fs.existsSync(filePath))
}

const fileEnv = parseEnvFile(envFile)
const apiUrl = process.env.EXPO_PUBLIC_API_URL || fileEnv.EXPO_PUBLIC_API_URL || ''
const doctorMode = args.mode || process.env.NODE_ENV || fileEnv.NODE_ENV || 'development'
const isProduction = doctorMode === 'production'
const allowedModes = new Set(['development', 'test', 'production'])

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

function looksPlaceholder(value) {
  return /example\.com|replace-with|change-me/i.test(value || '')
}

function pointsToLocalNetwork(value) {
  return /localhost|127\.0\.0\.1|10\.0\.2\.2|10\.0\.3\.2|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|10\./.test(value || '')
}

requireProduction(Boolean(apiUrl), 'EXPO_PUBLIC_API_URL must be configured')
requireProduction(/^https?:\/\//.test(apiUrl), 'EXPO_PUBLIC_API_URL must be an absolute URL')
requireProduction(!pointsToLocalNetwork(apiUrl), 'EXPO_PUBLIC_API_URL must not point to localhost, emulator host, or private LAN in production')
requireProduction(!looksPlaceholder(apiUrl), 'EXPO_PUBLIC_API_URL must not use a placeholder URL')
requireProduction(!apiUrl || apiUrl.startsWith('https://'), 'EXPO_PUBLIC_API_URL should use HTTPS in production')

if (apiUrl && !apiUrl.endsWith('/api')) {
  warnings.push('EXPO_PUBLIC_API_URL is expected to end with /api for the current mobile client')
}

const result = {
  ok: errors.length === 0,
  mode: doctorMode,
  envFile: envFile || explicitEnvFile,
  envFileExists: envFile ? fs.existsSync(envFile) : false,
  checks: {
    apiUrl,
    apiUrlConfigured: Boolean(apiUrl),
    apiUrlLooksAbsolute: /^https?:\/\//.test(apiUrl),
  },
  warnings,
  errors,
}

console.log(JSON.stringify(result, null, 2))

if (errors.length > 0) {
  process.exit(1)
}
