import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import process from 'node:process'
import { seedSmokeTenantOwner } from './smoke-helpers.mjs'

const HOST = '127.0.0.1'
const PORT = Number(process.env.PORT || 4817 + (process.pid % 500))
const DATABASE_PATH = `./.tmp-smoke/smoke-saas-admin-${process.pid}.sqlite`
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
        body: JSON.stringify({
          email: 'admin@example.com',
          password: 'admin123',
        }),
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

async function run() {
  const suffix = Date.now()
  const tenantOwnerEmail = `tenant-owner-${suffix}@example.com`
  const tenantManagerEmail = `tenant-manager-${suffix}@example.com`
  const tenantInspectorEmail = `tenant-inspector-${suffix}@example.com`

  await seedSmokeTenantOwner({
    databasePath: DATABASE_PATH,
    email: tenantOwnerEmail,
    password: 'owner123',
    companyId: `tenant-company-${suffix}`,
    name: 'Tenant Owner',
  })

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

    const adminLogin = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'admin123' }),
    })

    const adminHeaders = { Authorization: `Bearer ${adminLogin.token}` }
    const adminCookieHeaders = { Cookie: `audit_session=${encodeURIComponent(adminLogin.token)}` }
    const jsonHeaders = { ...adminHeaders, 'Content-Type': 'application/json' }
    const companyId = `resource-admin-${suffix}`
    const emptyCompanyId = `resource-empty-${suffix}`
    const ownerEmail = `resource-owner-${suffix}@example.com`
    const updatedOwnerEmail = `resource-owner-updated-${suffix}@example.com`
    const paymentDate = addDaysIso(-23)
    const periodEnd = addDaysIso(7)

    const bearerCookieDiagnostics = await request('/api/admin/resource/session-cookies', { headers: adminHeaders })
    if (
      bearerCookieDiagnostics.authSource !== 'bearer' ||
      bearerCookieDiagnostics.authCookiePresent !== false ||
      bearerCookieDiagnostics.authCookieName !== 'audit_session' ||
      bearerCookieDiagnostics.authCookieLength !== 0 ||
      bearerCookieDiagnostics.jwt?.email !== 'admin@example.com' ||
      !bearerCookieDiagnostics.tokenFingerprint ||
      JSON.stringify(bearerCookieDiagnostics).includes(adminLogin.token)
    ) {
      throw new Error(`Bearer session cookie diagnostics leaked or missed expected data: ${JSON.stringify(bearerCookieDiagnostics)}`)
    }

    const cookieOnlyDiagnostics = await request('/api/admin/resource/session-cookies', { headers: adminCookieHeaders })
    if (
      cookieOnlyDiagnostics.authSource !== 'cookie' ||
      cookieOnlyDiagnostics.authCookiePresent !== true ||
      cookieOnlyDiagnostics.authCookieLength !== adminLogin.token.length ||
      !cookieOnlyDiagnostics.cookieNames.includes('audit_session') ||
      cookieOnlyDiagnostics.jwt?.email !== 'admin@example.com' ||
      JSON.stringify(cookieOnlyDiagnostics).includes(adminLogin.token)
    ) {
      throw new Error(`Cookie session diagnostics leaked or missed expected data: ${JSON.stringify(cookieOnlyDiagnostics)}`)
    }

    const company = await request('/api/admin/resource/companies', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        id: companyId,
        slug: companyId,
        name: `Resource Admin Smoke ${suffix}`,
        region_code: 'RU-SAK',
        data_residency: 'RU',
        limits: {
          planCode: 'pilot',
          maxVehicles: 5,
          maxUsers: 3,
          maxStorageMb: 512,
          ocrEnabled: true,
          accidentModuleEnabled: true,
          analyticsEnabled: true,
          pdfReportEnabled: true,
          apiAccessEnabled: false,
        },
      }),
    }, 201)

    const updatedCompany = await request(`/api/admin/resource/companies/${company.id}`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({
        name: `Resource Admin Smoke Updated ${suffix}`,
        status: 'inactive',
      }),
    })

    if (updatedCompany.status !== 'inactive' || !updatedCompany.name.includes('Updated')) {
      throw new Error(`Resource admin company update failed: ${JSON.stringify(updatedCompany)}`)
    }

    const emptyCompany = await request('/api/admin/resource/companies', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        id: emptyCompanyId,
        slug: emptyCompanyId,
        name: `Resource Empty Smoke ${suffix}`,
      }),
    }, 201)

    const owner = await request(`/api/admin/resource/companies/${company.id}/owners`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        email: ownerEmail,
        name: 'Resource Owner',
        issue_setup_link: true,
      }),
    }, 201)

    const updatedOwner = await request(`/api/admin/resource/owners/${owner.id}`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({
        email: updatedOwnerEmail,
        name: 'Resource Owner Updated',
        status: 'active',
      }),
    })

    if (updatedOwner.email !== updatedOwnerEmail || updatedOwner.name !== 'Resource Owner Updated') {
      throw new Error(`Resource admin owner update failed: ${JSON.stringify(updatedOwner)}`)
    }

    if (!owner.setup?.token || !owner.setup?.setup_url || !owner.setup?.expires_at) {
      throw new Error(`Owner provisioning did not return setup token/url/expiry: ${JSON.stringify(owner)}`)
    }

    await request('/api/auth/owner-setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: owner.setup.token, password: 'OldSetupShouldFail123!' }),
    }, 401)

    const ownerSetupLink = await request(`/api/admin/resource/owners/${owner.id}/setup-link`, {
      method: 'POST',
      headers: jsonHeaders,
    })
    if (!ownerSetupLink.setup?.token || !ownerSetupLink.setup?.setup_url || !ownerSetupLink.setup?.expires_at) {
      throw new Error(`Owner setup link reissue failed: ${JSON.stringify(ownerSetupLink)}`)
    }

    const ownerSetupComplete = await request('/api/auth/owner-setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: ownerSetupLink.setup.token, password: 'OwnerSetupSmoke123!' }),
    })
    if (ownerSetupComplete.user?.email !== updatedOwnerEmail || ownerSetupComplete.user?.role !== 'owner') {
      throw new Error(`Owner setup completion failed: ${JSON.stringify(ownerSetupComplete)}`)
    }

    const billingDetails = await request(`/api/admin/resource/companies/${company.id}/billing-details`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({
        legal_name: 'ООО Ресурс Смоук',
        inn: '6500000000',
        billing_email: `billing-${suffix}@example.com`,
      }),
    })
    if (billingDetails.inn !== '6500000000') throw new Error(`Billing details update failed: ${JSON.stringify(billingDetails)}`)

    const template = await request('/api/admin/resource/notification-templates', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ code: `maintenance-${suffix}`, title: 'Плановые работы', body: 'Сервис временно недоступен.' }),
    }, 201)
    const manualMessage = await request('/api/admin/resource/messages', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ companyId: company.id, title: template.title, message: template.body, templateId: template.id }),
    }, 201)
    if (manualMessage.created < 1) throw new Error(`Manual message was not created: ${JSON.stringify(manualMessage)}`)

    await request('/api/admin/resource/service-profile', {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({ service_name: 'AuditAvto Smoke', inn: '6500000000', bank_name: 'Smoke Bank' }),
    })

    const resourceManagerEmail = `resource-manager-${suffix}@example.com`
    await request('/api/admin/resource/service-users', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        email: resourceManagerEmail,
        name: 'Support Manager',
        password: 'ResourceManager123!',
        preset: 'support',
      }),
    }, 201)
    const resourceManagerLogin = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: resourceManagerEmail, password: 'ResourceManager123!' }),
    })
    const resourceManagerHeaders = { Authorization: `Bearer ${resourceManagerLogin.token}` }
    await request('/api/admin/resource/companies-list', { headers: resourceManagerHeaders })
    await request('/api/admin/resource/payments', { headers: resourceManagerHeaders }, 403)
    await request('/api/vehicles', { headers: resourceManagerHeaders }, 403)

    const plan = await request('/api/admin/resource/plans', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        code: `smoke-${suffix}`,
        name: `Smoke ${suffix}`,
        maxVehicles: 15,
        maxUsers: 8,
        analyticsEnabled: true,
        pdfReportEnabled: true,
      }),
    }, 201)
    if (plan.features?.pdfReportEnabled !== true) {
      throw new Error(`Resource admin plan did not preserve PDF report feature: ${JSON.stringify(plan)}`)
    }

    const updatedLimits = await request(`/api/admin/resource/companies/${company.id}/limits`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({
        planCode: 'pilot',
        maxVehicles: 7,
        maxUsers: 4,
        maxStorageMb: 1024,
        ocrEnabled: true,
        accidentModuleEnabled: true,
        analyticsEnabled: false,
        pdfReportEnabled: true,
        apiAccessEnabled: false,
      }),
    })

    if (updatedLimits.maxVehicles !== 7 || updatedLimits.analyticsEnabled !== false || updatedLimits.pdfReportEnabled !== true) {
      throw new Error(`Resource admin company limits update failed: ${JSON.stringify(updatedLimits)}`)
    }

    const payment = await request('/api/admin/resource/payments', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        companyId: company.id,
        planCode: 'pilot',
        amount: 60000,
        currency: 'RUB',
        paymentDate,
        periodStart: paymentDate,
        periodEnd,
        paymentMethod: 'bank_transfer',
        documentNumber: `SMOKE-${suffix}`,
        comment: 'Smoke offline payment',
      }),
    }, 201)

    if (!payment.payment || payment.payment.amount !== 60000 || !payment.subscription?.mrr_rub) {
      throw new Error(`Resource admin payment create failed: ${JSON.stringify(payment)}`)
    }

    const paymentsList = await request('/api/admin/resource/payments', { headers: adminHeaders })
    if (!paymentsList.payments?.some((item) => item.id === payment.payment.id) || !paymentsList.summary || !Array.isArray(paymentsList.expiringSubscriptions)) {
      throw new Error(`Resource admin payments list is missing expected data: ${JSON.stringify(paymentsList)}`)
    }

    const alertsScan = await request('/api/admin/resource/alerts/scan', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({}),
    })
    if (!alertsScan.result || alertsScan.result.scannedSubscriptions < 1 || alertsScan.result.createdNotifications < 1) {
      throw new Error(`Resource admin alerts scan did not create expected subscription alerts: ${JSON.stringify(alertsScan)}`)
    }

    const alertsList = await request('/api/admin/resource/alerts', { headers: adminHeaders })
    const expiringAlert = alertsList.alerts?.find((item) => item.companyId === company.id && item.type === 'subscription_expiring_7d')
    if (!expiringAlert || !alertsList.summary || !Array.isArray(alertsList.expiringSubscriptions)) {
      throw new Error(`Resource admin alerts list is missing expected data: ${JSON.stringify(alertsList)}`)
    }

    const readAlert = await request(`/api/admin/resource/alerts/${expiringAlert.id}/read`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({}),
    })
    if (readAlert.status !== 'read') {
      throw new Error(`Resource admin alert read failed: ${JSON.stringify(readAlert)}`)
    }

    const stats = await request('/api/admin/resource/stats', { headers: adminHeaders })
    const legacyAlias = await request('/api/admin/saas/stats', { headers: adminHeaders })
    const companyDetails = await request(`/api/admin/resource/companies/${company.id}`, { headers: adminHeaders })
    const expectedPlanPrices = { pilot: 5000, standard: 15000, enterprise: 50000 }
    for (const [code, price] of Object.entries(expectedPlanPrices)) {
      const listedPlan = stats.plans?.find((item) => item.code === code)
      if (!listedPlan || listedPlan.monthlyPriceRub !== price) {
        throw new Error(`Resource admin plan price mismatch for ${code}: ${JSON.stringify(listedPlan)}`)
      }
    }

    if (
      companyDetails.company?.id !== company.id ||
      !Array.isArray(companyDetails.owners) ||
      !companyDetails.owners.some((item) => item.email === updatedOwnerEmail) ||
      !Array.isArray(companyDetails.payments) ||
      !companyDetails.payments.some((item) => item.id === payment.payment.id) ||
      !Array.isArray(companyDetails.alerts) ||
      !Array.isArray(companyDetails.auditLogs)
    ) {
      throw new Error(`Resource admin company details are missing expected service data: ${JSON.stringify(companyDetails)}`)
    }

    if (typeof stats.totals?.vehicles !== 'number' || typeof stats.totals?.inspections !== 'number' || typeof stats.totals?.accidents !== 'number') {
      throw new Error(`Resource admin aggregate stats are missing: ${JSON.stringify(stats.totals)}`)
    }

    if (!stats.billing || typeof stats.billing.monthlyRevenueRub !== 'number' || !Array.isArray(stats.plan_breakdown) || !Array.isArray(stats.activity_trend)) {
      throw new Error(`Resource admin dashboard aggregates are missing: ${JSON.stringify({ billing: stats.billing, plan_breakdown: stats.plan_breakdown, activity_trend: stats.activity_trend })}`)
    }

    if (
      !stats.activation?.funnel ||
      !stats.activity?.kpi ||
      !Array.isArray(stats.activity?.series30d) ||
      !stats.storage ||
      !stats.ocr ||
      !stats.alerts ||
      !Array.isArray(stats.recent_alerts) ||
      !Array.isArray(stats.recent_payments) ||
      !Array.isArray(stats.expiring_subscriptions) ||
      !Array.isArray(stats.health_center?.items) ||
      !Array.isArray(stats.limit_usage?.usage) ||
      !Array.isArray(stats.risk_center?.churn) ||
      !Array.isArray(stats.risk_center?.upsell)
    ) {
      throw new Error(`Resource admin SaaS dashboard aggregates are missing: ${JSON.stringify({
        activation: stats.activation,
        activity: stats.activity,
        storage: stats.storage,
        ocr: stats.ocr,
        alerts: stats.alerts,
        recent_alerts: stats.recent_alerts,
        recent_payments: stats.recent_payments,
        expiring_subscriptions: stats.expiring_subscriptions,
        health_center: stats.health_center,
        limit_usage: stats.limit_usage,
        risk_center: stats.risk_center,
      })}`)
    }

    const createdCompany = stats.companies?.find((item) => item.id === company.id)
    if (
      !createdCompany ||
      createdCompany.owners !== 1 ||
      createdCompany.status !== 'inactive' ||
      createdCompany.limits?.maxVehicles !== 7 ||
      createdCompany.limits?.pdfReportEnabled !== true ||
      typeof createdCompany.healthStatus !== 'string' ||
      typeof createdCompany.riskStatus !== 'string'
    ) {
      throw new Error(`Resource admin stats did not include created service entities: ${JSON.stringify(createdCompany)}`)
    }

    const createdOwner = createdCompany.ownerUsers?.find((item) => item.email === updatedOwnerEmail)
    if (!createdOwner || createdOwner.status !== 'active') {
      throw new Error(`Resource admin stats did not expose service owner list: ${JSON.stringify(createdCompany.ownerUsers)}`)
    }

    if (createdOwner.setup?.status !== 'accepted') {
      throw new Error(`Resource admin owner setup status was not accepted: ${JSON.stringify(createdOwner)}`)
    }

    const cancelledPayment = await request(`/api/admin/resource/payments/${payment.payment.id}/cancel`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ comment: 'Smoke cancellation' }),
    })
    if (cancelledPayment.payment?.status !== 'cancelled') {
      throw new Error(`Resource admin payment cancel failed: ${JSON.stringify(cancelledPayment)}`)
    }

    await request(`/api/admin/resource/plans/${plan.code}`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({ status: 'archived' }),
    })

    const statsAfterPlanUpdate = await request('/api/admin/resource/stats', { headers: adminHeaders })
    const updatedPlan = statsAfterPlanUpdate.plans?.find((item) => item.code === plan.code)
    if (!updatedPlan || updatedPlan.status !== 'archived' || updatedPlan.limits?.maxVehicles !== 15 || updatedPlan.features?.analyticsEnabled !== true || updatedPlan.features?.pdfReportEnabled !== true) {
      throw new Error(`Partial plan update did not preserve existing limits/features: ${JSON.stringify(updatedPlan)}`)
    }

    const deniedTenantEndpoints = [
      '/api/vehicles',
      '/api/inspections',
      '/api/defects',
      '/api/users',
      '/api/dashboard/stats',
      '/api/analytics/overview',
      '/api/company/usage',
    ]

    for (const endpoint of deniedTenantEndpoints) {
      await request(endpoint, { headers: adminHeaders }, 403)
    }

    await request(`/api/admin/resource/companies/${company.id}`, {
      method: 'DELETE',
      headers: adminHeaders,
    }, 409)

    const ownerLogin = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: tenantOwnerEmail, password: 'owner123' }),
    })
    const ownerHeaders = { Authorization: `Bearer ${ownerLogin.token}` }
    const ownerJsonHeaders = { ...ownerHeaders, 'Content-Type': 'application/json' }

    await request('/api/admin/resource/stats', { headers: ownerHeaders }, 403)

    const tenantManager = await request('/api/users', {
      method: 'POST',
      headers: ownerJsonHeaders,
      body: JSON.stringify({
        email: tenantManagerEmail,
        password: 'manager123',
        name: 'Tenant Manager',
        role: 'manager',
      }),
    }, 201)

    await request('/api/users', {
      method: 'POST',
      headers: ownerJsonHeaders,
      body: JSON.stringify({
        email: tenantInspectorEmail,
        password: 'inspector123',
        name: 'Tenant Inspector',
        role: 'inspector',
      }),
    }, 201)

    const managerLogin = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: tenantManagerEmail, password: 'manager123' }),
    })
    const inspectorLogin = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: tenantInspectorEmail, password: 'inspector123' }),
    })

    await request('/api/admin/resource/stats', { headers: { Authorization: `Bearer ${managerLogin.token}` } }, 403)
    await request('/api/admin/resource/session-cookies', { headers: { Authorization: `Bearer ${managerLogin.token}` } }, 403)
    await request('/api/admin/resource/stats', { headers: { Authorization: `Bearer ${inspectorLogin.token}` } }, 403)

    await request(`/api/admin/resource/owners/${owner.id}`, {
      method: 'DELETE',
      headers: adminHeaders,
    }, 204)

    const statsAfterOwnerDelete = await request('/api/admin/resource/stats', { headers: adminHeaders })
    const companyAfterOwnerDelete = statsAfterOwnerDelete.companies?.find((item) => item.id === company.id)
    const inactiveOwner = companyAfterOwnerDelete?.ownerUsers?.find((item) => item.id === owner.id)
    if (!companyAfterOwnerDelete || companyAfterOwnerDelete.owners !== 0 || inactiveOwner?.status !== 'inactive') {
      throw new Error(`Resource admin owner delete did not deactivate owner: ${JSON.stringify(companyAfterOwnerDelete)}`)
    }

    await request(`/api/admin/resource/plans/${plan.code}`, {
      method: 'DELETE',
      headers: adminHeaders,
    }, 204)

    await request(`/api/admin/resource/companies/${emptyCompany.id}`, {
      method: 'DELETE',
      headers: adminHeaders,
    }, 204)

    console.log(JSON.stringify({
      ok: true,
      companyId: company.id,
      ownerEmail: updatedOwner.email,
      planCode: plan.code,
      alertsCreated: alertsScan.result.createdNotifications,
      companyDetailsOk: companyDetails.company?.id === company.id,
      companies: stats.totals.companies,
      owners: stats.totals.owners,
      legacyAliasOk: legacyAlias.totals?.companies === stats.totals?.companies,
      adminTenantEndpointsDenied: deniedTenantEndpoints.length,
      resourceAdminDeniedForTenantRoles: Boolean(tenantManager.id),
      resourceManagerRbacOk: true,
      pdfReportFeaturePreserved: updatedPlan.features?.pdfReportEnabled === true,
      manualMessageRecipients: manualMessage.created,
      sessionCookiesDiagnosticsOk: cookieOnlyDiagnostics.authCookiePresent === true,
      planPricesOk: true,
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
