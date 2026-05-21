import { expect, test } from '@playwright/test'
import {
  archiveVehicle,
  createInspectionWithDefect,
  createVehicle,
  getAdminToken,
  loginAsAdmin,
  WEB_BASE,
} from './helpers'

test('Defects UI: create vehicle, add defect, display, close and reopen (UI path)', async ({ page, request }) => {
  await loginAsAdmin(page)

  const adminToken = await getAdminToken(request)
  const vehicle = await createVehicle(request, adminToken, 'UI Defect Vehicle')
  const { defect } = await createInspectionWithDefect(request, adminToken, vehicle.id, 'UI defect item', 'auto defect')
  const defectCard = page.locator(`[data-testid="defect-card-${defect.id}"]`)
  const statusBadge = defectCard.locator(`[data-testid="defect-status-${defect.id}"]`)

  try {
    await page.goto(`${WEB_BASE}/vehicles/${vehicle.id}`)

    await expect(page.getByText('Дефекты на технике')).toBeVisible({ timeout: 10000 })
    await expect(defectCard).toBeVisible()
    await expect(defectCard.getByText('UI defect item')).toBeVisible()

    await defectCard.getByRole('button', { name: 'Закрыть дефект' }).click()
    await expect(page.getByText('Дефект закрыт')).toBeVisible({ timeout: 6000 })
    await expect(statusBadge).toHaveText('Закрыт')

    await defectCard.getByRole('button', { name: 'Вернуть в работу' }).click()
    await expect(page.getByText('Дефект повторно открыт')).toBeVisible({ timeout: 6000 })
    await expect(statusBadge).toHaveText('Открыт')
  } finally {
    await archiveVehicle(request, adminToken, vehicle.id)
  }
})
