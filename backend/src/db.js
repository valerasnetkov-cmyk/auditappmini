import initSqlJs from 'sql.js'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { normalizeVehicleNumberToCyrillic, repairMojibakeRussian } from './utils/transliteration.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.join(__dirname, 'database.sqlite')

let db = null

const TEXT_REPLACEMENTS = new Map([
  ['Р С’Р Т‘Р СР С‘Р Р…Р С‘РЎРѓРЎвЂљРЎР‚Р В°РЎвЂљР С•РЎР‚', 'Администратор'],
  ['Р вЂњР С’Р вЂ”Р ВµР В»РЎРЉ Next', 'ГАЗель Next'],
  ['Р вЂњР С’Р вЂ”Р ВµР В»РЎРЉ Р вЂР С‘Р В·Р Р…Р ВµРЎРѓ', 'ГАЗель Бизнес'],
  ['Р РЋР С•Р В±Р С•Р В»РЎРЉ', 'Соболь'],
  ['Р СљР С•РЎРѓР С”Р Р†Р В°', 'Москва'],
  ['Р СљР С•РЎРѓР С”Р С•Р Р†РЎРѓР С”Р В°РЎРЏ Р С•Р В±Р В».', 'Московская обл.'],
  ['Р РЋР В°Р Р…Р С”РЎвЂљ-Р СџР ВµРЎвЂљР ВµРЎР‚Р В±РЎС“РЎР‚Р С–', 'Санкт-Петербург'],
  ['Р С™РЎР‚Р В°РЎРѓР Р…Р С•Р Т‘Р В°РЎР‚', 'Краснодар'],
  ['Р вЂўР С”Р В°РЎвЂљР ВµРЎР‚Р С‘Р Р…Р В±РЎС“РЎР‚Р С–', 'Екатеринбург'],
  ['Р СњР С•Р Р†Р С•РЎРѓР С‘Р В±Р С‘РЎР‚РЎРѓР С”', 'Новосибирск'],
  ['Р вЂ™Р Р…Р ВµРЎв‚¬Р Р…Р С‘Р в„– Р Р†Р С‘Р Т‘', 'Внешний вид'],
  ['Р СџР С•Р Р†РЎР‚Р ВµР В¶Р Т‘Р ВµР Р…Р С‘РЎРЏ Р С”РЎС“Р В·Р С•Р Р†Р В°', 'Повреждения кузова'],
  ['Р С™Р С•Р В»РЎвЂРЎРѓР В°', 'Колёса'],
  ['Р РЋРЎвЂљР ВµР С”Р В»Р В°', 'Стекла'],
  ['Р вЂњР С•РЎРѓР Р…Р С•Р СР ВµРЎР‚', 'Госномер'],
  ['Р вЂєР В°Р С”Р С•Р С”РЎР‚Р В°РЎРѓР С•РЎвЂЎР Р…Р С•Р Вµ Р С—Р С•Р С”РЎР‚РЎвЂ№РЎвЂљР С‘Р Вµ', 'Лакокрасочное покрытие'],
  ['Р В¤Р В°РЎР‚РЎвЂ№', 'Фары'],
  ['Р вЂ”Р ВµРЎР‚Р С”Р В°Р В»Р В°', 'Зеркала'],
  ['Р вЂќР Р†Р ВµРЎР‚Р С‘', 'Двери'],
  ['Р вЂќР Р†Р С‘Р С–Р В°РЎвЂљР ВµР В»РЎРЉ', 'Двигатель'],
  ['Р РЋР В°Р В»Р С•Р Р…', 'Салон'],
  ['Р СџРЎР‚Р С‘Р В±Р С•РЎР‚Р Р…Р В°РЎРЏ Р С—Р В°Р Р…Р ВµР В»РЎРЉ', 'Приборная панель'],
  ['Р С›РЎРѓРЎвЂљР ВµР С”Р В»Р ВµР Р…Р С‘Р Вµ', 'Остекление'],
  ['Р ТђР С•Р Т‘Р С•Р Р†Р В°РЎРЏ', 'Ходовая'],
  ['Р С™РЎС“Р В·Р С•Р Р†', 'Кузов'],
  ['Р вЂР ВµР В·Р С•Р С—Р В°РЎРѓР Р…Р С•РЎРѓРЎвЂљРЎРЉ', 'Безопасность'],
  ['Р вЂ”Р В°РЎвЂћР С‘Р С”РЎРѓР С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С• Р С—РЎР‚Р С‘ Р С•РЎРѓР СР С•РЎвЂљРЎР‚Р Вµ', 'Зафиксировано при осмотре'],
  ['Р СњР Вµ РЎС“Р С”Р В°Р В·Р В°Р Р…', 'Не указано'],
])

