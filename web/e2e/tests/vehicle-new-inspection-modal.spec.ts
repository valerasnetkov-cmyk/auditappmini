import { expect, test } from '@playwright/test'
import { archiveVehicle, createVehicle, getAdminToken, loginAsAdmin, WEB_BASE } from './helpers'

test('Vehicles: web list does not expose inspection start action', async ({ page, request }) => {
  await loginAsAdmin(page)

  const adminToken = await getAdminToken(request)
  const vehicle = await createVehicle(request, adminToken, 'Modal Test Vehicle')

  try {
    await page.goto(`${WEB_BASE}/vehicles?q=${encodeURIComponent(vehicle.number)}`)

    const row = page.locator('tr', { hasText: vehicle.number }).first()
    await expect(row).toBeVisible({ timeout: 10000 })
    await expect(row.getByText('Осмотр: mobile')).toBeVisible()
    await expect(row.getByRole('button', { name: 'Осмотр' })).toHaveCount(0)
    await expect(row.getByRole('link', { name: 'Осмотр' })).toHaveCount(0)
  } finally {
    await archiveVehicle(request, adminToken, vehicle.id)
  }
})
