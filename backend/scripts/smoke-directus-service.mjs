import process from 'node:process'
import fs from 'node:fs/promises'

process.env.DIRECTUS_URL = 'http://directus.test'
process.env.DIRECTUS_TOKEN = 'test-token'
process.env.DATABASE_PATH = `./.tmp-smoke/smoke-directus-service-${process.pid}.sqlite`

const requests = []
const existingByKey = new Map()
const collectionData = new Map([
  ['companies', [
    {
      id: 'directus-company-1',
      slug: 'directus-company-1',
      name: 'Directus Company 1',
      country: 'RU',
      region: 'RU-SAK',
      status: 'active',
    },
  ]],
  ['company_owners', [
    {
      id: 'directus-owner-1',
      company_id: 'directus-company-1',
      email: 'owner-directus@example.com',
      name: 'Directus Owner',
      status: 'active',
    },
  ]],
  ['company_limits', [
    {
      id: 'directus-limit-1',
      company_id: 'directus-company-1',
      plan_code: 'pilot',
      max_vehicles: 12,
      max_users: 4,
      max_storage_mb: 1024,
      ocr_enabled: true,
      accident_module_enabled: true,
      analytics_enabled: true,
      api_access_enabled: false,
      updated_at: '2026-05-20T00:00:00.000Z',
    },
  ]],
])

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  }
}