const DEFAULT_REGIONS = [
  'Москва',
  'Московская обл.',
  'Санкт-Петербург',
  'Краснодар',
  'Екатеринбург',
  'Новосибирск',
  'Сахалинская область',
]

const LICENSE_PLATE_LATIN_TO_CYRILLIC = {
  A: 'А',
  B: 'В',
  E: 'Е',
  K: 'К',
  M: 'М',
  H: 'Н',
  O: 'О',
  P: 'Р',
  C: 'С',
  T: 'Т',
  Y: 'У',
  X: 'Х',
}

const LICENSE_PLATE_ALLOWED_LETTERS = ['А', 'В', 'Е', 'К', 'М', 'Н', 'О', 'Р', 'С', 'Т', 'У', 'Х']
const LICENSE_PLATE_PATTERN = /^[АВЕКМНОРСТУХ]\d{3}[АВЕКМНОРСТУХ]{2}\d{2,3}$/

function repairTextValue(value) {
  if (typeof value !== 'string') return value
  return repairMojibakeRussian(TEXT_REPLACEMENTS.get(value) || value)
}

function normalizeVehicleNumber(value) {
  return normalizeVehicleNumberToCyrillic(value)
}

function hashString(value) {
  return Array.from(value).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 0)
}

function buildCompliantVehicleNumber(source, salt = '') {
  const normalized = normalizeVehicleNumber(source)
  const digits = normalized.replace(/\D/g, '')
  const allowedLetters = normalized.split('').filter((symbol) => LICENSE_PLATE_ALLOWED_LETTERS.includes(symbol))
  const hash = hashString(`${normalized}:${salt}`)
  const pickFallback = (offset) => LICENSE_PLATE_ALLOWED_LETTERS[(hash + offset) % LICENSE_PLATE_ALLOWED_LETTERS.length]

  const firstLetter = allowedLetters[0] || pickFallback(1)
  const secondLetter = allowedLetters[1] || pickFallback(2)
  const thirdLetter = allowedLetters[2] || pickFallback(3)
  const mainDigits = (digits.slice(0, 3) || '000').padStart(3, '0')
  const regionDigitsSource = digits.length > 3 ? digits.slice(-3) : '77'
  const regionDigits = regionDigitsSource.length >= 2 ? regionDigitsSource : regionDigitsSource.padStart(2, '7')

  return `${firstLetter}${mainDigits}${secondLetter}${thirdLetter}${regionDigits}`
}

function repairTableColumn(table, column) {
  const select = db.prepare(`SELECT rowid, ${column} as value FROM ${table} WHERE ${column} IS NOT NULL`)
  const update = db.prepare(`UPDATE ${table} SET ${column} = ? WHERE rowid = ?`)
  let repaired = 0

  while (select.step()) {
    const row = select.getAsObject()
    const fixedValue = repairTextValue(row.value)
    if (fixedValue !== row.value) {
      update.run([fixedValue, row.rowid])
      repaired += 1
    }
  }

  select.free()
  update.free()
  return repaired
}

function repairDatabaseEncoding() {
  const repaired =
    repairTableColumn('users', 'name') +
    repairTableColumn('vehicles', 'name') +
    repairTableColumn('vehicles', 'region') +
    repairTableColumn('regions', 'name') +
    repairTableColumn('checklist_items', 'title') +
    repairTableColumn('defects', 'title') +
    repairTableColumn('defects', 'comment')

  if (repaired > 0) {
    console.log(`Fixed mojibake records: ${repaired}`)
  }
}

