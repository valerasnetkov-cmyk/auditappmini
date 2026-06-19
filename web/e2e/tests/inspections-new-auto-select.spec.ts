import { expect, test } from '@playwright/test'
import { archiveVehicle, createVehicle, getAdminToken, loginAsAdmin, WEB_BASE } from './helpers'

test('Inspections: web new inspection route is mobile-only', async ({ page, request }) => {
  await loginAsAdmin(page)

  const adminToken = await getAdminToken(request)
  const vehicle = await createVehicle(request, adminToken, 'Inspect URL Vehicle')

  try {
    await page.goto(`${WEB_BASE}/inspections/new?vehicle=${vehicle.id}`)

    await expect(page.getByRole('heading', { name: 'Осмотр проводится только с мобильного устройства' })).toBeVisible({
      timeout: 5000,
    })
    await expect(page.getByRole('heading', { name: 'Новый осмотр' })).toHaveCount(0)
    await expect(page.getByText(`Автомобиль: ${vehicle.number} · ${vehicle.name}`)).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Вернуться к журналу осмотров' })).toBeVisible()
  } finally {
    await archiveVehicle(request, adminToken, vehicle.id)
  }
})
