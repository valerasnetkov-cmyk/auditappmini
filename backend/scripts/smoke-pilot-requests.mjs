import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import process from 'node:process'
import Database from 'better-sqlite3'

const HOST = '127.0.0.1'
const PORT = Number(process.env.PORT || 5320 + (process.pid % 500))
const DATABASE_PATH = `./.tmp-smoke/smoke-pilot-requests-${process.pid}.sqlite`
const JWT_SECRET = crypto.randomBytes(32).toString('hex')
const BASE_URL = `http://${HOST}:${PORT}`

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForServer(timeoutMs = 30000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@example.com', password: 'admin123' }),
      })
      if (response.status !== 500) return
    } catch {
    }
    await sleep(250)
  }
  throw new Error('Pilot requests smoke server did not start')
}

async function request(path, options = {}, expectedStatus = 200) {
  const response = await fetch(`${BASE_URL}${path}`, options)
  const body = response.status === 204 ? null : await response.json().catch(() => ({}))
  if (response.status !== expectedStatus) {
    throw new Error(`${path} failed with ${response.status}: ${JSON.stringify(body)}`)
  }
  return body
}

function publicPayload(suffix, overrides = {}) {
  return {
    companyName: `Пилотная компания ${suffix}`,
    contactName: 'Иван Пилотов',
    contactEmail: `pilot-${suffix}@example.com`,
    contactPhone: '+7 900 000-00-00',
    vehicleCount: 12,
    region: 'Сахалинская область',
    preferredPlanCode: 'standard',
    comment: 'Нужен пилот',
    consentGiven: true,
    source: 'smoke',
    ...overrides,
  }
}