function repairVehicleNumbers() {
  const select = db.prepare('SELECT rowid, number FROM vehicles WHERE number IS NOT NULL')
  const update = db.prepare('UPDATE vehicles SET number = ? WHERE rowid = ?')
  const rows = []
  const usedNumbers = new Set()
  let repaired = 0

  while (select.step()) {
    rows.push(select.getAsObject())
  }

  rows.forEach((row) => {
    let candidate = normalizeVehicleNumber(row.number)
    if (!LICENSE_PLATE_PATTERN.test(candidate)) {
      candidate = buildCompliantVehicleNumber(String(row.number), String(row.rowid))
    }

    let suffix = 1
    while (usedNumbers.has(candidate)) {
      candidate = buildCompliantVehicleNumber(String(row.number), `${row.rowid}-${suffix}`)
      suffix += 1
    }

    if (candidate !== row.number) {
      update.run([candidate, row.rowid])
      repaired += 1
    }

    usedNumbers.add(candidate)
  })

  select.free()
  update.free()

  if (repaired > 0) {
    console.log(`Fixed vehicle numbers: ${repaired}`)
  }
}

function syncRegionDirectory() {
  const insertRegion = db.prepare(`
    INSERT OR IGNORE INTO regions (id, name, created_at)
    VALUES (?, ?, datetime('now'))
  `)

  DEFAULT_REGIONS.forEach((region) => {
    insertRegion.run([uuidv4(), repairTextValue(region)])
  })

  const vehicleRegions = db.prepare(`
    SELECT DISTINCT region
    FROM vehicles
    WHERE region IS NOT NULL AND TRIM(region) != ''
  `)

  while (vehicleRegions.step()) {
    const row = vehicleRegions.getAsObject()
    insertRegion.run([uuidv4(), repairTextValue(row.region)])
  }

  vehicleRegions.free()
  insertRegion.free()
}

function ensureColumn(table, column, definition) {
  const existingColumns = db.exec(`PRAGMA table_info(${table})`)?.[0]?.values || []
  const hasColumn = existingColumns.some((row) => row[1] === column)

  if (!hasColumn) {
    db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }
}

