import { test, expect } from '@playwright/test'
import * as speakeasy from 'speakeasy'

// This test uses API calls to set up MFA for a user and then verifies the flow via API.
// It demonstrates the end-to-end MFA enablement without relying on full UI interactions.

test('MFA Admin: setup and verify for a user (API-driven)', async ({ request }) => {
  // Backend API base for tests (configurable via env, default to 3001 if available)
  const API_BASE = process.env.BACKEND_API_BASE || 'http://localhost:3001'
  // Admin login
  const login = await request.post(`${API_BASE}/api/auth/login`, {
    data: { email: 'admin@example.com', password: 'admin123' },
  })
  const loginBody = await login.json()
  const token = loginBody?.token
  expect(token).toBeTruthy()

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  // Create a test user
  const suffix = Date.now()
  const userEmail = `mfa-playwright-${suffix}@example.com`
  const created = await request.post(`${API_BASE}/api/users`, {
    headers,
    data: { email: userEmail, password: 'mfa123', name: 'MFA Playwright', role: 'inspector' },
  })
  const user = await created.json()
  expect(user.id).toBeTruthy()

  // MFA Setup
  const setup = await request.post(`${API_BASE}/api/users/${user.id}/mfa/setup`, { headers })
  const setupData = await setup.json()
  const otpauth_url = setupData?.data?.otpauth_url
  const secret = setupData?.data?.secret
  expect(otpauth_url).toBeTruthy()
  expect(secret).toBeTruthy()

  // Generate TOTp
  const code = speakeasy.totp({ secret, encoding: 'base32' })

  // Verify MFA
  const verify = await request.post(`${API_BASE}/api/users/${user.id}/mfa/verify`, {
    headers,
    data: { code },
  })
  expect(await verify.text()).toBeFalsy()
  // Clean up: delete user
  await request.delete(`${API_BASE}/api/users/${user.id}`, { headers })
})
