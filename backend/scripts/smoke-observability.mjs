import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import http from 'node:http'
import crypto from 'node:crypto'
import process from 'node:process'
import { sendAlert } from '../src/services/alertService.js'

const HOST = '127.0.0.1'
let PORT = Number(process.env.PORT || 0)
const DATABASE_PATH = `./.tmp-smoke/smoke-observability-${process.pid}.sqlite`
const UPLOAD_DIR = `./.tmp-smoke/uploads-observability-${process.pid}`
const SKIPPED_REQUEST_ID = `smoke-observability-skip-${process.pid}`
const LOGGED_REQUEST_ID = `smoke-observability-log-${process.pid}`
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

function parseAccessLogs(stdout) {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line)
      } catch {
        return null
      }
    })
    .filter((entry) => entry?.type === 'access')
}

async function run() {
  const alertDryRun = await sendAlert({
    severity: 'medium',
    source: 'smoke-observability',
    message: 'Observability dry-run alert',
    context: {
      requestId: LOGGED_REQUEST_ID,
      password: 'must-not-leak',
    },
  }, {
    env: {
      ...process.env,
      TELEGRAM_ALERTS_DRY_RUN: 'true',
      TELEGRAM_ALERTS_ENABLED: 'false',
    },
  })

  if (!alertDryRun.ok || !alertDryRun.dryRun || alertDryRun.delivered) {
    throw new Error(`Alert dry-run failed: ${JSON.stringify(alertDryRun)}`)
  }

  if (JSON.stringify(alertDryRun).includes('must-not-leak')) {
    throw new Error('Alert dry-run leaked sensitive context')
  }

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
      REQUEST_ID_HEADER: 'x-request-id',
      ACCESS_LOG_FORMAT: 'json',
      ACCESS_LOG_SLOW_MS: '1',
      ACCESS_LOG_SKIP_PATHS: '/health',
      JWT_SECRET: crypto.randomBytes(32).toString('hex'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let stdout = ''
  let stderr = ''

  server.stdout.on('data', (chunk) => {
    stdout += chunk.toString()
  })

  server.stderr.on('data', (chunk) => {
    stderr += chunk.toString()
  })

  try {
    await waitForServer()

    const response = await fetch(`${BASE_URL}/health`, {
      headers: {
        'x-request-id': SKIPPED_REQUEST_ID,
        'user-agent': 'auditmini-smoke-observability',
      },
    })
    const body = await response.json()

    if (!response.ok || body.status !== 'ok') {
      throw new Error(`/health did not return ok: ${response.status} ${JSON.stringify(body)}`)
    }

    if (response.headers.get('x-request-id') !== SKIPPED_REQUEST_ID) {
      throw new Error('Response did not echo x-request-id')
    }

    const readinessResponse = await fetch(`${BASE_URL}/api/health/ready`, {
      headers: {
        'x-request-id': `smoke-observability-ready-${process.pid}`,
        'user-agent': 'auditmini-smoke-observability',
      },
    })
    const readiness = await readinessResponse.json()

    if (!readinessResponse.ok || readiness.status !== 'ok' || readiness.ready !== true) {
      throw new Error(`/api/health/ready has unexpected shape: ${JSON.stringify(readiness)}`)
    }

    if (!readiness.checks || readiness.checks.database !== true || readiness.checks.uploads !== true) {
      throw new Error(`/api/health/ready checks are incomplete: ${JSON.stringify(readiness)}`)
    }

    const loggedResponse = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: {
        'x-request-id': LOGGED_REQUEST_ID,
        'user-agent': 'auditmini-smoke-observability',
      },
    })

    if (loggedResponse.status !== 401) {
      throw new Error(`/api/auth/me should return 401 without token, got ${loggedResponse.status}`)
    }

    if (loggedResponse.headers.get('x-request-id') !== LOGGED_REQUEST_ID) {
      throw new Error('Logged response did not echo x-request-id')
    }

    await sleep(300)

    const accessLogs = parseAccessLogs(stdout)
    const skippedLog = accessLogs.find((entry) => entry.requestId === SKIPPED_REQUEST_ID)
    const targetLog = accessLogs.find((entry) => entry.requestId === LOGGED_REQUEST_ID && entry.path === '/api/auth/me')

    if (skippedLog) {
      throw new Error(`ACCESS_LOG_SKIP_PATHS did not suppress /health log: ${JSON.stringify(skippedLog)}`)
    }

    if (!targetLog) {
      throw new Error(`Structured access log with request id was not found. stdout=${stdout}; stderr=${stderr}`)
    }

    if (
      targetLog.method !== 'GET' ||
      targetLog.statusCode !== 401 ||
      typeof targetLog.durationMs !== 'number' ||
      targetLog.ip !== HOST
    ) {
      throw new Error(`Structured access log has unexpected shape: ${JSON.stringify(targetLog)}`)
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          requestIdEchoed: true,
          readinessShape: true,
          structuredAccessLog: true,
          skipPathsRespected: true,
          alertDryRun: true,
          requestId: targetLog.requestId,
          path: targetLog.path,
          statusCode: targetLog.statusCode,
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
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
