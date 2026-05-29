import bcrypt from 'bcryptjs'

export async function seedSmokeTenantOwner({
  databasePath,
  email = 'owner@example.com',
  password = 'owner123',
  companyId = 'default',
  name = 'Smoke Owner',
} = {}) {
  if (databasePath) {
    process.env.DATABASE_PATH = databasePath
  }

  const { initDatabase, getDb } = await import('../src/db.js')
  await initDatabase()
  const db = getDb()
  const passwordHash = bcrypt.hashSync(password, 10)

  db.prepare(`
    INSERT OR IGNORE INTO companies (id, slug, name, region_code, data_residency, status)
    VALUES (?, ?, ?, ?, ?, 'active')
  `).run(companyId, companyId, 'Smoke Company', 'RU-SAK', 'RU')

  db.prepare(`
    INSERT OR IGNORE INTO company_limits (
      id, company_id, plan_code, max_vehicles, max_users, max_storage_mb,
      ocr_enabled, accident_module_enabled, analytics_enabled, api_access_enabled, updated_at
    )
    VALUES (?, ?, 'pilot', 500, 100, 102400, 1, 1, 1, 0, datetime('now'))
  `).run(`limits-${companyId}`, companyId)

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
  if (existing) {
    db.prepare(`
      UPDATE users
      SET password = ?, name = ?, role = 'owner', status = 'active', company_id = ?
      WHERE id = ?
    `).run(passwordHash, name, companyId, existing.id)
  } else {
    db.prepare(`
      INSERT INTO users (id, email, password, name, role, status, company_id)
      VALUES (?, ?, ?, ?, 'owner', 'active', ?)
    `).run(`owner-${companyId}`, email, passwordHash, name, companyId)
  }

  return { email, password, companyId }
}
