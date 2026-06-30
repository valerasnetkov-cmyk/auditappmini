import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import process from 'node:process'
import { seedSmokeTenantOwner } from './smoke-helpers.mjs'

const HOST = '127.0.0.1'
const PORT = Number(process.env.PORT || 5317 + (process.pid % 500))
const DATABASE_PATH = `./.tmp-smoke/smoke-subscription-guard-${process.pid}.sqlite`
const JWT_SECRET = crypto.randomBytes(32).toString('hex')
const BASE_URL = `http://${HOST}:${PORT}`

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function addDaysIso(days) {
  const date = new Date()
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

async function waitForServer(timeoutMs = 30000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@example.com', password: 'admin123' }),
      })
      if (response.status !== 500) return
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
  if (response.status === 204) return null
  return response.json()
}

async function seedSubscriptionState() {
  const suffix = Date.now()
  const expired = {
    companyId: `expired-company-${suffix}`,
    email: `expired-owner-${suffix}@example.com`,
    password: 'expiredOwner123',
    managerEmail: `expired-manager-${suffix}@example.com`,
    managerPassword: 'expiredManager123',
    vehicleId: `expired-vehicle-${suffix}`,
  }
  const suspended = {
    companyId: `suspended-company-${suffix}`,
    email: `suspended-owner-${suffix}@example.com`,
    password: 'suspendedOwner123',
    vehicleId: `suspended-vehicle-${suffix}`,
  }
  const legacyTrial = {
    companyId: `legacy-trial-company-${suffix}`,
    email: `legacy-trial-owner-${suffix}@example.com`,
    password: 'legacyTrial123',
  }

  await seedSmokeTenantOwner({
    databasePath: DATABASE_PATH,
    email: expired.email,
    password: expired.password,
    companyId: expired.companyId,
    name: 'Expired Owner',
    keepOpen: true,
  })
  await seedSmokeTenantOwner({
    databasePath: DATABASE_PATH,
    email: suspended.email,
    password: suspended.password,
    companyId: suspended.companyId,
    name: 'Suspended Owner',
    keepOpen: true,
  })
  await seedSmokeTenantOwner({
    databasePath: DATABASE_PATH,
    email: legacyTrial.email,
    password: legacyTrial.password,
    companyId: legacyTrial.companyId,
    name: 'Legacy Trial Owner',
    keepOpen: true,
  })

  const { getDb, closeDatabase } = await import('../src/db.js')
  const bcrypt = await import('bcryptjs')
  try {
    const db = getDb()
    const managerPasswordHash = bcrypt.default.hashSync(expired.managerPassword, 10)
    db.prepare(`
      INSERT INTO vehicles (id, number, name, status, region, company_id, created_at)
      VALUES (?, ?, ?, 'active', '', ?, datetime('now'))
    `).run(expired.vehicleId, 'A501BC177', 'Expired visible vehicle', expired.companyId)
    db.prepare(`
      INSERT INTO users (id, email, password, name, role, status, company_id, service_notifications_enabled)
      VALUES (?, ?, ?, 'Expired Manager', 'manager', 'active', ?, 0)
    `).run(`manager-${expired.companyId}`, expired.managerEmail, managerPasswordHash, expired.companyId)
    db.prepare(`
      INSERT INTO vehicles (id, number, name, status, region, company_id, created_at)
      VALUES (?, ?, ?, 'active', '', ?, datetime('now'))
    `).run(suspended.vehicleId, 'A601BC177', 'Suspended visible vehicle', suspended.companyId)

    db.prepare(`
      INSERT INTO company_subscriptions (
        id, company_id, plan_code, status, current_period_start, current_period_end,
        grace_until, last_payment_id, mrr_rub, auto_suspend_enabled, created_at, updated_at
      )
      VALUES (?, ?, 'pilot', 'expired', ?, ?, ?, NULL, 10000, 0, datetime('now'), datetime('now'))
    `).run(`subscription-${expired.companyId}`, expired.companyId, addDaysIso(-60), addDaysIso(-8), addDaysIso(-1))
    db.prepare(`
      INSERT INTO company_subscriptions (
        id, company_id, plan_code, status, current_period_start, current_period_end,
        grace_until, last_payment_id, mrr_rub, auto_suspend_enabled, created_at, updated_at
      )
      VALUES (?, ?, 'pilot', 'suspended', ?, ?, ?, NULL, 10000, 1, datetime('now'), datetime('now'))
    `).run(`subscription-${suspended.companyId}`, suspended.companyId, addDaysIso(-60), addDaysIso(-20), addDaysIso(-13))
    db.prepare('DELETE FROM company_subscriptions WHERE company_id = ?').run(legacyTrial.companyId)
    db.prepare(`
      INSERT INTO company_billing (
        id, company_id, plan_code, billing_status, trial_until, created_at, updated_at
      ) VALUES (?, ?, 'pilot', 'trial', ?, datetime('now'), datetime('now'))
      ON CONFLICT(company_id) DO UPDATE SET
        billing_status = 'trial',
        trial_until = excluded.trial_until,
        updated_at = datetime('now')
    `).run(`billing-${legacyTrial.companyId}`, legacyTrial.companyId, addDaysIso(90))
  } finally {
    closeDatabase()
  }

  return { expired, suspended, legacyTrial }
}

