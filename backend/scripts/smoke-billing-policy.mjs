import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import process from 'node:process'

const HOST = '127.0.0.1'
const PORT = Number(process.env.PORT || 5580 + (process.pid % 300))
const DATABASE_PATH = `./.tmp-smoke/smoke-billing-policy-${process.pid}.sqlite`
const BASE_URL = `http://${HOST}:${PORT}`
const JWT_SECRET = crypto.randomBytes(32).toString('hex')

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitForServer() {
  for (let index = 0; index < 100; index += 1) {
    try {
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@example.com', password: 'admin123' }),
      })
      if (response.status !== 500) return
    } catch {}
    await sleep(250)
  }
  throw new Error('Billing smoke server did not start')
}

async function request(path, options = {}, expectedStatus = 200) {
  const response = await fetch(`${BASE_URL}${path}`, options)
  const body = response.status === 204 ? null : await response.json()
  if (response.status !== expectedStatus) {
    throw new Error(`${path}: expected ${expectedStatus}, got ${response.status}: ${JSON.stringify(body)}`)
  }
  return body
}

const jsonHeaders = (token) => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' })

const server = spawn(process.execPath, ['src/server.js'], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(PORT), DATABASE_PATH, JWT_SECRET },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let stderr = ''
server.stderr.on('data', (chunk) => { stderr += chunk.toString() })

try {
  await waitForServer()
  const adminLogin = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'admin123' }),
  })
  const adminHeaders = jsonHeaders(adminLogin.token)
  const suffix = Date.now()
  const companyId = `billing-${suffix}`
  const ownerEmail = `billing-owner-${suffix}@example.com`

  const plans = await request('/api/admin/saas/plans', { headers: adminHeaders })
  const codes = new Set(plans.plans.map((plan) => plan.code))
  for (const code of ['pilot', 'standard', 'enterprise']) {
    if (!codes.has(code)) throw new Error(`Missing seeded plan: ${code}`)
  }

  await request('/api/admin/resource/companies', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ id: companyId, slug: companyId, name: 'Billing Smoke' }),
  }, 201)
  const initialBilling = await request(`/api/admin/saas/companies/${companyId}/billing`, { headers: adminHeaders })
  if (initialBilling.billing?.billing_status !== 'trial' || initialBilling.plan?.code !== 'pilot') {
    throw new Error(`Unexpected initial billing: ${JSON.stringify(initialBilling)}`)
  }

  await request(`/api/admin/saas/companies/${companyId}/limits`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({ max_inspections_per_month: 1 }),
  })

  const owner = await request(`/api/admin/resource/companies/${companyId}/owners`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ email: ownerEmail, name: 'Billing Owner', issue_setup_link: true }),
  }, 201)
  await request('/api/auth/owner-setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: owner.setup.token, password: 'BillingSmoke123!' }),
  })
  const ownerLogin = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ownerEmail, password: 'BillingSmoke123!' }),
  })
  const ownerHeaders = jsonHeaders(ownerLogin.token)
  const vehicle = await request('/api/vehicles', {
    method: 'POST',
    headers: ownerHeaders,
    body: JSON.stringify({ number: 'A555AA177', name: 'Billing vehicle' }),
  }, 201)

  await request('/api/inspections', {
    method: 'POST',
    headers: ownerHeaders,
    body: JSON.stringify({ vehicle_id: vehicle.id, type: 'quick' }),
  }, 201)
  const secondInspection = await request('/api/inspections', {
    method: 'POST',
    headers: ownerHeaders,
    body: JSON.stringify({ vehicle_id: vehicle.id, type: 'quick' }),
  }, 409)
  if (secondInspection.error !== 'inspection_limit_exceeded') {
    throw new Error(`Unexpected inspection limit response: ${JSON.stringify(secondInspection)}`)
  }

  const paid = await request(`/api/admin/saas/companies/${companyId}/payments`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      amountRub: 15000,
      paymentDate: '2026-06-06',
      periodStart: '2026-06-01',
      periodEnd: '2026-06-30',
      paymentMethod: 'invoice',
      invoiceNumber: 'SMOKE-1',
    }),
  }, 201)
  if (paid.billing?.billing_status !== 'active' || paid.billing?.paid_until !== '2026-06-30') {
    throw new Error(`Payment did not activate billing: ${JSON.stringify(paid.billing)}`)
  }
  if (!paid.events?.some((event) => event.event_type === 'payment_added')) {
    throw new Error('Payment event was not recorded')
  }

  await request(`/api/admin/saas/companies/${companyId}/billing`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({ billingStatus: 'suspended' }),
  })
  await request('/api/vehicles', { headers: ownerHeaders })
  const blocked = await request('/api/vehicles', {
    method: 'POST',
    headers: ownerHeaders,
    body: JSON.stringify({ number: 'A556AA177', name: 'Blocked vehicle' }),
  }, 403)
  if (!blocked.error) throw new Error('Suspended write was not blocked')

  const usage = await request('/api/company/usage', { headers: ownerHeaders })
  if (usage.billing?.status !== 'suspended' || usage.usage?.inspectionsMonth?.max !== 1) {
    throw new Error(`Company usage missing billing data: ${JSON.stringify(usage)}`)
  }

  console.log(JSON.stringify({
    ok: true,
    companyId,
    plans: [...codes],
    inspectionLimitError: secondInspection.error,
    billingStatus: usage.billing.status,
    paidUntil: paid.billing.paid_until,
  }, null, 2))
} finally {
  server.kill()
  await sleep(300)
  await fs.rm(DATABASE_PATH, { force: true })
  if (stderr.trim()) console.error(stderr.trim())
}
