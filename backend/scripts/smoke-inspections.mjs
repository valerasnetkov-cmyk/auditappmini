import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import process from 'node:process'
import { seedSmokeTenantOwner } from './smoke-helpers.mjs'

const HOST = '127.0.0.1'
const PORT = Number(process.env.PORT || 4015 + (process.pid % 500))
const DATABASE_PATH = `./.tmp-smoke/smoke-inspections-${process.pid}.sqlite`
const UPLOAD_DIR = `./.tmp-smoke/uploads-inspections-${process.pid}`
const JWT_SECRET = crypto.randomBytes(32).toString('hex')
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

function uploadUrlToFilePath(url) {
  if (typeof url !== 'string' || !url.startsWith('/uploads/')) return null
  return path.resolve(process.cwd(), UPLOAD_DIR, url.slice('/uploads/'.length))
}

async function assertPhotoFilesExist(photo, label) {
  const urls = new Set([photo.url, photo.original_url, photo.webp_url, photo.thumb_url].filter(Boolean))
  for (const url of urls) {
    const filePath = uploadUrlToFilePath(url)
    if (!filePath) continue
    try {
      await fs.access(filePath)
    } catch {
      throw new Error(`${label} expected photo file to exist: ${filePath}`)
    }
  }
}

async function assertPhotoFilesRemoved(photo, label) {
  const urls = new Set([photo.url, photo.original_url, photo.webp_url, photo.thumb_url].filter(Boolean))
  for (const url of urls) {
    const filePath = uploadUrlToFilePath(url)
    if (!filePath) continue
    try {
      await fs.access(filePath)
      throw new Error(`${label} expected photo file to be removed: ${filePath}`)
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
  }
}

async function uploadInspectionPhoto(inspectionId, photoType, headers, clientPhotoId = null, expectedStatus = 201) {
  const formData = new FormData()
  formData.append('photo', new Blob([VALID_PNG_BYTES], { type: 'image/png' }), `${photoType}.png`)
  formData.append('photo_type', photoType)
  if (clientPhotoId) formData.append('client_photo_id', clientPhotoId)
  formData.append('captured_at', '2026-05-01T10:20:00.000Z')
  formData.append('captured_lat', '46.9591')
  formData.append('captured_lng', '142.7380')

  return request(`/api/inspections/${inspectionId}/photos`, {
    method: 'POST',
    headers,
    body: formData,
  }, expectedStatus)
}

async function uploadInvalidInspectionPhoto(inspectionId, headers) {
  const formData = new FormData()
  formData.append('photo', new Blob([Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')], { type: 'image/png' }), 'polyglot.png')
  formData.append('photo_type', 'front')

  const response = await fetch(`${BASE_URL}/api/inspections/${inspectionId}/photos`, {
    method: 'POST',
    headers,
    body: formData,
  })

  if (response.status !== 400) {
    const body = await response.text()
    throw new Error(`Invalid photo content expected 400 but got ${response.status}: ${body}`)
  }

  return response.status
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
  const owner = await seedSmokeTenantOwner({ databasePath: DATABASE_PATH })
  const otherOwner = await seedSmokeTenantOwner({
    databasePath: DATABASE_PATH,
    email: 'other-owner@example.com',
    password: 'other-owner123',
    companyId: 'other-company',
    name: 'Other Owner',
  })

  const server = spawn(process.execPath, ['src/server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(PORT), DATABASE_PATH, UPLOAD_DIR, JWT_SECRET, WEB_APP_URL: BASE_URL },
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

    const authHeaders = { Authorization: `Bearer ${login.token}` }
    const jsonHeaders = { ...authHeaders, 'Content-Type': 'application/json' }
    const suffix = Date.now()
    const inspectorEmail = `inspection-approver-${suffix}@example.com`
    await request('/api/users', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        email: inspectorEmail,
        password: 'inspection-smoke-123',
        name: 'Inspection approval smoke inspector',
        role: 'inspector',
      }),
    }, 201)
    const inspectorLogin = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: inspectorEmail,
        password: 'inspection-smoke-123',
      }),
    })
    const inspectorHeaders = {
      Authorization: `Bearer ${inspectorLogin.token}`,
      'Content-Type': 'application/json',
    }
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
    await assertPhotoFilesExist(uploadedDefectPhoto, 'uploaded defect photo')

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

    const criticalDefect = await request(`/api/inspections/${inspection.id}/defects`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        title: 'Smoke critical defect',
        comment: 'Requires manager attention',
        severity: 'critical',
      }),
    }, 201)
    const usageWithCriticalAlert = await request('/api/company/usage', {
      headers: authHeaders,
    })
    if (!usageWithCriticalAlert.alerts?.some((item) => item.type === 'critical_defect_created')) {
      throw new Error('Critical defect notification was not delivered to company owner')
    }

    const quickInspection = await request('/api/inspections', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        vehicle_id: vehicle.id,
        type: 'quick',
        checklist: [],
        client_inspection_id: `quick-${suffix}`,
        sync_source: 'mobile',
      }),
    }, 201)

    const repeatedQuickInspection = await request('/api/inspections', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        vehicle_id: vehicle.id,
        type: 'quick',
        checklist: [],
        client_inspection_id: `quick-${suffix}`,
        sync_source: 'mobile',
      }),
    })
    if (repeatedQuickInspection.id !== quickInspection.id) {
      throw new Error('Repeated client_inspection_id created a duplicate inspection')
    }

    await request(`/api/inspections/${quickInspection.id}`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({
        checklist: [
          { title: 'Внешний вид', result: true, comment: '' },
          { title: 'Повреждения кузова', result: true, comment: '' },
          { title: 'Колёса', result: true, comment: '' },
          { title: 'Стёкла', result: true, comment: '' },
          { title: 'Госномер', result: true, comment: '' },
        ],
        odometer_value: 123456,
        odometer_unit: 'km',
      }),
    })

    const uploadedInspectionPhoto = await uploadInspectionPhoto(
      quickInspection.id,
      'front',
      authHeaders,
      `front-${suffix}`,
    )
    if (!uploadedInspectionPhoto.webp_url?.endsWith('/main.webp') || !uploadedInspectionPhoto.thumb_url?.endsWith('/thumb.webp') || !uploadedInspectionPhoto.original_url?.endsWith('/original.png')) {
      throw new Error(`Inspection photo WebP metadata is incomplete: ${JSON.stringify(uploadedInspectionPhoto)}`)
    }
    await assertPhotoFilesExist(uploadedInspectionPhoto, 'uploaded inspection photo')
    const repeatedInspectionPhoto = await uploadInspectionPhoto(
      quickInspection.id,
      'front',
      authHeaders,
      `front-${suffix}`,
      200,
    )
    if (repeatedInspectionPhoto.id !== uploadedInspectionPhoto.id) {
      throw new Error('Repeated client_photo_id created a duplicate photo')
    }
    const invalidPhotoStatus = await uploadInvalidInspectionPhoto(quickInspection.id, authHeaders)

    const incompleteCompletion = await fetch(`${BASE_URL}/api/inspections/${quickInspection.id}/complete`, {
      method: 'POST',
      headers: authHeaders,
    })

    if (incompleteCompletion.status !== 400) {
      const body = await incompleteCompletion.text()
      throw new Error(`Required photo validation failed: expected 400, got ${incompleteCompletion.status}: ${body}`)
    }

    const incompleteBody = await incompleteCompletion.json()
    if (
      incompleteBody.error !== 'INSPECTION_COMPLETION_BLOCKED'
      || !Array.isArray(incompleteBody.missing)
      || !incompleteBody.missing.some((item) => item.code === 'missing_required_photo' && item.field === 'odometer')
    ) {
      throw new Error(`Structured completion validation is incomplete: ${JSON.stringify(incompleteBody)}`)
    }

    for (const photoType of ['left', 'right', 'rear', 'overview', 'odometer']) {
      await uploadInspectionPhoto(quickInspection.id, photoType, authHeaders)
    }

    const completedQuickInspection = await request(`/api/inspections/${quickInspection.id}/complete`, {
      method: 'POST',
      headers: authHeaders,
    })
    const completedMutation = await fetch(`${BASE_URL}/api/inspections/${quickInspection.id}`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({ checklist: [] }),
    })
    if (completedMutation.status !== 409) {
      throw new Error(`Completed inspection mutation expected 409, got ${completedMutation.status}`)
    }
    const report = await request(`/api/inspections/${quickInspection.id}/report`, {
      method: 'POST',
      headers: authHeaders,
    }, 201)
    if (report.status !== 'ready' || !report.sha256) {
      throw new Error(`Inspection report was not generated: ${JSON.stringify(report)}`)
    }
    if (!report.public_url?.startsWith(`${BASE_URL}/reports/public/`)) {
      throw new Error(`Inspection report public URL is missing: ${JSON.stringify(report)}`)
    }
    const verifiedReport = await request(`/api/inspections/${quickInspection.id}/report`, {
      headers: authHeaders,
    })
    if (verifiedReport.integrity_status !== 'valid' || verifiedReport.file_size < 1000) {
      throw new Error(`Inspection report integrity was not verified: ${JSON.stringify(verifiedReport)}`)
    }
    const reportPdf = await fetch(`${BASE_URL}/api/inspections/${quickInspection.id}/report.pdf`, {
      headers: authHeaders,
    })
    if (reportPdf.status !== 200 || reportPdf.headers.get('content-type') !== 'application/pdf') {
      throw new Error(`Inspection PDF expected 200 application/pdf, got ${reportPdf.status}`)
    }
    const reportBytes = new Uint8Array(await reportPdf.arrayBuffer())
    if (reportBytes.length < 1000) {
      throw new Error(`Inspection PDF is unexpectedly small: ${reportBytes.length}`)
    }
    const reportFilePath = path.resolve(
      process.cwd(),
      UPLOAD_DIR,
      'reports',
      'default',
      quickInspection.id,
      'report.pdf',
    )
    await fs.appendFile(reportFilePath, Buffer.from('tampered'))
    const corruptedReport = await request(`/api/inspections/${quickInspection.id}/report`, {
      headers: authHeaders,
    })
    if (corruptedReport.status !== 'corrupted' || corruptedReport.integrity_status !== 'mismatch') {
      throw new Error(`Tampered report was not detected: ${JSON.stringify(corruptedReport)}`)
    }
    const corruptedDownload = await fetch(`${BASE_URL}/api/inspections/${quickInspection.id}/report.pdf`, {
      headers: authHeaders,
    })
    if (corruptedDownload.status !== 409) {
      throw new Error(`Tampered report download expected 409, got ${corruptedDownload.status}`)
    }
    const regeneratedReports = await Promise.all([
      request(`/api/inspections/${quickInspection.id}/report`, {
        method: 'POST',
        headers: authHeaders,
      }, 201),
      request(`/api/inspections/${quickInspection.id}/report`, {
        method: 'POST',
        headers: authHeaders,
      }, 201),
    ])
    if (regeneratedReports.some((item) => item.integrity_status !== 'valid')) {
      throw new Error(`Concurrent report regeneration failed: ${JSON.stringify(regeneratedReports)}`)
    }
    const regeneratedReport = await request(`/api/inspections/${quickInspection.id}/report`, {
      headers: authHeaders,
    })
    if (regeneratedReport.integrity_status !== 'valid' || regeneratedReport.status !== 'ready') {
      throw new Error(`Regenerated report integrity failed: ${JSON.stringify(regeneratedReport)}`)
    }
    const publicReportToken = String(regeneratedReport.public_url || '').split('/reports/public/')[1]
    if (!publicReportToken) {
      throw new Error(`Regenerated report public URL is missing: ${JSON.stringify(regeneratedReport)}`)
    }
    const publicReport = await request(`/api/reports/public/${publicReportToken}`)
    if (
      publicReport.integrity_status !== 'valid'
      || publicReport.status !== 'ready'
      || publicReport.inspection?.id !== quickInspection.id
      || publicReport.pdf_url !== null
      || publicReport.public_pdf_enabled !== false
    ) {
      throw new Error(`Public report metadata is incomplete: ${JSON.stringify(publicReport)}`)
    }
    const publicReportPdf = await fetch(`${BASE_URL}/api/reports/public/${publicReportToken}.pdf`)
    if (publicReportPdf.status !== 403) {
      throw new Error(`Public report PDF expected 403 before opt-in, got ${publicReportPdf.status}`)
    }
    const enabledPublicReport = await request(`/api/inspections/${quickInspection.id}/report/public-access`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({ public_pdf_enabled: true }),
    })
    if (!enabledPublicReport.public_pdf_enabled) {
      throw new Error(`Public PDF opt-in was not persisted: ${JSON.stringify(enabledPublicReport)}`)
    }
    const publicReportAfterOptIn = await request(`/api/reports/public/${publicReportToken}`)
    if (publicReportAfterOptIn.pdf_url !== `/api/reports/public/${publicReportToken}.pdf`) {
      throw new Error(`Public report PDF URL was not exposed after opt-in: ${JSON.stringify(publicReportAfterOptIn)}`)
    }
    const publicReportPdfAfterOptIn = await fetch(`${BASE_URL}/api/reports/public/${publicReportToken}.pdf`)
    if (publicReportPdfAfterOptIn.status !== 200 || publicReportPdfAfterOptIn.headers.get('content-type') !== 'application/pdf') {
      throw new Error(`Public report PDF expected 200 application/pdf after opt-in, got ${publicReportPdfAfterOptIn.status}`)
    }
    await request(`/api/inspections/${quickInspection.id}/report/public-access`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({ public_token_expires_at: '2000-01-01T00:00:00.000Z' }),
    })
    const expiredPublicReport = await fetch(`${BASE_URL}/api/reports/public/${publicReportToken}`)
    if (expiredPublicReport.status !== 404) {
      throw new Error(`Expired public report expected 404, got ${expiredPublicReport.status}`)
    }
    const submittedApproval = await request(`/api/inspections/${quickInspection.id}/submit`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ comment: 'Готово к проверке' }),
    })
    if (submittedApproval.status !== 'submitted' || submittedApproval.history.length !== 1) {
      throw new Error(`Inspection was not submitted for approval: ${JSON.stringify(submittedApproval)}`)
    }
    const usageAfterSubmission = await request('/api/company/usage', {
      headers: authHeaders,
    })
    if (!usageAfterSubmission.alerts?.some((item) => item.type === 'inspection_submitted')) {
      throw new Error(`Approval notification was not delivered: ${JSON.stringify(usageAfterSubmission)}`)
    }
    const inspectorDecision = await fetch(`${BASE_URL}/api/inspections/${quickInspection.id}/approval`, {
      method: 'POST',
      headers: inspectorHeaders,
      body: JSON.stringify({ status: 'approved' }),
    })
    if (inspectorDecision.status !== 403) {
      throw new Error(`Inspector approval decision expected 403, got ${inspectorDecision.status}`)
    }
    const missingRevisionReason = await fetch(`${BASE_URL}/api/inspections/${quickInspection.id}/approval`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ status: 'revision_required' }),
    })
    if (missingRevisionReason.status !== 400) {
      throw new Error(`Revision without reason expected 400, got ${missingRevisionReason.status}`)
    }
    const revisionApproval = await request(`/api/inspections/${quickInspection.id}/approval`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        status: 'revision_required',
        comment: 'Требуется повторная фиксация спорного ракурса новым осмотром',
      }),
    })
    if (revisionApproval.status !== 'revision_required' || revisionApproval.history.length !== 2) {
      throw new Error(`Inspection revision decision failed: ${JSON.stringify(revisionApproval)}`)
    }
    await request(`/api/inspections/${quickInspection.id}/submit`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ comment: 'Повторно направлено после проверки материалов' }),
    })
    const approvedInspection = await request(`/api/inspections/${quickInspection.id}/approval`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ status: 'approved', comment: 'Материалы приняты' }),
    })
    if (approvedInspection.status !== 'approved' || approvedInspection.history.length !== 4) {
      throw new Error(`Inspection approval failed: ${JSON.stringify(approvedInspection)}`)
    }
    const approvalDetails = await request(`/api/inspections/${quickInspection.id}/approval`, {
      headers: authHeaders,
    })
    if (approvalDetails.status !== 'approved' || approvalDetails.history.length !== 4) {
      throw new Error(`Inspection approval history is incomplete: ${JSON.stringify(approvalDetails)}`)
    }
    const otherLogin = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: otherOwner.email,
        password: otherOwner.password,
      }),
    })
    const crossTenantReport = await fetch(`${BASE_URL}/api/inspections/${quickInspection.id}/report.pdf`, {
      headers: { Authorization: `Bearer ${otherLogin.token}` },
    })
    if (crossTenantReport.status !== 404) {
      throw new Error(`Cross-tenant report access expected 404, got ${crossTenantReport.status}`)
    }
    const crossTenantApproval = await fetch(`${BASE_URL}/api/inspections/${quickInspection.id}/approval`, {
      headers: { Authorization: `Bearer ${otherLogin.token}` },
    })
    if (crossTenantApproval.status !== 404) {
      throw new Error(`Cross-tenant approval access expected 404, got ${crossTenantApproval.status}`)
    }

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

    const closeDefectResult = await request(`/api/defects/${originalDefect.id}/close`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ comment: 'Smoke defect closed' }),
    })
    await request(`/api/defects/${originalDefect.id}/reopen`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ comment: 'Smoke defect returned' }),
    })
    await request(`/api/defects/${originalDefect.id}/status`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ status: 'in_progress', comment: 'Smoke repair started' }),
    })
    await request(`/api/defects/${originalDefect.id}/status`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ status: 'resolved', comment: 'Smoke repair completed' }),
    })
    const lifecycleClosedDefect = await request(`/api/defects/${originalDefect.id}/status`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ status: 'closed', comment: 'Smoke result verified' }),
    })
    const defectLifecycleHistory = await request(`/api/defects/${originalDefect.id}/history`, {
      headers: authHeaders,
    })

    const vehicleDefectsAfterClose = await request(`/api/vehicles/${vehicle.id}/defects?limit=10`, {
      headers: authHeaders,
    })
    const defectDetailsAfterClose = await request(`/api/defects/${originalDefect.id}`, {
      headers: authHeaders,
    })
    const closedVehicleDefect = Array.isArray(vehicleDefectsAfterClose)
      ? vehicleDefectsAfterClose.find((defect) => defect.id === originalDefect.id)
      : null

    if (closeDefectResult.status !== 'closed' || lifecycleClosedDefect.status !== 'closed' || closedVehicleDefect?.status !== 'closed' || !closedVehicleDefect?.closed_at) {
      throw new Error(`Vehicle defect endpoint did not return closed status after close: ${JSON.stringify(closedVehicleDefect)}`)
    }
    if (defectLifecycleHistory.length !== 5 || !defectLifecycleHistory.every((item) => item.comment)) {
      throw new Error(`Defect lifecycle history is incomplete: ${JSON.stringify(defectLifecycleHistory)}`)
    }

    if (defectDetailsAfterClose.status !== 'closed' || !defectDetailsAfterClose.closed_at) {
      throw new Error(`Defect detail endpoint did not return closed status after close: ${JSON.stringify(defectDetailsAfterClose)}`)
    }

    await request(`/api/inspections/${inspection.id}`, {
      method: 'DELETE',
      headers: authHeaders,
    }, 204)
    await assertPhotoFilesRemoved(uploadedDefectPhoto, 'deleted inspection defect photo')

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
          vehicleDefectCloseReflected: closedVehicleDefect?.status === 'closed',
          defectDetailCloseReflected: defectDetailsAfterClose.status === 'closed',
          defectLifecycleCompleted: lifecycleClosedDefect.status === 'closed',
          defectLifecycleHistoryEntries: defectLifecycleHistory.length,
          criticalDefectNotificationDelivered: Boolean(
            criticalDefect.id
            && usageWithCriticalAlert.alerts?.some((item) => item.type === 'critical_defect_created')
          ),
          accidentValidationStatus: invalidAccidentInspectionResponse.status,
          requiredPhotoMissingCount: incompleteBody.missing.filter((item) => item.code === 'missing_required_photo').length,
          invalidPhotoRejected: invalidPhotoStatus === 400,
          quickInspectionCompleted: Boolean(completedQuickInspection.completed),
          idempotentInspection: repeatedQuickInspection.id === quickInspection.id,
          idempotentPhoto: repeatedInspectionPhoto.id === uploadedInspectionPhoto.id,
          completedMutationBlocked: completedMutation.status === 409,
          reportGenerated: report.status === 'ready',
          reportIntegrityVerified: regeneratedReport.integrity_status === 'valid',
          reportTamperingDetected: corruptedReport.integrity_status === 'mismatch',
          publicReportVerified: publicReport.integrity_status === 'valid',
          publicReportPdfBlockedByDefault: publicReportPdf.status === 403,
          publicReportPdfAvailableAfterOptIn: publicReportPdfAfterOptIn.status === 200,
          reportTenantIsolation: crossTenantReport.status === 404,
          approvalWorkflowCompleted: approvalDetails.status === 'approved',
          approvalNotificationDelivered: usageAfterSubmission.alerts.some(
            (item) => item.type === 'inspection_submitted',
          ),
          approvalTenantIsolation: crossTenantApproval.status === 404,
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
    await fs.rm(UPLOAD_DIR, { recursive: true, force: true })
    if (stderr.trim()) {
      console.error(stderr.trim())
      stderr = ''
    }
  }

  if (stderr.trim()) {
    console.error(stderr.trim())
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
