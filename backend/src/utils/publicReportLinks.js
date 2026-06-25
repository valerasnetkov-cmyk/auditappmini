const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0'])
const DEFAULT_WEB_APP_URL = 'http://localhost:3002'
export const DEFAULT_PUBLIC_REPORT_TOKEN_TTL_DAYS = 30

function isPrivateHostname(hostname) {
  const normalized = String(hostname || '').toLowerCase()
  if (LOCAL_HOSTNAMES.has(normalized)) return true
  if (normalized.endsWith('.local') || normalized.endsWith('.localhost')) return true
  if (/^10\./.test(normalized)) return true
  if (/^192\.168\./.test(normalized)) return true
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(normalized)) return true
  return false
}

function parsePublicUrl(value, name) {
  try {
    return new URL(value)
  } catch {
    throw new Error(`${name} must be a valid absolute URL`)
  }
}

export function resolvePublicWebAppUrl(env = process.env) {
  const configuredValue = env.WEB_APP_URL || env.WEB_URL || env.PUBLIC_WEB_URL || ''
  const production = env.NODE_ENV === 'production'

  if (production && !configuredValue) {
    throw new Error('WEB_APP_URL must be configured in production for public report QR links')
  }

  const value = configuredValue || DEFAULT_WEB_APP_URL
  const url = parsePublicUrl(value, 'WEB_APP_URL')

  if (production) {
    if (url.protocol !== 'https:') {
      throw new Error('WEB_APP_URL must use HTTPS in production')
    }
    if (isPrivateHostname(url.hostname)) {
      throw new Error('WEB_APP_URL must use a public hostname in production')
    }
  }

  return url.toString().replace(/\/+$/, '')
}

export function getPublicReportUrl(token, env = process.env) {
  return `${resolvePublicWebAppUrl(env)}/reports/public/${token}`
}

export function getPublicReportTokenExpiresAt(now = new Date(), env = process.env) {
  const rawValue = env.PUBLIC_REPORT_TOKEN_TTL_DAYS
  const ttlDays = rawValue === undefined || rawValue === ''
    ? DEFAULT_PUBLIC_REPORT_TOKEN_TTL_DAYS
    : Number(rawValue)

  if (!Number.isInteger(ttlDays) || ttlDays < 0) {
    throw new Error('PUBLIC_REPORT_TOKEN_TTL_DAYS must be a non-negative integer')
  }

  if (ttlDays === 0) return null

  const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000)
  return expiresAt.toISOString()
}
