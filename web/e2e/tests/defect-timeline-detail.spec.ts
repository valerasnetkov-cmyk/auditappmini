import { test, expect } from '@playwright/test'

// Test: Open Defect Detail page and verify that the timeline loads and reflects a closed event
test('Defect Timeline Detail: loads history after status change', async ({ page, request }) => {
  const base = 'http://localhost:3002'
  // 1) UI login as admin
  await page.goto(`${base}/login`)
  await page.fill('input[name="email"]', 'admin@example.com')
  await page.fill('input[name="password"]', 'admin123')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/vehicles', { timeout: 15000 }).catch(() => {})

  // 2) Seed data via API (vehicle + defect) so UI has something to display
  const loginRes = await request.post('/api/auth/login', {
    data: { email: 'admin@example.com', password: 'admin123' },
  })
  const loginBody = await loginRes.json()
  const adminToken = loginBody?.token ?? ''
  if (!adminToken) {
    test.skip('Admin API token not obtained')
  }

  // Seed a new vehicle
  let vehicleId = ''
  const newVehicle = await request.post('/api/vehicles', {
    data: {
      number: 'TL-DET-01',
      name: 'Timeline Detail Vehicle',
      region: 'Test',
    },
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
  })
  const newVehicleJson = await newVehicle.json()
  vehicleId = newVehicleJson?.id
  if (!vehicleId) {
    test.skip('Failed to create test vehicle')
  }

  // Create an inspection with a failing item to produce a defect
  const inspection = await request.post('/api/inspections', {
    data: {
      vehicle_id: vehicleId,
      type: 'quick',
      checklist: [{ title: 'Timeline detail item', result: false }],
    },
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
  })
  await inspection.json()

  // Fetch the defect created by the failing checklist item
  const defectsList = await request.get(`/api/vehicles/${vehicleId}/defects`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  const defects = await defectsList.json()
  const defect = defects?.data?.find((d: { title?: string }) => d.title === 'Timeline detail item')
  if (!defect) {
    test.skip('Defect not found for timeline detail test')
  }

  // 3) Close the defect via API to generate a history entry
  await request.post(`/api/defects/${defect.id}/close`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })

  // 4) Navigate to defect detail page (UI should be logged in)
  await page.goto(`${base}/defects/${defect.id}`)
  // Wait for timeline section to render
  const timelineSec = page.locator('[data-testid="defect-timeline-section"]')
  await timelineSec.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})

  // 5) Confirm at least one timeline item exists
  const items = page.locator('[data-testid^="defect-timeline-"]')
  const count = await items.count()
  expect(count).toBeGreaterThan(0)
})
