import { expect, test } from '@playwright/test'
import {
  archiveVehicle,
  createInspectionWithDefect,
  createVehicle,
  getAdminToken,
  loginAsAdmin,
  WEB_BASE,
} from './helpers'

test('Defect detail UI: reopen a closed defect through lifecycle', async ({ page, request }) => {
  await loginAsAdmin(page)

  const adminToken = await getAdminToken(request)
  const vehicle = await createVehicle(request, adminToken, 'Detail UI Reopen Vehicle')
  const { defect } = await createInspectionWithDefect(request, adminToken, vehicle.id, 'UI reopen item')

  try {
    await page.goto(`${WEB_BASE}/defects/${defect.id}`)

    await page.getByLabel('Новый статус').selectOption('closed')
    await page.getByLabel('Комментарий руководителя').fill('Первичное закрытие')
    await page.getByRole('button', { name: 'Сохранить статус' }).click()
    await expect(page.getByLabel('Новый статус')).toHaveValue('reopened')

    await page.getByLabel('Комментарий руководителя').fill('Проблема повторилась')
    await page.getByRole('button', { name: 'Сохранить статус' }).click()

    await expect(page.getByText('Статус дефекта обновлён')).toBeVisible({ timeout: 6000 })
    await expect(page.getByText('Открыт повторно').first()).toBeVisible()
    await expect(page.getByLabel('Новый статус')).toHaveValue('in_progress')
  } finally {
    await archiveVehicle(request, adminToken, vehicle.id)
  }
})
