import { expect, test } from '@playwright/test'
import { archiveVehicle, createVehicle, getAdminToken, loginAsAdmin, WEB_BASE } from './helpers'

test('Inspections: auto-select vehicle from URL param', async ({ page, request }) => {
  await loginAsAdmin(page)

  const adminToken = await getAdminToken(request)
  const vehicle = await createVehicle(request, adminToken, 'Inspect URL Vehicle')

  try {
    await page.goto(`${WEB_BASE}/inspections/new?vehicle=${vehicle.id}`)

    await expect(page.getByText('Новый осмотр')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(`Автомобиль: ${vehicle.number} · ${vehicle.name}`)).toBeVisible()
  } finally {
    await archiveVehicle(request, adminToken, vehicle.id)
  }
})
