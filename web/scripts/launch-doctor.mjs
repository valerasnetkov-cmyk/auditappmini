import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const webRoot = path.resolve(__dirname, '..')
const candidateEnvFiles = ['.env.production', '.env.local', '.env', '.env.example']
const envFile = candidateEnvFiles
  .map((name) => path.join(webRoot, name))
  .find((filePath) => fs.existsSync(filePath))

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

const fileEnv = parseEnvFile(envFile)
const apiUrl = process.env.NEXT_PUBLIC_API_URL || fileEnv.NEXT_PUBLIC_API_URL || ''
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

requireProduction(Boolean(apiUrl), 'NEXT_PUBLIC_API_URL must be configured')
requireProduction(/^https?:\/\//.test(apiUrl), 'NEXT_PUBLIC_API_URL must be an absolute URL')
requireProduction(!apiUrl.includes('localhost') && !apiUrl.includes('127.0.0.1'), 'NEXT_PUBLIC_API_URL must not point to localhost')

if (apiUrl && !apiUrl.endsWith('/api')) {
  warnings.push('NEXT_PUBLIC_API_URL is expected to end with /api for the current backend client')
}

const result = {
  ok: errors.length === 0,
  mode: process.env.NODE_ENV || 'development',
  envFile: envFile || null,
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
