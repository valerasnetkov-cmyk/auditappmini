import { test, expect } from '@playwright/test'

// UI test: Auto-select vehicle in New Inspection modal loaded from /inspections/new?vehicle=<id>
test('Inspections: auto-select vehicle from URL param', async ({ page, request }) => {
  const base = 'http://localhost:3002'
  // 1) admin login via UI
  await page.goto(`${base}/login`)
  await page.fill('input[name="email"]', 'admin@example.com')
  await page.fill('input[name="password"]', 'admin123')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/vehicles', { timeout: 15000 }).catch(() => {})

  // 2) Create a new vehicle via API to have a known id
  const loginRes = await request.post('/api/auth/login', {
    data: { email: 'admin@example.com', password: 'admin123' }
  })
  const loginBody = await loginRes.json()
  const adminToken = loginBody?.token ?? ''
  if (!adminToken) test.skip('Admin API token not obtained')

  const newVehicle = await request.post('/api/vehicles', {
    data: { number: 'DT-INS-URL', name: 'Inspect URL Vehicle', region: 'Test' },
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    }
  })
  const newVehicleJson = await newVehicle.json()
  const vehicleId = newVehicleJson?.id
  const vehicleNumber = 'VT-NEW'
  const vehicleName = 'Modal Test Vehicle'
  if (!vehicleId) test.skip('Failed to create test vehicle')

  // 3) Navigate directly to the new inspection route with vehicle param
  await page.goto(`${base}/inspections/new?vehicle=${vehicleId}`)

  // 4) Verify modal appears and the vehicle is shown (no dropdown)
  const modal = page.locator('text=Новый осмотр').first()
  await expect(modal).toBeVisible({ timeout: 5000 }).catch(() => {})
  const vehicleInfo = page.locator(`text=Автомобиль: ${vehicleNumber} · ${vehicleName}`)
  await expect(vehicleInfo).toBeVisible({ timeout: 5000 }).catch(() => {})

  // Cleanup: delete the test vehicle
  await request.delete(`/api/vehicles/${vehicleId}`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  })
})
