import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import http from 'node:http'
import process from 'node:process'

const HOST = '127.0.0.1'
const PORT = Number(process.env.PORT || 4717 + (process.pid % 500))
const DIRECTUS_PORT = Number(process.env.DIRECTUS_PORT || 5717 + (process.pid % 500))
const DATABASE_PATH = `./.tmp-smoke/smoke-owner-setup-${process.pid}.sqlite`
const JWT_SECRET = 'smoke-owner-setup-secret'
const DIRECTUS_TOKEN = 'smoke-directus-token'
const BASE_URL = `http://${HOST}:${PORT}`
const DIRECTUS_URL = `http://${HOST}:${DIRECTUS_PORT}`

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function createFakeDirectusServer() {
  const companyId = 1000 + (process.pid % 1000)
  const expectedCompanyId = String(companyId)
  const ownerEmail = `owner-setup-${process.pid}@example.com`
  let ownerStatus = 'active'

  const server = http.createServer((req, res) => {
    const authorization = req.headers.authorization
    if (authorization !== `Bearer ${DIRECTUS_TOKEN}`) {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ errors: [{ message: 'Unauthorized' }] }))
      return
    }

    const url = new URL(req.url || '/', DIRECTUS_URL)
    if (req.method === 'GET' && url.pathname === '/items/companies') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        data: [
          {
            id: companyId,
            slug: `directus-owner-setup-company-${companyId}`,
            name: `Owner Setup Smoke Company ${companyId}`,
            country: 'RU',
            region: 'RU-SAK',
            status: 'active',
          },
        ],
      }))
      return
    }

    if (req.method === 'GET' && url.pathname === '/items/company_owners') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        data: [
          {
            id: `directus-owner-${process.pid}`,
            company_id: companyId,
            email: ownerEmail,
            name: 'Owner Setup Smoke',
            status: ownerStatus,
          },
        ],
      }))
      return
    }

    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ errors: [{ message: `Unhandled ${req.method} ${url.pathname}` }] }))
  })

  return {
    server,
    companyId,
    expectedCompanyId,
    ownerEmail,
    setOwnerStatus: (status) => {
      ownerStatus = status
    },
  }
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, HOST, () => {
      server.off('error', reject)
      resolve()
    })
  })
}

function closeServer(server) {
  return new Promise((resolve) => {
    server.close(() => resolve())
  })
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
    throw new Error(`${path} expected ${expectedStatus} but got ${response.status}: ${body}`)
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}

async function run() {
  const fakeDirectus = createFakeDirectusServer()
  await listen(fakeDirectus.server, DIRECTUS_PORT)

  const server = spawn(process.execPath, ['src/server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(PORT),
      DATABASE_PATH,
      JWT_SECRET,
      DIRECTUS_URL,
      DIRECTUS_TOKEN,
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
      body: JSON.stringify({
        email: 'admin@example.com',
        password: 'admin123',
      }),
    })

    const adminHeaders = {
      Authorization: `Bearer ${adminLogin.token}`,
      'Content-Type': 'application/json',
    }

    const provisioning = await request('/api/integrations/directus/provisioning/sync', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ issue_setup_links: true }),
    })

    const setupLink = provisioning.result?.setup_links?.[0]
    if (!setupLink?.token || setupLink.email !== fakeDirectus.ownerEmail) {
      throw new Error(`Provisioning did not issue expected owner setup token: ${JSON.stringify(provisioning)}`)
    }

    const ownerPassword = 'ownerSmoke123'
    const ownerSetup = await request('/api/auth/owner-setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: setupLink.token,
        password: ownerPassword,
      }),
    })

    if (ownerSetup.user?.role !== 'owner' || ownerSetup.user?.company_id !== fakeDirectus.expectedCompanyId) {
      throw new Error(`Owner setup returned unexpected user: ${JSON.stringify(ownerSetup.user)}`)
    }

    await request('/api/auth/owner-setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: setupLink.token,
        password: 'ownerSmoke456',
      }),
    }, 401)

    const ownerLogin = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: fakeDirectus.ownerEmail,
        password: ownerPassword,
      }),
    })

    if (ownerLogin.user?.role !== 'owner' || ownerLogin.user?.company_id !== fakeDirectus.expectedCompanyId) {
      throw new Error(`Owner login returned unexpected user: ${JSON.stringify(ownerLogin.user)}`)
    }

    fakeDirectus.setOwnerStatus('inactive')
    await request('/api/integrations/directus/provisioning/sync', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ issue_setup_links: false }),
    })

    await request('/api/auth/me', {
      headers: { Authorization: `Bearer ${ownerLogin.token}` },
    }, 403)

    console.log(
      JSON.stringify(
        {
          ok: true,
          companyId: fakeDirectus.companyId,
          normalizedCompanyId: fakeDirectus.expectedCompanyId,
          ownerEmail: fakeDirectus.ownerEmail,
          setupUserRole: ownerSetup.user.role,
          reusedSetupTokenStatus: 401,
          ownerLoginRole: ownerLogin.user.role,
          inactiveOwnerTokenStatus: 403,
        },
        null,
        2,
      ),
    )
  } finally {
    server.kill()
    await sleep(300)
    await closeServer(fakeDirectus.server)
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
