// Integration tests that require a running backend.
// Run via: `npm --prefix backend run test:integration`
// Skip via: `SKIP_INTEGRATION_TESTS=1 npm --prefix backend run test`

import { test, before } from 'node:test'
import assert from 'node:assert/strict'

const SKIP = process.env.SKIP_INTEGRATION_TESTS === '1'
const BASE_URL = process.env.TEST_API_URL || 'http://127.0.0.1:3001'

let serverAvailable = !SKIP

async function ping() {
  try {
    const res = await fetch(`${BASE_URL}/api/health/live`)
    return res.ok
  } catch {
    return false
  }
}

before(async () => {
  if (SKIP) return
  serverAvailable = await ping()
  if (!serverAvailable) {
    console.warn(`[integration] backend not reachable at ${BASE_URL}; tests will be skipped`)
  }
})

async function loginAs(email, password) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    throw new Error(`login failed: ${res.status}`)
  }
  const data = await res.json()
  return data?.token || data?.sessionToken || null
}

test('resolve-number: requires authentication', { skip: !serverAvailable }, async (t) => {
  if (!serverAvailable) {
    t.skip('backend unavailable')
    return
  }

  const res = await fetch(`${BASE_URL}/api/vehicles/resolve-number`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ number: 'A012XM63' }),
  })
  // 401 (no token) or 403 (forbidden) are both acceptable
  assert.ok(res.status === 401 || res.status === 403, `expected 401/403, got ${res.status}`)
})

test('resolve-number: authenticated owner can resolve', { skip: !serverAvailable }, async (t) => {
  if (!serverAvailable) {
    t.skip('backend unavailable')
    return
  }

  const token = await loginAs('owner@example.com', 'owner123')
  if (!token) {
    console.warn('[integration] no owner credentials; skipping')
    return
  }
  const res = await fetch(`${BASE_URL}/api/vehicles/resolve-number`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ number: 'A012XM63' }),
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(typeof body, 'object')
})

test('health/ready: returns 200 when backend is healthy', { skip: !serverAvailable }, async (t) => {
  if (!serverAvailable) {
    t.skip('backend unavailable')
    return
  }

  const res = await fetch(`${BASE_URL}/api/health/ready`)
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.status, 'ok')
  assert.equal(body.ready, true)
})
