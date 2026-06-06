import jwt from 'jsonwebtoken'
import {
  JWT_SECRET,
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_MAX_AGE_SECONDS,
  AUTH_COOKIE_SECURE,
  AUTH_COOKIE_SAME_SITE,
  corsOrigins,
  allowAllCorsOrigins,
} from '../config.js'

function parseCookies(header) {
  const cookies = new Map()
  if (!header) return cookies

  for (const part of String(header).split(';')) {
    const separatorIndex = part.indexOf('=')
    if (separatorIndex === -1) continue

    const name = part.slice(0, separatorIndex).trim()
    const value = part.slice(separatorIndex + 1).trim()
    if (!name) continue

    try {
      cookies.set(name, decodeURIComponent(value))
    } catch {
      cookies.set(name, value)
    }
  }

  return cookies
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`]

  if (options.maxAge != null) parts.push(`Max-Age=${options.maxAge}`)
  if (options.path) parts.push(`Path=${options.path}`)
  if (options.httpOnly) parts.push('HttpOnly')
  if (options.secure) parts.push('Secure')
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`)

  return parts.join('; ')
}

export function setAuthCookie(res, token) {
  res.setHeader('Set-Cookie', serializeCookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: AUTH_COOKIE_SECURE,
    sameSite: AUTH_COOKIE_SAME_SITE,
    maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
    path: '/',
  }))
}

export function clearAuthCookie(res) {
  res.setHeader('Set-Cookie', serializeCookie(AUTH_COOKIE_NAME, '', {
    httpOnly: true,
    secure: AUTH_COOKIE_SECURE,
    sameSite: AUTH_COOKIE_SAME_SITE,
    maxAge: 0,
    path: '/',
  }))
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null
  return authHeader.split(' ')[1]
}

function getCookieToken(req) {
  return parseCookies(req.headers.cookie).get(AUTH_COOKIE_NAME) || null
}

function isUnsafeMethod(method) {
  return !['GET', 'HEAD', 'OPTIONS'].includes(String(method || '').toUpperCase())
}

function isAllowedRequestOrigin(req) {
  const origin = req.get('origin')
  if (!origin) return false
  return allowAllCorsOrigins || corsOrigins.includes(origin)
}

function rejectInvalidCookieOrigin(req, res, { sendError, apiMessages }) {
  if (req.authSource !== 'cookie' || !isUnsafeMethod(req.method)) return false
  if (isAllowedRequestOrigin(req)) return false

  sendError(res, 403, apiMessages.accessDenied)
  return true
}

export function createAuthenticateMiddleware({ getDb, getApiMessages, sendError, isTenantUserEndpoint }) {
  return (req, res, next) => {
    const apiMessages = getApiMessages()
    const db = getDb()
    const bearerToken = getBearerToken(req)
    const cookieToken = bearerToken ? null : getCookieToken(req)
    const token = bearerToken || cookieToken
    req.authSource = bearerToken ? 'bearer' : cookieToken ? 'cookie' : null

    if (!token) {
      return sendError(res, 401, apiMessages.authRequired)
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET)

      if (decoded?.purpose || !decoded?.id) {
        return sendError(res, 401, apiMessages.invalidToken)
      }

      const user = db.prepare(`
        SELECT id, email, name, role, status, company_id
        FROM users
        WHERE id = ?
      `).get(decoded.id)

      if (!user) {
        return sendError(res, 401, apiMessages.invalidToken)
      }

      if (user.status === 'inactive') {
        return sendError(res, 403, apiMessages.userInactive)
      }

      if (decoded.email && decoded.email !== user.email) {
        return sendError(res, 401, apiMessages.invalidToken)
      }

      req.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        company_id: user.company_id || 'default',
      }

      if (req.user.role === 'admin' && isTenantUserEndpoint(req.path)) {
        return sendError(res, 403, apiMessages.accessDenied)
      }

      if (rejectInvalidCookieOrigin(req, res, { sendError, apiMessages })) {
        return
      }

      if (bearerToken && !cookieToken) {
        setAuthCookie(res, token)
      }

      next()
    } catch {
      return sendError(res, 401, apiMessages.invalidToken)
    }
  }
}

export function createRequireRoleMiddleware(allowedRoles, { sendError, getApiMessages }) {
  const allowed = new Set(Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles])

  return (req, res, next) => {
    if (allowed.has(req.user?.role)) {
      next()
      return
    }

    sendError(res, 403, getApiMessages().accessDenied)
  }
}
