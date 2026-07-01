import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import process from 'node:process'
import { seedSmokeTenantOwner } from './smoke-helpers.mjs'
import {
  clearTelegramDedupe,
  getTelegramBotStatus,
  sendTelegramAdminAlert,
} from '../src/services/telegramBot.js'

const HOST = '127.0.0.1'
const PORT = Number(process.env.PORT || 5917 + (process.pid % 500))
const DATABASE_PATH = `./.tmp-smoke/smoke-telegram-${process.pid}.sqlite`
const JWT_SECRET = crypto.randomBytes(32).toString('hex')
const BASE_URL = `http://${HOST}:${PORT}`

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

async function seedUsers() {
  await seedSmokeTenantOwner({
    databasePath: DATABASE_PATH,
    email: 'telegram-owner@example.com',
    password: 'owner123',
    companyId: 'telegram-smoke-company',
    name: 'Telegram Owner',
    keepOpen: true,
  })
  const { getDb, closeDatabase } = await import('../src/db.js')
  const bcrypt = await import('bcryptjs')
  try {
    const db = getDb()
    db.prepare(`
      INSERT INTO users (id, email, password, name, role, status, company_id)
      VALUES (?, ?, ?, ?, ?, 'active', ?)
    `).run(
      'telegram-manager',
      'telegram-manager@example.com',
      bcrypt.default.hashSync('manager123', 10),
      'Telegram Manager',
      'manager',
      'telegram-smoke-company',
    )
    db.prepare(`
      INSERT INTO users (id, email, password, name, role, status, company_id)
      VALUES (?, ?, ?, ?, ?, 'active', ?)
    `).run(
      'telegram-inspector',
      'telegram-inspector@example.com',
      bcrypt.default.hashSync('inspector123', 10),
      'Telegram Inspector',
      'inspector',
      'telegram-smoke-company',
    )
    db.prepare(`
      INSERT INTO users (id, email, password, name, role, status, company_id, resource_permission_preset)
      VALUES (?, ?, ?, ?, 'resource_manager', 'active', NULL, 'custom')
    `).run(
      'telegram-resource-manager',
      'telegram-resource-manager@example.com',
      bcrypt.default.hashSync('resource123', 10),
      'Telegram Resource Manager',
    )
  } finally {
    closeDatabase()
  }
}

async function assertServiceBehavior() {
  clearTelegramDedupe()
  const disabled = await sendTelegramAdminAlert({
    type: 'pilot_request_created',
    title: 'Новая заявка',
    message: 'token=secret should be redacted',
    url: '/saas-admin/pilot-requests',
    entityKey: 'disabled',
  }, {
    env: { TELEGRAM_BOT_ENABLED: 'false', TELEGRAM_BOT_TOKEN: 'secret-token', TELEGRAM_ADMIN_CHAT_ID: '1' },
    fetchImpl: async () => {
      throw new Error('fetch should not be called when Telegram is disabled')
    },
  })
  if (!disabled.skipped || disabled.reason !== 'disabled') {
    throw new Error(`Disabled Telegram should skip safely: ${JSON.stringify(disabled)}`)
  }

  const missing = await sendTelegramAdminAlert({
    type: 'telegram_test',
    title: 'Test',
    message: 'Missing config',
    url: '/saas-admin/dashboard',
    entityKey: 'missing',
  }, { env: { TELEGRAM_BOT_ENABLED: 'true' } })
  if (!missing.skipped || missing.reason !== 'not_configured') {
    throw new Error(`Missing Telegram config should skip safely: ${JSON.stringify(missing)}`)
  }

  const calls = []
  const env = {
    TELEGRAM_BOT_ENABLED: 'true',
    TELEGRAM_BOT_TOKEN: '123456:secret-token-value',
    TELEGRAM_ADMIN_CHAT_ID: 'admin-chat',
    WEB_APP_URL: 'https://auditavto.ru',
  }
  const fetchImpl = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) })
    return { ok: true, status: 200, text: async () => 'ok' }
  }

  const sent = await sendTelegramAdminAlert({
    type: 'pilot_request_created',
    title: 'Новая заявка на пилот',
    message: 'Компания: Рога и копыта. token=secret',
    url: '/saas-admin/pilot-requests',
    entityKey: 'pilot-1',
  }, { env, fetchImpl, now: 1000 })
  const duplicate = await sendTelegramAdminAlert({
    type: 'pilot_request_created',
    title: 'Новая заявка на пилот',
    message: 'Компания: Рога и копыта.',
    url: '/saas-admin/pilot-requests',
    entityKey: 'pilot-1',
  }, { env, fetchImpl, now: 2000 })

  if (!sent.delivered || duplicate.reason !== 'duplicate' || calls.length !== 1) {
    throw new Error(`Telegram send/dedupe failed: ${JSON.stringify({ sent, duplicate, calls })}`)
  }
  const payloadText = calls[0].body.text
  if (!payloadText.includes('[AuditAvto] Новая заявка на пилот') || !payloadText.includes('https://auditavto.ru/saas-admin/pilot-requests')) {
    throw new Error(`Telegram payload is missing expected text: ${payloadText}`)
  }
  if (/secret-token-value|token=secret/.test(JSON.stringify(calls.map((call) => call.body)))) {
    throw new Error(`Telegram payload leaked a token: ${JSON.stringify(calls.map((call) => call.body))}`)
  }

  const status = getTelegramBotStatus(env)
  if (!status.enabled || !status.configured || !status.tokenFingerprint || JSON.stringify(status).includes('secret-token-value')) {
    throw new Error(`Telegram status is not safe: ${JSON.stringify(status)}`)
  }
}

