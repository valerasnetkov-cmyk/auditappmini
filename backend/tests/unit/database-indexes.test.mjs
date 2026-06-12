import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const databasePath = path.join(os.tmpdir(), `auditavto-indexes-${process.pid}-${Date.now()}.sqlite`)
process.env.DATABASE_PATH = databasePath

const databaseModule = await import(`../../src/db.js?indexes-test=${Date.now()}`)

after(async () => {
  databaseModule.closeDatabase()
  delete process.env.DATABASE_PATH
  await fs.rm(databasePath, { force: true })
  await fs.rm(`${databasePath}-shm`, { force: true })
  await fs.rm(`${databasePath}-wal`, { force: true })
})

test('operational vehicle list indexes are created repeat-safely', async () => {
  await databaseModule.initDatabase()
  await databaseModule.initDatabase()

  const indexes = databaseModule.getDb().prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'index' AND name IN (
      'idx_vehicles_company_status_created',
      'idx_vehicles_company_number',
      'idx_inspections_company_vehicle_created',
      'idx_defects_inspection',
      'idx_pilot_requests_status_created',
      'idx_pilot_requests_assigned_created',
      'idx_pilot_requests_region_created',
      'idx_pilot_requests_linked_company'
    )
    ORDER BY name
  `).all().map((row) => row.name)

  assert.deepEqual(indexes, [
    'idx_defects_inspection',
    'idx_inspections_company_vehicle_created',
    'idx_pilot_requests_assigned_created',
    'idx_pilot_requests_linked_company',
    'idx_pilot_requests_region_created',
    'idx_pilot_requests_status_created',
    'idx_vehicles_company_number',
    'idx_vehicles_company_status_created',
  ])
})