function applySchemaMigrations() {
  ensureColumn('users', 'company_id', "TEXT DEFAULT 'default'")
  ensureColumn('users', 'mfa_enabled', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn('users', 'mfa_secret', 'TEXT')
  ensureColumn('users', 'created_at', 'TEXT')

  ensureColumn('vehicles', 'company_id', "TEXT DEFAULT 'default'")
  ensureColumn('vehicles', 'region', 'TEXT')
  ensureColumn('vehicles', 'qr_code', 'TEXT')
  ensureColumn('vehicles', 'last_scheduled_inspection', 'TEXT')
  ensureColumn('vehicles', 'created_at', 'TEXT')

  ensureColumn('inspections', 'company_id', "TEXT DEFAULT 'default'")
  ensureColumn('inspections', 'completed', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn('inspections', 'accident_occurred_at', 'TEXT')
  ensureColumn('inspections', 'accident_location', 'TEXT')
  ensureColumn('inspections', 'odometer_value', 'INTEGER')
  ensureColumn('inspections', 'odometer_unit', "TEXT DEFAULT 'km'")
  ensureColumn('inspections', 'odometer_recognized_at', 'TEXT')
  ensureColumn('inspections', 'created_at', 'TEXT')

  ensureColumn('defects', 'company_id', "TEXT DEFAULT 'default'")
  ensureColumn('defects', 'comment', 'TEXT')
  ensureColumn('defects', 'status', "TEXT NOT NULL DEFAULT 'open'")
  ensureColumn('defects', 'created_at', 'TEXT')
  ensureColumn('defects', 'closed_at', 'TEXT')

  ensureColumn('photos', 'defect_id', 'TEXT')
  ensureColumn('photos', 'geo', 'TEXT')
  ensureColumn('photos', 'is_required', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn('photos', 'created_at', 'TEXT')

  db.run("UPDATE users SET created_at = datetime('now') WHERE created_at IS NULL")
  db.run("UPDATE vehicles SET created_at = datetime('now') WHERE created_at IS NULL")
  db.run("UPDATE inspections SET created_at = datetime('now') WHERE created_at IS NULL")
  db.run("UPDATE defects SET created_at = datetime('now') WHERE created_at IS NULL")
  db.run("UPDATE photos SET created_at = datetime('now') WHERE created_at IS NULL")
}

export async function initDatabase() {
  const SQL = await initSqlJs()

  if (fs.existsSync(dbPath)) {
    const data = fs.readFileSync(dbPath)
    db = new SQL.Database(data)
  } else {
    db = new SQL.Database()
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('inspector', 'manager')),
      company_id TEXT DEFAULT 'default',
      mfa_enabled INTEGER NOT NULL DEFAULT 0,
      mfa_secret TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)

  try {
    db.run(`ALTER TABLE users ADD COLUMN mfa_enabled INTEGER NOT NULL DEFAULT 0`)
  } catch {
  }

  try {
    db.run(`ALTER TABLE users ADD COLUMN mfa_secret TEXT`)
  } catch {
  }

  try {
    db.run(`ALTER TABLE users ADD COLUMN company_id TEXT DEFAULT 'default'`)
  } catch {
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      region_code TEXT,
      data_residency TEXT,
      api_cluster_key TEXT,
      storage_cluster_key TEXT,
      ocr_cluster_key TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id TEXT PRIMARY KEY,
      number TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'repair')),
      company_id TEXT DEFAULT 'default',
      region TEXT,
      qr_code TEXT,
      last_scheduled_inspection TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS regions (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS inspections (
      id TEXT PRIMARY KEY,
      vehicle_id TEXT NOT NULL,
      inspector_id TEXT NOT NULL,
      company_id TEXT DEFAULT 'default',
      type TEXT NOT NULL CHECK (type IN ('quick', 'scheduled', 'accident')),
      completed INTEGER NOT NULL DEFAULT 0,
      accident_occurred_at TEXT,
      accident_location TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS checklist_items (
      id TEXT PRIMARY KEY,
      inspection_id TEXT NOT NULL,
      title TEXT NOT NULL,
      result INTEGER,
      comment TEXT
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS defects (
      id TEXT PRIMARY KEY,
      inspection_id TEXT NOT NULL,
      company_id TEXT DEFAULT 'default',
      title TEXT NOT NULL,
      comment TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT DEFAULT (datetime('now')),
      closed_at TEXT
    )
  `)
  // Migrate if needed: ensure columns exist in existing DB
  try { db.run(`ALTER TABLE defects ADD COLUMN status TEXT NOT NULL DEFAULT 'open'`) } catch {}
  try { db.run(`ALTER TABLE defects ADD COLUMN closed_at TEXT`) } catch {}
  // defect_history table for status changes
  try {
    db.run(`CREATE TABLE IF NOT EXISTS defect_history (
      id TEXT PRIMARY KEY,
      defect_id TEXT NOT NULL,
      status TEXT NOT NULL,
      changed_at TEXT DEFAULT (datetime('now')),
      changed_by TEXT
    )`)
  } catch {}

  db.run(`
    CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY,
      inspection_id TEXT NOT NULL,
      defect_id TEXT,
      url TEXT NOT NULL,
      geo TEXT,
      is_required INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS vehicle_status_history (
      id TEXT PRIMARY KEY,
      vehicle_id TEXT NOT NULL,
      old_status TEXT NOT NULL,
      new_status TEXT NOT NULL,
      reason TEXT,
      changed_by TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Audit logs table for tracking important actions
  try {
    db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      company_id TEXT DEFAULT 'default',
      user_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      old_value TEXT,
      new_value TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`)
  } catch {}

  applySchemaMigrations()

  const settingsCheck = db.exec("SELECT value FROM settings WHERE key = 'scheduled_inspection_days'")
  if (settingsCheck.length === 0 || settingsCheck[0].values.length === 0) {
    db.run(`INSERT INTO settings (key, value) VALUES ('scheduled_inspection_days', '30')`)
    db.run(`INSERT INTO settings (key, value) VALUES ('notification_days_before', '3')`)
    db.run(`INSERT INTO settings (key, value) VALUES ('timezone_offset', '3')`)
  }

  const tzCheck = db.exec("SELECT value FROM settings WHERE key = 'timezone_offset'")
  if (tzCheck.length === 0 || tzCheck[0].values.length === 0) {
    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('timezone_offset', '3')`)
  }

  try {
    db.run(`ALTER TABLE vehicles ADD COLUMN region TEXT`)
  } catch {
  }

  try {
    db.run(`ALTER TABLE vehicles ADD COLUMN company_id TEXT DEFAULT 'default'`)
  } catch {
  }

  try {
    db.run(`ALTER TABLE inspections ADD COLUMN accident_occurred_at TEXT`)
  } catch {
  }

  try {
    db.run(`ALTER TABLE inspections ADD COLUMN accident_location TEXT`)
  } catch {
  }

  try {
    db.run(`ALTER TABLE inspections ADD COLUMN odometer_value INTEGER`)
  } catch {}
  try {
    db.run(`ALTER TABLE inspections ADD COLUMN odometer_unit TEXT DEFAULT 'km'`)
  } catch {}
  try {
    db.run(`ALTER TABLE inspections ADD COLUMN odometer_recognized_at TEXT`)
  } catch {}

  // Optional admin user from environment. If ADMIN_EMAIL is not provided, skip seeding here.
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD
  if (ADMIN_EMAIL) {
    if (!ADMIN_PASSWORD) {
      console.log('Admin seed skipped: ADMIN_PASSWORD not provided in environment')
    } else {
      try {
        const existing = db.prepare('SELECT id FROM users WHERE email = ?')
        existing.bind([ADMIN_EMAIL])
        const adminExists = existing.step()
        existing.free()

        if (adminExists) {
          console.log(`Admin already exists: ${ADMIN_EMAIL}`)
        } else {
          const hashedPassword = bcrypt.hashSync(ADMIN_PASSWORD, 10)
          db.run(
            'INSERT INTO users (id, email, password, name, role, company_id) VALUES (?, ?, ?, ?, ?, ?)',
            [uuidv4(), ADMIN_EMAIL, hashedPassword, 'Администратор', 'manager', 'default'],
          )
          saveDatabase()
        }
      } catch (e) {
        console.log('[DB] Error checking admin:', e.message)
      }
    }
  }

  repairDatabaseEncoding()
  repairVehicleNumbers()
  syncRegionDirectory()

  saveDatabase()
  console.log('Database initialized')
}

function saveDatabase() {
  if (db) {
    const data = db.export()
    fs.writeFileSync(dbPath, Buffer.from(data))
  }
}

export function getDb() {
  return {
    prepare: (sql) => ({
      run: (...params) => {
        if (params.length > 0) {
          db.run(sql, params)
        } else {
          db.run(sql)
        }
        saveDatabase()
        return { changes: 0 }
      },
      get: (...params) => {
        const stmt = db.prepare(sql)
        // Handle both: .get(a, b) and .get([a, b])
        const bindParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params
        if (bindParams.length > 0) stmt.bind(bindParams)
        // IMPORTANT: step() only once - calling twice breaks it!
        if (stmt.step()) {
          const row = stmt.getAsObject()
          stmt.free()
          return row
        }
        stmt.free()
        return undefined
      },
      all: (...params) => {
        const stmt = db.prepare(sql)
        const bindParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params
        if (bindParams.length > 0) stmt.bind(bindParams)
        const results = []
        while (stmt.step()) {
          results.push(stmt.getAsObject())
        }
        stmt.free()
        return results
      },
    }),
    exec: (sql) => {
      db.run(sql)
      saveDatabase()
    },
  }
}

export default {
  get prepare() {
    return getDb().prepare
  },
  get exec() {
    return getDb().exec
  },
}
