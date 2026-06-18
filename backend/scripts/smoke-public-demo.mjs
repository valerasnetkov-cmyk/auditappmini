import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import process from 'node:process'

const HOST = '127.0.0.1'
const PORT = Number(process.env.PORT || 6217 + (process.pid % 500))
const DATABASE_PATH = `./.tmp-smoke/smoke-public-demo-${process.pid}.sqlite`
const UPLOAD_DIR = `./.tmp-smoke/smoke-public-demo-uploads-${process.pid}`
const JWT_SECRET = crypto.randomBytes(32).toString('hex')
const PUBLIC_DEMO_PASSWORD = 'demo-smoke-password-2026'
const BASE_URL = `http://${HOST}:${PORT}`

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForServer(timeoutMs = 60000) {
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

async function seedPrivateTenant() {
  process.env.DATABASE_PATH = DATABASE_PATH
  const { initDatabase, getDb, closeDatabase } = await import('../src/db.js')
  await initDatabase()
  try {
    const db = getDb()
    db.prepare(`
      INSERT INTO companies (id, slug, name, status)
      VALUES ('private-company', 'private-company', 'Private Company', 'active')
    `).run()
    db.prepare(`
      INSERT INTO vehicles (id, number, name, status, company_id)
      VALUES ('private-vehicle', 'А999АА77', 'Private Vehicle', 'active', 'private-company')
    `).run()
  } finally {
    closeDatabase()
  }
}

async function run() {
  await seedPrivateTenant()

  const server = spawn(process.execPath, ['src/server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(PORT),
      DATABASE_PATH,
      UPLOAD_DIR,
      JWT_SECRET,
      PUBLIC_DEMO_ENABLED: 'true',
      PUBLIC_DEMO_PASSWORD,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let stderr = ''
  server.stderr.on('data', (chunk) => {
    stderr += chunk.toString()
  })

  try {
    await waitForServer()

    const login = await request('/api/auth/demo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const headers = {
      Authorization: `Bearer ${login.token}`,
      'Content-Type': 'application/json',
    }
    const readHeaders = { Authorization: `Bearer ${login.token}` }

    if (login.user?.company_id !== 'demo' || login.user?.access_mode !== 'demo_readonly') {
      throw new Error(`Unexpected demo identity: ${JSON.stringify(login.user)}`)
    }

    const vehicles = await request('/api/vehicles?limit=100', { headers: readHeaders })
    if (vehicles.data.length !== 12 || vehicles.data.some((vehicle) => vehicle.id === 'private-vehicle')) {
      throw new Error(`Demo tenant isolation failed: ${JSON.stringify(vehicles)}`)
    }

    const inspections = await request('/api/inspections?limit=100', { headers: readHeaders })
    if (inspections.data.length !== 36) {
      throw new Error(`Expected 36 demo inspections, got ${inspections.data.length}`)
    }

    const blockedCreate = await request('/api/vehicles', {
      method: 'POST',
      headers,
      body: JSON.stringify({ number: 'А101ВС65', name: 'Blocked Demo Vehicle', status: 'active' }),
    }, 403)
    if (blockedCreate.error !== 'demo_read_only') {
      throw new Error(`Unexpected demo write error: ${JSON.stringify(blockedCreate)}`)
    }

    await request('/api/seed', {
      method: 'POST',
      headers,
      body: JSON.stringify({ vehicles: 1, inspections: 1 }),
    }, 403)

    await request('/api/users/demo-manager/mfa/setup', {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    }, 403)

    await request('/api/admin/resource/stats', { headers: readHeaders }, 403)

    const resolved = await request('/api/vehicles/resolve-number', {
      method: 'POST',
      headers,
      body: JSON.stringify({ number: 'А123ВС65' }),
    })
    if (!resolved.found || resolved.data?.company_id !== 'demo') {
      throw new Error(`Demo number resolution failed: ${JSON.stringify(resolved)}`)
    }

    const inspection = await request('/api/inspections/demo-inspection-01', { headers: readHeaders })
    const photoUrl = inspection.photos?.[0]?.url
    if (!photoUrl) {
      throw new Error('Demo inspection photo is missing')
    }

    const photoResponse = await fetch(`${BASE_URL}${photoUrl}`, { headers: readHeaders })
    if (!photoResponse.ok || !String(photoResponse.headers.get('content-type')).startsWith('image/')) {
      throw new Error(`Demo photo failed: ${photoResponse.status}`)
    }

    const anonymousPhotoResponse = await fetch(`${BASE_URL}${photoUrl}`)
    if (anonymousPhotoResponse.status !== 401) {
      throw new Error(`Anonymous demo photo expected 401, got ${anonymousPhotoResponse.status}`)
    }

    console.log(JSON.stringify({
      ok: true,
      companyId: login.user.company_id,
      accessMode: login.user.access_mode,
      vehicles: vehicles.data.length,
      inspections: inspections.data.length,
      blockedWrite: blockedCreate.error,
      photoProtected: true,
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
