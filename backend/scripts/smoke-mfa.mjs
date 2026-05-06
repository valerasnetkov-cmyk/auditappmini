import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import process from 'node:process'
import speakeasy from 'speakeasy'

const HOST = '127.0.0.1'
const PORT = Number(process.env.PORT || 3013 + (process.pid % 500))
const DATABASE_PATH = `./.tmp-smoke/smoke-mfa-${process.pid}.sqlite`
const BASE_URL = `http://${HOST}:${PORT}`
const LOGIN_URL = `${BASE_URL}/api/auth/login`
const USERS_URL = `${BASE_URL}/api/users`
const MFA_SETUP_URL = (id) => `${BASE_URL}/api/users/${id}/mfa/setup`
const MFA_VERIFY_URL = (id) => `${BASE_URL}/api/users/${id}/mfa/verify`

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForServer(url, timeoutMs = 15000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@example.com', password: 'admin123' }),
      })
      if (res.status < 500) return
    } catch {
      // ignore
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
  const server = spawn(process.execPath, ['src/server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(PORT), DATABASE_PATH },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let stderr = ''
  server.stderr.on('data', (chunk) => {
    stderr += chunk.toString()
  })

  try {
    // Wait for server to be ready
    await waitForServer(LOGIN_URL)

    // Admin login
    const login = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'admin123' }),
    })
    const token = login.token
    if (!token) throw new Error('Login response did not include a token')
    const headers = { Authorization: `Bearer ${token}` }
    const jsonHeaders = { ...headers, 'Content-Type': 'application/json' }

    // Create a test user for MFA flow
    const suffix = Date.now()
    const testEmail = `mfa-smoke-${suffix}@example.com`
    const createdUser = await request('/api/users', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ email: testEmail, password: 'mfa123', name: 'MFA Smoke', role: 'inspector' }),
    }, 201)

    // Setup MFA for the new user
    const setup = await request(`/api/users/${createdUser.id}/mfa/setup`, {
      method: 'POST',
      headers: jsonHeaders,
    })

    const otpauthUrl = setup.data.otpauth_url
    const secret = setup.data.secret
    if (!otpauthUrl || !secret) {
      throw new Error('MFA setup did not return otpauth_url or secret')
    }

    // Generate TOTp code using the secret
    const code = speakeasy.totp({ secret, encoding: 'base32' })

    // Verify MFA code
    const verify = await request(`/api/users/${createdUser.id}/mfa/verify`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ code }),
    })
    if (!verify || verify.error) {
      throw new Error('MFA verification failed')
    }

    // Login again with MFA-enabled user
    const login2 = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: 'mfa123' }),
    })
    if (!login2.token) throw new Error('MFA-enabled login did not return a token')

    // Cleanup: delete test user
    await request(`/api/users/${createdUser.id}`, { method: 'DELETE', headers }, 204)

    console.log(
      JSON.stringify({ ok: true, mfaEnabledUser: testEmail, tokenFromMfaLogin: login2.token != null }),
      null,
      2
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
