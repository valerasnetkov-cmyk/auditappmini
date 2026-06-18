import test from 'node:test'
import assert from 'node:assert/strict'
import { mapAuditLog, mapNotification } from '../../src/services/resourceActivity.js'

test('notification mapping preserves resource-admin contract defaults', () => {
  const notification = mapNotification({
    id: 'n1',
    type: 'subscription_expired',
    title: 'Expired',
  })
  assert.equal(notification.channel, 'in_app')
  assert.equal(notification.status, 'new')
  assert.equal(notification.companyId, null)
})

test('audit mapping parses valid payload JSON', () => {
  const log = mapAuditLog({
    id: 'a1',
    action: 'company_updated',
    payload_json: '{"status":"inactive"}',
  })
  assert.deepEqual(log.payload, { status: 'inactive' })
})

test('audit mapping tolerates malformed payload JSON', () => {
  assert.equal(mapAuditLog({
    id: 'a2',
    action: 'legacy',
    payload_json: '{broken',
  }).payload, null)
})
