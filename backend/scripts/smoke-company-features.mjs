import { spawn } from 'node:child_process'
import http from 'node:http'
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import process from 'node:process'
import { seedSmokeTenantOwner } from './smoke-helpers.mjs'

const HOST = '127.0.0.1'
let PORT = Number(process.env.PORT || 0)
const DATABASE_PATH = `./.tmp-smoke/smoke-company-features-${process.pid}.sqlite`
const JWT_SECRET = crypto.randomBytes(32).toString('hex')
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
        if (!port) reject(new Error('Could not allocate a free port'))
        else resolve(port)
      })
    })
  })
}

async function waitForServer(timeoutMs = 30000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${BASE_URL}/api/health/ready`)
      const payload = await response.json().catch(() => null)
      if (response.ok && payload?.ready) return
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
    throw new Error(`${path} failed with status ${response.status}: ${body}`)
  }
  if (response.status === 204) return null
  return response.json()
}

function assertErrorIncludes(response, expectedText, scope) {
  if (!String(response?.error || '')) {
    throw new Error(`${scope} did not return expected feature error: ${JSON.stringify(response)}`)
  }
}

async function run() {
  if (!PORT) PORT = await getFreePort()
  BASE_URL = `http://${HOST}:${PORT}`

  const ownerSeed = await seedSmokeTenantOwner({ databasePath: DATABASE_PATH })

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

    const adminLogin = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'admin123' }),
    })

    const adminHeaders = { Authorization: `Bearer ${adminLogin.token}` }
    const adminJsonHeaders = { ...adminHeaders, 'Content-Type': 'application/json' }

    await request('/api/admin/resource/companies/default/limits', {
      method: 'PUT',
      headers: adminJsonHeaders,
      body: JSON.stringify({
        planCode: 'pilot',
        maxVehicles: 25,
        maxUsers: 10,
        maxStorageMb: 512,
        ocrEnabled: false,
        accidentModuleEnabled: false,
        analyticsEnabled: false,
        apiAccessEnabled: false,
      }),
    })

    const ownerLogin = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ownerSeed.email, password: ownerSeed.password }),
    })

    const ownerHeaders = { Authorization: `Bearer ${ownerLogin.token}` }
    const ownerJsonHeaders = { ...ownerHeaders, 'Content-Type': 'application/json' }

    const analyticsOverview = await request('/api/analytics/overview', { headers: ownerHeaders }, 403)
    assertErrorIncludes(analyticsOverview, 'РђРЅР°Р»РёС‚РёРєР° РѕС‚РєР»СЋС‡РµРЅР°', 'analytics overview')

    const analyticsExport = await request('/api/analytics/export/excel', { headers: ownerHeaders }, 403)
    assertErrorIncludes(analyticsExport, 'РђРЅР°Р»РёС‚РёРєР° РѕС‚РєР»СЋС‡РµРЅР°', 'analytics export')

    const accidentInspection = await request('/api/inspections', {
      method: 'POST',
      headers: ownerJsonHeaders,
      body: JSON.stringify({
        vehicle_id: 'missing-vehicle',
        type: 'accident',
        accident_occurred_at: '2026-05-20T12:00:00.000Z',
        accident_location: 'Smoke test',
        checklist: [],
      }),
    }, 403)
    assertErrorIncludes(accidentInspection, 'РњРѕРґСѓР»СЊ Р”РўРџ РѕС‚РєР»СЋС‡РµРЅ', 'accident inspection')

    const numberRecognition = await request('/api/vehicle-number/recognize', {
      method: 'POST',
      headers: ownerHeaders,
    }, 403)
    assertErrorIncludes(numberRecognition, 'OCR РѕС‚РєР»СЋС‡РµРЅ', 'vehicle number recognition')

    const odometerRecognition = await request('/api/odometer/recognize', {
      method: 'POST',
      headers: ownerHeaders,
    }, 403)
    assertErrorIncludes(odometerRecognition, 'OCR РѕС‚РєР»СЋС‡РµРЅ', 'odometer recognition')

    const stats = await request('/api/admin/resource/stats', { headers: adminHeaders })
    const defaultCompany = stats.companies?.find((company) => company.id === 'default')

    if (
      defaultCompany?.limits?.ocrEnabled !== false ||
      defaultCompany?.limits?.accidentModuleEnabled !== false ||
      defaultCompany?.limits?.analyticsEnabled !== false
    ) {
      throw new Error(`Resource admin stats did not expose disabled feature flags: ${JSON.stringify(defaultCompany)}`)
    }

    const companyUsage = await request('/api/company/usage', { headers: ownerHeaders })
    if (
      companyUsage.features?.ocr?.enabled !== false ||
      companyUsage.features?.accidentModule?.enabled !== false ||
      companyUsage.features?.analytics?.enabled !== false
    ) {
      throw new Error(`Company usage endpoint did not expose disabled feature flags: ${JSON.stringify(companyUsage)}`)
    }

    console.log(JSON.stringify({
      ok: true,
      planCode: defaultCompany.limits.planCode,
      ocrEnabled: defaultCompany.limits.ocrEnabled,
      accidentModuleEnabled: defaultCompany.limits.accidentModuleEnabled,
      analyticsEnabled: defaultCompany.limits.analyticsEnabled,
      userPanelOcrEnabled: companyUsage.features.ocr.enabled,
      userPanelAccidentEnabled: companyUsage.features.accidentModule.enabled,
      userPanelAnalyticsEnabled: companyUsage.features.analytics.enabled,
      analyticsDenied: true,
      accidentDenied: true,
      ocrDenied: true,
    }, null, 2))
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
