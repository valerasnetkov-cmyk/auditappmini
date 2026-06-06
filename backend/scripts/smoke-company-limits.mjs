import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import process from 'node:process'

const HOST = '127.0.0.1'
const PORT = Number(process.env.PORT || 4917 + (process.pid % 500))
const DATABASE_PATH = `./.tmp-smoke/smoke-company-limits-${process.pid}.sqlite`
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

async function run() {
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
    const suffix = Date.now()
    const companyId = `limit-company-${suffix}`
    const ownerEmail = `limit-owner-${suffix}@example.com`

    await request('/api/admin/resource/companies', {
      method: 'POST',
      headers: adminJsonHeaders,
      body: JSON.stringify({
        id: companyId,
        slug: companyId,
        name: `Limit Smoke ${suffix}`,
      }),
    }, 201)

    await request(`/api/admin/resource/companies/${companyId}/limits`, {
      method: 'PUT',
      headers: adminJsonHeaders,
      body: JSON.stringify({
        planCode: 'pilot',
        maxVehicles: 1,
        maxUsers: 2,
        maxStorageMb: 128,
        ocrEnabled: true,
        accidentModuleEnabled: true,
        analyticsEnabled: true,
        apiAccessEnabled: false,
      }),
    })

    const owner = await request(`/api/admin/resource/companies/${companyId}/owners`, {
      method: 'POST',
      headers: adminJsonHeaders,
      body: JSON.stringify({ email: ownerEmail, name: 'Limit Owner', issue_setup_link: true }),
    }, 201)

    const ownerPassword = 'limitOwnerSmoke123'
    await request('/api/auth/owner-setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: owner.setup.token, password: ownerPassword }),
    })

    const ownerLogin = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ownerEmail, password: ownerPassword }),
    })

    const ownerHeaders = { Authorization: `Bearer ${ownerLogin.token}` }
    const ownerJsonHeaders = { ...ownerHeaders, 'Content-Type': 'application/json' }

    await request('/api/vehicles', {
      method: 'POST',
      headers: ownerJsonHeaders,
      body: JSON.stringify({ number: 'A123BC177', name: 'Limit smoke vehicle 1', status: 'active' }),
    }, 201)

    const secondVehicle = await request('/api/vehicles', {
      method: 'POST',
      headers: ownerJsonHeaders,
      body: JSON.stringify({ number: 'A124BC177', name: 'Limit smoke vehicle 2', status: 'active' }),
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

    const stats = await request('/api/admin/resource/stats', { headers: adminHeaders })
    const company = stats.companies?.find((item) => item.id === companyId)
    if (company?.limits?.maxVehicles !== 1 || company?.limits?.maxUsers !== 2) {
      throw new Error(`Resource admin stats did not expose company limits: ${JSON.stringify(company)}`)
    }

    const companyUsage = await request('/api/company/usage', { headers: ownerHeaders })
    if (
      companyUsage.plan?.code !== 'pilot' ||
      companyUsage.usage?.vehicles?.max !== 1 ||
      companyUsage.usage?.vehicles?.current !== 1 ||
      companyUsage.usage?.users?.max !== 2 ||
      companyUsage.features?.ocr?.enabled !== true
    ) {
      throw new Error(`Company usage endpoint did not expose current limits: ${JSON.stringify(companyUsage)}`)
    }

    console.log(JSON.stringify({
      ok: true,
      companyId,
      planCode: company.limits.planCode,
      maxVehicles: company.limits.maxVehicles,
      maxUsers: company.limits.maxUsers,
      usageVehicles: companyUsage.usage.vehicles,
      usageUsers: companyUsage.usage.users,
      secondVehicleError: secondVehicle.error,
      secondUserError: secondUser.error,
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
