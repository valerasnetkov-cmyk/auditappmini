import { expect, test } from '@playwright/test'
import {
  archiveVehicle,
  createInspectionWithDefect,
  createVehicle,
  getAdminToken,
  loginAsAdmin,
  WEB_BASE,
} from './helpers'

test('Defect Timeline MVP: verify timeline updates with close/open actions (UI path)', async ({ page, request }) => {
  await loginAsAdmin(page)

  const adminToken = await getAdminToken(request)
  const vehicle = await createVehicle(request, adminToken, 'Timeline UI Vehicle')
  const { defect } = await createInspectionWithDefect(request, adminToken, vehicle.id, 'Timeline test item')
  const card = page.locator(`[data-testid="defect-card-${defect.id}"]`)
  const statusBadge = card.locator(`[data-testid="defect-status-${defect.id}"]`)
  const historyBlock = page.locator(`[data-testid="defect-history-block-${defect.id}"]`)

  try {
    await page.goto(`${WEB_BASE}/vehicles/${vehicle.id}`)
    await expect(card).toBeVisible({ timeout: 10000 })

    await card.getByRole('button', { name: 'Закрыть дефект' }).click()
    await expect(page.getByText('Дефект закрыт')).toBeVisible({ timeout: 6000 })
    await expect(statusBadge).toHaveText('Закрыт')

    await page.reload()
    await expect(card).toBeVisible({ timeout: 10000 })
    await card.getByRole('button', { name: 'История' }).click()
    await expect(historyBlock).toBeVisible({ timeout: 5000 })
    const afterCloseCount = await historyBlock.locator('div').count()
    expect(afterCloseCount).toBeGreaterThan(0)

    await card.getByRole('button', { name: 'Вернуть в работу' }).click()
    await expect(page.getByText('Дефект повторно открыт')).toBeVisible({ timeout: 6000 })
    await expect(statusBadge).toHaveText('Открыт')

    await page.reload()
    await expect(card).toBeVisible({ timeout: 10000 })
    await card.getByRole('button', { name: 'История' }).click()
    await expect(historyBlock).toBeVisible({ timeout: 5000 })
    const afterOpenCount = await historyBlock.locator('div').count()
    expect(afterOpenCount).toBeGreaterThan(afterCloseCount)
  } finally {
    await archiveVehicle(request, adminToken, vehicle.id)
  }
})
