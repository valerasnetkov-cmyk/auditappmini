export function hasEnvValue(name) {
  return process.env[name] != null && process.env[name] !== ''
}

export function parsePositiveIntegerEnv(name, fallback) {
  if (!hasEnvValue(name)) return fallback

  const parsed = Number(process.env[name])
  return Number.isInteger(parsed) && parsed > 0 ? parsed : Number.NaN
}

export function parseTrustProxy(value) {
  if (!value) return false

  const normalized = String(value).trim().toLowerCase()
  if (normalized === 'true') return true
  if (normalized === 'false') return false
  if (/^\d+$/.test(normalized)) return Number(normalized)

  return value
}

const HEADER_NAME_PATTERN = /^[a-z0-9!#$%&'*+.^_`|~-]+$/
const DEFAULT_REQUEST_ID_HEADER = 'x-request-id'

export function normalizeHeaderName(value) {
  const headerName = String(value || '').trim().toLowerCase()
  if (HEADER_NAME_PATTERN.test(headerName)) {
    return headerName
  }

  return DEFAULT_REQUEST_ID_HEADER
}

export function parseAccessLogSkipPaths(value) {
  const paths = String(value || '')
    .split(',')
    .map(pathname => pathname.trim())
    .filter(Boolean)
    .map(pathname => pathname.replace(/\/+$/, '') || '/')

  return Array.from(new Set(paths))
}

export function isValidAccessLogSkipPath(pathname) {
  return (
    typeof pathname === 'string' &&
    pathname.startsWith('/') &&
    pathname.length <= 256 &&
    !/\s/.test(pathname) &&
    !pathname.includes('..')
  )
}
