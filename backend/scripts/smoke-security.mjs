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

async function postLogin(expectedStatus) {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@example.com',
      password: 'wrong-password',
    }),
  })
  const body = await response.json().catch(() => ({}))

  if (response.status !== expectedStatus) {
    throw new Error(`/api/auth/login expected ${expectedStatus} but got ${response.status}: ${JSON.stringify(body)}`)
  }

  return { response, body }
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
      SENSITIVE_RATE_LIMIT_MAX: '2',
      AUTH_ACCOUNT_RATE_LIMIT_MAX: '2',
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

    await postLogin(401)
    const secondAttempt = await postLogin(401)
    const limitedAttempt = await postLogin(429)

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
