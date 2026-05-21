import { expect, test } from '@playwright/test'
import {
  archiveVehicle,
  closeDefectByApi,
  createInspectionWithDefect,
  createVehicle,
  getAdminToken,
  loginAsAdmin,
  WEB_BASE,
} from './helpers'

test('Defect Timeline Detail: loads history after status change', async ({ page, request }) => {
  await loginAsAdmin(page)

  const adminToken = await getAdminToken(request)
  const vehicle = await createVehicle(request, adminToken, 'Timeline Detail Vehicle')
  const { defect } = await createInspectionWithDefect(request, adminToken, vehicle.id, 'Timeline detail item')

  try {
    await closeDefectByApi(request, adminToken, defect.id)
    await page.goto(`${WEB_BASE}/defects/${defect.id}`)

    const timelineSection = page.locator('[data-testid="defect-timeline-section"]')
    await expect(timelineSection).toBeVisible({ timeout: 10000 })

    const timelineItems = page.locator('[data-testid^="defect-timeline-"]')
    await expect.poll(async () => timelineItems.count(), {
      message: 'Defect detail timeline should contain at least one status history item',
    }).toBeGreaterThan(0)
  } finally {
    await archiveVehicle(request, adminToken, vehicle.id)
  }
})
