import { type APIRequestContext, type APIResponse, type Page } from '@playwright/test'

export const WEB_BASE = process.env.BASE_URL || 'http://localhost:3002'
export const API_BASE = process.env.BACKEND_API_BASE || 'http://127.0.0.1:3001'

const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL || 'owner@example.com'
const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD || 'owner123'

let vehicleNumberCounter = 0

type JsonRecord = Record<string, unknown>

export type TestVehicle = {
  id: string
  number: string
  name: string
  status?: string
  region?: string | null
}

export type TestInspection = {
  id: string
  vehicle_id?: string
}

export type TestDefect = {
  id: string
  title: string
  status?: string
  closed_at?: string | null
}

export type TestUser = {
  id: string
  email: string
  name: string
  role: string
}

export function apiHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : {}
}

function readString(record: JsonRecord, key: string) {
  const value = record[key]
  return typeof value === 'string' ? value : ''
}

async function readJsonResponse<T = unknown>(response: APIResponse): Promise<T> {
  return (await response.json()) as T
}

async function expectOk(response: APIResponse, label: string) {
  if (!response.ok()) {
    throw new Error(`${label} failed with HTTP ${response.status()}: ${await response.text()}`)
  }
}

export async function loginAsCompanyOwner(page: Page) {
  await page.goto(`${WEB_BASE}/login`)
  await page.fill('input[name="email"]', OWNER_EMAIL)
  await page.fill('input[name="password"]', OWNER_PASSWORD)

  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 }),
    page.click('button[type="submit"]'),
  ])
}

export async function loginAsAdmin(page: Page) {
  return loginAsCompanyOwner(page)
}

export async function getCompanyOwnerToken(request: APIRequestContext) {
  const response = await request.post(`${API_BASE}/api/auth/login`, {
    data: { email: OWNER_EMAIL, password: OWNER_PASSWORD },
  })

  await expectOk(response, 'Company owner login')
  const body = asRecord(await readJsonResponse(response))
  const token = readString(body, 'token')
  if (!token) throw new Error('Company owner login response does not contain token')

  return token
}

export async function getAdminToken(request: APIRequestContext) {
  return getCompanyOwnerToken(request)
}

export function makeVehicleNumber() {
  const allowedPairs = ['ВС', 'КМ', 'НО', 'РТ', 'СУ', 'ХЕ']
  const seed = Date.now() + vehicleNumberCounter + Math.floor(Math.random() * 100000)
  const number = String((seed % 900) + 100)
  const region = String((Math.floor(seed / 11) % 900) + 100)
  const pair = allowedPairs[vehicleNumberCounter % allowedPairs.length]
  vehicleNumberCounter += 1

  return `А${number}${pair}${region}`
}

export async function createVehicle(request: APIRequestContext, token: string, name: string): Promise<TestVehicle> {
  let lastError = ''

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const number = makeVehicleNumber()
    const response = await request.post(`${API_BASE}/api/vehicles`, {
      headers: apiHeaders(token),
      data: { number, name },
    })
    const bodyText = await response.text()

    if (response.ok()) {
      const body = asRecord(JSON.parse(bodyText) as unknown)
      const id = readString(body, 'id')
      if (!id) throw new Error(`Vehicle creation response does not contain id: ${bodyText}`)

      return {
        ...(body as TestVehicle),
        id,
        number: readString(body, 'number') || number,
        name: readString(body, 'name') || name,
      }
    }

    lastError = bodyText
    if (response.status() !== 400 || !bodyText.includes('already exists')) {
      throw new Error(`Vehicle creation failed with HTTP ${response.status()}: ${bodyText}`)
    }
  }

  throw new Error(`Vehicle creation failed after duplicate retries: ${lastError}`)
}

