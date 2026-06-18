import test from 'node:test'
import assert from 'node:assert/strict'
import { getOwnerSetupStatus, mapOwner } from '../../src/services/resourceOwners.js'

const now = new Date('2026-06-13T00:00:00Z')

test('owner setup status covers not sent, pending and expired links', () => {
  assert.equal(getOwnerSetupStatus({}, now), 'not_sent')
  assert.equal(getOwnerSetupStatus({
    owner_setup_issued_at: '2026-06-12T00:00:00Z',
    owner_setup_expires_at: '2026-06-14T00:00:00Z',
  }, now), 'pending')
  assert.equal(getOwnerSetupStatus({
    owner_setup_issued_at: '2026-06-10T00:00:00Z',
    owner_setup_expires_at: '2026-06-12T00:00:00Z',
  }, now), 'expired')
})

test('accepted owner setup has priority over expiration', () => {
  assert.equal(getOwnerSetupStatus({
    owner_setup_issued_at: '2026-06-01T00:00:00Z',
    owner_setup_expires_at: '2026-06-02T00:00:00Z',
    owner_setup_accepted_at: '2026-06-01T12:00:00Z',
  }, now), 'accepted')
})

test('owner mapping preserves legacy field names used by resource admin', () => {
  const owner = mapOwner({
    id: 'owner-1',
    email: 'owner@example.com',
    name: 'Owner',
    role: 'owner',
    company_id: null,
  }, now)
  assert.equal(owner.company_id, 'default')
  assert.equal(owner.setup.status, 'not_sent')
})