async function run() {
  const suffix = `${Date.now()}-${process.pid}`
  const server = spawn(process.execPath, ['src/server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(PORT),
      DATABASE_PATH,
      JWT_SECRET,
      ADMIN_EMAIL: 'admin@example.com',
      ADMIN_PASSWORD: 'admin123',
      PILOT_REQUEST_RATE_LIMIT_MAX: '3',
      PILOT_REQUEST_RATE_LIMIT_WINDOW_MS: '1800000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stderr = ''
  server.stderr.on('data', (chunk) => { stderr += chunk.toString() })

  try {
    await waitForServer()

    const invalid = publicPayload(`${suffix}-invalid`, { consentGiven: false })
    await request('/api/public/pilot-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalid),
    }, 400)

    const primary = publicPayload(`${suffix}-primary`)
    await request('/api/public/pilot-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(primary),
    }, 201)
    await request('/api/public/pilot-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(primary),
    }, 201)
    await request('/api/public/pilot-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(publicPayload(`${suffix}-limited`)),
    }, 429)

    const adminLogin = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'admin123' }),
    })
    const adminHeaders = { Authorization: `Bearer ${adminLogin.token}` }
    const adminJson = { ...adminHeaders, 'Content-Type': 'application/json' }

    const registry = await request('/api/admin/resource/pilot-requests', { headers: adminHeaders })
    if (registry.requests.length !== 1 || registry.summary.new !== 1) {
      throw new Error(`Unexpected pilot registry: ${JSON.stringify(registry)}`)
    }
    const pilotRequest = registry.requests[0]
    if (pilotRequest.preferredPlanCode !== 'standard') {
      throw new Error(`Preferred plan was not saved: ${JSON.stringify(pilotRequest)}`)
    }

    await request(`/api/admin/resource/pilot-requests/${pilotRequest.id}`, {
      method: 'PUT',
      headers: adminJson,
      body: JSON.stringify({ status: 'rejected' }),
    }, 400)

    const assignees = await request('/api/admin/resource/pilot-requests/assignees', { headers: adminHeaders })
    const admin = assignees.users.find((user) => user.role === 'admin')
    if (!admin) throw new Error('Admin assignee missing')

    await request(`/api/admin/resource/pilot-requests/${pilotRequest.id}`, {
      method: 'PUT',
      headers: adminJson,
      body: JSON.stringify({
        status: 'approved',
        assignedUserId: admin.id,
        internalComment: 'Пилот согласован',
      }),
    })

    const preview = await request(
      `/api/admin/resource/pilot-requests/${pilotRequest.id}/conversion-preview`,
      { headers: adminHeaders },
    )
    if (preview.planCode !== 'standard' || !preview.slug || !preview.limits.maxVehicles) {
      throw new Error(`Invalid conversion preview: ${JSON.stringify(preview)}`)
    }
    await request('/api/admin/resource/companies', {
      method: 'POST',
      headers: adminJson,
      body: JSON.stringify({
        id: `slug-conflict-${suffix}`,
        slug: preview.slug,
        name: 'Slug Conflict',
      }),
    }, 201)

    const supportEmail = `support-${suffix}@example.com`
    await request('/api/admin/resource/service-users', {
      method: 'POST',
      headers: adminJson,
      body: JSON.stringify({
        name: 'Pilot Support',
        email: supportEmail,
        password: 'Support123!',
        preset: 'support',
      }),
    }, 201)
    const supportLogin = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: supportEmail, password: 'Support123!' }),
    })
    const supportHeaders = { Authorization: `Bearer ${supportLogin.token}` }
    await request('/api/admin/resource/pilot-requests', { headers: supportHeaders })
    await request(`/api/admin/resource/pilot-requests/${pilotRequest.id}/convert`, {
      method: 'POST',
      headers: { ...supportHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(preview),
    }, 403)

    const financeEmail = `finance-${suffix}@example.com`
    await request('/api/admin/resource/service-users', {
      method: 'POST',
      headers: adminJson,
      body: JSON.stringify({
        name: 'Pilot Finance',
        email: financeEmail,
        password: 'Finance123!',
        preset: 'finance',
      }),
    }, 201)
    const financeLogin = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: financeEmail, password: 'Finance123!' }),
    })
    await request('/api/admin/resource/pilot-requests', {
      headers: { Authorization: `Bearer ${financeLogin.token}` },
    }, 403)

    await request(`/api/admin/resource/pilot-requests/${pilotRequest.id}/convert`, {
      method: 'POST',
      headers: adminJson,
      body: JSON.stringify(preview),
    }, 409)
    const afterConflict = await request(`/api/admin/resource/pilot-requests/${pilotRequest.id}`, {
      headers: adminHeaders,
    })
    if (afterConflict.status !== 'approved' || afterConflict.linkedCompanyId) {
      throw new Error(`Slug conflict partially converted request: ${JSON.stringify(afterConflict)}`)
    }
    preview.slug = `${preview.slug}-pilot`
    const converted = await request(`/api/admin/resource/pilot-requests/${pilotRequest.id}/convert`, {
      method: 'POST',
      headers: adminJson,
      body: JSON.stringify(preview),
    }, 201)
    if (!converted.setup?.setup_url || converted.request.status !== 'converted') {
      throw new Error(`Conversion did not provision owner setup: ${JSON.stringify(converted)}`)
    }
    await request(`/api/admin/resource/pilot-requests/${pilotRequest.id}/convert`, {
      method: 'POST',
      headers: adminJson,
      body: JSON.stringify(preview),
    }, 409)

    const sqlite = new Database(DATABASE_PATH)
    const retentionId = crypto.randomUUID()
    sqlite.prepare(`
      INSERT INTO pilot_requests (
        id, company_name, contact_name, contact_email, contact_phone, vehicle_count,
        status, consent_given, consent_at, created_at, updated_at
      ) VALUES (?, 'Retention Test', 'Удалить', 'retention@example.com', '+7 900 000-00-01',
        2, 'rejected', 1, datetime('now', '-13 months'), datetime('now', '-13 months'),
        datetime('now', '-13 months'))
    `).run(retentionId)
    sqlite.close()

    const retention = await request('/api/admin/resource/pilot-requests/anonymize-expired', {
      method: 'POST',
      headers: adminJson,
      body: JSON.stringify({}),
    })
    if (retention.anonymized < 1) throw new Error('Expired request was not anonymized')
    const retained = await request(`/api/admin/resource/pilot-requests/${retentionId}`, { headers: adminHeaders })
    if (retained.contactEmail !== null || !retained.anonymizedAt) {
      throw new Error(`Retention anonymization failed: ${JSON.stringify(retained)}`)
    }

    console.log('Pilot requests smoke passed')
  } finally {
    server.kill('SIGTERM')
    await new Promise((resolve) => server.once('exit', resolve))
    await fs.rm(DATABASE_PATH, { force: true })
    await fs.rm(`${DATABASE_PATH}-shm`, { force: true })
    await fs.rm(`${DATABASE_PATH}-wal`, { force: true })
    if (stderr.trim()) console.error(stderr.trim())
  }
}

await run()
