import { expect, test } from '@playwright/test'
import * as speakeasy from 'speakeasy'
import { createUser, deleteUser, getAdminToken, loginAsAdmin, WEB_BASE } from './helpers'

test('MFA UI: end-to-end flow (admin per-user) - UI path', async ({ page, request }) => {
  await loginAsAdmin(page)

  const adminToken = await getAdminToken(request)
  const user = await createUser(request, adminToken, 'MFA UI Playwright')

  try {
    await page.goto(`${WEB_BASE}/admin/mfa/${user.id}`)

    await page.getByRole('button', { name: 'Подготовить MFA' }).click()
    await expect(page.locator('img[alt="QR-код MFA"]')).toBeVisible({ timeout: 10000 })

    const showSecretButton = page.getByRole('button', { name: 'Показать секрет' })
    if (await showSecretButton.count()) {
      await showSecretButton.click()
    }

    const secret = (await page.locator('code').first().innerText()).trim()
    expect(secret).toBeTruthy()

    const code = speakeasy.totp({ secret, encoding: 'base32' })
    await page.fill('input[placeholder="6-значный код"]', code)
    await page.getByRole('button', { name: 'Подтвердить' }).click()

    await expect(page.getByText('MFA успешно активирован')).toBeVisible({ timeout: 10000 })
  } finally {
    await deleteUser(request, adminToken, user.id)
  }
})
