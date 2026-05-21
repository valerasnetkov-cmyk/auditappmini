import { expect, test } from '@playwright/test'
import {
  archiveVehicle,
  createInspectionWithDefect,
  createVehicle,
  getAdminToken,
  loginAsAdmin,
  WEB_BASE,
} from './helpers'

test('Defect detail UI: reopen defect via UI button', async ({ page, request }) => {
  await loginAsAdmin(page)

  const adminToken = await getAdminToken(request)
  const vehicle = await createVehicle(request, adminToken, 'Detail UI Reopen Vehicle')
  const { defect } = await createInspectionWithDefect(request, adminToken, vehicle.id, 'UI reopen item')

  try {
    await page.goto(`${WEB_BASE}/defects/${defect.id}`)

    await page.getByRole('button', { name: 'Закрыть дефект' }).click()
    await expect(page.getByRole('button', { name: 'Вернуть в работу' })).toBeVisible({ timeout: 6000 })

    await page.getByRole('button', { name: 'Вернуть в работу' }).click()

    await expect(page.getByText('Дефект повторно открыт')).toBeVisible({ timeout: 6000 })
    await expect(page.getByRole('button', { name: 'Закрыть дефект' })).toBeVisible()
  } finally {
    await archiveVehicle(request, adminToken, vehicle.id)
  }
})
