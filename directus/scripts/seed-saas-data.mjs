import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const directusDir = path.resolve(__dirname, '..')
const args = new Set(process.argv.slice(2))
const dryRun = args.has('--dry-run') || args.has('--check')
const force = args.has('--force')
const ACTIVE_COLLECTIONS = ['companies', 'company_owners', 'plans', 'company_limits', 'saas_metric_snapshots']
const CRUD_ACTIONS = ['read', 'create', 'update', 'delete']

const PLAN_SEED = [
  {
    code: 'pilot',
    name: 'Пилот',
    status: 'active',
    monthly_price: 0,
    max_vehicles: 10,
    max_users: 3,
    max_storage_mb: 512,
    features: {
      ocr_enabled: true,
      accident_module_enabled: true,
      analytics_enabled: false,
      api_access_enabled: false,
    },
  },
  {
    code: 'standard',
    name: 'Стандарт',
    status: 'active',
    monthly_price: 4900,
    max_vehicles: 100,
    max_users: 15,
    max_storage_mb: 5120,
    features: {
      ocr_enabled: true,
      accident_module_enabled: true,
      analytics_enabled: true,
      api_access_enabled: false,
    },
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    status: 'active',
    monthly_price: null,
    max_vehicles: null,
    max_users: null,
    max_storage_mb: null,
    features: {
      ocr_enabled: true,
      accident_module_enabled: true,
      analytics_enabled: true,
      api_access_enabled: true,
    },
  },
]

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

function buildLimitPayload(company, plan) {
  const features = plan.features || {}

  return {
    company_id: company.id,
    plan_code: plan.code,
    max_vehicles: plan.max_vehicles ?? null,
    max_users: plan.max_users ?? null,
    max_storage_mb: plan.max_storage_mb ?? null,
    ocr_enabled: features.ocr_enabled ?? true,
    accident_module_enabled: features.accident_module_enabled ?? true,
    analytics_enabled: features.analytics_enabled ?? true,
    api_access_enabled: features.api_access_enabled ?? false,
    updated_at: new Date().toISOString(),
  }
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

async function listItems(collection, token, params = {}) {
  const search = new URLSearchParams({ limit: '-1', ...params })
  const response = await request(`/items/${collection}?${search}`, { token })
  return response?.data || []
}

async function listPolicies(token) {
  const response = await request('/policies?limit=-1', { token })
  return response?.data || []
}

async function listPermissions(token, policyId) {
  const params = new URLSearchParams({ limit: '-1' })
  params.set('filter[policy][_eq]', policyId)
  const response = await request(`/permissions?${params}`, { token })
  return response?.data || []
}

async function ensureSaasAdminPermissions(token) {
  const policies = await listPolicies(token)
  const adminPolicy = policies.find((policy) => policy.admin_access === true) || policies.find((policy) => policy.name === 'Administrator')

  if (!adminPolicy) {
    throw new Error('Directus Administrator policy was not found')
  }

  const existingPermissions = await listPermissions(token, adminPolicy.id)
  const existingKeys = new Set(existingPermissions.map((permission) => `${permission.collection}:${permission.action}`))
  const created = []
  const skipped = []

  for (const collection of ACTIVE_COLLECTIONS) {
    for (const action of CRUD_ACTIONS) {
      const key = `${collection}:${action}`
      if (existingKeys.has(key)) {
        skipped.push(key)
        continue
      }

      if (dryRun) {
        created.push(key)
        continue
      }

      await request('/permissions', {
        method: 'POST',
        token,
        body: JSON.stringify({
          policy: adminPolicy.id,
          collection,
          action,
          permissions: {},
          validation: null,
          presets: null,
          fields: ['*'],
        }),
      })
      created.push(key)
    }
  }

  return {
    policy: adminPolicy.name,
    policyId: adminPolicy.id,
    created,
    skipped,
  }
}

async function findOneByField(collection, token, field, value) {
  const params = new URLSearchParams({ limit: '1' })
  params.set(`filter[${field}][_eq]`, value)
  const response = await request(`/items/${collection}?${params}`, { token })
  return response?.data?.[0] || null
}

async function createItem(collection, token, payload) {
  const response = await request(`/items/${collection}`, {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  })
  return response?.data
}

async function updateItem(collection, token, id, payload) {
  const response = await request(`/items/${collection}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(payload),
  })
  return response?.data
}

async function upsertPlans(token) {
  const created = []
  const updated = []

  for (const plan of PLAN_SEED) {
    const existing = await findOneByField('plans', token, 'code', plan.code)
    const payload = {
      ...plan,
      features: plan.features,
    }

    if (dryRun) {
      ;(existing ? updated : created).push(plan.code)
      continue
    }

    if (existing) {
      await updateItem('plans', token, existing.id, payload)
      updated.push(plan.code)
    } else {
      await createItem('plans', token, { ...payload, created_at: new Date().toISOString() })
      created.push(plan.code)
    }
  }

  return { created, updated }
}

async function upsertCompanyLimits(token) {
  const companies = await listItems('companies', token)
  const limits = await listItems('company_limits', token)
  const existingLimitByCompany = new Map(limits.map((limit) => [String(limit.company_id), limit]))
  const plans = new Map(PLAN_SEED.map((plan) => [plan.code, plan]))

  const created = []
  const updated = []
  const skipped = []
  const companyPlanSync = []
  const invalidCompanyPlans = []

  for (const company of companies) {
    const hasKnownPlan = company.plan_code && plans.has(company.plan_code)
    const planCode = hasKnownPlan ? company.plan_code : 'pilot'
    const plan = plans.get(planCode) || PLAN_SEED[0]
    const payload = buildLimitPayload(company, plan)
    const existingLimit = existingLimitByCompany.get(String(company.id))

    if (!company.plan_code) {
      if (dryRun) {
        companyPlanSync.push({ company_id: company.id, plan_code: plan.code })
      } else {
        await updateItem('companies', token, company.id, { plan_code: plan.code })
        companyPlanSync.push({ company_id: company.id, plan_code: plan.code })
      }
    } else if (!hasKnownPlan) {
      invalidCompanyPlans.push({ company_id: company.id, plan_code: company.plan_code })
    }

    if (dryRun) {
      ;(existingLimit ? updated : created).push({ company_id: company.id, plan_code: plan.code })
      continue
    }

    if (existingLimit) {
      if (!force) {
        skipped.push({ company_id: company.id, reason: 'existing limit, use --force to update' })
        continue
      }

      await updateItem('company_limits', token, existingLimit.id, payload)
      updated.push({ company_id: company.id, plan_code: plan.code })
    } else {
      await createItem('company_limits', token, payload)
      created.push({ company_id: company.id, plan_code: plan.code })
    }
  }

  return {
    companiesFound: companies.length,
    created,
    updated,
    skipped,
    companyPlanSync,
    invalidCompanyPlans,
  }
}

async function main() {
  let token = await getAccessToken()
  const permissions = await ensureSaasAdminPermissions(token)
  token = await getAccessToken()
  const plans = await upsertPlans(token)
  const companyLimits = await upsertCompanyLimits(token)

  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: dryRun ? 'dry-run' : 'apply',
        directusUrl,
        force,
        permissions,
        plans,
        companyLimits,
        note:
          companyLimits.companiesFound === 0
            ? 'Plans were seeded. Company limits were not created because there are no companies in Directus yet.'
            : 'Plans and company limits are synchronized. Existing limits are preserved unless --force is used.',
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