async function run() {
  const seeded = await seedSubscriptionState()
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

    const expiredLogin = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: seeded.expired.email, password: seeded.expired.password }),
    })
    const expiredManagerLogin = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: seeded.expired.managerEmail, password: seeded.expired.managerPassword }),
    })
    const suspendedLogin = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: seeded.suspended.email, password: seeded.suspended.password }),
    })
    const legacyTrialLogin = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: seeded.legacyTrial.email, password: seeded.legacyTrial.password }),
    })
    const adminLogin = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'admin123' }),
    })

    const expiredHeaders = { Authorization: `Bearer ${expiredLogin.token}` }
    const expiredJsonHeaders = { ...expiredHeaders, 'Content-Type': 'application/json' }
    const expiredManagerHeaders = { Authorization: `Bearer ${expiredManagerLogin.token}` }
    const adminJsonHeaders = { Authorization: `Bearer ${adminLogin.token}`, 'Content-Type': 'application/json' }
    const suspendedHeaders = { Authorization: `Bearer ${suspendedLogin.token}` }
    const suspendedJsonHeaders = { ...suspendedHeaders, 'Content-Type': 'application/json' }
    const legacyTrialHeaders = { Authorization: `Bearer ${legacyTrialLogin.token}` }

    const recipients = await request('/api/company/service-notification-recipients', { headers: expiredHeaders })
    const managerRecipient = recipients.recipients?.find((item) => item.email === seeded.expired.managerEmail)
    if (!recipients.recipients?.some((item) => item.role === 'owner' && item.locked === true) || managerRecipient?.serviceNotificationsEnabled !== false) {
      throw new Error(`Service notification recipients should include owner and disabled manager: ${JSON.stringify(recipients)}`)
    }
    const updatedRecipients = await request('/api/company/service-notification-recipients', {
      method: 'PUT',
      headers: expiredJsonHeaders,
      body: JSON.stringify({ recipients: [{ id: managerRecipient.id, serviceNotificationsEnabled: true }] }),
    })
    if (!updatedRecipients.recipients?.find((item) => item.id === managerRecipient.id)?.serviceNotificationsEnabled) {
      throw new Error(`Manager should be enabled for service notifications: ${JSON.stringify(updatedRecipients)}`)
    }

    const alertScan = await request('/api/admin/resource/alerts/scan', {
      method: 'POST',
      headers: adminJsonHeaders,
      body: JSON.stringify({}),
    })
    if (!alertScan.result || alertScan.result.createdNotifications < 2) {
      throw new Error(`Alert scan should create admin and tenant notifications: ${JSON.stringify(alertScan.result)}`)
    }

    const expiredUsage = await request('/api/company/usage', { headers: expiredHeaders })
    if (expiredUsage.subscription?.status !== 'expired') {
      throw new Error(`Expired subscription status should be visible in company usage: ${JSON.stringify(expiredUsage)}`)
    }
    if (!expiredUsage.serviceWarnings?.some((warning) => warning.type === 'subscription_expired' && warning.severity === 'danger')) {
      throw new Error(`Expired warning should be visible in company usage: ${JSON.stringify(expiredUsage.serviceWarnings)}`)
    }
    if (!expiredUsage.alerts?.some((alert) => alert.type === 'subscription_expired')) {
      throw new Error(`Expired owner should see subscription alert in company usage: ${JSON.stringify(expiredUsage.alerts)}`)
    }
    const expiredManagerUsage = await request('/api/company/usage', { headers: expiredManagerHeaders })
    if (!expiredManagerUsage.alerts?.some((alert) => alert.type === 'subscription_expired')) {
      throw new Error(`Enabled manager should see subscription alert in company usage: ${JSON.stringify(expiredManagerUsage.alerts)}`)
    }

    const expiredVehicles = await request('/api/vehicles', { headers: expiredHeaders })
    if (!Array.isArray(expiredVehicles.data) || !expiredVehicles.data.some((item) => item.id === seeded.expired.vehicleId)) {
      throw new Error(`Expired subscription should keep history readable: ${JSON.stringify(expiredVehicles)}`)
    }

    const expiredCreateVehicle = await request('/api/vehicles', {
      method: 'POST',
      headers: expiredJsonHeaders,
      body: JSON.stringify({ number: 'A502BC177', name: 'Blocked expired vehicle', status: 'active' }),
    }, 403)
    const expiredInspection = await request('/api/inspections', {
      method: 'POST',
      headers: expiredJsonHeaders,
      body: JSON.stringify({ vehicle_id: seeded.expired.vehicleId, type: 'quick', checklist: [] }),
    }, 403)
    const expiredImport = await request('/api/vehicles/import', {
      method: 'POST',
      headers: expiredJsonHeaders,
      body: JSON.stringify({ vehicles: [{ number: 'A503BC177', name: 'Blocked import' }] }),
    }, 403)
    const expiredOcr = await request('/api/vehicle-number/recognize', {
      method: 'POST',
      headers: expiredHeaders,
    }, 403)

    const suspendedUsage = await request('/api/company/usage', { headers: suspendedHeaders })
    if (suspendedUsage.subscription?.status !== 'suspended') {
      throw new Error(`Suspended subscription status should be visible in company usage: ${JSON.stringify(suspendedUsage)}`)
    }
    if (!suspendedUsage.serviceWarnings?.some((warning) => warning.type === 'subscription_suspended' && warning.severity === 'danger')) {
      throw new Error(`Suspended warning should be visible in company usage: ${JSON.stringify(suspendedUsage.serviceWarnings)}`)
    }

    const suspendedVehicles = await request('/api/vehicles', { headers: suspendedHeaders })
    if (!Array.isArray(suspendedVehicles.data) || !suspendedVehicles.data.some((item) => item.id === seeded.suspended.vehicleId)) {
      throw new Error(`Suspended subscription should keep history readable: ${JSON.stringify(suspendedVehicles)}`)
    }

    const legacyTrialUsage = await request('/api/company/usage', { headers: legacyTrialHeaders })
    if (
      legacyTrialUsage.subscription !== null ||
      legacyTrialUsage.billing?.status !== 'trial' ||
      legacyTrialUsage.billing?.daysLeft === null ||
      legacyTrialUsage.billing?.daysLeft === undefined ||
      legacyTrialUsage.billing.daysLeft < 29 ||
      legacyTrialUsage.billing.daysLeft > 30
    ) {
      throw new Error(`Legacy trial billing fallback should be capped to 30 days: ${JSON.stringify(legacyTrialUsage.billing)}`)
    }

    const suspendedUpdate = await request(`/api/vehicles/${seeded.suspended.vehicleId}`, {
      method: 'PUT',
      headers: suspendedJsonHeaders,
      body: JSON.stringify({ number: 'A601BC177', name: 'Should not update', status: 'active' }),
    }, 403)
    const suspendedCreate = await request('/api/vehicles', {
      method: 'POST',
      headers: suspendedJsonHeaders,
      body: JSON.stringify({ number: 'A602BC177', name: 'Blocked suspended vehicle', status: 'active' }),
    }, 403)
    const suspendedUserCreate = await request('/api/users', {
      method: 'POST',
      headers: suspendedJsonHeaders,
      body: JSON.stringify({
        email: `blocked-manager-${Date.now()}@example.com`,
        password: 'blocked123',
        name: 'Blocked Manager',
        role: 'manager',
      }),
    }, 403)
    const suspendedRegionCreate = await request('/api/regions', {
      method: 'POST',
      headers: suspendedJsonHeaders,
      body: JSON.stringify({ name: `Blocked Region ${Date.now()}` }),
    }, 403)
    const suspendedSettingsUpdate = await request('/api/settings', {
      method: 'PUT',
      headers: suspendedJsonHeaders,
      body: JSON.stringify({ scheduled_inspection_days: 30 }),
    }, 403)

    console.log(JSON.stringify({
      ok: true,
      expiredCompanyId: seeded.expired.companyId,
      suspendedCompanyId: seeded.suspended.companyId,
      expiredSubscriptionStatus: expiredUsage.subscription.status,
      suspendedSubscriptionStatus: suspendedUsage.subscription.status,
      legacyTrialDaysLeft: legacyTrialUsage.billing.daysLeft,
      tenantAlertNotificationsCreated: alertScan.result.createdNotifications,
      serviceNotificationRecipients: updatedRecipients.recipients.length,
      expiredHistoryReadable: expiredVehicles.data.length,
      expiredCreateVehicleError: expiredCreateVehicle.error,
      expiredInspectionError: expiredInspection.error,
      expiredImportError: expiredImport.error,
      expiredOcrError: expiredOcr.error,
      suspendedUpdateError: suspendedUpdate.error,
      suspendedCreateError: suspendedCreate.error,
      suspendedUserCreateError: suspendedUserCreate.error,
      suspendedRegionCreateError: suspendedRegionCreate.error,
      suspendedSettingsUpdateError: suspendedSettingsUpdate.error,
    }, null, 2))
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
