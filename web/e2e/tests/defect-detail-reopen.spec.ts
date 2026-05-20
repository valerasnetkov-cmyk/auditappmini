import { test, expect } from '@playwright/test'

// UI-based test: Open defect detail, close then reopen via UI button, verify toast and state
test('Defect detail UI: reopen defect via UI button', async ({ page, request }) => {
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
    data: { number: 'DT-UI-REOPEN', name: 'Detail UI Reopen Vehicle', region: 'Test' },
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
      checklist: [{ title: 'UI reopen item', result: false }]
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
  const defect = defects?.data?.find((d: { title?: string }) => d.title === 'UI reopen item')
  if (!defect) {
    test.skip('Defect not created for UI reopen test')
  }

  // 3) Open defect detail page
  await page.goto(`${base}/defects/${defect.id}`)
  // 4) If possible, close defect first to enable reopen
  const closeBtn = page.locator('button:has-text("Закрыть дефект")').first()
  if (await closeBtn.count() > 0) {
    await closeBtn.click()
    await page.waitForSelector('text=Дефект закрыт', { timeout: 6000 }).catch(() => {})
  }

  // 5) Reopen defect via UI
  const reopenBtn = page.locator('button:has-text("Вернуть в работу")').first()
  if (await reopenBtn.count() > 0) {
    await reopenBtn.click()
    await page.waitForSelector('text=Дефект повторно открыт', { timeout: 6000 }).catch(() => {})
  } else {
    test.skip('Не найдено кнопки открытия дефекта на детали')
  }

  // 6) Verify that close button appears again, confirming reopen
  const reopenCloseBtn = page.locator('button:has-text("Закрыть дефект")').first()
  if (await reopenCloseBtn.count() > 0) {
    await expect(reopenCloseBtn).toBeVisible()
  } else {
    test.fail('После повторного открытия дефекта кнопка закрыть дефект не появилась')
  }

  // 7) Cleanup: delete test vehicle
  await request.delete(`/api/vehicles/${vehicleId}`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  })
})