function assertProductionDoctorTelegramCheck() {
  const doctor = spawnSync(process.execPath, ['scripts/launch-doctor.mjs', '--production'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      TELEGRAM_BOT_ENABLED: 'true',
      TELEGRAM_BOT_TOKEN: '',
      TELEGRAM_ADMIN_CHAT_ID: 'admin-chat',
    },
    encoding: 'utf8',
    windowsHide: true,
  })
  if (doctor.status === 0 || !doctor.stdout.includes('TELEGRAM_BOT_TOKEN is required when TELEGRAM_BOT_ENABLED=true')) {
    throw new Error(`Production doctor did not report missing Telegram token: ${doctor.stdout}\n${doctor.stderr}`)
  }
}

await assertServiceBehavior()
assertProductionDoctorTelegramCheck()
await seedUsers()

const server = spawn(process.execPath, ['src/server.js'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: String(PORT),
    DATABASE_PATH,
    JWT_SECRET,
    TELEGRAM_BOT_ENABLED: 'false',
    TELEGRAM_BOT_TOKEN: 'server-secret-token',
    TELEGRAM_ADMIN_CHAT_ID: 'admin-chat',
  },
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
  const ownerLogin = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'telegram-owner@example.com', password: 'owner123' }),
  })
  const managerLogin = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'telegram-manager@example.com', password: 'manager123' }),
  })
  const inspectorLogin = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'telegram-inspector@example.com', password: 'inspector123' }),
  })
  const resourceLogin = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'telegram-resource-manager@example.com', password: 'resource123' }),
  })

  const adminHeaders = { Authorization: `Bearer ${adminLogin.token}` }
  const status = await request('/api/admin/resource/telegram/status', { headers: adminHeaders })
  if (status.enabled !== false || status.configured !== true || JSON.stringify(status).includes('server-secret-token')) {
    throw new Error(`Admin Telegram status is unsafe: ${JSON.stringify(status)}`)
  }

  const test = await request('/api/admin/resource/telegram/send-test', {
    method: 'POST',
    headers: { ...adminHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  if (!test.ok || !test.skipped || test.reason !== 'disabled' || JSON.stringify(test).includes('server-secret-token')) {
    throw new Error(`Telegram send-test should skip safely when disabled: ${JSON.stringify(test)}`)
  }

  for (const token of [ownerLogin.token, managerLogin.token, inspectorLogin.token, resourceLogin.token]) {
    await request('/api/admin/resource/telegram/status', { headers: { Authorization: `Bearer ${token}` } }, 403)
    await request('/api/admin/resource/telegram/send-test', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }, 403)
  }

  console.log(JSON.stringify({
    ok: true,
    statusConfigured: status.configured,
    tokenFingerprintPresent: Boolean(status.tokenFingerprint),
    sendTestSkipped: test.reason,
    deniedRoles: ['owner', 'manager', 'inspector', 'resource_manager'],
    mockPayloadOk: true,
  }, null, 2))
} finally {
  server.kill()
  await sleep(300)
  await fs.rm(DATABASE_PATH, { force: true })
}

if (stderr.trim() && !stderr.includes('Telegram bot enabled but token or chat id is missing')) {
  console.error(stderr.trim())
}
