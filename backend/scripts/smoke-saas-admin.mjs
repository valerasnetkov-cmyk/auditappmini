import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import process from 'node:process'

const HOST = '127.0.0.1'
const PORT = Number(process.env.PORT || 4817 + (process.pid % 500))
const DATABASE_PATH = `./.tmp-smoke/smoke-saas-admin-${process.pid}.sqlite`
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
  const server = spawn(process.execPath, ['src/server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(PORT), DATABASE_PATH },
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

    const seeded = await request('/api/seed', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ vehicles: 5, inspections: 12 }),
    })

    const stats = await request('/api/admin/saas/stats', {
      headers: adminHeaders,
    })

    if (stats.totals?.companies < 1 || stats.totals?.vehicles < seeded.vehicles || stats.totals?.inspections < seeded.inspections) {
      throw new Error(`SaaS stats did not include global seeded data: ${JSON.stringify(stats.totals)}`)
    }

    if (!Array.isArray(stats.companies) || !stats.companies.some((company) => company.id === 'default')) {
      throw new Error(`SaaS stats did not include company breakdown: ${JSON.stringify(stats.companies)}`)
    }

    const managerLogin = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'demo_manager@example.com',
        password: 'demo123',
      }),
    })

    await request('/api/admin/saas/stats', {
      headers: { Authorization: `Bearer ${managerLogin.token}` },
    }, 403)

    console.log(
      JSON.stringify(
        {
          ok: true,
          companies: stats.totals.companies,
          vehicles: stats.totals.vehicles,
          inspections: stats.totals.inspections,
          defects: stats.totals.defects,
          managerDenied: true,
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
