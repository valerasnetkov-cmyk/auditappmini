import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import process from 'node:process'

const HOST = '127.0.0.1'
const PORT = Number(process.env.PORT || 4617 + (process.pid % 500))
const DATABASE_PATH = `./.tmp-smoke/smoke-directus-${process.pid}.sqlite`
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
    env: {
      ...process.env,
      PORT: String(PORT),
      DATABASE_PATH,
      DIRECTUS_TOKEN: '',
      DIRECTUS_DEFAULT_COMPANY_ID: '',
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
      body: JSON.stringify({
        email: 'admin@example.com',
        password: 'admin123',
      }),
    })

    const authHeaders = { Authorization: `Bearer ${login.token}` }
    const jsonHeaders = { ...authHeaders, 'Content-Type': 'application/json' }
    const suffix = Date.now()
    const plateNumber = `A${String(suffix % 1000).padStart(3, '0')}BC${String((suffix % 900) + 100)}`
    const regionName = `Directus Smoke Region ${suffix}`

    const status = await request('/api/integrations/directus/status', {
      headers: authHeaders,
    })

    if (
      status.configured !== false ||
      status.collections?.length !== 5 ||
      !status.collections.includes('company_owners') ||
      !status.collections.includes('plans') ||
      status.collections.includes('accident_cases') ||
      !status.legacy_sync_collections?.includes('accident_cases')
    ) {
      throw new Error(`Unexpected Directus status payload: ${JSON.stringify(status)}`)
    }

    await request('/api/regions', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ name: regionName }),
    }, 201)

    const vehicle = await request('/api/vehicles', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        number: plateNumber,
        name: `Directus Smoke ${suffix}`,
        status: 'active',
        region: regionName,
      }),
    }, 201)

    const inspection = await request('/api/inspections', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        vehicle_id: vehicle.id,
        type: 'accident',
        checklist: [],
        accident_occurred_at: '2026-05-01T10:15:00.000Z',
        accident_location: 'Yuzhno-Sakhalinsk, Directus smoke route',
      }),
    }, 201)

    await request(`/api/inspections/${inspection.id}`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({
        checklist: [
          { title: 'Body', result: true, comment: '' },
          { title: 'Glass', result: false, comment: 'Crack after accident' },
        ],
        accident_occurred_at: '2026-05-01T10:15:00.000Z',
        accident_location: 'Yuzhno-Sakhalinsk, Directus smoke route',
      }),
    })

    const preview = await request(`/api/integrations/directus/inspections/${inspection.id}/preview`, {
      headers: authHeaders,
    })

    if (preview.accident_case?.case_number !== `inspection-${inspection.id}`) {
      throw new Error(`Unexpected preview case number: ${JSON.stringify(preview.accident_case)}`)
    }

    if (preview.damages?.length !== 1) {
      throw new Error(`Unexpected Directus damages preview: ${JSON.stringify(preview.damages)}`)
    }

    if (preview.accident_case?.source_inspection_id !== inspection.id) {
      throw new Error(`Unexpected source inspection id: ${JSON.stringify(preview.accident_case)}`)
    }

    if (!preview.damages?.[0]?.source_defect_id) {
      throw new Error(`Directus damage preview must contain source_defect_id: ${JSON.stringify(preview.damages)}`)
    }

    const syncUnavailable = await request(`/api/integrations/directus/inspections/${inspection.id}/sync`, {
      method: 'POST',
      headers: authHeaders,
    }, 503)

    await request(`/api/inspections/${inspection.id}`, {
      method: 'DELETE',
      headers: authHeaders,
    }, 204)

    await request(`/api/vehicles/${vehicle.id}`, {
      method: 'DELETE',
      headers: authHeaders,
    }, 204)

    console.log(
      JSON.stringify(
        {
          ok: true,
          configured: status.configured,
          inspectionId: inspection.id,
          caseNumber: preview.accident_case.case_number,
          sourceInspectionId: preview.accident_case.source_inspection_id,
          damages: preview.damages.length,
          syncStatus: 503,
          syncError: syncUnavailable.error,
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
