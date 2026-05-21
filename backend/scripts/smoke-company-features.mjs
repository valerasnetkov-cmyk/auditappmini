import { spawn } from 'node:child_process'
import http from 'node:http'
import fs from 'node:fs/promises'
import process from 'node:process'

const HOST = '127.0.0.1'
let PORT = Number(process.env.PORT || 0)
let DIRECTUS_PORT = Number(process.env.DIRECTUS_PORT || 0)
const DATABASE_PATH = `./.tmp-smoke/smoke-company-features-${process.pid}.sqlite`
let BASE_URL = ''
let DIRECTUS_URL = ''
const DIRECTUS_TOKEN = 'smoke-company-features-token'

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

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, HOST, () => {
      server.off('error', reject)
      resolve()
    })
  })
}

function closeServer(server) {
  return new Promise((resolve) => {
    server.close(resolve)
  })
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

function createFakeDirectusServer() {
  return http.createServer((req, res) => {
    if (req.headers.authorization !== `Bearer ${DIRECTUS_TOKEN}`) {
      json(res, 401, { errors: [{ message: 'Unauthorized' }] })
      return
    }

    const url = new URL(req.url || '/', DIRECTUS_URL)

    if (req.method === 'GET' && url.pathname === '/items/companies') {
      json(res, 200, {
        data: [
          {
            id: 'default',
            slug: 'default',
            name: 'Default company',
            region: 'RU-MOS',
            country: 'RU',
            status: 'active',
          },
        ],
      })
      return
    }

    if (req.method === 'GET' && url.pathname === '/items/company_owners') {
      json(res, 200, { data: [] })
      return
    }

    if (req.method === 'GET' && url.pathname === '/items/company_limits') {
      json(res, 200, {
        data: [
          {
            id: 'feature-limit-default',
            company_id: 'default',
            plan_code: 'starter',
            max_vehicles: 25,
            max_users: 10,
            max_storage_mb: 512,
            ocr_enabled: false,
            accident_module_enabled: false,
            analytics_enabled: false,
            api_access_enabled: false,
            updated_at: '2026-05-20T00:00:00.000Z',
          },
        ],
      })
      return
    }

    json(res, 404, { errors: [{ message: `Unhandled fake Directus route: ${req.method} ${url.pathname}` }] })
  })
}

async function waitForServer(timeoutMs = 30000) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${BASE_URL}/api/health/ready`)
      const payload = await response.json().catch(() => null)

      if (response.ok && payload?.ready) {
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
    throw new Error(`${path} failed with status ${response.status}: ${body}`)
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}

function assertErrorIncludes(response, expectedText, scope) {
  if (!String(response?.error || '').includes(expectedText)) {
    throw new Error(`${scope} did not return expected feature error: ${JSON.stringify(response)}`)
  }
}

async function run() {
  if (!PORT) {
    PORT = await getFreePort()
  }

  if (!DIRECTUS_PORT) {
    DIRECTUS_PORT = await getFreePort()
  }

  BASE_URL = `http://${HOST}:${PORT}`
  DIRECTUS_URL = `http://${HOST}:${DIRECTUS_PORT}`

  const fakeDirectus = createFakeDirectusServer()
  await listen(fakeDirectus, DIRECTUS_PORT)

  const server = spawn(process.execPath, ['src/server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(PORT),
      DATABASE_PATH,
      DIRECTUS_URL,
      DIRECTUS_TOKEN,
    },
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
      body: JSON.stringify({
        email: 'admin@example.com',
        password: 'admin123',
      }),
    })

    const adminHeaders = { Authorization: `Bearer ${adminLogin.token}` }
    const jsonHeaders = { ...adminHeaders, 'Content-Type': 'application/json' }

    const provisioning = await request('/api/integrations/directus/provisioning/sync', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ issue_setup_links: false }),
    })

    if (!provisioning.result?.company_limits?.some((item) => item.company_id === 'default')) {
      throw new Error(`Provisioning did not sync default feature flags: ${JSON.stringify(provisioning)}`)
    }

    const analyticsOverview = await request('/api/analytics/overview', {
      headers: adminHeaders,
    }, 403)
    assertErrorIncludes(analyticsOverview, 'Аналитика отключена', 'analytics overview')

    const analyticsExport = await request('/api/analytics/export/excel', {
      headers: adminHeaders,
    }, 403)
    assertErrorIncludes(analyticsExport, 'Аналитика отключена', 'analytics export')

    const accidentInspection = await request('/api/inspections', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        vehicle_id: 'missing-vehicle',
        type: 'accident',
        accident_occurred_at: '2026-05-20T12:00:00.000Z',
        accident_location: 'Smoke test',
        checklist: [],
      }),
    }, 403)
    assertErrorIncludes(accidentInspection, 'Модуль ДТП отключен', 'accident inspection')

    const numberRecognition = await request('/api/vehicle-number/recognize', {
      method: 'POST',
      headers: adminHeaders,
    }, 403)
    assertErrorIncludes(numberRecognition, 'OCR отключен', 'vehicle number recognition')

    const odometerRecognition = await request('/api/odometer/recognize', {
      method: 'POST',
      headers: adminHeaders,
    }, 403)
    assertErrorIncludes(odometerRecognition, 'OCR отключен', 'odometer recognition')

    const stats = await request('/api/admin/saas/stats', {
      headers: adminHeaders,
    })
    const defaultCompany = stats.companies?.find((company) => company.id === 'default')

    if (
      defaultCompany?.limits?.ocrEnabled !== false ||
      defaultCompany?.limits?.accidentModuleEnabled !== false ||
      defaultCompany?.limits?.analyticsEnabled !== false
    ) {
      throw new Error(`SaaS stats did not expose disabled feature flags: ${JSON.stringify(defaultCompany)}`)
    }

    const companyUsage = await request('/api/company/usage', {
      headers: adminHeaders,
    })

    if (
      companyUsage.features?.ocr?.enabled !== false ||
      companyUsage.features?.accidentModule?.enabled !== false ||
      companyUsage.features?.analytics?.enabled !== false
    ) {
      throw new Error(`Company usage endpoint did not expose disabled feature flags: ${JSON.stringify(companyUsage)}`)
    }

    console.log(
      JSON.stringify(
        {
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
        },
        null,
        2,
      ),
    )
  } finally {
    server.kill()
    await sleep(300)
    await closeServer(fakeDirectus)
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
