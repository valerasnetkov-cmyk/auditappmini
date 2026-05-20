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
const DEFAULT_LEGACY_COLLECTIONS_TO_HIDE = [
  'vehicles',
  'accident_cases',
  'accident_participants',
  'damages',
  'photos',
  'odometer_recognitions',
  'plate_recognitions',
  'fraud_checks',
]

function fieldInterface(field) {
  if (field.relation?.collection) return 'select-dropdown-m2o'
  if (field.options?.length) return 'select-dropdown'

  return {
    boolean: 'boolean',
    date: 'datetime',
    dateTime: 'datetime',
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

function buildTranslations({ label, singular, plural }) {
  if (!label && !singular && !plural) return null

  return ['ru-RU', 'en-US'].map((language) => ({
    language,
    translation: label || plural || singular,
    singular: singular || label,
    plural: plural || label,
  }))
}

function buildFieldTranslations(field) {
  if (!field.label) return null

  return ['ru-RU', 'en-US'].map((language) => ({
    language,
    translation: field.label,
  }))
}

function buildOptionChoices(field) {
  if (!field.options?.length) return null

  return field.options.map((option) => {
    if (option && typeof option === 'object') {
      return {
        text: option.label || option.text || option.value,
        value: option.value,
      }
    }

    return {
      text: field.optionLabels?.[option] || option,
      value: option,
    }
  })
}

function directusFieldType(field) {
  return {
    datetime: 'dateTime',
  }[field.type] || field.type
}

function buildFieldMeta(field, sort) {
  const choices = buildOptionChoices(field)

  return {
    hidden: field.hidden === true || field.primary === true,
    interface: fieldInterface(field),
    note: field.note || null,
    options: choices ? { choices } : null,
    readonly: field.readonly === true || field.primary === true,
    required: field.required === true,
    sort,
    translations: buildFieldTranslations(field),
    width: field.width || 'full',
  }
}

function buildFieldPayload(field, sort) {
  return {
    field: field.field,
    type: directusFieldType(field),
    meta: buildFieldMeta(field, sort),
    schema: {
      is_nullable: field.required !== true && field.primary !== true,
      is_primary_key: field.primary === true,
    },
  }
}

function buildRelationPayload(collectionName, field) {
  if (!field.relation?.collection) return null

  const relatedCollection = field.relation.collection
  const relatedField = field.relation.field || 'id'
  const onDelete = field.relation.onDelete || 'NO ACTION'

  return {
    collection: collectionName,
    field: field.field,
    related_collection: relatedCollection,
    meta: {
      many_collection: collectionName,
      many_field: field.field,
      one_collection: relatedCollection,
      one_field: field.relation.oneField || null,
      one_collection_field: null,
      one_allowed_collections: null,
      one_deselect_action: onDelete === 'CASCADE' ? 'delete' : 'nullify',
      sort_field: null,
    },
    schema: {
      on_delete: onDelete,
      on_update: field.relation.onUpdate || 'NO ACTION',
      foreign_key_column: relatedField,
    },
  }
}

function buildCollectionMeta(collection, sort) {
  return {
    collection: collection.collection,
    color: collection.color || null,
    display_template: collection.displayTemplate || collection.display_template || null,
    hidden: false,
    icon: collection.icon || 'table_chart',
    note: collection.note || null,
    sort,
    translations: buildTranslations({
      label: collection.label,
      singular: collection.singular,
      plural: collection.plural,
    }),
  }
}

function getLegacyCollectionsToHide(schema, activeCollectionNames) {
  const configured = Array.isArray(schema.legacyCollectionsToHide)
    ? schema.legacyCollectionsToHide
    : DEFAULT_LEGACY_COLLECTIONS_TO_HIDE

  return configured
    .filter((collection) => typeof collection === 'string' && collection.trim())
    .map((collection) => collection.trim())
    .filter((collection) => !activeCollectionNames.has(collection))
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

      if (field.relation) {
        if (!field.relation.collection || typeof field.relation.collection !== 'string') {
          throw new Error(`Relation field ${collection.collection}.${field.field} must define relation.collection`)
        }

        if (field.options?.length) {
          throw new Error(`Relation field ${collection.collection}.${field.field} cannot also define dropdown options`)
        }
      }
    }

    if (primaryFields.length !== 1) {
      throw new Error(`Collection ${collection.collection} must have exactly one primary field`)
    }
  }
}

