import { createRateLimiter } from '../services/rateLimiter.js'

function normalizeRateLimitPath(pathname) {
  return String(pathname || '')
    .replace(/^\/api\/users\/[^/]+\/mfa\/enable$/, '/api/users/:id/mfa/enable')
    .replace(/^\/api\/users\/[^/]+\/mfa\/verify$/, '/api/users/:id/mfa/verify')
    .replace(/^\/api\/users\/[^/]+\/mfa\/disable$/, '/api/users/:id/mfa/disable')
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

export function noStore(req, res, next) {
  res.setHeader('Cache-Control', 'no-store')
  next()
}

export function createAuthRateLimitMiddlewares({
  sensitiveWindowMs,
  sensitiveIpMax,
  sensitiveAccountMax,
}) {
  const sensitiveIpRateLimit = createRateLimiter({
    name: 'sensitive-ip',
    windowMs: sensitiveWindowMs,
    max: sensitiveIpMax,
    keyGenerator: sensitiveIpRateLimitKey,
  })

  const sensitiveAccountRateLimit = createRateLimiter({
    name: 'sensitive-account',
    windowMs: sensitiveWindowMs,
    max: sensitiveAccountMax,
    keyGenerator: sensitiveAccountRateLimitKey,
  })

  return {
    publicAuthRateLimit: [noStore, sensitiveIpRateLimit, sensitiveAccountRateLimit],
    authenticatedSensitiveRateLimit: [noStore, sensitiveIpRateLimit],
  }
}
