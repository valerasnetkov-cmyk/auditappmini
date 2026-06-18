import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveSubscriptionStatus } from '../../src/services/subscriptionAlerts.js'

const now = new Date('2026-06-12T10:00:00Z')

test('subscription remains active outside notification window', () => {
  assert.equal(resolveSubscriptionStatus({
    current_period_end: '2026-07-01',
  }, now), 'active')
})

test('subscription becomes expiring within fourteen days', () => {
  assert.equal(resolveSubscriptionStatus({
    current_period_end: '2026-06-19',
  }, now), 'expiring')
})

test('expired period remains in grace until grace date', () => {
  assert.equal(resolveSubscriptionStatus({
    current_period_end: '2026-06-10',
    grace_until: '2026-06-15',
  }, now), 'grace')
})

test('subscription expires after grace when auto suspend is disabled', () => {
  assert.equal(resolveSubscriptionStatus({
    current_period_end: '2026-06-01',
    grace_until: '2026-06-05',
    auto_suspend_enabled: 0,
  }, now), 'expired')
})

test('subscription is suspended after grace when auto suspend is enabled', () => {
  assert.equal(resolveSubscriptionStatus({
    current_period_end: '2026-06-01',
    grace_until: '2026-06-05',
    auto_suspend_enabled: 1,
  }, now), 'suspended')
})
