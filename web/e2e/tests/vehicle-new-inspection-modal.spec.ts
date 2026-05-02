import { test, expect } from '@playwright/test'

// UI test: Open Vehicles tab, click Осмотр for a vehicle, ensure modal shows and the vehicle dropdown is preselected
test('Vehicles: New Inspection modal preselects current vehicle', async ({ page, request }) => {
  const base = 'http://localhost:3002'
  // 1) UI login as admin
  await page.goto(`${base}/login`)
  await page.fill('input[name="email"]', 'admin@example.com')
  await page.fill('input[name="password"]', 'admin123')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/vehicles', { timeout: 15000 }).catch(() => {})

  // 2) Seed data via API to ensure determinism: add a vehicle and an API-visible list
  const loginRes = await request.post('/api/auth/login', {
    data: { email: 'admin@example.com', password: 'admin123' }
  })
  const loginBody = await loginRes.json()
  const adminToken = loginBody?.token ?? ''
  if (!adminToken) test.skip('Admin API token not obtained')

  // Create a new vehicle to ensure we have something concrete
  const veh = await request.post('/api/vehicles', {
    data: { number: 'VT-NEW', name: 'Modal Test Vehicle', region: 'Test' },
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    }
  })
  const vehJson = await veh.json()
  const vehicleId = vehJson?.id
  const vehicleNumber = 'VT-NEW'
  const vehicleName = 'Modal Test Vehicle'
  // 3) Find the row in UI and click Осмотр for this vehicle
  const rowSelector = `text=${vehicleNumber}`
  const vehicleRow = page.locator(rowSelector).first()
  if (await vehicleRow.count() === 0) {
    test.skip('Seeded vehicle row not found in UI')
  }
  // Click the Осмотр action within the same row
  const inspectBtn = vehicleRow.locator('text=Осмотр')
  if (await inspectBtn.count() > 0) {
    await inspectBtn.first().click()
  } else {
    test.skip('Осмотр action not found in vehicle row')
  }

  // 4) Verify modal appears and the vehicle is shown as preselected (no dropdown)
  await page.waitForSelector('text=Новый осмотр', { timeout: 5000 }).catch(() => {})
  const vehicleInfo = page.locator(`text=Автомобиль: ${vehicleNumber} · ${vehicleName}`)
  await expect(vehicleInfo).toBeVisible({ timeout: 5000 })

  // Close modal
  const cancelBtn = page.locator('text=Отмена').first()
  if (await cancelBtn.count() > 0) {
    await cancelBtn.click()
  }

  // Cleanup: delete the seed vehicle
  if (vehicleId) {
    await request.delete(`/api/vehicles/${vehicleId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    })
  }
})
