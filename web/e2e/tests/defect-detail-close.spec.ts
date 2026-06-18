import { expect, test } from '@playwright/test'
import {
  archiveVehicle,
  createInspectionWithDefect,
  createVehicle,
  getAdminToken,
  loginAsAdmin,
  WEB_BASE,
} from './helpers'

test('Defect detail UI: close defect with a lifecycle comment', async ({ page, request }) => {
  await loginAsAdmin(page)

  const adminToken = await getAdminToken(request)
  const vehicle = await createVehicle(request, adminToken, 'Detail UI Close Vehicle')
  const { defect } = await createInspectionWithDefect(request, adminToken, vehicle.id, 'UI close item')

  try {
    await page.goto(`${WEB_BASE}/defects/${defect.id}`)

    const saveButton = page.getByRole('button', { name: 'Сохранить статус' })
    await page.getByLabel('Новый статус').selectOption('closed')
    await expect(saveButton).toBeDisabled()
    await page.getByLabel('Комментарий руководителя').fill('Результат проверен в E2E')
    await saveButton.click()

    await expect(page.getByText('Статус дефекта обновлён')).toBeVisible({ timeout: 6000 })
    await expect(page.getByText('Закрыт').first()).toBeVisible()
    await expect(page.getByLabel('Новый статус')).toHaveValue('reopened')
  } finally {
    await archiveVehicle(request, adminToken, vehicle.id)
  }
})
