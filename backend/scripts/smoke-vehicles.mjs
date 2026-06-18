import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import process from 'node:process'
import { seedSmokeTenantOwner } from './smoke-helpers.mjs'

const HOST = '127.0.0.1'
const PORT = Number(process.env.PORT || 3514 + (process.pid % 500))
const DATABASE_PATH = `./.tmp-smoke/smoke-vehicles-${process.pid}.sqlite`
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
        body: JSON.stringify({
          email: 'owner@example.com',
          password: 'owner123',
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
  const owner = await seedSmokeTenantOwner({ databasePath: DATABASE_PATH })

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
        email: owner.email,
        password: owner.password,
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
    if (created.inspection_schedule?.status !== 'never_inspected') {
      throw new Error(`New vehicle expected never_inspected schedule, got ${created.inspection_schedule?.status}`)
    }

    const updatedSettings = await request('/api/settings', {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        default_quick_inspection_interval_days: 5,
        default_planned_inspection_interval_days: 21,
        notification_days_before: 4,
      }),
    })
    if (
      updatedSettings.default_quick_inspection_interval_days !== 5
      || updatedSettings.default_planned_inspection_interval_days !== 21
    ) {
      throw new Error('Company inspection schedule settings were not persisted')
    }

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
        quick_inspection_interval_days: 3,
        planned_inspection_interval_days: 14,
      }),
    })
    if (
      updated.inspection_schedule?.quick?.interval_days !== 3
      || updated.inspection_schedule?.planned?.interval_days !== 14
    ) {
      throw new Error('Vehicle inspection schedule overrides were not applied')
    }

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

    const defect = await request(`/api/inspections/${inspection.id}/defects`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: 'Smoke vehicle list defect',
        comment: 'Created to verify aggregated defect counts',
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

    const archivePlateOne = `А${String((suffix + 1) % 1000).padStart(3, '0')}МС${String((suffix % 900) + 100)}`
    const archivePlateTwo = `А${String((suffix + 2) % 1000).padStart(3, '0')}НХ${String((suffix % 900) + 100)}`
    const archiveVehicleOne = await request('/api/vehicles', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        number: archivePlateOne,
        name: `Smoke Archive Vehicle 1 ${suffix}`,
        status: 'active',
      }),
    })
    const archiveVehicleTwo = await request('/api/vehicles', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        number: archivePlateTwo,
        name: `Smoke Archive Vehicle 2 ${suffix}`,
        status: 'repair',
      }),
    })

    const archiveResult = await request('/api/vehicles/archive', {
      method: 'POST',
      headers,
      body: JSON.stringify({ ids: [archiveVehicleOne.id, archiveVehicleTwo.id] }),
    })

    const vehiclesDefaultList = await request('/api/vehicles?limit=100', {
      headers: { Authorization: `Bearer ${login.token}` },
    })
    const neverInspectedVehicles = await request('/api/vehicles?inspection_status=never_inspected&limit=100', {
      headers: { Authorization: `Bearer ${login.token}` },
    })
    const createdVehicleListItem = vehiclesDefaultList.data.find((vehicle) => vehicle.id === created.id)
    if (!createdVehicleListItem) {
      throw new Error('Created vehicle is missing from default vehicle list')
    }
    if (createdVehicleListItem.lastInspection?.id !== inspection.id) {
      throw new Error('Vehicle list did not include the latest inspection id')
    }
    if (createdVehicleListItem.defectsCount !== 1) {
      throw new Error(`Vehicle list expected defectsCount=1 but got ${createdVehicleListItem.defectsCount}`)
    }
    const vehiclesArchiveList = await request('/api/vehicles?status=archived&limit=100', {
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
          archivedVehicles: archiveResult.archived,
          archivedHiddenFromDefaultList: !vehiclesDefaultList.data.some((vehicle) => archiveResult.ids.includes(vehicle.id)),
          archivedVisibleInArchiveFilter: archiveResult.ids.every((id) => vehiclesArchiveList.data.some((vehicle) => vehicle.id === id && vehicle.status === 'archived')),
          listLastInspectionId: createdVehicleListItem.lastInspection?.id ?? null,
          listDefectsCount: createdVehicleListItem.defectsCount,
          scheduleStatus: createdVehicleListItem.inspection_schedule?.status ?? null,
          scheduleOverridesApplied:
            updated.inspection_schedule?.quick?.interval_days === 3
            && updated.inspection_schedule?.planned?.interval_days === 14,
          neverInspectedFilterMatched: neverInspectedVehicles.data.some((vehicle) => vehicle.id === created.id),
          staleRegionIdFallbackUpdated: fallbackUpdatedRegion.name === fallbackRenamedRegionName,
          staleRegionIdOldNameRemoved: !regionsAfterFallbackUpdate.some((region) => region.name === fallbackRegionName),
          inspectionId: inspection.id,
          defectId: defect.id,
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
