import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import process from 'node:process'

const HOST = '127.0.0.1'
const PORT = Number(process.env.PORT || 4015 + (process.pid % 500))
const DATABASE_PATH = `./.tmp-smoke/smoke-inspections-${process.pid}.sqlite`
const BASE_URL = `http://${HOST}:${PORT}`
const VALID_PNG_BYTES = Uint8Array.from(Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64',
))

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

async function uploadInspectionPhoto(inspectionId, photoType, headers) {
  const formData = new FormData()
  formData.append('photo', new Blob([VALID_PNG_BYTES], { type: 'image/png' }), `${photoType}.png`)
  formData.append('photo_type', photoType)

  return request(`/api/inspections/${inspectionId}/photos`, {
    method: 'POST',
    headers,
    body: formData,
  }, 201)
}

async function uploadDefectPhoto(defectId, headers) {
  const formData = new FormData()
  formData.append('photo', new Blob([VALID_PNG_BYTES], { type: 'image/png' }), 'defect.png')

  return request(`/api/defects/${defectId}/photos`, {
    method: 'POST',
    headers,
    body: formData,
  }, 201)
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
          { title: 'Body', result: true, comment: '' },
          { title: 'Glass', result: false, comment: 'Initial crack' },
        ],
        accident_occurred_at: '2026-05-01T10:15:00.000Z',
        accident_location: 'Smoke route',
      }),
    })

    const inspectionDetails = await request(`/api/inspections/${inspection.id}`, {
      headers: authHeaders,
    })
    const originalDefect = inspectionDetails.defects?.[0]
    const bodyChecklistItem = inspectionDetails.checklist_items?.[0]
    const failedChecklistItem = inspectionDetails.checklist_items?.find((item) => item.result === 0)

    if (!originalDefect || !bodyChecklistItem || !failedChecklistItem) {
      throw new Error('Expected checklist items and a defect after saving failed checklist item')
    }

    const uploadedDefectPhoto = await uploadDefectPhoto(originalDefect.id, authHeaders)
    if (!uploadedDefectPhoto.webp_url?.endsWith('/main.webp') || !uploadedDefectPhoto.thumb_url?.endsWith('/thumb.webp') || !uploadedDefectPhoto.original_url?.endsWith('/original.png')) {
      throw new Error(`Defect photo WebP metadata is incomplete: ${JSON.stringify(uploadedDefectPhoto)}`)
    }

    await request(`/api/inspections/${inspection.id}`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({
        checklist: [
          { id: bodyChecklistItem.id, title: bodyChecklistItem.title, result: true, comment: '' },
          { id: failedChecklistItem.id, title: failedChecklistItem.title, result: false, comment: 'Repeat check' },
        ],
        accident_occurred_at: '2026-05-01T10:15:00.000Z',
        accident_location: 'Smoke route',
      }),
    })

    const repeatedInspectionDetails = await request(`/api/inspections/${inspection.id}`, {
      headers: authHeaders,
    })
    const repeatedDefect = repeatedInspectionDetails.defects?.find((defect) => defect.id === originalDefect.id)

    if (!repeatedDefect || repeatedDefect.id !== originalDefect.id) {
      throw new Error('Defect was recreated instead of updated in place on repeated save')
    }

    if (!repeatedDefect.photos?.some((photo) => photo.id === uploadedDefectPhoto.id)) {
      throw new Error('Defect photo was lost on repeated save')
    }

    if (repeatedDefect.comment !== 'Repeat check') {
      throw new Error('Defect comment was not updated on repeated save')
    }

    const quickInspection = await request('/api/inspections', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        vehicle_id: vehicle.id,
        type: 'quick',
        checklist: [],
      }),
    }, 201)

    await request(`/api/inspections/${quickInspection.id}`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({
        checklist: [],
        odometer_value: 123456,
        odometer_unit: 'km',
      }),
    })

    const uploadedInspectionPhoto = await uploadInspectionPhoto(quickInspection.id, 'front', authHeaders)
    if (!uploadedInspectionPhoto.webp_url?.endsWith('/main.webp') || !uploadedInspectionPhoto.thumb_url?.endsWith('/thumb.webp') || !uploadedInspectionPhoto.original_url?.endsWith('/original.png')) {
      throw new Error(`Inspection photo WebP metadata is incomplete: ${JSON.stringify(uploadedInspectionPhoto)}`)
    }

    const incompleteCompletion = await fetch(`${BASE_URL}/api/inspections/${quickInspection.id}/complete`, {
      method: 'POST',
      headers: authHeaders,
    })

    if (incompleteCompletion.status !== 400) {
      const body = await incompleteCompletion.text()
      throw new Error(`Required photo validation failed: expected 400, got ${incompleteCompletion.status}: ${body}`)
    }

    const incompleteBody = await incompleteCompletion.json()
    if (!Array.isArray(incompleteBody.missingPhotos) || !incompleteBody.missingPhotos.includes('odometer')) {
      throw new Error(`Required photo validation did not return missing photo types: ${JSON.stringify(incompleteBody)}`)
    }

    for (const photoType of ['left', 'right', 'rear', 'overview', 'odometer']) {
      await uploadInspectionPhoto(quickInspection.id, photoType, authHeaders)
    }

    const completedQuickInspection = await request(`/api/inspections/${quickInspection.id}/complete`, {
      method: 'POST',
      headers: authHeaders,
    })

    const firstDefectId = repeatedInspectionDetails.defects?.[0]?.id
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
          requiredPhotoMissingCount: incompleteBody.missingPhotos.length,
          quickInspectionCompleted: Boolean(completedQuickInspection.completed),
          defectInspectionType: defectDetails?.inspection_type ?? null,
          defectAccidentLocation: defectDetails?.accident_location ?? null,
          repeatedSavePreservedDefectId: repeatedDefect.id === originalDefect.id,
          repeatedSavePreservedPhoto: repeatedDefect.photos.some((photo) => photo.id === uploadedDefectPhoto.id),
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
