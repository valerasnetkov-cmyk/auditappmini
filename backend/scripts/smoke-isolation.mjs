import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import process from 'node:process'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

const HOST = '127.0.0.1'
const PORT = Number(process.env.PORT || 3917 + (process.pid % 500))
const DATABASE_PATH = `./.tmp-smoke/smoke-isolation-${process.pid}.sqlite`
const JWT_SECRET = 'smoke-isolation-secret'
const BASE_URL = `http://${HOST}:${PORT}`
const VALID_PNG_BYTES = Uint8Array.from(Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64',
))

process.env.DATABASE_PATH = DATABASE_PATH

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
        body: JSON.stringify({
          email: 'admin@example.com',
          password: 'admin123',
        }),
      })

      if (response.status !== 500) {
        return
      }
    } catch {
    }

    await sleep(300)
  }

  throw new Error(`Server did not become ready within ${timeoutMs}ms`)
}

async function request(path, options = {}, expectedStatus = 200) {
  const response = await fetch(`${BASE_URL}${path}`, options)

  if (response.status !== expectedStatus) {
    const body = await response.text()
    throw new Error(`${path} expected ${expectedStatus} but got ${response.status}: ${body}`)
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}

async function uploadInspectionPhoto(inspectionId, photoType, headers) {
  const formData = new FormData()
  formData.append('photo', new Blob([VALID_PNG_BYTES], { type: 'image/png' }), `${photoType}.png`)
  formData.append('photo_type', photoType)

  return request(`/api/inspections/${inspectionId}/photos`, {
    method: 'POST',
    headers,
    body: formData,
  }, 201)
}

function makeToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' })
}

async function seedIsolationPrincipals() {
  const { initDatabase, getDb } = await import('../src/db.js')
  await initDatabase()
  const db = getDb()
  const passwordHash = bcrypt.hashSync('smoke123', 10)

  db.prepare(`
    INSERT OR IGNORE INTO companies (id, slug, name, region_code, data_residency, status)
    VALUES (?, ?, ?, ?, ?, 'active')
  `).run('other-company', 'other-company', 'Other Company', 'RU-SAK', 'RU')

  db.prepare(`
    INSERT INTO users (id, email, password, name, role, status, company_id)
    VALUES (?, ?, ?, ?, ?, 'active', ?)
  `).run('other-company-owner', 'owner@other.example', passwordHash, 'Other Company Owner', 'owner', 'other-company')

  db.prepare(`
    INSERT INTO users (id, email, password, name, role, status, company_id)
    VALUES (?, ?, ?, ?, ?, 'active', ?)
  `).run('default-company-owner', 'owner@default.example', passwordHash, 'Default Company Owner', 'owner', 'default')

  db.prepare(`
    INSERT INTO users (id, email, password, name, role, status, company_id)
    VALUES (?, ?, ?, ?, ?, 'active', ?)
  `).run('default-inspector', 'inspector@default.example', passwordHash, 'Default Inspector', 'inspector', 'default')
}

