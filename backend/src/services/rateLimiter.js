// Распределённый rate limiter.
//
// Стратегия:
//   1. Если Redis сконфигурирован И доступен → INCR + EXPIRE в Lua-скрипте
//      (атомарно). Лимит один на все реплики backend.
//   2. Если Redis сконфигурирован, но недоступен → in-memory fallback
//      (с warning в логе). Лимит становится per-replica — НЕ идеально,
//      но процесс не падает.
//   3. Если Redis не сконфигурирован → in-memory (как раньше).
//
// Семантика идентична исходной: middleware (req, res, next) с теми же
// response headers (RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset,
// Retry-After) и тем же 429-ответом.

import { getRedisClient, isRedisConfigured } from './redisClient.js'

// KEYS[1] = bucket key (e.g. "rl:sensitive-ip:1.2.3.4:POST:/api/auth/login")
// ARGV[1] = windowMs (number)
// ARGV[2] = max (number)
// Returns: { count, resetAtMs }
const RATE_LIMIT_LUA = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local pttl = redis.call('PTTL', KEYS[1])
return { current, pttl }
`

let rateLimiterLogger = null

export function setRateLimiterLogger(fn) {
  rateLimiterLogger = fn
}

function logWarn(message) {
  if (typeof rateLimiterLogger === 'function') {
    rateLimiterLogger(message)
    return
  }
  console.warn(message)
}

function createInMemoryLimiter({ windowMs, max, keyGenerator }) {
  const hits = new Map()
  let lastSweepAt = 0

  return function inMemoryRateLimit(req, res, next) {
    if (!Number.isInteger(windowMs) || windowMs <= 0 || !Number.isInteger(max) || max <= 0) {
      return next()
    }

    const now = Date.now()
    if (now - lastSweepAt > windowMs) {
      lastSweepAt = now
      for (const [key, bucket] of hits.entries()) {
        if (bucket.resetAt <= now) hits.delete(key)
      }
    }

    const key = keyGenerator(req)
    const existing = hits.get(key)
    const bucket =
      existing && existing.resetAt > now ? existing : { count: 0, resetAt: now + windowMs }
    bucket.count += 1
    hits.set(key, bucket)

    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
    res.setHeader('RateLimit-Limit', String(max))
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - bucket.count)))
    res.setHeader('RateLimit-Reset', String(retryAfterSeconds))

    if (bucket.count > max) {
      res.setHeader('Retry-After', String(retryAfterSeconds))
      return res.status(429).json({ error: 'Too many requests. Try again later.' })
    }
    return next()
  }
}

function createRedisLimiter({ name, windowMs, max, keyGenerator, onRedisUnavailable }) {
  let warnedThisProcess = false
  const fallbackLimiter = createInMemoryLimiter({ windowMs, max, keyGenerator })

  return function redisRateLimit(req, res, next) {
    if (!Number.isInteger(windowMs) || windowMs <= 0 || !Number.isInteger(max) || max <= 0) {
      return next()
    }

    const client = getRedisClient()
    if (!client || client.status !== 'ready') {
      if (!warnedThisProcess) {
        logWarn(
          `[rate-limit:${name}] Redis unavailable, falling back to in-memory limiter ` +
            '(limits become per-replica; fix Redis to restore global limits)',
        )
        warnedThisProcess = true
      }
      if (typeof onRedisUnavailable === 'function') {
        onRedisUnavailable()
      }
      return fallbackLimiter(req, res, next)
    }

    const key = `rl:${name}:${keyGenerator(req)}`

    client
      .eval(RATE_LIMIT_LUA, 1, key, String(windowMs), String(max))
      .then((result) => {
        const count = Number(result?.[0] ?? 0)
        const pttl = Number(result?.[1] ?? windowMs)
        const resetAtMs = Date.now() + Math.max(0, pttl)
        const retryAfterSeconds = Math.max(1, Math.ceil((resetAtMs - Date.now()) / 1000))

        res.setHeader('RateLimit-Limit', String(max))
        res.setHeader('RateLimit-Remaining', String(Math.max(0, max - count)))
        res.setHeader('RateLimit-Reset', String(retryAfterSeconds))

        if (count > max) {
          res.setHeader('Retry-After', String(retryAfterSeconds))
          return res.status(429).json({ error: 'Too many requests. Try again later.' })
        }
        return next()
      })
      .catch((err) => {
        logWarn(`[rate-limit:${name}] Redis eval failed (${err.message}); falling back`)
        return fallbackLimiter(req, res, next)
      })
  }
}

export function createRateLimiter(options) {
  if (isRedisConfigured()) {
    return createRedisLimiter(options)
  }
  return createInMemoryLimiter(options)
}

export function __resetRateLimiterForTests() {
  rateLimiterLogger = null
}
