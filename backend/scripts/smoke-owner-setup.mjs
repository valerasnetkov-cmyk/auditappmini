import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import process from 'node:process'

const HOST = '127.0.0.1'
const PORT = Number(process.env.PORT || 4717 + (process.pid % 500))
const DATABASE_PATH = `./.tmp-smoke/smoke-owner-setup-${process.pid}.sqlite`
const JWT_SECRET = 'smoke-owner-setup-secret'
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
    throw new Error(`${path} expected ${expectedStatus} but got ${response.status}: ${body}`)
  }
  if (response.status === 204) return null
  return response.json()
}

async function run() {
  const server = spawn(process.execPath, ['src/server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(PORT),
      DATABASE_PATH,
      JWT_SECRET,
      WEB_APP_URL: 'http://localhost:3002',
      OWNER_SETUP_TOKEN_TTL: '1h',
    },
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

    const adminHeaders = {
      Authorization: `Bearer ${adminLogin.token}`,
      'Content-Type': 'application/json',
    }
    const companyId = `owner-setup-company-${process.pid}`
    const ownerEmail = `owner-setup-${process.pid}@example.com`

    await request('/api/admin/resource/companies', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        id: companyId,
        slug: companyId,
        name: `Owner Setup Smoke Company ${process.pid}`,
      }),
    }, 201)

    const owner = await request(`/api/admin/resource/companies/${companyId}/owners`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ email: ownerEmail, name: 'Owner Setup Smoke', issue_setup_link: true }),
    }, 201)

    const setupLink = owner.setup
    if (!setupLink?.token || owner.email !== ownerEmail) {
      throw new Error(`Resource admin did not issue expected owner setup token: ${JSON.stringify(owner)}`)
    }

    const ownerPassword = 'ownerSmoke123'
    const ownerSetup = await request('/api/auth/owner-setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: setupLink.token, password: ownerPassword }),
    })

    if (ownerSetup.user?.role !== 'owner' || ownerSetup.user?.company_id !== companyId) {
      throw new Error(`Owner setup returned unexpected user: ${JSON.stringify(ownerSetup.user)}`)
    }

    await request('/api/auth/owner-setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: setupLink.token, password: 'ownerSmoke456' }),
    }, 401)

    const ownerLogin = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ownerEmail, password: ownerPassword }),
    })

    if (ownerLogin.user?.role !== 'owner' || ownerLogin.user?.company_id !== companyId) {
      throw new Error(`Owner login returned unexpected user: ${JSON.stringify(ownerLogin.user)}`)
    }

    await request(`/api/admin/resource/owners/${owner.id}`, {
      method: 'DELETE',
      headers: adminHeaders,
    }, 204)

    await request('/api/auth/me', {
      headers: { Authorization: `Bearer ${ownerLogin.token}` },
    }, 403)

    console.log(JSON.stringify({
      ok: true,
      companyId,
      ownerEmail,
      setupUserRole: ownerSetup.user.role,
      reusedSetupTokenStatus: 401,
      ownerLoginRole: ownerLogin.user.role,
      inactiveOwnerTokenStatus: 403,
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
