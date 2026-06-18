import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getActivityDropPercent,
  getLimitRiskLevel,
  getUsagePercent,
  isOlderThan,
} from '../../src/services/resourceCompanies.js'

test('company usage percent and limit risk use established thresholds', () => {
  assert.equal(getUsagePercent(8, 10), 80)
  assert.equal(getUsagePercent(1, null), null)
  assert.equal(getLimitRiskLevel(80, 20), 'upsell')
  assert.equal(getLimitRiskLevel(100, 20), 'blocked')
})

test('activity drop never reports negative growth', () => {
  assert.equal(getActivityDropPercent(5, 10), 50)
  assert.equal(getActivityDropPercent(15, 10), 0)
  assert.equal(getActivityDropPercent(5, 0), null)
})

test('stale activity comparison accepts a deterministic clock', () => {
  const now = new Date('2026-06-13T00:00:00Z')
  assert.equal(isOlderThan('2026-05-01T00:00:00Z', 14, now), true)
  assert.equal(isOlderThan('2026-06-10T00:00:00Z', 14, now), false)
})
