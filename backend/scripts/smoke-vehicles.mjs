import { spawn } from 'node:child_process'
import process from 'node:process'

const HOST = '127.0.0.1'
const PORT = Number(process.env.PORT || 3514 + (process.pid % 500))
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

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, options)

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`${path} failed with status ${response.status}: ${body}`)
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}

async function expectStatus(path, expectedStatus, options = {}) {
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

    const headers = {
      Authorization: `Bearer ${login.token}`,
      'Content-Type': 'application/json',
    }

    const suffix = Date.now()
    const plateNumber = `А${String(suffix % 1000).padStart(3, '0')}ВС${String((suffix % 900) + 100)}`
    const regionName = `Smoke Region ${suffix}`
    const mergedRegionName = `Smoke Region Merged ${suffix}`
    const fallbackRegionName = `Smoke Region Fallback ${suffix}`
    const fallbackRenamedRegionName = `Smoke Region Fallback Renamed ${suffix}`

    const createdRegion = await request('/api/regions', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: regionName }),
    })

    const mergeTargetRegion = await request('/api/regions', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: mergedRegionName }),
    })

    await request('/api/regions', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: fallbackRegionName }),
    })

    const fallbackUpdatedRegion = await request(`/api/regions/missing-${suffix}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ name: fallbackRenamedRegionName, currentName: fallbackRegionName }),
    })

    const regionsAfterFallbackUpdate = await request('/api/regions?includeEmpty=1', {
      headers: { Authorization: `Bearer ${login.token}` },
    })

    const createPayload = {
      number: plateNumber,
      name: `Smoke Vehicle ${suffix}`,
      status: 'active',
      region: regionName,
    }

    const created = await request('/api/vehicles', {
      method: 'POST',
      headers,
      body: JSON.stringify(createPayload),
    })

    const duplicateCreate = await expectStatus('/api/vehicles', 400, {
      method: 'POST',
      headers,
      body: JSON.stringify(createPayload),
    })

    const updated = await request(`/api/vehicles/${created.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        ...createPayload,
        status: 'repair',
        reason: 'Smoke test transition',
      }),
    })

    const inspection = await request('/api/inspections', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        vehicle_id: created.id,
        type: 'scheduled',
        checklist: [
          { title: 'Smoke checklist OK', result: true, comment: '' },
          { title: 'Smoke checklist defect', result: false, comment: 'Created by smoke test' },
        ],
      }),
    })

    const vehicleInspections = await request(`/api/vehicles/${created.id}/inspections?limit=10`, {
      headers: { Authorization: `Bearer ${login.token}` },
    })

    const history = await request(`/api/vehicles/${created.id}/history`, {
      headers: { Authorization: `Bearer ${login.token}` },
    })

    const mergedRegion = await request(`/api/regions/${createdRegion.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ name: mergedRegionName }),
    })

    const vehicleAfterRegionMerge = await request(`/api/vehicles/${created.id}`, {
      headers: { Authorization: `Bearer ${login.token}` },
    })

    const regionsAfterMerge = await request('/api/regions?includeEmpty=1', {
      headers: { Authorization: `Bearer ${login.token}` },
    })

    await expectStatus(`/api/regions/${mergeTargetRegion.id}`, 204, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${login.token}` },
    })

    await expectStatus(`/api/regions/${fallbackUpdatedRegion.id}`, 204, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${login.token}` },
    })

    const vehicleAfterRegionDelete = await request(`/api/vehicles/${created.id}`, {
      headers: { Authorization: `Bearer ${login.token}` },
    })

    await request(`/api/vehicles/${created.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${login.token}` },
    })

    console.log(
      JSON.stringify(
        {
          ok: true,
          createdId: created.id,
          createdNumber: created.number,
          createdRegion: created.region,
          updatedStatus: updated.status,
          duplicateError: duplicateCreate.error ?? null,
          regionMergedIntoExisting: mergedRegion.id === mergeTargetRegion.id,
          oldRegionRemovedAfterMerge: !regionsAfterMerge.some((region) => region.id === createdRegion.id),
          vehicleMovedToMergedRegion: vehicleAfterRegionMerge.region === mergedRegionName,
          regionClearedOnDelete: vehicleAfterRegionDelete.region === null,
          staleRegionIdFallbackUpdated: fallbackUpdatedRegion.name === fallbackRenamedRegionName,
          staleRegionIdOldNameRemoved: !regionsAfterFallbackUpdate.some((region) => region.name === fallbackRegionName),
          inspectionId: inspection.id,
          listedInspections: Array.isArray(vehicleInspections?.data) ? vehicleInspections.data.length : 0,
          listedDefects: vehicleInspections?.data?.[0]?.defects_count ?? null,
          historyEntries: Array.isArray(history) ? history.length : 0,
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
