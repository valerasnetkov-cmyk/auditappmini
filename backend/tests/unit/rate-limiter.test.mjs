// Tests for the in-memory rate limiter and Redis-unavailable fallback.
//
// Redis-path tests would require a live Redis; this file focuses on the
// regression coverage for the local in-memory path (identical semantics
// to the previous Map-based implementation).

import { test, describe, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

// IMPORTANT: REDIS_URL must be unset so createRateLimiter uses in-memory.
delete process.env.REDIS_URL

const { createRateLimiter, __resetRateLimiterForTests } = await import(
  '../../src/services/rateLimiter.js'
)
const { resetRedisForTests } = await import('../../src/services/redisClient.js')

function makeReq({ ip = '1.2.3.4', method = 'POST', path = '/api/auth/login' } = {}) {
  return { ip, method, path, body: {} }
}

function makeRes() {
  const headers = new Map()
  let statusCode = 200
  let body = null
  return {
    setHeader(name, value) {
      headers.set(String(name).toLowerCase(), String(value))
    },
    getHeader(name) {
      return headers.get(String(name).toLowerCase())
    },
    status(code) {
      statusCode = code
      return this
    },
    json(payload) {
      body = payload
      return this
    },
    _state: {
      get status() {
        return statusCode
      },
      get body() {
        return body
      },
      get headers() {
        return headers
      },
    },
  }
}

describe('createRateLimiter (in-memory)', () => {
  beforeEach(() => {
    __resetRateLimiterForTests()
  })

  test('first request within window passes through', () => {
    const limiter = createRateLimiter({
      name: 'test-pass',
      windowMs: 1000,
      max: 3,
      keyGenerator: (req) => req.ip,
    })

    let nextCalled = 0
    limiter(makeReq(), makeRes(), () => {
      nextCalled += 1
    })
    assert.equal(nextCalled, 1)
  })

  test('RateLimit-Limit and RateLimit-Remaining headers are set', () => {
    const limiter = createRateLimiter({
      name: 'test-headers',
      windowMs: 1000,
      max: 5,
      keyGenerator: (req) => req.ip,
    })

    const res = makeRes()
    limiter(makeReq(), res, () => {})
    assert.equal(res.getHeader('RateLimit-Limit'), '5')
    assert.equal(res.getHeader('RateLimit-Remaining'), '4')
    assert.equal(res.getHeader('RateLimit-Reset'), '1')
  })

  test('requests within max pass through and decrement remaining', () => {
    const limiter = createRateLimiter({
      name: 'test-decrement',
      windowMs: 1000,
      max: 3,
      keyGenerator: (req) => req.ip,
    })

    const remainings = []
    for (let i = 0; i < 3; i += 1) {
      const res = makeRes()
      limiter(makeReq(), res, () => {})
      remainings.push(res.getHeader('RateLimit-Remaining'))
    }
    assert.deepEqual(remainings, ['2', '1', '0'])
  })

  test('request exceeding max returns 429 with Retry-After', () => {
    const limiter = createRateLimiter({
      name: 'test-429',
      windowMs: 1000,
      max: 2,
      keyGenerator: (req) => req.ip,
    })

    // consume 2
    limiter(makeReq(), makeRes(), () => {})
    limiter(makeReq(), makeRes(), () => {})

    // 3rd should be 429
    const res = makeRes()
    let nextCalled = 0
    limiter(makeReq(), res, () => {
      nextCalled += 1
    })
    assert.equal(nextCalled, 0)
    assert.equal(res._state.status, 429)
    assert.equal(res.getHeader('Retry-After'), '1')
    assert.equal(res._state.body.error, 'Too many requests. Try again later.')
  })

  test('different IPs are tracked independently', () => {
    const limiter = createRateLimiter({
      name: 'test-ips',
      windowMs: 1000,
      max: 1,
      keyGenerator: (req) => req.ip,
    })

    let aNext = 0
    let bNext = 0
    limiter(makeReq({ ip: '1.1.1.1' }), makeRes(), () => {
      aNext += 1
    })
    limiter(makeReq({ ip: '2.2.2.2' }), makeRes(), () => {
      bNext += 1
    })
    assert.equal(aNext, 1)
    assert.equal(bNext, 1)
  })

  test('window resets after windowMs elapses', async () => {
    const limiter = createRateLimiter({
      name: 'test-reset',
      windowMs: 50,
      max: 1,
      keyGenerator: (req) => req.ip,
    })

    let first = 0
    limiter(makeReq(), makeRes(), () => {
      first += 1
    })

    const blocked = makeRes()
    let second = 0
    limiter(makeReq(), blocked, () => {
      second += 1
    })
    assert.equal(blocked._state.status, 429)
    assert.equal(second, 0)

    await new Promise((resolve) => setTimeout(resolve, 80))

    let third = 0
    limiter(makeReq(), makeRes(), () => {
      third += 1
    })
    assert.equal(first, 1)
    assert.equal(third, 1)
  })

  test('invalid windowMs or max causes middleware to pass through', () => {
    const limiter = createRateLimiter({
      name: 'test-invalid',
      windowMs: 0,
      max: 5,
      keyGenerator: (req) => req.ip,
    })

    let nextCalled = 0
    limiter(makeReq(), makeRes(), () => {
      nextCalled += 1
    })
    assert.equal(nextCalled, 1)
  })

  test('keyGenerator fully customizes the bucket', () => {
    const limiter = createRateLimiter({
      name: 'test-custom',
      windowMs: 1000,
      max: 1,
      keyGenerator: (req) => req.body?.email || 'anon',
    })

    const a = makeReq()
    a.body = { email: 'a@example.com' }
    const b = makeReq()
    b.body = { email: 'b@example.com' }

    let aNext = 0
    let bNext = 0
    limiter(a, makeRes(), () => {
      aNext += 1
    })
    limiter(b, makeRes(), () => {
      bNext += 1
    })
    assert.equal(aNext, 1)
    assert.equal(bNext, 1)
  })
})

describe('createRateLimiter (Redis unavailable fallback)', () => {
  beforeEach(() => {
    process.env.REDIS_URL = 'redis://127.0.0.1:1'
    resetRedisForTests()
    __resetRateLimiterForTests()
  })

  test('fallback limiter keeps counts across requests', () => {
    const limiter = createRateLimiter({
      name: 'test-redis-fallback',
      windowMs: 1000,
      max: 1,
      keyGenerator: (req) => req.ip,
    })

    let firstNext = 0
    limiter(makeReq(), makeRes(), () => {
      firstNext += 1
    })

    const blocked = makeRes()
    let secondNext = 0
    limiter(makeReq(), blocked, () => {
      secondNext += 1
    })

    assert.equal(firstNext, 1)
    assert.equal(secondNext, 0)
    assert.equal(blocked._state.status, 429)
    assert.equal(blocked.getHeader('Retry-After'), '1')
  })
})