function printDryRun(schema) {
  const plannedCollections = schema.collections.map((collection) => collection.collection)
  const activeCollectionNames = new Set(plannedCollections)
  const legacyCollectionsToHide = getLegacyCollectionsToHide(schema, activeCollectionNames)
  const plannedFields = schema.collections.flatMap((collection) =>
    collection.fields.map((field) => `${collection.collection}.${field.field}:${field.type}`),
  )
  const plannedRelations = schema.collections.flatMap((collection) =>
    collection.fields
      .filter((field) => field.relation?.collection)
      .map((field) => `${collection.collection}.${field.field}->${field.relation.collection}.${field.relation.field || 'id'}`),
  )

  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: 'dry-run',
        directusUrl,
        plannedCollections,
        legacyCollectionsToHide,
        plannedFields,
        plannedRelations,
        note: 'Dry-run validates the local schema only and does not call Directus. Legacy collections are hidden, not deleted, during live bootstrap.',
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

async function collectionHasItems(collection, token) {
  const params = new URLSearchParams({ limit: '1', fields: 'id' })
  const response = await request(`/items/${encodeURIComponent(collection)}?${params}`, { token })
  return (response?.data || []).length > 0
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
  const activeCollectionNames = new Set(schema.collections.map((collection) => collection.collection))
  const legacyCollectionsToHide = getLegacyCollectionsToHide(schema, activeCollectionNames)

  const createdCollections = []
  const updatedCollectionMeta = []
  const hiddenLegacyCollections = []
  const skippedLegacyCollections = []
  const createdFields = []
  const recreatedFields = []
  const skippedFields = []
  const plannedRelations = []
  const createdRelations = []
  const skippedRelations = []

  for (const [index, collection] of schema.collections.entries()) {
    const meta = buildCollectionMeta(collection, index + 1)

    if (!existingCollections.has(collection.collection)) {
      await request('/collections', {
        method: 'POST',
        token,
        body: JSON.stringify({
          collection: collection.collection,
          meta,
          schema: {},
        }),
      })
      existingCollections.add(collection.collection)
      createdCollections.push(collection.collection)
    } else {
      await request(`/collections/${encodeURIComponent(collection.collection)}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ meta }),
      })
      updatedCollectionMeta.push(collection.collection)
    }

    const fieldsResponse = await request(`/fields/${collection.collection}`, { token })
    const existingFields = new Map((fieldsResponse?.data || []).map((item) => [item.field, item]))

    for (const [fieldIndex, field] of collection.fields.entries()) {
      const fieldPayload = buildFieldPayload(field, fieldIndex + 1)
      const existingField = existingFields.get(field.field)

      if (existingField) {
        const expectedType = directusFieldType(field)
        const actualType = existingField.type

        if (!field.primary && actualType !== expectedType) {
          const hasItems = await collectionHasItems(collection.collection, token)

          if (hasItems) {
            throw new Error(
              `Refusing to recreate non-empty field ${collection.collection}.${field.field}: Directus type is ${actualType}, schema expects ${expectedType}`,
            )
          }

          await request(`/fields/${encodeURIComponent(collection.collection)}/${encodeURIComponent(field.field)}`, {
            method: 'DELETE',
            token,
          })
          await request(`/fields/${collection.collection}`, {
            method: 'POST',
            token,
            body: JSON.stringify(fieldPayload),
          })
          recreatedFields.push(`${collection.collection}.${field.field}:${actualType}->${expectedType}`)
          continue
        }

        skippedFields.push(`${collection.collection}.${field.field}`)
        await request(`/fields/${encodeURIComponent(collection.collection)}/${encodeURIComponent(field.field)}`, {
          method: 'PATCH',
          token,
          body: JSON.stringify({
            meta: buildFieldMeta(field, fieldIndex + 1),
          }),
        })
        continue
      }

      await request(`/fields/${collection.collection}`, {
        method: 'POST',
        token,
        body: JSON.stringify(fieldPayload),
      })
      createdFields.push(`${collection.collection}.${field.field}`)
    }

    plannedRelations.push(
      ...collection.fields
        .filter((field) => field.relation?.collection)
        .map((field) => ({
          collection: collection.collection,
          field,
        })),
    )
  }

  const relationsResponse = await request('/relations?limit=-1', { token })
  const existingRelations = new Set((relationsResponse?.data || []).map((relation) => `${relation.collection}.${relation.field}`))

  for (const plannedRelation of plannedRelations) {
    const relationPayload = buildRelationPayload(plannedRelation.collection, plannedRelation.field)
    const key = `${plannedRelation.collection}.${plannedRelation.field.field}`

    if (!relationPayload) continue

    if (existingRelations.has(key)) {
      skippedRelations.push(key)
      continue
    }

    await request('/relations', {
      method: 'POST',
      token,
      body: JSON.stringify(relationPayload),
    })
    createdRelations.push(`${key}->${relationPayload.related_collection}`)
  }

  for (const collection of legacyCollectionsToHide) {
    if (!existingCollections.has(collection)) {
      skippedLegacyCollections.push(collection)
      continue
    }

    await request(`/collections/${encodeURIComponent(collection)}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({
        meta: {
          collection,
          hidden: true,
          note: 'Legacy operational collection hidden from SaaS backoffice menu. Data is preserved.',
        },
      }),
    })
    hiddenLegacyCollections.push(collection)
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        directusUrl,
        createdCollections,
        updatedCollectionMeta,
        hiddenLegacyCollections,
        skippedLegacyCollections,
        createdFields,
        recreatedFields,
        skippedFields,
        createdRelations,
        skippedRelations,
        note: 'Legacy operational collections were hidden from Directus Studio menu without deleting tables or data.',
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
