import { expect, test } from '@playwright/test'
import {
  archiveVehicle,
  createInspectionWithDefect,
  createVehicle,
  getAdminToken,
  loginAsAdmin,
  WEB_BASE,
} from './helpers'

test('Defect detail UI: close defect via UI button', async ({ page, request }) => {
  await loginAsAdmin(page)

  const adminToken = await getAdminToken(request)
  const vehicle = await createVehicle(request, adminToken, 'Detail UI Close Vehicle')
  const { defect } = await createInspectionWithDefect(request, adminToken, vehicle.id, 'UI close item')

  try {
    await page.goto(`${WEB_BASE}/defects/${defect.id}`)

    await page.getByRole('button', { name: 'Закрыть дефект' }).click()

    await expect(page.getByText('Дефект закрыт')).toBeVisible({ timeout: 6000 })
    await expect(page.getByRole('button', { name: 'Вернуть в работу' })).toBeVisible()
  } finally {
    await archiveVehicle(request, adminToken, vehicle.id)
  }
})
