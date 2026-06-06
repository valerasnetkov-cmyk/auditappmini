import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

const TMP_ROOT = path.resolve('.tmp-smoke', `smoke-production-guard-${process.pid}`)
const PERSISTENT_ROOT = path.join(os.tmpdir(), `auditmini-smoke-production-guard-${process.pid}`)
const DATA_DIR = path.join(PERSISTENT_ROOT, 'data')
const UPLOADS_DIR = path.join(PERSISTENT_ROOT, 'uploads')
const BACKUPS_DIR = path.join(PERSISTENT_ROOT, 'backups')
const ENV_PATH = path.join(TMP_ROOT, 'production.env')

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
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

function runNode(args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      env: { ...process.env, ...(options.env || {}) },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.on('close', (code) => {
      resolve({ code, stdout, stderr })
    })
  })
}

function buildProductionEnv({ publicRegistrationEnabled, port = 3001, relativeStorage = false }) {
  return {
    NODE_ENV: 'production',
    PORT: String(port),
    TRUST_PROXY: '1',
    SECURITY_HSTS_ENABLED: 'true',
    SECURITY_HSTS_MAX_AGE: '15552000',
    GRACEFUL_SHUTDOWN_TIMEOUT_MS: '10000',
    REQUEST_ID_HEADER: 'x-request-id',
    ACCESS_LOG_FORMAT: 'json',
    ACCESS_LOG_SLOW_MS: '1000',
    ACCESS_LOG_SKIP_PATHS: '/health,/api/health',
    JWT_SECRET: 'production-smoke-secret-64-characters-long-and-unique',
    ADMIN_EMAIL: 'admin@auditmini.example',
    ADMIN_PASSWORD: 'VeryStrongAdminPassword123!',
    DATABASE_PATH: relativeStorage ? './data/database.sqlite' : path.join(DATA_DIR, 'database.sqlite'),
    UPLOAD_DIR: relativeStorage ? './uploads' : UPLOADS_DIR,
    BACKUP_DIR: relativeStorage ? './backups' : BACKUPS_DIR,
    CORS_ORIGINS: 'https://app.auditmini.example',
    WEB_APP_URL: 'https://app.auditmini.example',
    SENSITIVE_RATE_LIMIT_WINDOW_MS: '900000',
    SENSITIVE_RATE_LIMIT_MAX: '60',
    AUTH_ACCOUNT_RATE_LIMIT_MAX: '20',
    PUBLIC_REGISTRATION_ENABLED: publicRegistrationEnabled ? 'true' : 'false',
  }
}

async function writeProductionEnv({ publicRegistrationEnabled, port = 3001, relativeStorage = false }) {
  await fs.mkdir(TMP_ROOT, { recursive: true })
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.mkdir(UPLOADS_DIR, { recursive: true })
  await fs.mkdir(BACKUPS_DIR, { recursive: true })

  const content = Object
    .entries(buildProductionEnv({ publicRegistrationEnabled, port, relativeStorage }))
    .map(([name, value]) => `${name}=${value}`)
    .concat('')
    .join('\n')

  await fs.writeFile(ENV_PATH, content, 'utf8')
}

async function runDoctor({ publicRegistrationEnabled, expectedCode, relativeStorage = false, expectedOutput = '' }) {
  await writeProductionEnv({ publicRegistrationEnabled, relativeStorage })

  const result = await runNode([
    'scripts/launch-doctor.mjs',
    '--production',
    '--doctor-env-file',
    ENV_PATH,
  ])

  if (result.code !== expectedCode) {
    throw new Error([
      `launch-doctor exit code mismatch for PUBLIC_REGISTRATION_ENABLED=${publicRegistrationEnabled}`,
      `expected: ${expectedCode}`,
      `actual: ${result.code}`,
      `stdout: ${result.stdout}`,
      `stderr: ${result.stderr}`,
    ].join('\n'))
  }

  if (publicRegistrationEnabled && !result.stdout.includes('PUBLIC_REGISTRATION_ENABLED must be false in production')) {
    throw new Error([
      'launch-doctor did not report public registration production error',
      `stdout: ${result.stdout}`,
      `stderr: ${result.stderr}`,
    ].join('\n'))
  }

  if (expectedOutput && !result.stdout.includes(expectedOutput)) {
    throw new Error([
      `launch-doctor did not report expected output: ${expectedOutput}`,
      `stdout: ${result.stdout}`,
      `stderr: ${result.stderr}`,
    ].join('\n'))
  }
}

async function waitForServer(baseUrl, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs
  let lastError

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/health/ready`)
      const body = await response.json().catch(() => null)
      if (response.ok && body?.ready) return
    } catch (error) {
      lastError = error
    }

    await sleep(250)
  }

  throw new Error(`Production server did not become ready: ${lastError?.message || 'timeout'}`)
}

async function runProductionBoot() {
  const port = await getFreePort()
  await writeProductionEnv({ publicRegistrationEnabled: false, port })

  const server = spawn(process.execPath, ['src/server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...buildProductionEnv({ publicRegistrationEnabled: false, port }),
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
    await waitForServer(`http://127.0.0.1:${port}`)

    const health = await fetch(`http://127.0.0.1:${port}/health`)
    if (!health.ok) {
      throw new Error(`Production /health expected 200 but got ${health.status}`)
    }

    if (health.headers.get('content-security-policy') !== "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'") {
      throw new Error('Production server did not expose the expected CSP header')
    }
  } finally {
    server.kill()
    await sleep(300)
  }

  if (server.exitCode && server.exitCode !== 0) {
    throw new Error(`Production server exited unexpectedly with ${server.exitCode}\nstdout: ${stdout}\nstderr: ${stderr}`)
  }
}

async function run() {
  await runDoctor({ publicRegistrationEnabled: false, expectedCode: 0 })
  await runDoctor({ publicRegistrationEnabled: true, expectedCode: 1 })
  await runDoctor({
    publicRegistrationEnabled: false,
    expectedCode: 1,
    relativeStorage: true,
    expectedOutput: 'DATABASE_PATH must be an absolute persistent storage path',
  })
  await runProductionBoot()

  console.log('Production guard smoke passed')
}

run()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await fs.rm(TMP_ROOT, { recursive: true, force: true }).catch(() => {})
    await fs.rm(PERSISTENT_ROOT, { recursive: true, force: true }).catch(() => {})
  })
