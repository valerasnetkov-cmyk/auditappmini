import { spawn } from 'node:child_process'
import process from 'node:process'

const HOST = '127.0.0.1'
const PORT = Number(process.env.PORT || 4015 + (process.pid % 500))
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
    env: { ...process.env, PORT: String(PORT) },
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
    const plateNumber = `А${String(suffix % 1000).padStart(3, '0')}КМ${String((suffix % 900) + 100)}`
    const regionName = `Inspection Smoke Region ${suffix}`

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
        name: `Inspection Smoke ${suffix}`,
        status: 'active',
        region: regionName,
      }),
    }, 201)

    const invalidAccidentInspectionResponse = await fetch(`${BASE_URL}/api/inspections`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        vehicle_id: vehicle.id,
        type: 'accident',
        checklist: [],
      }),
    })

    if (invalidAccidentInspectionResponse.status !== 400) {
      const body = await invalidAccidentInspectionResponse.text()
      throw new Error(`Accident validation failed: expected 400, got ${invalidAccidentInspectionResponse.status}: ${body}`)
    }

    const inspection = await request('/api/inspections', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        vehicle_id: vehicle.id,
        type: 'accident',
        checklist: [],
        accident_occurred_at: '2026-05-01T10:15:00.000Z',
        accident_location: 'Южно-Сахалинск, тестовый маршрут',
      }),
    }, 201)

    await request(`/api/inspections/${inspection.id}`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({
        checklist: [
          { title: 'Кузов', result: true, comment: '' },
          { title: 'Остекление', result: false, comment: 'Трещина после ДТП' },
        ],
        accident_occurred_at: '2026-05-01T10:15:00.000Z',
        accident_location: 'Южно-Сахалинск, тестовый маршрут',
      }),
    })

    const inspectionDetails = await request(`/api/inspections/${inspection.id}`, {
      headers: authHeaders,
    })

    const firstDefectId = inspectionDetails.defects?.[0]?.id
    const defectDetails = firstDefectId
      ? await request(`/api/defects/${firstDefectId}`, {
          headers: authHeaders,
        })
      : null

    const inspectionsList = await request(`/api/inspections?vehicle=${vehicle.id}`, {
      headers: authHeaders,
    })

    const defectsList = await request(`/api/defects?vehicle=${vehicle.id}`, {
      headers: authHeaders,
    })

    const vehicleDefects = await request(`/api/vehicles/${vehicle.id}/defects?limit=10`, {
      headers: authHeaders,
    })

    await request(`/api/inspections/${inspection.id}`, {
      method: 'DELETE',
      headers: authHeaders,
    }, 204)

    await request(`/api/vehicles/${vehicle.id}`, {
      method: 'DELETE',
      headers: authHeaders,
    }, 204)

    const missingInspectionResponse = await fetch(`${BASE_URL}/api/inspections/${inspection.id}`, {
      headers: authHeaders,
    })

    if (missingInspectionResponse.status !== 404) {
      const body = await missingInspectionResponse.text()
      throw new Error(`Deleted inspection still accessible: ${missingInspectionResponse.status} ${body}`)
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          vehicleId: vehicle.id,
          inspectionId: inspection.id,
          checklistItems: inspectionDetails.checklist_items?.length || 0,
          defectsCreated: inspectionDetails.defects?.length || 0,
          inspectionsListed: inspectionsList.data?.length || 0,
          defectsListed: defectsList.data?.length || 0,
          vehicleDefectsListed: Array.isArray(vehicleDefects) ? vehicleDefects.length : 0,
          accidentValidationStatus: invalidAccidentInspectionResponse.status,
          defectInspectionType: defectDetails?.inspection_type ?? null,
          defectAccidentLocation: defectDetails?.accident_location ?? null,
        },
        null,
        2,
      ),
    )
  } finally {
    server.kill()
    await sleep(300)
  }

  if (stderr.trim()) {
    console.error(stderr.trim())
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
