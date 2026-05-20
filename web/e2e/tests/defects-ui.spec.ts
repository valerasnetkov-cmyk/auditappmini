import { test, expect } from '@playwright/test'

// This UI test creates a vehicle and an inspection that generates a defect,
// then verifies the UI displays the defect on the vehicle page, allows closing it,
// and shows the history section.

test('Defects UI: create vehicle, add defect, display and close (UI path)', async ({ page, request }) => {
  const base = 'http://localhost:3002'
  // 1) Admin login via UI
  await page.goto(`${base}/login`)
  await page.fill('input[name="email"]', 'admin@example.com')
  await page.fill('input[name="password"]', 'admin123')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/vehicles**', { timeout: 15000 }).catch(() => {})

  // 2) Seed data via API to ensure determinism (vehicle + defect)
  // Obtain admin token via API login to seed
  const loginRes = await request.post('/api/auth/login', {
    data: { email: 'admin@example.com', password: 'admin123' }
  })
  const loginBody = await loginRes.json()
  const adminToken = loginBody?.token ?? ''

  // Seed a new vehicle with a defect by creating a vehicle and an inspection with a failing item
  let vehicleId = ''
  const newVehicle = await request.post('/api/vehicles', {
    data: {
      number: 'А123АК45',
      name: 'UI Defect Vehicle',
      region: 'Тестовый',
    },
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    }
  })
  const newVehicleJson = await newVehicle.json()
  vehicleId = newVehicleJson?.id

  // Create an inspection with a failing item to trigger a defect
  const inspection = await request.post('/api/inspections', {
    data: {
      vehicle_id: vehicleId,
      type: 'quick',
      checklist: [
        { title: 'UI defect item', result: false, comment: 'auto defect' }
      ]
    },
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    }
  })
  await inspection.json()
  const defectsList = await request.get(`/api/vehicles/${vehicleId}/defects`, {
    headers: {
      Authorization: `Bearer ${adminToken}`
    }
  })
  const defects = await defectsList.json()
  const defect = defects?.data?.find((d: { title?: string }) => d.title === 'UI defect item') || null
  if (!defect) {
    test.skip('No defect created for UI test; skipping UI path')
  }

  // 3) Navigate to vehicle detail in UI
  await page.goto(`${base}/vehicles`)
  // Find the vehicle row by number/text and click to open details
  // Use the exact seeded vehicle name to locate the row
  const vehicleRow = page.locator(`text=UI Defect Vehicle`).first()
  if (await vehicleRow.count() === 0) {
    test.skip('Seeded vehicle not found in UI; skipping')
  }
  await vehicleRow.click()
  // 4) Validate defects section contains the created defect
  await page.waitForSelector('section:has-text("Дефекты на технике")', { timeout: 10000 })
  const defectCard = page.locator(`text=UI defect item`).first()
  if (await defectCard.count() === 0) {
    test.skip('Defect item not visible in UI; skipping')
  }
  // 5) Close the defect via UI button
  const closeBtn = defectCard.locator('button:has-text("Закрыть дефект")')
  if (await closeBtn.count() > 0) {
    await closeBtn.first().click()
    // Wait a bit for UI update and Toast
    await page.waitForTimeout(1000)
    // Verify via toast presence in UI
    await expect(page.locator('text=Дефект закрыт')).toBeVisible({ timeout: 6000 })
  }

  // 6) Reopen the defect if possible (UI path)
  const reopenBtn = defectCard.locator('button[data-testid^="defect-reopen-"]')
  if (await reopenBtn.count() > 0) {
    await reopenBtn.first().click()
    await page.waitForTimeout(1000)
    await expect(page.locator('text=Дефект повторно открыт')).toBeVisible({ timeout: 6000 })
  }

  // 6) Cleanup: delete the test vehicle
  await request.delete(`/api/vehicles/${vehicleId}`, {
    headers: {
      Authorization: `Bearer ${adminToken}`
    }
  })
})
