import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const directusDir = path.resolve(__dirname, '..')
const schemaPath = path.join(directusDir, 'schema', 'mvp-schema.json')
const args = new Set(process.argv.slice(2))
const dryRun = args.has('--dry-run') || args.has('--check')

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {}

  return Object.fromEntries(
    fs
      .readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=')
        const key = line.slice(0, index).trim()
        const value = line.slice(index + 1).trim().replace(/^["']|["']$/g, '')
        return [key, value]
      }),
  )
}

const env = {
  ...readEnvFile(path.join(directusDir, '.env')),
  ...process.env,
}

const directusUrl = (env.DIRECTUS_URL || env.DIRECTUS_PUBLIC_URL || 'http://localhost:8055').replace(/\/+$/, '')
const adminEmail = env.DIRECTUS_ADMIN_EMAIL
const adminPassword = env.DIRECTUS_ADMIN_PASSWORD
const staticToken = env.DIRECTUS_TOKEN || env.DIRECTUS_ACCESS_TOKEN

function fieldInterface(field) {
  if (field.options?.length) return 'select-dropdown'

  return {
    boolean: 'boolean',
    date: 'datetime',
    datetime: 'datetime',
    decimal: 'input',
    integer: 'input',
    json: 'input-code',
    string: 'input',
    text: 'input-multiline',
    time: 'datetime',
    uuid: 'input',
  }[field.type] || 'input'
}

function buildFieldPayload(field) {
  return {
    field: field.field,
    type: field.type,
    meta: {
      hidden: field.primary === true,
      interface: fieldInterface(field),
      options: field.options?.length ? { choices: field.options.map((value) => ({ text: value, value })) } : null,
      readonly: field.primary === true,
      required: field.required === true,
    },
    schema: {
      is_nullable: field.required !== true && field.primary !== true,
      is_primary_key: field.primary === true,
    },
  }
}

function validateSchema(schema) {
  if (!schema || !Array.isArray(schema.collections)) {
    throw new Error('Schema must contain a collections array')
  }

  const collectionNames = new Set()

  for (const collection of schema.collections) {
    if (!collection.collection || typeof collection.collection !== 'string') {
      throw new Error('Every collection must have a string collection name')
    }

    if (collectionNames.has(collection.collection)) {
      throw new Error(`Duplicate collection: ${collection.collection}`)
    }

    collectionNames.add(collection.collection)

    if (!Array.isArray(collection.fields) || collection.fields.length === 0) {
      throw new Error(`Collection ${collection.collection} must contain fields`)
    }

    const fieldNames = new Set()
    const primaryFields = []

    for (const field of collection.fields) {
      if (!field.field || typeof field.field !== 'string') {
        throw new Error(`Collection ${collection.collection} contains a field without a valid name`)
      }

      if (!field.type || typeof field.type !== 'string') {
        throw new Error(`Field ${collection.collection}.${field.field} must have a type`)
      }

      if (fieldNames.has(field.field)) {
        throw new Error(`Duplicate field: ${collection.collection}.${field.field}`)
      }

      fieldNames.add(field.field)

      if (field.primary) {
        primaryFields.push(field.field)
      }
    }

    if (primaryFields.length !== 1) {
      throw new Error(`Collection ${collection.collection} must have exactly one primary field`)
    }
  }
}

function printDryRun(schema) {
  const plannedCollections = schema.collections.map((collection) => collection.collection)
  const plannedFields = schema.collections.flatMap((collection) =>
    collection.fields.map((field) => `${collection.collection}.${field.field}:${field.type}`),
  )

  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: 'dry-run',
        directusUrl,
        plannedCollections,
        plannedFields,
        note: 'Dry-run validates the local schema only and does not call Directus.',
      },
      null,
      2,
    ),
  )
}

async function request(pathname, options = {}) {
  const response = await fetch(`${directusUrl}${pathname}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers || {}),
    },
  })
  const text = await response.text()
  const body = text ? JSON.parse(text) : null

  if (!response.ok) {
    const message = body?.errors?.[0]?.message || `Directus request failed: ${response.status}`
    throw new Error(`${pathname}: ${message}`)
  }

  return body
}

async function getAccessToken() {
  if (staticToken) return staticToken

  if (!adminEmail || !adminPassword) {
    throw new Error('Set DIRECTUS_TOKEN or DIRECTUS_ADMIN_EMAIL/DIRECTUS_ADMIN_PASSWORD in directus/.env')
  }

  const response = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: adminEmail,
      password: adminPassword,
    }),
  })

  return response?.data?.access_token
}

async function main() {
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'))
  validateSchema(schema)

  if (dryRun) {
    printDryRun(schema)
    return
  }

  const token = await getAccessToken()
  const collectionsResponse = await request('/collections', { token })
  const existingCollections = new Set((collectionsResponse?.data || []).map((item) => item.collection))

  const createdCollections = []
  const createdFields = []
  const skippedFields = []

  for (const collection of schema.collections) {
    if (!existingCollections.has(collection.collection)) {
      await request('/collections', {
        method: 'POST',
        token,
        body: JSON.stringify({
          collection: collection.collection,
          meta: {
            collection: collection.collection,
            icon: 'table_chart',
          },
          schema: {},
        }),
      })
      createdCollections.push(collection.collection)
    }

    const fieldsResponse = await request(`/fields/${collection.collection}`, { token })
    const existingFields = new Set((fieldsResponse?.data || []).map((item) => item.field))

    for (const field of collection.fields) {
      if (existingFields.has(field.field)) {
        skippedFields.push(`${collection.collection}.${field.field}`)
        continue
      }

      await request(`/fields/${collection.collection}`, {
        method: 'POST',
        token,
        body: JSON.stringify(buildFieldPayload(field)),
      })
      createdFields.push(`${collection.collection}.${field.field}`)
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        directusUrl,
        createdCollections,
        createdFields,
        skippedFields,
        note: 'Relations and role permission filters are still configured manually in Directus Studio for MVP.',
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
