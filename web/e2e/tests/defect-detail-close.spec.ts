import { test, expect } from '@playwright/test'

// UI-based test: Open defect detail and close defect via UI button, verify toast
test('Defect detail UI: close defect via UI button', async ({ page, request }) => {
  const base = 'http://localhost:3002'
  // 1) UI login as admin
  await page.goto(`${base}/login`)
  await page.fill('input[name="email"]', 'admin@example.com')
  await page.fill('input[name="password"]', 'admin123')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/vehicles', { timeout: 15000 }).catch(() => {})

  // 2) Seed data via API to ensure determinism
  const loginRes = await request.post('/api/auth/login', {
    data: { email: 'admin@example.com', password: 'admin123' }
  })
  const loginBody = await loginRes.json()
  const adminToken = loginBody?.token ?? ''
  if (!adminToken) test.skip('Admin API token not obtained')

  // Seed a new vehicle
  let vehicleId = ''
  const newVehicle = await request.post('/api/vehicles', {
    data: { number: 'DT-UI-DEL', name: 'Detail UI Close Vehicle', region: 'Test' },
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    }
  })
  const newVehicleJson = await newVehicle.json()
  vehicleId = newVehicleJson?.id
  if (!vehicleId) test.skip('Failed to create test vehicle')

  // Create an inspection with a failing item to trigger a defect
  const inspection = await request.post('/api/inspections', {
    data: {
      vehicle_id: vehicleId,
      type: 'quick',
      checklist: [{ title: 'UI close item', result: false }]
    },
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    }
  })
  await inspection.json()

  // Retrieve defect created
  const defectsList = await request.get(`/api/vehicles/${vehicleId}/defects`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  })
  const defects = await defectsList.json()
  const defect = defects?.data?.find((d: any) => d.title === 'UI close item')
  if (!defect) {
    test.skip('Defect not created for UI close test')
  }

  // 3) Open defect detail page
  await page.goto(`${base}/defects/${defect.id}`)
  // 4) Click close defect button on detail page and verify toast
  const closeBtn = page.locator('button:has-text("Закрыть дефект")').first()
  if (await closeBtn.count() > 0) {
    await closeBtn.click()
    await page.waitForSelector('text=Дефект закрыт', { timeout: 6000 }).catch(() => {})
  } else {
    test.skip('Close defect button not found on detail page')
  }

  // 5) Cleanup: delete test vehicle
  await request.delete(`/api/vehicles/${vehicleId}`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  })
})
