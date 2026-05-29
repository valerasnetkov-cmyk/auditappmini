import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import http from 'node:http'
import process from 'node:process'

const HOST = '127.0.0.1'
let PORT = Number(process.env.PORT || 0)
const DATABASE_PATH = `./.tmp-smoke/smoke-security-${process.pid}.sqlite`
const UPLOAD_DIR = `./.tmp-smoke/uploads-security-${process.pid}`
let BASE_URL = ''

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer()
    server.once('error', reject)
    server.listen(0, HOST, () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : null
      server.close(() => {
        if (!port) {
          reject(new Error('Could not allocate a free port'))
          return
        }

        resolve(port)
      })
    })
  })
}

async function waitForServer(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs
  let lastError

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/api/health/ready`)
      const body = await response.json().catch(() => null)
      if (response.ok && body?.ready) return
    } catch (error) {
      lastError = error
    }

    await sleep(250)
  }

  throw new Error(`Server did not become ready: ${lastError?.message || 'timeout'}`)
}

async function postLogin(expectedStatus, email = 'admin@example.com') {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: 'wrong-password',
    }),
  })
  const body = await response.json().catch(() => ({}))

  if (response.status !== expectedStatus) {
    throw new Error(`/api/auth/login expected ${expectedStatus} but got ${response.status}: ${JSON.stringify(body)}`)
  }

  return { response, body }
}

async function postValidLogin() {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@example.com',
      password: 'VeryStrongAdminPassword123!',
    }),
  })
  const body = await response.json().catch(() => ({}))

  if (!response.ok || !body?.token) {
    throw new Error(`/api/auth/login expected token but got ${response.status}: ${JSON.stringify(body)}`)
  }

  const cookie = response.headers.get('set-cookie')
  if (!cookie || !cookie.includes('audit_session=') || !cookie.includes('HttpOnly') || !cookie.includes('SameSite=Lax')) {
    throw new Error(`Login must set an httpOnly auth cookie, got: ${cookie}`)
  }

  return { response, body, cookie: cookie.split(';')[0] }
}

async function assertPublicRegistrationDisabled() {
  const response = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `smoke-${process.pid}@example.com`,
      password: 'Strong-password-123',
      name: 'Smoke User',
    }),
  })
  const body = await response.json().catch(() => ({}))

  if (response.status !== 403) {
    throw new Error(`/api/auth/register expected 403 by default but got ${response.status}: ${JSON.stringify(body)}`)
  }
}

async function run() {
  if (!PORT) {
    PORT = await getFreePort()
  }

  BASE_URL = `http://${HOST}:${PORT}`

  const server = spawn(process.execPath, ['src/server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(PORT),
      DATABASE_PATH,
      UPLOAD_DIR,
      TRUST_PROXY: 'false',
      SECURITY_HSTS_ENABLED: 'true',
      SECURITY_HSTS_MAX_AGE: '60',
      SENSITIVE_RATE_LIMIT_WINDOW_MS: '60000',
      SENSITIVE_RATE_LIMIT_MAX: '4',
      AUTH_ACCOUNT_RATE_LIMIT_MAX: '2',
      ADMIN_EMAIL: 'admin@example.com',
      ADMIN_PASSWORD: 'VeryStrongAdminPassword123!',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let stderr = ''
  server.stderr.on('data', (chunk) => {
    stderr += chunk.toString()
  })

  try {
    await waitForServer()

    const health = await fetch(`${BASE_URL}/health`)
    const expectedHeaders = {
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'referrer-policy': 'no-referrer',
      'content-security-policy': "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      'cross-origin-opener-policy': 'same-origin',
      'cross-origin-resource-policy': 'same-site',
      'strict-transport-security': 'max-age=60; includeSubDomains',
    }

    for (const [header, expectedValue] of Object.entries(expectedHeaders)) {
      const actualValue = health.headers.get(header)
      if (actualValue !== expectedValue) {
        throw new Error(`${header} expected "${expectedValue}" but got "${actualValue}"`)
      }
    }

    if (health.headers.get('x-powered-by')) {
      throw new Error('X-Powered-By header must be disabled')
    }

    await assertPublicRegistrationDisabled()
    const validLogin = await postValidLogin()

    const cookieMe = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: validLogin.cookie },
    })
    const cookieMeBody = await cookieMe.json().catch(() => ({}))
    if (!cookieMe.ok || cookieMeBody?.email !== 'admin@example.com') {
      throw new Error(`Cookie auth /api/auth/me failed: ${cookieMe.status} ${JSON.stringify(cookieMeBody)}`)
    }

    const bearerMe = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${validLogin.body.token}` },
    })
    const bearerCookie = bearerMe.headers.get('set-cookie')
    if (!bearerMe.ok || !bearerCookie?.includes('audit_session=')) {
      throw new Error(`Bearer auth should refresh httpOnly cookie, got ${bearerMe.status} ${bearerCookie}`)
    }

    const missingUserAttempt = await postLogin(401, 'missing-admin@example.com')
    const secondAttempt = await postLogin(401)
    const limitedAttempt = await postLogin(429)

    if (missingUserAttempt.body?.error !== secondAttempt.body?.error) {
      throw new Error(`Login errors must not reveal whether an email exists: ${JSON.stringify({
        missing: missingUserAttempt.body,
        existing: secondAttempt.body,
      })}`)
    }

    if (secondAttempt.response.headers.get('cache-control') !== 'no-store') {
      throw new Error('Sensitive auth responses must use Cache-Control: no-store')
    }

    if (!limitedAttempt.response.headers.get('retry-after')) {
      throw new Error('Rate limited response must include Retry-After')
    }

    if (!String(limitedAttempt.body?.error || '').includes('Too many requests')) {
      throw new Error(`Unexpected rate limit error body: ${JSON.stringify(limitedAttempt.body)}`)
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          securityHeaders: true,
          poweredByDisabled: true,
          authNoStore: true,
          publicRegistrationDisabled: true,
          httpOnlyCookieSession: true,
          bearerRefreshesCookieSession: true,
          loginEnumerationProtected: true,
          authRateLimited: true,
        },
        null,
        2,
      ),
    )
  } finally {
    server.kill()
    await sleep(300)
    await fs.rm(DATABASE_PATH, { force: true })
    await fs.rm(UPLOAD_DIR, { recursive: true, force: true })

    if (stderr.trim()) {
      console.error(stderr.trim())
    }
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
