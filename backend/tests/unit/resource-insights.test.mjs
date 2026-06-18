import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildLimitUsage,
  buildRiskCenter,
  getBillingSummary,
} from '../../src/services/resourceInsights.js'

test('billing summary excludes inactive companies and estimates potential MRR', () => {
  const result = getBillingSummary([
    { status: 'active', inspections30d: 10, billing: { monthlyRevenueRub: 0 } },
    { status: 'active', inspections30d: 10, billing: { monthlyRevenueRub: 5000 } },
    { status: 'inactive', inspections30d: 10, billing: { monthlyRevenueRub: 9000 } },
  ], [
    { code: 'pilot', status: 'active', monthlyPriceRub: 3000 },
    { code: 'archived', status: 'archived', monthlyPriceRub: 1000 },
  ])
  assert.equal(result.monthlyRevenueRub, 5000)
  assert.equal(result.activeFreeCompanies, 1)
  assert.equal(result.potentialMrr, 3000)
  assert.equal(result.trialToPaidConversionRate, 50)
})

test('limit usage counts near-limit companies and disabled modules', () => {
  const result = buildLimitUsage([{
    id: 'c1',
    name: 'Company',
    users: 8,
    usersLimit: 10,
    usersUsagePercent: 80,
    vehiclesLimit: 10,
    vehiclesUsagePercent: 90,
    usage: { vehicles: 9 },
    limits: { planCode: 'pilot', ocrEnabled: false, analyticsEnabled: true },
  }])
  assert.equal(result.companiesNearVehicleLimit, 1)
  assert.equal(result.companiesNearUserLimit, 1)
  assert.equal(result.disabledModules.ocr, 1)
  assert.equal(result.usage[0].riskLevel, 'upsell')
})

test('risk center identifies stale and upsell companies deterministically', () => {
  const result = buildRiskCenter([{
    id: 'c1',
    name: 'Company',
    status: 'active',
    lastActivityAt: '2026-05-01T00:00:00Z',
    inspections30d: 35,
    vehiclesUsagePercent: 85,
    usersUsagePercent: 20,
    limits: { planCode: 'pilot' },
    usage: { accidents: 0 },
    billing: { monthlyPriceRub: 0, monthlyRevenueRub: 0 },
  }], [{
    code: 'standard',
    status: 'active',
    monthlyPriceRub: 10000,
  }], new Date('2026-06-13T00:00:00Z'))
  assert.equal(result.churnRiskCompanies, 1)
  assert.equal(result.upsellCandidates, 1)
  assert.equal(result.upsell[0].recommendedPlanCode, 'standard')
  assert.equal(result.upsell[0].potentialMrr, 10000)
})
