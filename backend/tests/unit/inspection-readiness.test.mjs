import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { randomUUID } from 'node:crypto'

const databasePath = path.resolve('.tmp-smoke', `readiness-unit-${process.pid}.sqlite`)
process.env.DATABASE_PATH = databasePath

const { initDatabase, getDb, closeDatabase } = await import('../../src/db.js')
const { photoRequirements, photoTypeLabels } = await import('../../src/routes/photo-requirements.js')
const {
  CHECKLIST_REQUIREMENTS,
  createInspectionReadinessService,
} = await import('../../src/services/inspectionReadiness.js')

test('inspection readiness enforces checklist, defect evidence and odometer confirmation', async () => {
  await fs.mkdir(path.dirname(databasePath), { recursive: true })
  await initDatabase()
  const db = getDb()
  const companyId = 'readiness-company'
  const inspectionId = randomUUID()
  const vehicleId = randomUUID()
  const userId = randomUUID()

  try {
    db.prepare(`
      INSERT INTO companies (id, slug, name, status)
      VALUES (?, ?, ?, 'active')
    `).run(companyId, companyId, 'Readiness Company')
    db.prepare(`
      INSERT INTO users (id, email, password, name, role, status, company_id)
      VALUES (?, ?, 'hash', 'Inspector', 'inspector', 'active', ?)
    `).run(userId, 'readiness@example.com', companyId)
    db.prepare(`
      INSERT INTO vehicles (id, number, name, status, company_id)
      VALUES (?, 'А123ВС65', 'Test vehicle', 'active', ?)
    `).run(vehicleId, companyId)
    db.prepare(`
      INSERT INTO inspections (
        id, vehicle_id, inspector_id, company_id, type, odometer_value, odometer_confirmed_at
      ) VALUES (?, ?, ?, ?, 'quick', 1000, datetime('now'))
    `).run(inspectionId, vehicleId, userId, companyId)

    const service = createInspectionReadinessService({ db, photoRequirements, photoTypeLabels })
    const initiallyMissing = service.getReadiness(inspectionId, companyId)
    assert.equal(initiallyMissing.ready, false)
    assert.ok(initiallyMissing.missing.some((item) => item.code === 'missing_checklist_result'))

    const checklistIds = []
    for (const title of CHECKLIST_REQUIREMENTS.quick) {
      const id = randomUUID()
      checklistIds.push(id)
      db.prepare(`
        INSERT INTO checklist_items (id, inspection_id, title, result)
        VALUES (?, ?, ?, 1)
      `).run(id, inspectionId, title)
    }
    for (const photoType of photoRequirements.quick.required) {
      db.prepare(`
        INSERT INTO photos (
          id, inspection_id, company_id, photo_type, url, upload_status, is_required
        ) VALUES (?, ?, ?, ?, ?, 'uploaded', 1)
      `).run(randomUUID(), inspectionId, companyId, photoType, `/uploads/${photoType}.webp`)
    }

    assert.equal(service.getReadiness(inspectionId, companyId).ready, true)

    const customChecklistId = randomUUID()
    db.prepare(`
      INSERT INTO checklist_items (id, inspection_id, title, result)
      VALUES (?, ?, 'Дополнительная проверка', NULL)
    `).run(customChecklistId, inspectionId)
    let readiness = service.getReadiness(inspectionId, companyId)
    assert.ok(readiness.missing.some((item) => (
      item.code === 'missing_checklist_result' && item.field === customChecklistId
    )))
    db.prepare('UPDATE checklist_items SET result = 1 WHERE id = ?').run(customChecklistId)

    const failedChecklistId = checklistIds[0]
    db.prepare('UPDATE checklist_items SET result = 0 WHERE id = ?').run(failedChecklistId)
    readiness = service.getReadiness(inspectionId, companyId)
    assert.ok(readiness.missing.some((item) => item.code === 'missing_defect'))

    const defectId = randomUUID()
    db.prepare(`
      INSERT INTO defects (id, inspection_id, checklist_item_id, company_id, title, status)
      VALUES (?, ?, ?, ?, 'Внешний вид', 'open')
    `).run(defectId, inspectionId, failedChecklistId, companyId)
    readiness = service.getReadiness(inspectionId, companyId)
    assert.ok(readiness.missing.some((item) => item.code === 'missing_defect_photo'))

    db.prepare(`
      INSERT INTO photos (
        id, inspection_id, defect_id, company_id, url, upload_status, is_required
      ) VALUES (?, ?, ?, ?, '/uploads/defect.webp', 'uploaded', 0)
    `).run(randomUUID(), inspectionId, defectId, companyId)
    assert.equal(service.getReadiness(inspectionId, companyId).ready, true)
  } finally {
    closeDatabase()
    await fs.rm(databasePath, { force: true })
  }
})
