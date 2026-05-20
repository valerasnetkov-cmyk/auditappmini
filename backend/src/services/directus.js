const DEFAULT_DIRECTUS_URL = 'http://localhost:8055'

function getDirectusUrl() {
  return (process.env.DIRECTUS_URL || DEFAULT_DIRECTUS_URL).replace(/\/+$/, '')
}

function getDirectusToken() {
  return process.env.DIRECTUS_TOKEN || ''
}

function toRequestBody(body) {
  if (body === undefined || body === null || typeof body === 'string') {
    return body
  }

  return JSON.stringify(body)
}

async function parseDirectusResponse(response) {
  const text = await response.text()

  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export function isDirectusConfigured() {
  return Boolean(getDirectusUrl() && getDirectusToken())
}

export async function directusRequest(path, options = {}) {
  const token = getDirectusToken()

  if (!token) {
    throw new Error('Directus service token is not configured')
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const body = toRequestBody(options.body)
  const headers = {
    ...(body ? { 'Content-Type': 'application/json' } : {}),
    Authorization: `Bearer ${token}`,
    ...(options.headers || {}),
  }

  const response = await fetch(`${getDirectusUrl()}${normalizedPath}`, {
    ...options,
    body,
    headers,
  })
  const payload = await parseDirectusResponse(response)

  if (!response.ok) {
    const message =
      payload?.errors?.[0]?.message ||
      payload?.error ||
      `Directus request failed with status ${response.status}`

    throw new Error(message)
  }

  return payload
}

export function createItem(collection, payload) {
  return directusRequest(`/items/${encodeURIComponent(collection)}`, {
    method: 'POST',
    body: payload,
  })
}

export function updateItem(collection, id, payload) {
  return directusRequest(`/items/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: payload,
  })
}

export async function listItems(collection, params = {}) {
  const query = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    query.set(key, String(value))
  })

  const suffix = query.toString() ? `?${query.toString()}` : ''
  const response = await directusRequest(`/items/${encodeURIComponent(collection)}${suffix}`)

  return response?.data || []
}

export async function findItemByField(collection, field, value) {
  const query = new URLSearchParams({
    [`filter[${field}][_eq]`]: value,
    limit: '1',
  })
  const response = await directusRequest(`/items/${encodeURIComponent(collection)}?${query.toString()}`)

  return response?.data?.[0] || null
}

export async function upsertItemByField(collection, field, value, payload) {
  if (!value) {
    throw new Error(`Directus upsert for ${collection} requires ${field}`)
  }

  const existing = await findItemByField(collection, field, value)

  if (existing?.id) {
    const response = await updateItem(collection, existing.id, payload)
    return {
      action: 'updated',
      data: response?.data || response,
    }
  }

  const response = await createItem(collection, payload)
  return {
    action: 'created',
    data: response?.data || response,
  }
}

export function createAccidentCase(payload) {
  return createItem('accident_cases', payload)
}

export async function findAccidentCaseByCaseNumber(caseNumber) {
  return findItemByField('accident_cases', 'case_number', caseNumber)
}

export function getAccidentCase(id) {
  return directusRequest(`/items/accident_cases/${encodeURIComponent(id)}`)
}

export function updateAccidentCase(id, payload) {
  return updateItem('accident_cases', id, payload)
}

export async function upsertAccidentCaseByCaseNumber(payload) {
  if (!payload?.case_number) {
    throw new Error('Directus accident case payload must contain case_number')
  }

  const existing = await findAccidentCaseByCaseNumber(payload.case_number)

  if (existing?.id) {
    const response = await updateAccidentCase(existing.id, payload)
    return {
      action: 'updated',
      data: response?.data || response,
    }
  }

  const response = await createAccidentCase(payload)
  return {
    action: 'created',
    data: response?.data || response,
  }
}

export function createPhotoMetadata(payload) {
  return createItem('photos', payload)
}

export function upsertPhotoMetadataBySourcePhotoId(payload) {
  return upsertItemByField('photos', 'source_photo_id', payload.source_photo_id, payload)
}

export function createDamage(payload) {
  return createItem('damages', payload)
}

export function upsertDamageBySourceDefectId(payload) {
  return upsertItemByField('damages', 'source_defect_id', payload.source_defect_id, payload)
}

export function createFraudCheck(payload) {
  return createItem('fraud_checks', payload)
}
