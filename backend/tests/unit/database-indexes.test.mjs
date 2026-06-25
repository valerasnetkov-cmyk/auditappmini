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

test('vehicle number repair keeps valid duplicate numbers scoped per company', async () => {
  const db = databaseModule.getDb()
  db.prepare(`
    INSERT OR IGNORE INTO companies (id, slug, name, status)
    VALUES (?, ?, ?, 'active')
  `).run('repair-company-a', 'repair-company-a', 'Repair Company A')
  db.prepare(`
    INSERT OR IGNORE INTO companies (id, slug, name, status)
    VALUES (?, ?, ?, 'active')
  `).run('repair-company-b', 'repair-company-b', 'Repair Company B')

  db.prepare(`
    INSERT INTO vehicles (id, number, name, status, company_id)
    VALUES (?, ?, ?, 'active', ?)
  `).run('repair-vehicle-a', 'К002МК65', 'Vehicle A', 'repair-company-a')
  db.prepare(`
    INSERT INTO vehicles (id, number, name, status, company_id)
    VALUES (?, ?, ?, 'active', ?)
  `).run('repair-vehicle-b', 'К002МК65', 'Vehicle B', 'repair-company-b')

  await databaseModule.initDatabase()

  const numbers = db.prepare(`
    SELECT company_id, number
    FROM vehicles
    WHERE id IN ('repair-vehicle-a', 'repair-vehicle-b')
    ORDER BY company_id
  `).all()

  assert.deepEqual(numbers, [
    { company_id: 'repair-company-a', number: 'К002МК65' },
    { company_id: 'repair-company-b', number: 'К002МК65' },
  ])
})
