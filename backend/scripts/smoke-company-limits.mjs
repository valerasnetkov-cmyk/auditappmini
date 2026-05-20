import { spawn } from 'node:child_process'
import http from 'node:http'
import fs from 'node:fs/promises'
import process from 'node:process'

const HOST = '127.0.0.1'
const PORT = Number(process.env.PORT || 4917 + (process.pid % 500))
const DIRECTUS_PORT = Number(process.env.DIRECTUS_PORT || 5917 + (process.pid % 500))
const DATABASE_PATH = `./.tmp-smoke/smoke-company-limits-${process.pid}.sqlite`
const BASE_URL = `http://${HOST}:${PORT}`
const DIRECTUS_URL = `http://${HOST}:${DIRECTUS_PORT}`
const DIRECTUS_TOKEN = 'smoke-company-limits-token'
const DIRECTUS_COMPANY_ID = 1001
const EXPECTED_COMPANY_ID = String(DIRECTUS_COMPANY_ID)
const OWNER_EMAIL = `limit-owner-${process.pid}@example.com`

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function listen(server, port) {
  return new Promise((resolve) => {
    server.listen(port, HOST, resolve)
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
            id: DIRECTUS_COMPANY_ID,
            slug: `directus-limit-company-${DIRECTUS_COMPANY_ID}`,
            name: 'Directus integer limit company',
            region: 'RU-MOS',
            country: 'RU',
            status: 'active',
          },
        ],
      })
      return
    }

    if (req.method === 'GET' && url.pathname === '/items/company_owners') {
      json(res, 200, {
        data: [
          {
            id: 2001,
            company_id: DIRECTUS_COMPANY_ID,
            email: OWNER_EMAIL,
            name: 'Limit Owner',
            status: 'active',
          },
        ],
      })
      return
    }

    if (req.method === 'GET' && url.pathname === '/items/company_limits') {
      json(res, 200, {
        data: [
          {
            id: 3001,
            company_id: DIRECTUS_COMPANY_ID,
            plan_code: 'pilot',
            max_vehicles: 1,
            max_users: 2,
            max_storage_mb: 128,
            ocr_enabled: true,
            accident_module_enabled: true,
            analytics_enabled: true,
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
    throw new Error(`${path} failed with status ${response.status}: ${body}`)
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}

async function run() {
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
      body: JSON.stringify({ issue_setup_links: true }),
    })

    if (!provisioning.result?.companies?.some((item) => item.id === EXPECTED_COMPANY_ID)) {
      throw new Error(`Provisioning did not sync integer-id company: ${JSON.stringify(provisioning)}`)
    }

    if (!provisioning.result?.owners?.some((item) => item.company_id === EXPECTED_COMPANY_ID && item.email === OWNER_EMAIL)) {
      throw new Error(`Provisioning did not sync integer-id owner: ${JSON.stringify(provisioning)}`)
    }

    if (!provisioning.result?.company_limits?.some((item) => item.company_id === EXPECTED_COMPANY_ID)) {
      throw new Error(`Provisioning did not sync integer-id limits: ${JSON.stringify(provisioning)}`)
    }

    const setupLink = provisioning.result?.setup_links?.find((item) => item.email === OWNER_EMAIL)
    if (!setupLink?.token) {
      throw new Error(`Provisioning did not issue owner setup link: ${JSON.stringify(provisioning)}`)
    }

    const ownerPassword = 'limitOwnerSmoke123'
    const ownerSetup = await request('/api/auth/owner-setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: setupLink.token,
        password: ownerPassword,
      }),
    })

    if (ownerSetup.user?.company_id !== EXPECTED_COMPANY_ID || ownerSetup.user?.role !== 'owner') {
      throw new Error(`Owner setup returned unexpected integer-id user: ${JSON.stringify(ownerSetup.user)}`)
    }

    const ownerLogin = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: OWNER_EMAIL,
        password: ownerPassword,
      }),
    })

    const ownerHeaders = { Authorization: `Bearer ${ownerLogin.token}` }
    const ownerJsonHeaders = { ...ownerHeaders, 'Content-Type': 'application/json' }

    await request('/api/vehicles', {
      method: 'POST',
      headers: ownerJsonHeaders,
      body: JSON.stringify({
        number: 'A123BC177',
        name: 'Limit smoke vehicle 1',
        status: 'active',
      }),
    }, 201)

    const secondVehicle = await request('/api/vehicles', {
      method: 'POST',
      headers: ownerJsonHeaders,
      body: JSON.stringify({
        number: 'A124BC177',
        name: 'Limit smoke vehicle 2',
        status: 'active',
      }),
    }, 409)

    await request('/api/users', {
      method: 'POST',
      headers: ownerJsonHeaders,
      body: JSON.stringify({
        email: `limit-manager-1-${process.pid}@example.com`,
        password: 'smoke123',
        name: 'Limit Manager 1',
        role: 'manager',
      }),
    }, 201)

    const secondUser = await request('/api/users', {
      method: 'POST',
      headers: ownerJsonHeaders,
      body: JSON.stringify({
        email: `limit-manager-2-${process.pid}@example.com`,
        password: 'smoke123',
        name: 'Limit Manager 2',
        role: 'manager',
      }),
    }, 409)

    const stats = await request('/api/admin/saas/stats', {
      headers: adminHeaders,
    })
    const defaultCompany = stats.companies?.find((company) => company.id === EXPECTED_COMPANY_ID)

    if (defaultCompany?.limits?.maxVehicles !== 1 || defaultCompany?.limits?.maxUsers !== 2) {
      throw new Error(`SaaS stats did not expose synced limits: ${JSON.stringify(defaultCompany)}`)
    }

    const companyUsage = await request('/api/company/usage', {
      headers: ownerHeaders,
    })

    if (
      companyUsage.plan?.code !== 'pilot' ||
      companyUsage.usage?.vehicles?.max !== 1 ||
      companyUsage.usage?.vehicles?.current !== 1 ||
      companyUsage.usage?.users?.max !== 2 ||
      companyUsage.features?.ocr?.enabled !== true
    ) {
      throw new Error(`Company usage endpoint did not expose current limits: ${JSON.stringify(companyUsage)}`)
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          directusCompanyId: DIRECTUS_COMPANY_ID,
          normalizedCompanyId: EXPECTED_COMPANY_ID,
          planCode: defaultCompany.limits.planCode,
          maxVehicles: defaultCompany.limits.maxVehicles,
          maxUsers: defaultCompany.limits.maxUsers,
          usageVehicles: companyUsage.usage.vehicles,
          usageUsers: companyUsage.usage.users,
          secondVehicleError: secondVehicle.error,
          secondUserError: secondUser.error,
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
