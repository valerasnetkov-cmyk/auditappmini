import { expect, test } from '@playwright/test'
import * as speakeasy from 'speakeasy'
import { API_BASE, apiHeaders, createUser, deleteUser, getAdminToken } from './helpers'

test('MFA Owner: setup and verify for a user (API-driven)', async ({ request }) => {
  const adminToken = await getAdminToken(request)
  const user = await createUser(request, adminToken, 'MFA Playwright')

  try {
    const headers = apiHeaders(adminToken)

    const setup = await request.post(`${API_BASE}/api/users/${user.id}/mfa/setup`, { headers })
    if (!setup.ok()) throw new Error(`MFA setup failed with HTTP ${setup.status()}: ${await setup.text()}`)

    const setupData = (await setup.json()) as { otpauth_url?: string; secret?: string }
    expect(setupData.otpauth_url).toBeTruthy()
    const secret = setupData.secret
    expect(secret).toBeTruthy()
    if (!secret) throw new Error('MFA setup response does not contain secret')

    const code = speakeasy.totp({ secret, encoding: 'base32' })
    const verify = await request.post(`${API_BASE}/api/users/${user.id}/mfa/enable`, {
      headers,
      data: { token: code },
    })
    if (!verify.ok()) throw new Error(`MFA verify failed with HTTP ${verify.status()}: ${await verify.text()}`)

    const verifyData = (await verify.json()) as { token?: string }
    expect(verifyData.token).toBeTruthy()
  } finally {
    await deleteUser(request, adminToken, user.id)
  }
})