async function run() {
  await seedIsolationPrincipals()

  const server = spawn(process.execPath, ['src/server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(PORT), DATABASE_PATH, JWT_SECRET },
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
      body: JSON.stringify({
        email: 'admin@example.com',
        password: 'admin123',
      }),
    })

    const adminHeaders = {
      Authorization: `Bearer ${login.token}`,
      'Content-Type': 'application/json',
    }

    const defaultOwnerToken = makeToken({
      id: 'default-company-owner',
      email: 'owner@default.example',
      name: 'Default Company Owner',
      role: 'owner',
      company_id: 'default',
    })
    const tenantHeaders = {
      Authorization: `Bearer ${defaultOwnerToken}`,
      'Content-Type': 'application/json',
    }
    const tenantReadHeaders = { Authorization: `Bearer ${defaultOwnerToken}` }

    const otherCompanyToken = makeToken({
      id: 'other-company-owner',
      email: 'owner@other.example',
      name: 'Other Company Owner',
      role: 'owner',
      company_id: 'other-company',
    })
    const otherHeaders = {
      Authorization: `Bearer ${otherCompanyToken}`,
      'Content-Type': 'application/json',
    }
    const otherReadHeaders = { Authorization: `Bearer ${otherCompanyToken}` }

    const inspectorToken = makeToken({
      id: 'default-inspector',
      email: 'inspector@default.example',
      name: 'Default Inspector',
      role: 'inspector',
      company_id: 'default',
    })
    const inspectorHeaders = { Authorization: `Bearer ${inspectorToken}` }

    const suffix = Date.now()
    const regionName = `Isolation Region ${suffix}`
    const vehicleNumber = `\u0410${String(suffix % 1000).padStart(3, '0')}\u0412\u0421${String((suffix % 900) + 100)}`

    const region = await request('/api/regions', {
      method: 'POST',
      headers: tenantHeaders,
      body: JSON.stringify({ name: regionName }),
    }, 201)

    const vehicle = await request('/api/vehicles', {
      method: 'POST',
      headers: tenantHeaders,
      body: JSON.stringify({
        number: vehicleNumber,
        name: `Isolation Vehicle ${suffix}`,
        status: 'active',
        region: regionName,
      }),
    }, 201)

    const user = await request('/api/users', {
      method: 'POST',
      headers: tenantHeaders,
      body: JSON.stringify({
        email: `isolation-user-${suffix}@example.com`,
        password: 'smoke123',
        name: 'Isolation User',
        role: 'inspector',
      }),
    }, 201)

    const inspection = await request('/api/inspections', {
      method: 'POST',
      headers: tenantHeaders,
      body: JSON.stringify({
        vehicle_id: vehicle.id,
        type: 'quick',
        checklist: [],
      }),
    }, 201)

    const uploadedPhoto = await uploadInspectionPhoto(inspection.id, 'front', tenantReadHeaders)

    await request('/api/vehicles', { headers: { Authorization: `Bearer ${login.token}` } }, 403)
    await request('/api/inspections', { headers: { Authorization: `Bearer ${login.token}` } }, 403)
    await request('/api/defects', { headers: { Authorization: `Bearer ${login.token}` } }, 403)
    await request('/api/users', { headers: { Authorization: `Bearer ${login.token}` } }, 403)

    await request(`/api/vehicles/${vehicle.id}`, { headers: otherReadHeaders }, 404)
    await request(`/api/vehicles/${vehicle.id}/history`, { headers: otherReadHeaders }, 404)
    await request(`/api/users/${user.id}`, { headers: otherReadHeaders }, 404)
    await request(`/api/users/${user.id}`, { method: 'DELETE', headers: otherReadHeaders }, 404)
    await request(`/api/vehicles/${vehicle.id}`, {
      method: 'PUT',
      headers: otherHeaders,
      body: JSON.stringify({
        number: vehicleNumber,
        name: 'Cross-company update attempt',
        status: 'repair',
        region: regionName,
      }),
    }, 404)
    await request(`/api/vehicles/${vehicle.id}`, { method: 'DELETE', headers: otherReadHeaders }, 404)
    await request(`/api/inspections/${inspection.id}/odometer`, {
      method: 'POST',
      headers: otherHeaders,
      body: JSON.stringify({ odometer_value: 12345 }),
    }, 404)

    const inspectorCompanies = await request('/api/companies', { headers: inspectorHeaders })
    if (inspectorCompanies.length !== 1 || inspectorCompanies[0]?.id !== 'default') {
      throw new Error('Inspector can see companies outside their tenant')
    }

    const otherCompanies = await request('/api/companies', { headers: otherReadHeaders })
    if (otherCompanies.length !== 1 || otherCompanies[0]?.id !== 'other-company') {
      throw new Error('Other-company owner cannot see exactly their own company')
    }

    await request('/api/companies', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        slug: `admin-forbidden-company-${suffix}`,
        name: 'Admin Forbidden Company',
      }),
    }, 403)

    await request('/api/companies', {
      method: 'POST',
      headers: otherHeaders,
      body: JSON.stringify({
        slug: `forbidden-company-${suffix}`,
        name: 'Forbidden Company',
      }),
    }, 403)

    const crossTenantPhotoResponse = await fetch(`${BASE_URL}${uploadedPhoto.url}`, {
      headers: otherReadHeaders,
    })
    if (crossTenantPhotoResponse.status !== 404) {
      const body = await crossTenantPhotoResponse.text()
      throw new Error(`Cross-tenant photo access expected 404, got ${crossTenantPhotoResponse.status}: ${body}`)
    }

    const anonymousPhotoResponse = await fetch(`${BASE_URL}${uploadedPhoto.url}`)
    if (anonymousPhotoResponse.status !== 401) {
      const body = await anonymousPhotoResponse.text()
      throw new Error(`Anonymous photo access expected 401, got ${anonymousPhotoResponse.status}: ${body}`)
    }

    const otherVehicles = await request('/api/vehicles/list', { headers: otherReadHeaders })
    const otherRegions = await request('/api/regions', { headers: otherReadHeaders })
    const otherResolve = await request('/api/vehicles/resolve-number', {
      method: 'POST',
      headers: otherHeaders,
      body: JSON.stringify({ number: vehicleNumber }),
    })

    if (otherVehicles.some((item) => item.id === vehicle.id)) {
      throw new Error('Other company can see default company vehicle in /api/vehicles/list')
    }

    if (otherRegions.some((item) => item.name === region.name)) {
      throw new Error('Other company can see default company region usage')
    }

    if (otherResolve.found) {
      throw new Error('Other company can resolve default company vehicle number')
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          protectedVehicleId: vehicle.id,
          protectedUserId: user.id,
          protectedInspectionId: inspection.id,
          otherCompanyVehicles: otherVehicles.length,
          otherCompanyRegions: otherRegions.length,
          otherCompanyResolveFound: otherResolve.found,
          inspectorCompanies: inspectorCompanies.length,
          otherCompanies: otherCompanies.length,
        },
        null,
        2,
      ),
    )
  } finally {
    server.kill()
    await sleep(300)
    await fs.rm(DATABASE_PATH, { force: true })
  }

  if (stderr.trim()) {
    console.error(stderr.trim())
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
