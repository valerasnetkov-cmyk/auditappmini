import { expect, test } from '@playwright/test'
import { archiveVehicle, createVehicle, getAdminToken, loginAsAdmin, WEB_BASE } from './helpers'

test('Vehicles: New Inspection modal preselects current vehicle', async ({ page, request }) => {
  await loginAsAdmin(page)

  const adminToken = await getAdminToken(request)
  const vehicle = await createVehicle(request, adminToken, 'Modal Test Vehicle')

  try {
    await page.goto(`${WEB_BASE}/vehicles?q=${encodeURIComponent(vehicle.number)}`)

    const row = page.locator('tr', { hasText: vehicle.number }).first()
    await expect(row).toBeVisible({ timeout: 10000 })
    await row.getByRole('button', { name: 'Осмотр' }).click()

    await expect(page.getByText('Новый осмотр')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(`Автомобиль: ${vehicle.number} · ${vehicle.name}`)).toBeVisible()

    await page.getByRole('button', { name: 'Отмена' }).click()
  } finally {
    await archiveVehicle(request, adminToken, vehicle.id)
  }
})
