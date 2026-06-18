import { expect, test } from '@playwright/test'
import {
  WEB_BASE,
  createVehicle,
  getCompanyOwnerToken,
  loginAsCompanyOwner,
} from './helpers'

test.describe('Inspection schedule', () => {
  test('shows and filters vehicles that have never been inspected', async ({ page, request }) => {
    const token = await getCompanyOwnerToken(request)
    const vehicle = await createVehicle(request, token, `Schedule E2E ${Date.now()}`)

    await loginAsCompanyOwner(page)
    await page.goto(`${WEB_BASE}/vehicles?q=${encodeURIComponent(vehicle.number)}`)

    const row = page.getByRole('row').filter({ hasText: vehicle.number })
    await expect(row).toBeVisible()
    await expect(row.getByText('Не осматривался')).toBeVisible()

    await page.getByLabel('Статус графика осмотров').selectOption('never_inspected')
    await expect(row).toBeVisible()

    await page.getByLabel('Статус графика осмотров').selectOption('inspection_actual')
    await expect(row).toHaveCount(0)
  })
})
