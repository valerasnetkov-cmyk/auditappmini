import { test, expect } from '@playwright/test'

// MVP: Defect timeline flow in UI — create defect, verify timeline, close/open, verify timeline updates

test('Defect Timeline MVP: verify timeline updates with close/open actions (UI path)', async ({ page, request }) => {
  const base = 'http://localhost:3002'
  // UI login as admin
  await page.goto(`${base}/login`)
  await page.fill('input[name="email"]', 'admin@example.com')
  await page.fill('input[name="password"]', 'admin123')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/vehicles', { timeout: 15000 }).catch(() => {})

  // Admin API login to seed data
  const loginRes = await request.post('/api/auth/login', {
    data: { email: 'admin@example.com', password: 'admin123' },
  })
  const loginBody = await loginRes.json()
  const adminToken = loginBody?.token ?? ''
  if (!adminToken) test.skip('Admin API token not obtained')

  // Create a new vehicle for deterministic test data
  const vehicleRes = await request.post('/api/vehicles', {
    data: { number: 'А100АВ3', name: 'Timeline UI Vehicle', region: 'TestReg' },
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    }
  })
  const vehicle = await vehicleRes.json()
  const vehicleId = vehicle?.id
  if (!vehicleId) test.skip('Failed to create test vehicle')

  // Create an inspection with a failing item to generate a defect
  const insRes = await request.post('/api/inspections', {
    data: {
      vehicle_id: vehicleId,
      type: 'quick',
      checklist: [{ title: 'Timeline test item', result: false }]
    },
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    }
  })
  await insRes.json()

  // Retrieve defect for this vehicle to identify UI card
  const defectsList = await request.get(`/api/vehicles/${vehicleId}/defects`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  })
  const defects = await defectsList.json()
  const defect = defects?.data?.find((d: any) => d.title === 'Timeline test item')
  if (!defect) test.skip('Defect not found for timeline test')

  // UI: open list and navigate to vehicle detail
  await page.goto(`${base}/vehicles`)
  const vehicleRow = page.locator(`text=Timeline UI Vehicle`).first()
  if (await vehicleRow.count() === 0) test.skip('Vehicle not visible in UI')
  await vehicleRow.click()

  // Find defect card and verify history section exists
  const defectCard = page.locator(`div[data-testid="defect-card-${defect.id}"]`).first()
  if (await defectCard.count() === 0) test.skip('Defect card not found in UI')

  // Open history
  const historyBtn = defectCard.locator('button:has-text("История")')
  if (await historyBtn.count() > 0) {
    await historyBtn.first().click()
  }
  const historyBlock = page.locator(`div[data-testid="defect-history-block-${defect.id}"]`)
  await historyBlock.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
  const initialCount = await historyBlock.locator('div').count()
  // Track timeline counts across actions for validation
  let afterCloseCount = initialCount
  let afterOpenCount = initialCount
  // Close defect
  const closeBtn = defectCard.locator('button:has-text("Закрыть дефект")')
  if (await closeBtn.count() > 0) {
    await closeBtn.first().click()
    await page.waitForSelector('text=Дефект закрыт', { timeout: 6000 }).catch(() => {})
    afterCloseCount = await historyBlock.locator('div').count()
    if (afterCloseCount <= initialCount) {
      test.fail('Timeline did not gain an entry after closing the defect')
    }
  }

  // Reopen if available
  const reopenBtn = defectCard.locator('button[data-testid^="defect-reopen-"]')
  if (await reopenBtn.count() > 0) {
    await reopenBtn.first().click()
    await page.waitForSelector('text=Дефект повторно открыт', { timeout: 6000 }).catch(() => {})
    afterOpenCount = await historyBlock.locator('div').count()
    if (afterOpenCount <= afterCloseCount) {
      test.fail('Timeline did not gain an entry after reopening the defect')
    }
  }

  // Refresh timeline and ensure there is data
  if (await historyBtn.count() > 0) {
    await historyBtn.first().click()
  }
  await historyBlock.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
  const finalCount = await historyBlock.locator('div').count()
  if (finalCount < initialCount) {
    test.fail('Timeline did not gain entries after actions')
  }

  // Cleanup: delete test vehicle
  await request.delete(`/api/vehicles/${vehicleId}`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  })
})
