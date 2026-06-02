import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import process from 'node:process'
import { seedSmokeTenantOwner } from './smoke-helpers.mjs'

const HOST = '127.0.0.1'
const PORT = Number(process.env.PORT || 3013 + (process.pid % 500))
const DATABASE_PATH = `./.tmp-smoke/smoke-auth-${process.pid}.sqlite`
const BASE_URL = `http://${HOST}:${PORT}`
const LOGIN_URL = `${BASE_URL}/api/auth/login`
const JWT_SECRET = crypto.randomBytes(32).toString('hex')

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForServer(url, timeoutMs = 30000) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'owner@example.com',
          password: 'owner123',
        }),
      })

      if (response.status !== 500) {
        return
      }
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

  if (response.status === 204) {
    return null
  }

  return response.json()
}

async function run() {
  const owner = await seedSmokeTenantOwner({ databasePath: DATABASE_PATH })

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
    await waitForServer(LOGIN_URL)

    const login = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: owner.email,
        password: owner.password,
      }),
    })

    const token = login.token
    if (!token) {
      throw new Error('Login response did not include a token')
    }

    const headers = { Authorization: `Bearer ${token}` }
    const jsonHeaders = { ...headers, 'Content-Type': 'application/json' }
    const suffix = Date.now()
    const createdEmail = `smoke-user-${suffix}@example.com`
    const updatedEmail = `smoke-user-updated-${suffix}@example.com`
    const ownerCreatedEmail = `smoke-owner-created-${suffix}@example.com`

    const [meResponse, statsResponse, settingsResponse] = await Promise.all([
      request('/api/auth/me', { headers }),
      request('/api/dashboard/stats', { headers }),
      request('/api/settings', { headers }),
    ])

    const updateResponse = await request('/api/settings', {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({
        scheduled_inspection_days: settingsResponse.scheduled_inspection_days,
        notification_days_before: settingsResponse.notification_days_before,
        timezone_offset: settingsResponse.timezone_offset,
      }),
    })

    const createdUser = await request('/api/users', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        email: createdEmail,
        password: 'smoke123',
        name: 'Smoke User',
        role: 'inspector',
      }),
    }, 201)

    const updatedUser = await request(`/api/users/${createdUser.id}`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({
        email: updatedEmail,
        name: 'Smoke User Updated',
        role: 'manager',
        password: 'smoke456',
      }),
    })

    const updatedLogin = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: updatedEmail,
        password: 'smoke456',
      }),
    })

    await request(`/api/users/${createdUser.id}`, {
      method: 'DELETE',
      headers,
    }, 204)

    const adminCreatedUser = await request('/api/users', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        email: ownerCreatedEmail,
        password: 'smoke123',
        name: 'Admin Created Manager',
        role: 'manager',
      }),
    }, 201)

    await request('/api/users', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        email: `forbidden-owner-${suffix}@example.com`,
        password: 'smoke123',
        name: 'Forbidden Owner',
        role: 'owner',
      }),
    }, 403)

    await request(`/api/users/${adminCreatedUser.id}`, {
      method: 'DELETE',
      headers,
    }, 204)

    await request('/api/auth/me', {
      headers: { Authorization: `Bearer ${updatedLogin.token}` },
    }, 401)

    console.log(
      JSON.stringify(
        {
          ok: true,
          loginUser: login.user?.email,
          meUser: meResponse.email,
          totalVehicles: statsResponse.totalVehicles,
          inspectionsToday: statsResponse.inspectionsToday,
          settingsNumeric:
            typeof settingsResponse.scheduled_inspection_days === 'number' &&
            typeof settingsResponse.notification_days_before === 'number' &&
            typeof settingsResponse.timezone_offset === 'number',
          settingsUpdateNumeric:
            typeof updateResponse.scheduled_inspection_days === 'number' &&
            typeof updateResponse.notification_days_before === 'number' &&
            typeof updateResponse.timezone_offset === 'number',
          createdUserEmail: createdUser.email,
          updatedUserEmail: updatedUser.email,
          updatedUserRole: updatedUser.role,
          updatedLoginEmail: updatedLogin.user?.email,
          deletedUserTokenRejected: true,
          adminCreatedUserRole: adminCreatedUser.role,
        },
        null,
        2,
      ),
    )
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