function parseBody(options) {
  if (!options?.body) return null
  return typeof options.body === 'string' ? JSON.parse(options.body) : options.body
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

global.fetch = async (url, options = {}) => {
  const parsedUrl = new URL(url)
  const method = options.method || 'GET'
  const body = parseBody(options)
  const authorization = options.headers?.Authorization

  requests.push({
    method,
    pathname: parsedUrl.pathname,
    search: parsedUrl.search,
    body,
    authorization,
  })

  if (authorization !== 'Bearer test-token') {
    return jsonResponse({ errors: [{ message: 'Unauthorized' }] }, 401)
  }

  if (method === 'GET' && parsedUrl.pathname.startsWith('/items/')) {
    const collection = parsedUrl.pathname.split('/').at(-1)
    const filterEntry = [...parsedUrl.searchParams.entries()].find(([key]) => key.startsWith('filter['))
    const value = filterEntry?.[1]
    if (!filterEntry && collectionData.has(collection)) {
      return jsonResponse({ data: collectionData.get(collection) })
    }

    const existing = existingByKey.get(`${collection}:${value}`)

    return jsonResponse({ data: existing ? [existing] : [] })
  }

  if (method === 'POST' && parsedUrl.pathname.startsWith('/items/')) {
    const collection = parsedUrl.pathname.split('/').at(-1)
    const id = `${collection}-created`
    const sourceKey = body?.case_number || body?.source_photo_id || body?.source_defect_id || id
    existingByKey.set(`${collection}:${sourceKey}`, { id, ...body })

    return jsonResponse({ data: { id, ...body } }, 201)
  }

  if (method === 'PATCH' && parsedUrl.pathname.startsWith('/items/')) {
    const id = parsedUrl.pathname.split('/').at(-1)
    return jsonResponse({ data: { id, ...body } })
  }

  return jsonResponse({ errors: [{ message: `Unhandled mock request: ${method} ${parsedUrl.pathname}` }] }, 500)
}

const {
  isDirectusConfigured,
  upsertAccidentCaseByCaseNumber,
  upsertDamageBySourceDefectId,
  upsertPhotoMetadataBySourcePhotoId,
  listItems,
} = await import('../src/services/directus.js')
const { initDatabase, getDb } = await import('../src/db.js')
const { syncCompaniesAndOwnersFromDirectus } = await import('../src/routes/directus.js')

assert(isDirectusConfigured(), 'Directus service should be configured in smoke')

const listedCompanies = await listItems('companies', { limit: -1 })
assert(listedCompanies.length === 1, 'Directus listItems should return mocked companies')

const createdCase = await upsertAccidentCaseByCaseNumber({
  case_number: 'inspection-smoke-1',
  source_inspection_id: 'inspection-smoke-1',
  status: 'submitted',
})
assert(createdCase.action === 'created', 'Accident case should be created when no existing item is found')

const updatedCase = await upsertAccidentCaseByCaseNumber({
  case_number: 'inspection-smoke-1',
  source_inspection_id: 'inspection-smoke-1',
  status: 'review',
})
assert(updatedCase.action === 'updated', 'Accident case should be updated when case_number already exists')

const createdDamage = await upsertDamageBySourceDefectId({
  accident_case_id: 'case-1',
  source_inspection_id: 'inspection-smoke-1',
  source_defect_id: 'defect-smoke-1',
  vehicle_zone: 'Glass',
  description: 'Crack after accident',
})
assert(createdDamage.action === 'created', 'Damage should be created when source_defect_id is new')

const updatedDamage = await upsertDamageBySourceDefectId({
  accident_case_id: 'case-1',
  source_inspection_id: 'inspection-smoke-1',
  source_defect_id: 'defect-smoke-1',
  vehicle_zone: 'Glass',
  description: 'Updated crack description',
})
assert(updatedDamage.action === 'updated', 'Damage should be updated when source_defect_id already exists')

const createdPhoto = await upsertPhotoMetadataBySourcePhotoId({
  accident_case_id: 'case-1',
  damage_id: 'damage-1',
  source_inspection_id: 'inspection-smoke-1',
  source_defect_id: 'defect-smoke-1',
  source_photo_id: 'photo-smoke-1',
  type: 'defect',
  url: '/uploads/photo-smoke-1.jpg',
})
assert(createdPhoto.action === 'created', 'Photo should be created when source_photo_id is new')

const updatedPhoto = await upsertPhotoMetadataBySourcePhotoId({
  accident_case_id: 'case-1',
  damage_id: 'damage-1',
  source_inspection_id: 'inspection-smoke-1',
  source_defect_id: 'defect-smoke-1',
  source_photo_id: 'photo-smoke-1',
  type: 'defect',
  url: '/uploads/photo-smoke-1-updated.jpg',
})
assert(updatedPhoto.action === 'updated', 'Photo should be updated when source_photo_id already exists')

const patchRequests = requests.filter((request) => request.method === 'PATCH')
assert(patchRequests.length === 3, `Expected 3 PATCH requests, received ${patchRequests.length}`)
assert(
  requests.some((request) => request.search.includes('filter%5Bcase_number%5D%5B_eq%5D=inspection-smoke-1')),
  'Expected accident case lookup by case_number',
)
assert(
  requests.some((request) => request.search.includes('filter%5Bsource_defect_id%5D%5B_eq%5D=defect-smoke-1')),
  'Expected damage lookup by source_defect_id',
)
assert(
  requests.some((request) => request.search.includes('filter%5Bsource_photo_id%5D%5B_eq%5D=photo-smoke-1')),
  'Expected photo lookup by source_photo_id',
)

await initDatabase()
const provisioning = await syncCompaniesAndOwnersFromDirectus(getDb(), {
  issueSetupLinks: true,
  createOwnerSetupInvitation: (user) => ({
    token: `setup-token-${user.id}`,
    setup_url: `http://localhost:3002/owner-setup?token=setup-token-${user.id}`,
    expires_in: '7d',
  }),
})

const provisionedCompany = getDb().prepare('SELECT id, slug, name FROM companies WHERE id = ?').get('directus-company-1')
const provisionedOwner = getDb().prepare('SELECT email, role, status, company_id FROM users WHERE email = ?').get('owner-directus@example.com')
const provisionedLimit = getDb().prepare('SELECT company_id, plan_code, max_vehicles, max_users, ocr_enabled, api_access_enabled FROM company_limits WHERE company_id = ?').get('directus-company-1')

assert(provisioning.companies.some((item) => item.action === 'created' && item.id === 'directus-company-1'), 'Provisioning should create Directus company locally')
assert(provisioning.owners.some((item) => item.action === 'created' && item.email === 'owner-directus@example.com'), 'Provisioning should create Directus company owner locally')
assert(provisioning.company_limits.some((item) => item.action === 'created' && item.company_id === 'directus-company-1'), 'Provisioning should create Directus company limits locally')
assert(provisioning.setup_links.length === 1, 'Provisioning should issue setup link for owner')
assert(provisionedCompany?.slug === 'directus-company-1', 'Provisioned company should be readable from local DB')
assert(provisionedOwner?.role === 'owner' && provisionedOwner.company_id === 'directus-company-1', 'Provisioned owner should be local owner in the Directus company')
assert(provisionedLimit?.plan_code === 'pilot' && Number(provisionedLimit.max_vehicles) === 12, 'Provisioned limits should be readable from local DB')
assert(Number(provisionedLimit.ocr_enabled) === 1 && Number(provisionedLimit.api_access_enabled) === 0, 'Provisioned feature flags should be normalized to SQLite booleans')

await fs.rm(process.env.DATABASE_PATH, { force: true })

console.log(
  JSON.stringify(
    {
      ok: true,
      requests: requests.length,
      patchRequests: patchRequests.length,
      provisioningCompanies: provisioning.companies.length,
      provisioningOwners: provisioning.owners.length,
      provisioningLimits: provisioning.company_limits.length,
      setupLinks: provisioning.setup_links.length,
      created: ['accident_case', 'damage', 'photo'],
      updated: ['accident_case', 'damage', 'photo'],
    },
    null,
    2,
  ),
)
