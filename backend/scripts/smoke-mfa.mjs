import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import process from 'node:process'
import speakeasy from 'speakeasy'
import { seedSmokeTenantOwner } from './smoke-helpers.mjs'

const HOST = '127.0.0.1'
const PORT = Number(process.env.PORT || 3013 + (process.pid % 500))
const DATABASE_PATH = `./.tmp-smoke/smoke-mfa-${process.pid}.sqlite`
const JWT_SECRET = crypto.randomBytes(32).toString('hex')
const BASE_URL = `http://${HOST}:${PORT}`
const LOGIN_URL = `${BASE_URL}/api/auth/login`
const USERS_URL = `${BASE_URL}/api/users`
const MFA_SETUP_URL = (id) => `${BASE_URL}/api/users/${id}/mfa/setup`
const MFA_ENABLE_URL = (id) => `${BASE_URL}/api/users/${id}/mfa/enable`
const MFA_VERIFY_URL = (id) => `${BASE_URL}/api/users/${id}/mfa/verify`
const MFA_DISABLE_URL = (id) => `${BASE_URL}/api/users/${id}/mfa/disable`

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForServer(url, timeoutMs = 30000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'owner@example.com', password: 'owner123' }),
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
    // Wait for server to be ready
    await waitForServer(LOGIN_URL)

    // Admin login
    const login = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: owner.email, password: owner.password }),
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

    const otpauthUrl = setup.otpauth_url
    const secret = setup.secret
    if (!otpauthUrl || !secret) {
      throw new Error('MFA setup did not return otpauth_url or secret')
    }

    // Generate TOTp code using the secret
    const code = speakeasy.totp({ secret, encoding: 'base32' })

    // Enable MFA with the explicit endpoint used by clients.
    const verifyResponse = await fetch(MFA_ENABLE_URL(createdUser.id), {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ token: code }),
    })
    if (!verifyResponse.ok) {
      throw new Error(`MFA enable failed with HTTP ${verifyResponse.status}: ${await verifyResponse.text()}`)
    }
    const verify = await verifyResponse.json()
    if (!verify || verify.error) {
      throw new Error('MFA verification failed')
    }

    // Login again with MFA-enabled user
    const login2 = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: 'mfa123' }),
    })
    if (!login2.mfaRequired || !login2.mfaToken) {
      throw new Error('MFA-enabled login did not return a challenge token')
    }

    const loginCode = speakeasy.totp({ secret, encoding: 'base32' })
    const login2Verified = await request('/api/auth/mfa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mfaToken: login2.mfaToken, token: loginCode }),
    })
    if (!login2Verified.token) throw new Error('MFA challenge verification did not return a token')

    const badDisable = await fetch(MFA_DISABLE_URL(createdUser.id), {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ password: owner.password, token: '000000' }),
    })
    if (badDisable.status !== 401) {
      throw new Error(`MFA disable with an invalid token should return 401, got ${badDisable.status}`)
    }

    const disableCode = speakeasy.totp({ secret, encoding: 'base32' })
    const disable = await request(`/api/users/${createdUser.id}/mfa/disable`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ password: owner.password, token: disableCode }),
    })
    if (!disable?.ok || disable.mfa_enabled !== false) {
      throw new Error('MFA disable did not return a disabled state')
    }

    const loginAfterDisable = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: 'mfa123' }),
    })
    if (loginAfterDisable.mfaRequired || !loginAfterDisable.token) {
      throw new Error('Disabled MFA user login should not return an MFA challenge')
    }

    const legacyEmail = `mfa-legacy-smoke-${suffix}@example.com`
    const legacyUser = await request('/api/users', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ email: legacyEmail, password: 'mfa123', name: 'MFA Legacy Smoke', role: 'inspector' }),
    }, 201)
    const legacySetupResponse = await fetch(MFA_SETUP_URL(legacyUser.id), {
      method: 'POST',
      headers: jsonHeaders,
    })
    if (!legacySetupResponse.ok) {
      throw new Error(`Legacy MFA setup failed with HTTP ${legacySetupResponse.status}: ${await legacySetupResponse.text()}`)
    }
    const legacySetup = await legacySetupResponse.json()
    const legacyCode = speakeasy.totp({ secret: legacySetup.secret, encoding: 'base32' })
    const legacyVerifyResponse = await fetch(MFA_VERIFY_URL(legacyUser.id), {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ token: legacyCode }),
    })
    if (!legacyVerifyResponse.ok) {
      throw new Error(`Legacy MFA verify alias failed with HTTP ${legacyVerifyResponse.status}: ${await legacyVerifyResponse.text()}`)
    }

    await request(`/api/users/${legacyUser.id}`, { method: 'DELETE', headers }, 204)

    // Cleanup: delete test user
    await request(`/api/users/${createdUser.id}`, { method: 'DELETE', headers }, 204)

    console.log(
      JSON.stringify({
        ok: true,
        mfaEnabledUser: testEmail,
        tokenFromMfaLogin: login2Verified.token != null,
        mfaDisabled: disable.mfa_enabled === false,
        tokenAfterDisableLogin: loginAfterDisable.token != null,
        legacyVerifyAlias: true,
      }, null, 2)
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
