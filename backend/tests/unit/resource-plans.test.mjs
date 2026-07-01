import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildLimitPayload,
  buildPlanPayload,
  buildPlanUpdatePayload,
} from '../../src/services/resourcePlans.js'

test('plan payload normalizes identifiers and nullable values', () => {
  const payload = buildPlanPayload({
    code: ' Pilot Plus ',
    name: ' Пилот Плюс ',
    maxVehicles: '25',
    maxInspectionsPerMonth: '100',
    ocrEnabled: 1,
    ocrMonthlyLimit: '100',
    status: 'archived',
  })
  assert.equal(payload.code, 'pilot-plus')
  assert.equal(payload.name, 'Пилот Плюс')
  assert.equal(payload.maxVehicles, 25)
  assert.equal(payload.maxInspectionsPerMonth, 100)
  assert.equal(payload.ocrEnabled, true)
  assert.equal(payload.ocrMonthlyLimit, 100)
  assert.equal(payload.status, 'archived')
})

test('plan update preserves omitted fields and accepts explicit null', () => {
  const payload = buildPlanUpdatePayload({
    code: 'pilot',
    name: 'Пилот',
    status: 'active',
    max_vehicles: 10,
    max_users: 5,
    max_inspections_per_month: 300,
    max_storage_mb: 100,
    storage_limit_gb: 10,
    ocr_enabled: 1,
    ocr_monthly_limit: 300,
    accident_module_enabled: 0,
    analytics_enabled: 1,
    api_access_enabled: 0,
    monthly_price_rub: 5000,
  }, {
    maxVehicles: null,
  })
  assert.equal(payload.maxVehicles, null)
  assert.equal(payload.maxUsers, 5)
  assert.equal(payload.maxInspectionsPerMonth, 300)
  assert.equal(payload.ocrMonthlyLimit, 300)
  assert.equal(payload.ocrEnabled, true)
})

test('limit payload defaults to pilot plan', () => {
  assert.equal(buildLimitPayload({}).planCode, 'pilot')
})
