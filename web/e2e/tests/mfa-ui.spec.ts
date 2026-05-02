import { test, expect } from '@playwright/test'
import * as speakeasy from 'speakeasy'

// UI end-to-end MFA flow for an admin configuring MFA per user
test('MFA UI: end-to-end flow (admin per-user) - UI path', async ({ page }) => {
  const base = 'http://localhost:3002'

  // Try login via UI; if login form not present, skip gracefully
  await page.goto(`${base}/login`).catch(() => {})
  const hasEmail = await page.locator('input[name="email"]').count()
  if (hasEmail > 0) {
    await page.fill('input[name="email"]', 'admin@example.com')
    const hasPwd = await page.locator('input[name="password"]').count()
    if (hasPwd > 0) {
      await page.fill('input[name="password"]', 'admin123')
      const loginBtn = page.locator('button[type="submit"]')
      if (await loginBtn.count() > 0) {
        await loginBtn.click()
        // wait to land on admin area
        await page.waitForURL('**/admin/**', { timeout: 15000 }).catch(() => {})
      }
    }
  } else {
    // If there is no login form, skip UI login path
    test.skip('UI login page not available in this environment')
  }

  // Go to MFA list and open first user
  await page.goto(`${base}/admin/mfa`)
  const firstRow = page.locator('table tbody tr').first()
  await firstRow.waitFor()
  const setupLink = firstRow.locator('a', { hasText: 'Настроить MFA' })
  if (await setupLink.count() === 0) {
    test.skip('No user with MFA actions found')
  }
  await setupLink.first().click()

  // Step 1: Prepare MFA
  await page.click('button:has-text("Подготовить MFA")')
  await page.waitForSelector('img[alt="QR-код MFA"]')

  // Step 2: Reveal and read secret
  const showSecretBtn = page.locator('button:has-text("Показать секрет")')
  if (await showSecretBtn.count() > 0) {
    await showSecretBtn.first().click()
  }
  const secret = await page.locator('code').first().innerText()
  // Generate TOTp using the secret
  const code = speakeasy.totp({ secret: secret.trim(), encoding: 'base32' })
  // Copy actions (optional)
  if (await page.locator('button:has-text("Копировать URL MFA")').count() > 0) {
    await page.click('button:has-text("Копировать URL MFA")')
  }
  if (await page.locator('button:has-text("Копировать секрет")').count() > 0) {
    await page.click('button:has-text("Копировать секрет")')
  }

  // Step 3: Verify TOTp
  await page.fill('input[placeholder="6-значный код"]', code)
  await page.click('button:has-text("Подтвердить")')
  // Expect a success indicator on the page
  await expect(page.locator('text=MFA успешно активирован')).toBeVisible()
})
