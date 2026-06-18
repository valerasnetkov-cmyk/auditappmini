import { spawn, spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import process from 'node:process'
import sharp from 'sharp'
import { seedSmokeTenantOwner } from './smoke-helpers.mjs'

const provider = process.env.OCR_ODOMETER_PROVIDER || 'mock'
const tesseractCmd = process.env.TESSERACT_CMD || 'tesseract'

if (provider !== 'tesseract-cli') {
  console.log(JSON.stringify({
    ok: true,
    skipped: true,
    reason: 'OCR_ODOMETER_PROVIDER is not tesseract-cli',
    provider,
  }, null, 2))
  process.exit(0)
}

const versionCheck = spawnSync(tesseractCmd, ['--version'], {
  encoding: 'utf8',
  timeout: 5000,
  windowsHide: true,
})

if (versionCheck.status !== 0) {
  console.log(JSON.stringify({
    ok: true,
    skipped: true,
    reason: `Tesseract command is unavailable: ${tesseractCmd}`,
    provider,
  }, null, 2))
  process.exit(0)
}

const HOST = '127.0.0.1'
const PORT = Number(process.env.PORT || 6617 + (process.pid % 500))
const DATABASE_PATH = `./.tmp-smoke/smoke-ocr-tesseract-${process.pid}.sqlite`
const UPLOAD_DIR = `./.tmp-smoke/smoke-ocr-tesseract-uploads-${process.pid}`
const JWT_SECRET = crypto.randomBytes(32).toString('hex')
const BASE_URL = `http://${HOST}:${PORT}`

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForServer(timeoutMs = 30000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${BASE_URL}/api/health/live`)
      if (response.ok) return
    } catch {
    }
    await sleep(300)
  }
  throw new Error(`Server did not become ready within ${timeoutMs}ms`)
}

async function request(path, options = {}, expectedStatus = 200) {
  const response = await fetch(`${BASE_URL}${path}`, options)
  const body = response.status === 204 ? null : await response.json().catch(() => null)
  if (response.status !== expectedStatus) {
    throw new Error(`${path} expected ${expectedStatus}, got ${response.status}: ${JSON.stringify(body)}`)
  }
  return body
}

async function createOdometerFixture() {
  const svg = `
    <svg width="900" height="260" viewBox="0 0 900 260" xmlns="http://www.w3.org/2000/svg">
      <rect width="900" height="260" fill="#111111"/>
      <text x="450" y="170" text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif"
        font-size="120" font-weight="700" fill="#ffffff">128450</text>
    </svg>
  `
  return sharp(Buffer.from(svg)).png().toBuffer()
}

async function run() {
  const owner = await seedSmokeTenantOwner({ databasePath: DATABASE_PATH })
  const server = spawn(process.execPath, ['src/server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(PORT),
      DATABASE_PATH,
      UPLOAD_DIR,
      JWT_SECRET,
      OCR_ODOMETER_PROVIDER: 'tesseract-cli',
      TESSERACT_CMD: tesseractCmd,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let stderr = ''
  server.stderr.on('data', (chunk) => {
    stderr += chunk.toString()
  })

  try {
    await waitForServer()

    const login = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: owner.email, password: owner.password }),
    })

    const headers = { Authorization: `Bearer ${login.token}` }
    const body = new FormData()
    body.append('photo', new Blob([await createOdometerFixture()], { type: 'image/png' }), 'odometer.png')

    const recognition = await request('/api/odometer/recognize', {
      method: 'POST',
      headers,
      body,
    })

    if (recognition.provider !== 'tesseract-cli' || recognition.requires_manual_confirmation !== true) {
      throw new Error(`Unexpected Tesseract OCR response: ${JSON.stringify(recognition)}`)
    }

    const usage = await request('/api/company/usage', { headers })
    const ocrUsage = usage.usage?.ocrMonth
    if (!ocrUsage || ocrUsage.current !== 1) {
      throw new Error(`OCR usage was not recorded: ${JSON.stringify(usage.usage)}`)
    }

    console.log(JSON.stringify({
      ok: true,
      provider: recognition.provider,
      normalizedValue: recognition.normalized_value,
      confidence: recognition.confidence,
      candidates: recognition.candidates,
      requiresManualConfirmation: recognition.requires_manual_confirmation,
      ocrUsage: ocrUsage.current,
      tesseractVersion: String(versionCheck.stdout || '').split(/\r?\n/)[0],
    }, null, 2))
  } finally {
    server.kill()
    await sleep(300)
    await fs.rm(DATABASE_PATH, { force: true })
    await fs.rm(UPLOAD_DIR, { recursive: true, force: true })
  }

  if (stderr.trim()) {
    console.error(stderr.trim())
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