export async function createInspectionWithDefect(
  request: APIRequestContext,
  token: string,
  vehicleId: string,
  defectTitle: string,
  defectComment = 'Created by E2E',
) {
  const inspectionResponse = await request.post(`${API_BASE}/api/inspections`, {
    headers: apiHeaders(token),
    data: {
      vehicle_id: vehicleId,
      type: 'quick',
      checklist: [{ title: `Контроль: ${defectTitle}`, result: true }],
    },
  })
  await expectOk(inspectionResponse, 'Inspection creation')

  const inspectionBody = asRecord(await readJsonResponse(inspectionResponse))
  const inspectionId = readString(inspectionBody, 'id')
  if (!inspectionId) throw new Error('Inspection creation response does not contain id')

  const defectResponse = await request.post(`${API_BASE}/api/inspections/${inspectionId}/defects`, {
    headers: apiHeaders(token),
    data: { title: defectTitle, comment: defectComment },
  })
  await expectOk(defectResponse, 'Defect creation')

  const defectBody = asRecord(await readJsonResponse(defectResponse))
  const defectId = readString(defectBody, 'id')
  if (!defectId) throw new Error('Defect creation response does not contain id')

  return {
    inspection: { ...(inspectionBody as TestInspection), id: inspectionId },
    defect: {
      ...(defectBody as TestDefect),
      id: defectId,
      title: readString(defectBody, 'title') || defectTitle,
    },
  }
}

export async function getVehicleDefects(request: APIRequestContext, token: string, vehicleId: string) {
  const response = await request.get(`${API_BASE}/api/vehicles/${vehicleId}/defects?limit=20`, {
    headers: apiHeaders(token),
  })
  await expectOk(response, 'Vehicle defects loading')

  const body = await readJsonResponse(response)
  const bodyRecord = asRecord(body)
  const records: unknown[] = Array.isArray(body) ? body : Array.isArray(bodyRecord.data) ? bodyRecord.data : []

  return records
    .map((record) => asRecord(record))
    .filter((record) => readString(record, 'id'))
    .map((record) => ({
      ...(record as TestDefect),
      id: readString(record, 'id'),
      title: readString(record, 'title'),
    }))
}

export async function closeDefectByApi(request: APIRequestContext, token: string, defectId: string) {
  const response = await request.post(`${API_BASE}/api/defects/${defectId}/close`, {
    headers: apiHeaders(token),
    data: { comment: 'Closed by E2E' },
  })
  await expectOk(response, 'Defect close')
}

export async function reopenDefectByApi(request: APIRequestContext, token: string, defectId: string) {
  const response = await request.post(`${API_BASE}/api/defects/${defectId}/reopen`, {
    headers: apiHeaders(token),
    data: { comment: 'Reopened by E2E' },
  })
  await expectOk(response, 'Defect reopen')
}

export async function archiveVehicle(request: APIRequestContext, token: string, vehicleId?: string) {
  if (!vehicleId) return

  const response = await request.delete(`${API_BASE}/api/vehicles/${vehicleId}`, {
    headers: apiHeaders(token),
  })
  await expectOk(response, 'Vehicle archive')
}

export async function createUser(request: APIRequestContext, token: string, name: string, role = 'inspector') {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`
  const email = `e2e-${suffix}@example.com`
  const response = await request.post(`${API_BASE}/api/users`, {
    headers: apiHeaders(token),
    data: { email, password: 'e2e-user-123', name, role },
  })
  await expectOk(response, 'User creation')

  const body = asRecord(await readJsonResponse(response))
  const id = readString(body, 'id')
  if (!id) throw new Error('User creation response does not contain id')

  return {
    ...(body as TestUser),
    id,
    email: readString(body, 'email') || email,
    name: readString(body, 'name') || name,
    role: readString(body, 'role') || role,
  }
}

export async function deleteUser(request: APIRequestContext, token: string, userId?: string) {
  if (!userId) return

  const response = await request.delete(`${API_BASE}/api/users/${userId}`, {
    headers: apiHeaders(token),
  })
  await expectOk(response, 'User deletion')
}
