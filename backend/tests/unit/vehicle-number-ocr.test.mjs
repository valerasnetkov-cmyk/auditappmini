import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseVehicleNumberCandidates } from '../../src/services/vehicleNumberOcr.js'

test('parseVehicleNumberCandidates extracts normalized Russian plate candidates', () => {
  assert.deepEqual(parseVehicleNumberCandidates('plate A012XM63'), ['А012ХМ63'])
  assert.deepEqual(parseVehicleNumberCandidates('K002MK65 extra K002MK65'), ['К002МК65'])
})

test('parseVehicleNumberCandidates ignores invalid plate-shaped noise', () => {
  assert.deepEqual(parseVehicleNumberCandidates('A12XM63'), [])
  assert.deepEqual(parseVehicleNumberCandidates('A012ZZ63'), [])
})
