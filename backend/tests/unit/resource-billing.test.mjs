import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPaymentPayload, calculateMrrRub } from '../../src/services/resourceBilling.js'

test('payment payload normalizes identifiers, currency and dates', () => {
  const payload = buildPaymentPayload({
    companyId: ' Demo Company ',
    planCode: ' Pilot Plus ',
    amount: '60000',
    currency: 'rub',
    periodStart: '2026-06-01',
    periodEnd: '2026-07-01',
  }, new Date('2026-06-13T00:00:00Z'))
  assert.equal(payload.companyId, 'demo-company')
  assert.equal(payload.planCode, 'pilot-plus')
  assert.equal(payload.currency, 'RUB')
  assert.equal(payload.paymentDate, '2026-06-13')
  assert.equal(payload.amount, 60000)
})

test('MRR calculation normalizes a two-month payment', () => {
  assert.equal(calculateMrrRub(120000, '2026-01-01', '2026-03-02'), 60000)
})

test('MRR calculation keeps amount for an invalid period', () => {
  assert.equal(calculateMrrRub(120000, 'invalid', 'invalid'), 120000)
})
