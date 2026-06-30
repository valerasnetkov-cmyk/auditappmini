import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { spawn } from 'node:child_process'
import crypto from 'node:crypto'
import http from 'node:http'

const HOST = '127.0.0.1'
let PORT = Number(process.env.SMOKE_HEALTH_PORT || 0)
const DATABASE_PATH = `./.tmp-smoke/smoke-health-${process.pid}.sqlite`
const UPLOAD_DIR = `./.tmp-smoke/uploads-health-${process.pid}`
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

async function waitForServer() {
  const deadline = Date.now() + 15000
  let lastError

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/api/health/ready`)
      if (response.status === 200 || response.status === 503) {
        return
      }
    } catch (error) {
      lastError = error
    }

    await sleep(250)
  }

  throw new Error(`Server did not start in time: ${lastError?.message || 'timeout'}`)
}

async function requestJson(pathname, expectedStatus = 200) {
  const response = await fetch(`${BASE_URL}${pathname}`)
  const body = await response.json()

  if (response.status !== expectedStatus) {
    throw new Error(`${pathname} returned ${response.status}: ${JSON.stringify(body)}`)
  }

  return body
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
    JWT_SECRET: crypto.randomBytes(32).toString('hex'),
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})

server.stdout.on('data', (chunk) => process.stdout.write(`[backend] ${chunk}`))
server.stderr.on('data', (chunk) => process.stderr.write(`[backend] ${chunk}`))

try {
  await waitForServer()

  const rootHealth = await requestJson('/health')
  const apiHealth = await requestJson('/api/health')
  const liveHealth = await requestJson('/api/health/live')
  const readyHealth = await requestJson('/api/health/ready')

  if (rootHealth.status !== 'ok' || apiHealth.status !== 'ok' || liveHealth.status !== 'ok') {
    throw new Error('Liveness endpoints should return ok')
  }

  if (!readyHealth.ready || readyHealth.checks?.database !== true || readyHealth.checks?.uploads !== true) {
    throw new Error(`Readiness check failed: ${JSON.stringify(readyHealth)}`)
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        liveness: rootHealth.status,
        apiLiveness: apiHealth.status,
        ready: readyHealth.ready,
        checks: readyHealth.checks,
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
  await fs.rmdir(path.dirname(DATABASE_PATH)).catch(() => {})
}
