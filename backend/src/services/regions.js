import { v4 as uuidv4 } from 'uuid'

export function normalizeRegionName(region) {
  if (typeof region !== 'string') return null
  const trimmed = region.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function getRegionByName(db, name) {
  return db.prepare('SELECT id, name, created_at FROM regions WHERE name = ?').get(name)
}

export function getRegionById(db, id) {
  return db.prepare('SELECT id, name, created_at FROM regions WHERE id = ?').get(id)
}

export function countVehiclesByRegion(db, regionName, companyId = null) {
  const query = companyId
    ? db.prepare('SELECT COUNT(*) as count FROM vehicles WHERE region = ? AND company_id = ?')
    : db.prepare('SELECT COUNT(*) as count FROM vehicles WHERE region = ?')

  const result = companyId ? query.get(regionName, companyId) : query.get(regionName)
  return Number(result?.count || 0)
}

export function listRegions(db, companyId = null) {
  if (companyId) {
    return db.prepare(`
      SELECT r.id, r.name, r.created_at, COUNT(v.id) as vehicle_count
      FROM regions r
      LEFT JOIN vehicles v ON v.region = r.name AND v.company_id = ?
      GROUP BY r.id, r.name, r.created_at
      ORDER BY r.name
    `).all(companyId)
  }

  return db.prepare(`
    SELECT r.id, r.name, r.created_at, COUNT(v.id) as vehicle_count
    FROM regions r
    LEFT JOIN vehicles v ON v.region = r.name
    GROUP BY r.id, r.name, r.created_at
    ORDER BY r.name
  `).all()
}

export function createRegionRecord(db, name) {
  return db.prepare(`
    INSERT INTO regions (id, name, created_at)
    VALUES (?, ?, datetime('now'))
  `).run(uuidv4(), name)
}

export function deleteRegionRecord(db, id) {
  return db.prepare('DELETE FROM regions WHERE id = ?').run(id)
}

export function ensureRegionRecordByName(db, name, companyId = null) {
  const regionName = normalizeRegionName(name)
  if (!regionName) return null

  const existing = getRegionByName(db, regionName)
  if (existing) return existing

  if (countVehiclesByRegion(db, regionName, companyId) === 0) return null

  createRegionRecord(db, regionName)
  return getRegionByName(db, regionName)
}

export function getRegionForMutation(db, id, fallbackName, companyId = null) {
  return getRegionById(db, id) || ensureRegionRecordByName(db, fallbackName, companyId)
}
