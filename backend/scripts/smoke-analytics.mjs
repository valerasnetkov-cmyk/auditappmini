import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import process from 'node:process'

const HOST = '127.0.0.1'
const PORT = Number(process.env.PORT || 4516 + (process.pid % 500))
const DATABASE_PATH = `./.tmp-smoke/smoke-analytics-${process.pid}.sqlite`
const BASE_URL = `http://${HOST}:${PORT}`

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForServer(timeoutMs = 15000) {
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

    const login = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@example.com',
        password: 'admin123',
      }),
    })

    const authHeaders = { Authorization: `Bearer ${login.token}` }
    const jsonHeaders = { ...authHeaders, 'Content-Type': 'application/json' }

    const seeded = await request('/api/seed', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ vehicles: 6, inspections: 18 }),
    })

    const analytics = await request('/api/analytics/overview?from=2000-01-01', {
      headers: authHeaders,
    })

    const vehiclesExport = await request('/api/analytics/export/excel?type=vehicles', {
      headers: authHeaders,
    })

    const inspectionsExport = await request('/api/analytics/export/excel?type=inspections', {
      headers: authHeaders,
    })

    const notifications = await request('/api/notifications', {
      headers: authHeaders,
    })

    const dailyDates = Array.isArray(analytics.dailyInspections)
      ? new Set(analytics.dailyInspections.map((item) => item.date)).size
      : 0

    console.log(
      JSON.stringify(
        {
          ok: true,
          seededVehicles: seeded.vehicles ?? null,
          seededInspections: seeded.inspections ?? null,
          totalVehicles: analytics.total?.vehicles ?? null,
          totalDefects: analytics.total?.defects ?? null,
          dailyBuckets: analytics.dailyInspections?.length ?? 0,
          uniqueDailyDates: dailyDates,
          vehicleExportRows: vehiclesExport.data?.length ?? 0,
          inspectionExportRows: inspectionsExport.data?.length ?? 0,
          notifications: Array.isArray(notifications) ? notifications.length : 0,
        },
        null,
        2,
      ),
    )

    if (dailyDates < 2) {
      throw new Error('Analytics seed did not produce inspection history across multiple dates')
    }
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
