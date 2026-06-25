import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { normalizeVehicleNumberToCyrillic } from './utils/transliteration.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const backendRoot = path.resolve(__dirname, '..')
const configuredDbPath = process.env.DATABASE_PATH
const dbPath = configuredDbPath
  ? path.resolve(process.cwd(), configuredDbPath)
  : path.join(backendRoot, 'data', 'database.sqlite')

let db = null

function normalizeParams(params) {
  if (params.length === 0) return []
  if (params.length === 1 && Array.isArray(params[0])) return params[0]
  return params
}

function isReadSql(sql) {
  return /^\s*(SELECT|PRAGMA|WITH)\b/i.test(sql)
}

function runStatement(statement, params) {
  const normalized = normalizeParams(params)
  return normalized.length > 0 ? statement.run(normalized) : statement.run()
}

function allStatement(statement, params) {
  const normalized = normalizeParams(params)
  return normalized.length > 0 ? statement.all(normalized) : statement.all()
}

function getStatement(statement, params) {
  const normalized = normalizeParams(params)
  return normalized.length > 0 ? statement.get(normalized) : statement.get()
}

function createSqlJsLikeStatement(statement) {
  let boundParams = []
  let rows = null
  let currentRow = null

  return {
    bind: (...params) => {
      boundParams = normalizeParams(params)
    },
    run: (...params) => runStatement(statement, params.length > 0 ? params : boundParams),
    step: () => {
      if (rows === null) {
        rows = allStatement(statement, boundParams)
      }

      currentRow = rows.shift() || null
      return currentRow !== null
    },
    getAsObject: () => currentRow || {},
    free: () => {},
  }
}

function createDatabase(filePath) {
  const sqlite = new Database(filePath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  return {
    raw: sqlite,
    run: (sql, ...params) => {
      const normalized = normalizeParams(params)
      if (normalized.length === 0) {
        try {
          return sqlite.prepare(sql).run()
        } catch (error) {
          if (!/more than one statement/i.test(error.message)) {
            throw error
          }

          sqlite.exec(sql)
          return { changes: 0, lastInsertRowid: undefined }
        }
      }

      return runStatement(sqlite.prepare(sql), normalized)
    },
    exec: (sql) => {
      if (!isReadSql(sql)) {
        sqlite.exec(sql)
        return []
      }

      const statement = sqlite.prepare(sql)
      const columns = statement.columns().map((column) => column.name)
      const values = statement.raw().all()
      return values.length > 0 ? [{ columns, values }] : []
    },
    prepare: (sql) => createSqlJsLikeStatement(sqlite.prepare(sql)),
    close: () => sqlite.close(),
  }
}

const DEFAULT_REGIONS = [
  'Москва',
  'Московская обл.',
  'Санкт-Петербург',
  'Краснодар',
  'Екатеринбург',
  'Новосибирск',
  'Сахалинская область',
]

const LICENSE_PLATE_ALLOWED_LETTERS = ['А', 'В', 'Е', 'К', 'М', 'Н', 'О', 'Р', 'С', 'Т', 'У', 'Х']
const LICENSE_PLATE_PATTERN = /^[АВЕКМНОРСТУХ]\d{3}[АВЕКМНОРСТУХ]{2}\d{2,3}$/

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
    insertRegion.run([uuidv4(), region])
  })

  const vehicleRegions = db.prepare(`
    SELECT DISTINCT region
    FROM vehicles
    WHERE region IS NOT NULL AND TRIM(region) != ''
  `)

  while (vehicleRegions.step()) {
    const row = vehicleRegions.getAsObject()
    insertRegion.run([uuidv4(), row.region])
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

function tableHasColumn(table, column) {
  const existingColumns = db.exec(`PRAGMA table_info(${table})`)?.[0]?.values || []
  return existingColumns.some((row) => row[1] === column)
}

function dropVehicleQrCodeColumn() {
  if (!tableHasColumn('vehicles', 'qr_code')) return

  db.run('BEGIN TRANSACTION')
  try {
    db.run(`
      CREATE TABLE vehicles_without_qr (
        id TEXT PRIMARY KEY,
        number TEXT NOT NULL,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'repair', 'archived')),
        company_id TEXT DEFAULT 'default',
        region TEXT,
        last_scheduled_inspection TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `)

    db.run(`
      INSERT INTO vehicles_without_qr (
        id,
        number,
        name,
        status,
        company_id,
        region,
        last_scheduled_inspection,
        created_at
      )
      SELECT
        id,
        COALESCE(NULLIF(TRIM(number), ''), id),
        COALESCE(NULLIF(TRIM(name), ''), 'Без названия'),
        CASE WHEN status IN ('active', 'repair', 'archived') THEN status ELSE 'active' END,
        COALESCE(company_id, 'default'),
        region,
        last_scheduled_inspection,
        COALESCE(created_at, datetime('now'))
      FROM vehicles
    `)

    db.run('DROP TABLE vehicles')
    db.run('ALTER TABLE vehicles_without_qr RENAME TO vehicles')
    db.run('COMMIT')
    console.log('Removed legacy vehicles.qr_code column')
  } catch (error) {
    db.run('ROLLBACK')
    throw error
  }
}

function ensureVehicleStatusSupportsArchived() {
  const vehiclesTableSql = db.exec(`
    SELECT sql
    FROM sqlite_master
    WHERE type = 'table' AND name = 'vehicles'
  `)?.[0]?.values?.[0]?.[0]

  if (typeof vehiclesTableSql === 'string' && vehiclesTableSql.includes("'archived'")) {
    return
  }

  db.run('BEGIN TRANSACTION')
  try {
    db.run(`
      CREATE TABLE vehicles_with_archived_status (
        id TEXT PRIMARY KEY,
        number TEXT NOT NULL,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'repair', 'archived')),
        company_id TEXT DEFAULT 'default',
        region TEXT,
        last_scheduled_inspection TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `)

    db.run(`
      INSERT INTO vehicles_with_archived_status (
        id,
        number,
        name,
        status,
        company_id,
        region,
        last_scheduled_inspection,
        created_at
      )
      SELECT
        id,
        COALESCE(NULLIF(TRIM(number), ''), id),
        COALESCE(NULLIF(TRIM(name), ''), 'Без названия'),
        CASE WHEN status IN ('active', 'repair', 'archived') THEN status ELSE 'active' END,
        COALESCE(company_id, 'default'),
        region,
        last_scheduled_inspection,
        COALESCE(created_at, datetime('now'))
      FROM vehicles
    `)

    db.run('DROP TABLE vehicles')
    db.run('ALTER TABLE vehicles_with_archived_status RENAME TO vehicles')
    db.run('COMMIT')
    console.log('Expanded vehicles.status to support archived')
  } catch (error) {
    db.run('ROLLBACK')
    throw error
  }
}

function ensureUsersRoleSupportsAdminAndOwner() {
  const usersTableSql = db.exec(`
    SELECT sql
    FROM sqlite_master
    WHERE type = 'table' AND name = 'users'
  `)?.[0]?.values?.[0]?.[0]

  if (typeof usersTableSql === 'string' && usersTableSql.includes("'resource_manager'")) {
    return
  }

  db.run('BEGIN TRANSACTION')
  try {
    db.run(`
      CREATE TABLE users_with_admin_owner_role (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('inspector', 'manager', 'owner', 'admin', 'resource_manager')),
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
        company_id TEXT DEFAULT 'default',
        mfa_enabled INTEGER NOT NULL DEFAULT 0,
        mfa_secret TEXT,
        last_login_at TEXT,
        service_notifications_enabled INTEGER NOT NULL DEFAULT 0,
        service_notification_types TEXT,
        resource_permission_preset TEXT NOT NULL DEFAULT 'custom',
        owner_setup_nonce TEXT,
        owner_setup_issued_at TEXT,
        owner_setup_expires_at TEXT,
        owner_setup_accepted_at TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `)

    db.run(`
      INSERT INTO users_with_admin_owner_role (
        id,
        email,
        password,
        name,
        role,
        status,
        company_id,
        mfa_enabled,
        mfa_secret,
        last_login_at,
        service_notifications_enabled,
        service_notification_types,
        resource_permission_preset,
        owner_setup_nonce,
        owner_setup_issued_at,
        owner_setup_expires_at,
        owner_setup_accepted_at,
        created_at
      )
      SELECT
        id,
        email,
        password,
        name,
        CASE WHEN role IN ('inspector', 'manager', 'owner', 'admin', 'resource_manager') THEN role ELSE 'inspector' END,
        CASE WHEN status IN ('active', 'inactive') THEN status ELSE 'active' END,
        COALESCE(company_id, 'default'),
        COALESCE(mfa_enabled, 0),
        mfa_secret,
        last_login_at,
        COALESCE(service_notifications_enabled, 0),
        service_notification_types,
        COALESCE(resource_permission_preset, 'custom'),
        owner_setup_nonce,
        owner_setup_issued_at,
        owner_setup_expires_at,
        owner_setup_accepted_at,
        COALESCE(created_at, datetime('now'))
      FROM users
    `)

    db.run('DROP TABLE users')
    db.run('ALTER TABLE users_with_admin_owner_role RENAME TO users')
    db.run('COMMIT')
    console.log('Expanded users.role to support resource roles')
  } catch (error) {
    db.run('ROLLBACK')
    throw error
  }
}

function seedDefaultPlans() {
  const insertPlan = db.prepare(`
    INSERT OR IGNORE INTO plans (
      code,
      name,
      description,
      position,
      is_active,
      is_public,
      yearly_price_rub,
      trial_months,
      recommended,
      max_vehicles,
      max_users,
      max_inspections_per_month,
      max_storage_mb,
      storage_limit_gb,
      ocr_enabled,
      ocr_monthly_limit,
      accident_module_enabled,
      analytics_enabled,
      export_enabled,
      api_access_enabled,
      custom_branding_enabled,
      regional_storage_enabled,
      support_level,
      monthly_price_rub,
      status,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, 1, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'), datetime('now'))
  `)

  insertPlan.run(['pilot', 'Пилот', 'Пилотное внедрение для небольшой группы техники', 10, null, 1, 0, 10, 3, 300, 10240, 10, 1, 300, 1, 0, 1, 0, 0, 0, 'basic', 5000])
  insertPlan.run(['standard', 'Стандарт', 'Основной тариф для регулярного контроля автопарка', 20, 150000, 0, 1, 50, 10, 2000, 51200, 50, 1, 2000, 1, 1, 1, 0, 0, 0, 'priority', 15000])
  insertPlan.run(['enterprise', 'Enterprise', 'Индивидуальные условия для крупных парков', 30, null, 0, 0, 150, 30, null, 204800, 200, 1, null, 1, 1, 1, 1, 1, 1, 'personal', 50000])
  insertPlan.free?.()

  const updatePlan = db.prepare(`
    UPDATE plans
    SET name = ?, description = ?, position = ?, is_active = 1, is_public = 1,
        monthly_price_rub = ?, yearly_price_rub = ?, trial_months = ?, recommended = ?,
        max_vehicles = ?, max_users = ?, max_inspections_per_month = ?,
        max_storage_mb = ?, storage_limit_gb = ?, ocr_enabled = ?, ocr_monthly_limit = ?,
        accident_module_enabled = ?, analytics_enabled = ?, export_enabled = ?,
        api_access_enabled = ?, custom_branding_enabled = ?, regional_storage_enabled = ?,
        support_level = ?, status = 'active', updated_at = datetime('now')
    WHERE code = ?
  `)
  updatePlan.run(['Пилот', 'Пилотное внедрение для небольшой группы техники', 10, 5000, null, 1, 0, 10, 3, 300, 10240, 10, 1, 300, 1, 0, 1, 0, 0, 0, 'basic', 'pilot'])
  updatePlan.run(['Стандарт', 'Основной тариф для регулярного контроля автопарка', 20, 15000, 150000, 0, 1, 50, 10, 2000, 51200, 50, 1, 2000, 1, 1, 1, 0, 0, 0, 'priority', 'standard'])
  updatePlan.run(['Enterprise', 'Индивидуальные условия для крупных парков', 30, 50000, null, 0, 0, 150, 30, null, 204800, 200, 1, null, 1, 1, 1, 1, 1, 1, 'personal', 'enterprise'])
  updatePlan.free?.()

  db.run(`
    INSERT OR IGNORE INTO company_limits (id, company_id, plan_code, created_at, updated_at)
    SELECT lower(hex(randomblob(16))), id, CASE WHEN id = 'default' THEN 'standard' ELSE 'pilot' END, datetime('now'), datetime('now')
    FROM companies
  `)
  db.run("UPDATE company_limits SET plan_code = 'standard' WHERE company_id = 'default' AND (plan_code IS NULL OR plan_code = 'pilot')")

  db.run(`
    INSERT OR IGNORE INTO company_billing (
      id, company_id, plan_code, billing_status, trial_until, created_at, updated_at
    )
    SELECT
      lower(hex(randomblob(16))),
      c.id,
      COALESCE(l.plan_code, 'pilot'),
      CASE WHEN s.status = 'suspended' THEN 'suspended' ELSE 'trial' END,
      CASE
        WHEN s.current_period_end IS NOT NULL THEN s.current_period_end
        ELSE date('now', '+30 days')
      END,
      datetime('now'),
      datetime('now')
    FROM companies c
    LEFT JOIN company_limits l ON l.company_id = c.id
    LEFT JOIN company_subscriptions s ON s.company_id = c.id
  `)
}

function applySchemaMigrations() {
  ensureColumn('companies', 'access_mode', "TEXT NOT NULL DEFAULT 'standard'")
  ensureColumn('companies', 'default_quick_inspection_interval_days', 'INTEGER NOT NULL DEFAULT 7')
  ensureColumn('companies', 'default_planned_inspection_interval_days', 'INTEGER NOT NULL DEFAULT 30')
  ensureColumn('users', 'company_id', "TEXT DEFAULT 'default'")
  ensureColumn('users', 'status', "TEXT NOT NULL DEFAULT 'active'")
  ensureColumn('users', 'mfa_enabled', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn('users', 'mfa_secret', 'TEXT')
  ensureColumn('users', 'created_at', 'TEXT')
  ensureColumn('users', 'last_login_at', 'TEXT')
  ensureColumn('users', 'service_notifications_enabled', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn('users', 'service_notification_types', 'TEXT')
  ensureColumn('users', 'resource_permission_preset', "TEXT NOT NULL DEFAULT 'custom'")
  ensureColumn('users', 'owner_setup_nonce', 'TEXT')
  ensureColumn('users', 'owner_setup_issued_at', 'TEXT')
  ensureColumn('users', 'owner_setup_expires_at', 'TEXT')
  ensureColumn('users', 'owner_setup_accepted_at', 'TEXT')

  ensureColumn('vehicles', 'company_id', "TEXT DEFAULT 'default'")
  ensureColumn('vehicles', 'region', 'TEXT')
  ensureColumn('vehicles', 'last_scheduled_inspection', 'TEXT')
  ensureColumn('vehicles', 'quick_inspection_interval_days', 'INTEGER')
  ensureColumn('vehicles', 'planned_inspection_interval_days', 'INTEGER')
  ensureColumn('vehicles', 'primary_photo_url', 'TEXT')
  ensureColumn('vehicles', 'primary_photo_original_url', 'TEXT')
  ensureColumn('vehicles', 'primary_photo_webp_url', 'TEXT')
  ensureColumn('vehicles', 'primary_photo_thumb_url', 'TEXT')
  ensureColumn('vehicles', 'primary_photo_source', 'TEXT')
  ensureColumn('vehicles', 'created_at', 'TEXT')
  dropVehicleQrCodeColumn()
  ensureVehicleStatusSupportsArchived()

  ensureColumn('inspections', 'company_id', "TEXT DEFAULT 'default'")
  ensureColumn('inspections', 'completed', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn('inspections', 'accident_occurred_at', 'TEXT')
  ensureColumn('inspections', 'accident_location', 'TEXT')
  ensureColumn('inspections', 'odometer_value', 'INTEGER')
  ensureColumn('inspections', 'odometer_unit', "TEXT DEFAULT 'km'")
  ensureColumn('inspections', 'odometer_recognized_at', 'TEXT')
  ensureColumn('inspections', 'client_inspection_id', 'TEXT')
  ensureColumn('inspections', 'sync_source', "TEXT NOT NULL DEFAULT 'web'")
  ensureColumn('inspections', 'started_at', 'TEXT')
  ensureColumn('inspections', 'completed_at', 'TEXT')
  ensureColumn('inspections', 'duration_seconds', 'INTEGER')
  ensureColumn('inspections', 'odometer_confirmed_at', 'TEXT')
  ensureColumn('inspections', 'odometer_unavailable_reason', 'TEXT')
  ensureColumn('inspections', 'approval_status', "TEXT NOT NULL DEFAULT 'draft'")
  ensureColumn('inspections', 'submitted_at', 'TEXT')
  ensureColumn('inspections', 'submitted_by', 'TEXT')
  ensureColumn('inspections', 'reviewed_at', 'TEXT')
  ensureColumn('inspections', 'reviewed_by', 'TEXT')
  ensureColumn('inspections', 'approval_comment', 'TEXT')
  ensureColumn('inspections', 'created_at', 'TEXT')
  db.run("UPDATE inspections SET started_at = COALESCE(started_at, created_at) WHERE started_at IS NULL")
  db.run(`
    UPDATE inspections
    SET duration_seconds = CAST(strftime('%s', completed_at) - strftime('%s', COALESCE(started_at, created_at)) AS INTEGER)
    WHERE completed_at IS NOT NULL
      AND (duration_seconds IS NULL OR duration_seconds < 0)
      AND strftime('%s', completed_at) >= strftime('%s', COALESCE(started_at, created_at))
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS inspection_approval_history (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      inspection_id TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      comment TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)
  db.run('CREATE INDEX IF NOT EXISTS idx_inspection_approval_history_inspection ON inspection_approval_history(company_id, inspection_id, created_at)')

  ensureColumn('defects', 'company_id', "TEXT DEFAULT 'default'")
  ensureColumn('defects', 'checklist_item_id', 'TEXT')
  ensureColumn('defects', 'comment', 'TEXT')
  ensureColumn('defects', 'status', "TEXT NOT NULL DEFAULT 'open'")
  ensureColumn('defects', 'severity', "TEXT NOT NULL DEFAULT 'medium'")
  ensureColumn('defects', 'resolved_at', 'TEXT')
  ensureColumn('defects', 'created_at', 'TEXT')
  ensureColumn('defects', 'closed_at', 'TEXT')
  ensureColumn('defects', 'closed_by', 'TEXT')
  ensureColumn('defects', 'manager_comment', 'TEXT')
  db.run(`
    CREATE TABLE IF NOT EXISTS defect_status_history (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      defect_id TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      comment TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)
  db.run('CREATE INDEX IF NOT EXISTS idx_defect_status_history_defect ON defect_status_history(company_id, defect_id, created_at)')

  ensureColumn('photos', 'defect_id', 'TEXT')
  ensureColumn('photos', 'company_id', "TEXT DEFAULT 'default'")
  ensureColumn('photos', 'photo_type', 'TEXT')
  ensureColumn('photos', 'geo', 'TEXT')
  ensureColumn('photos', 'is_required', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn('photos', 'original_url', 'TEXT')
  ensureColumn('photos', 'webp_url', 'TEXT')
  ensureColumn('photos', 'thumb_url', 'TEXT')
  ensureColumn('photos', 'original_mime', 'TEXT')
  ensureColumn('photos', 'original_name', 'TEXT')
  ensureColumn('photos', 'width', 'INTEGER')
  ensureColumn('photos', 'height', 'INTEGER')
  ensureColumn('photos', 'size_original', 'INTEGER')
  ensureColumn('photos', 'size_webp', 'INTEGER')
  ensureColumn('photos', 'size_thumb', 'INTEGER')
  ensureColumn('photos', 'hash', 'TEXT')
  ensureColumn('photos', 'client_photo_id', 'TEXT')
  ensureColumn('photos', 'upload_status', "TEXT NOT NULL DEFAULT 'uploaded'")
  ensureColumn('photos', 'captured_at', 'TEXT')
  ensureColumn('photos', 'captured_lat', 'REAL')
  ensureColumn('photos', 'captured_lng', 'REAL')
  ensureColumn('photos', 'watermark_url', 'TEXT')
  ensureColumn('photos', 'watermark_generated_at', 'TEXT')
  ensureColumn('photos', 'created_at', 'TEXT')

  db.run(`
    CREATE TABLE IF NOT EXISTS inspection_reports (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      inspection_id TEXT NOT NULL,
      pdf_url TEXT,
      sha256 TEXT,
      file_size INTEGER,
      status TEXT NOT NULL DEFAULT 'pending',
      integrity_status TEXT NOT NULL DEFAULT 'unverified',
      public_token TEXT,
      public_token_expires_at TEXT,
      public_pdf_enabled INTEGER NOT NULL DEFAULT 0,
      verified_at TEXT,
      generated_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE (company_id, inspection_id)
    )
  `)
  ensureColumn('inspection_reports', 'company_id', 'TEXT')
  ensureColumn('inspection_reports', 'inspection_id', 'TEXT')
  ensureColumn('inspection_reports', 'pdf_url', 'TEXT')
  ensureColumn('inspection_reports', 'sha256', 'TEXT')
  ensureColumn('inspection_reports', 'file_size', 'INTEGER')
  ensureColumn('inspection_reports', 'status', "TEXT NOT NULL DEFAULT 'pending'")
  ensureColumn('inspection_reports', 'integrity_status', "TEXT NOT NULL DEFAULT 'unverified'")
  ensureColumn('inspection_reports', 'public_token', 'TEXT')
  ensureColumn('inspection_reports', 'public_token_expires_at', 'TEXT')
  ensureColumn('inspection_reports', 'public_pdf_enabled', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn('inspection_reports', 'verified_at', 'TEXT')
  ensureColumn('inspection_reports', 'generated_at', 'TEXT')
  ensureColumn('inspection_reports', 'created_at', 'TEXT')
  ensureColumn('inspection_reports', 'updated_at', 'TEXT')
  db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_inspection_reports_public_token ON inspection_reports(public_token) WHERE public_token IS NOT NULL')

  db.run(`
    CREATE TABLE IF NOT EXISTS company_limits (
      id TEXT PRIMARY KEY,
      company_id TEXT UNIQUE NOT NULL,
      plan_code TEXT,
      max_vehicles INTEGER,
      max_users INTEGER,
      max_storage_mb INTEGER,
      ocr_enabled INTEGER,
      accident_module_enabled INTEGER,
      analytics_enabled INTEGER,
      api_access_enabled INTEGER,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)
  ensureColumn('company_limits', 'plan_code', 'TEXT')
  ensureColumn('company_limits', 'max_vehicles', 'INTEGER')
  ensureColumn('company_limits', 'max_users', 'INTEGER')
  ensureColumn('company_limits', 'max_inspections_per_month', 'INTEGER')
  ensureColumn('company_limits', 'max_storage_mb', 'INTEGER')
  ensureColumn('company_limits', 'storage_limit_gb', 'REAL')
  ensureColumn('company_limits', 'ocr_enabled', 'INTEGER')
  ensureColumn('company_limits', 'ocr_monthly_limit', 'INTEGER')
  ensureColumn('company_limits', 'accident_module_enabled', 'INTEGER')
  ensureColumn('company_limits', 'analytics_enabled', 'INTEGER')
  ensureColumn('company_limits', 'pdf_report_enabled', 'INTEGER')
  ensureColumn('company_limits', 'export_enabled', 'INTEGER')
  ensureColumn('company_limits', 'api_access_enabled', 'INTEGER')
  ensureColumn('company_limits', 'custom_branding_enabled', 'INTEGER')
  ensureColumn('company_limits', 'regional_storage_enabled', 'INTEGER')
  ensureColumn('company_limits', 'support_level', 'TEXT')
  ensureColumn('company_limits', 'limits_comment', 'TEXT')
  ensureColumn('company_limits', 'created_at', 'TEXT')
  ensureColumn('company_limits', 'updated_at', 'TEXT')

  db.run(`
    CREATE TABLE IF NOT EXISTS plans (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      max_vehicles INTEGER,
      max_users INTEGER,
      max_storage_mb INTEGER,
      ocr_enabled INTEGER,
      accident_module_enabled INTEGER,
      analytics_enabled INTEGER,
      api_access_enabled INTEGER,
      monthly_price_rub INTEGER,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)
  ensureColumn('plans', 'max_vehicles', 'INTEGER')
  ensureColumn('plans', 'max_users', 'INTEGER')
  ensureColumn('plans', 'description', 'TEXT')
  ensureColumn('plans', 'position', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn('plans', 'is_active', 'INTEGER NOT NULL DEFAULT 1')
  ensureColumn('plans', 'is_public', 'INTEGER NOT NULL DEFAULT 1')
  ensureColumn('plans', 'yearly_price_rub', 'INTEGER')
  ensureColumn('plans', 'trial_months', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn('plans', 'recommended', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn('plans', 'max_inspections_per_month', 'INTEGER')
  ensureColumn('plans', 'max_storage_mb', 'INTEGER')
  ensureColumn('plans', 'storage_limit_gb', 'REAL')
  ensureColumn('plans', 'ocr_enabled', 'INTEGER')
  ensureColumn('plans', 'ocr_monthly_limit', 'INTEGER')
  ensureColumn('plans', 'accident_module_enabled', 'INTEGER')
  ensureColumn('plans', 'analytics_enabled', 'INTEGER')
  ensureColumn('plans', 'pdf_report_enabled', 'INTEGER')
  ensureColumn('plans', 'export_enabled', 'INTEGER')
  ensureColumn('plans', 'api_access_enabled', 'INTEGER')
  ensureColumn('plans', 'custom_branding_enabled', 'INTEGER')
  ensureColumn('plans', 'regional_storage_enabled', 'INTEGER')
  ensureColumn('plans', 'support_level', "TEXT NOT NULL DEFAULT 'basic'")
  ensureColumn('plans', 'monthly_price_rub', 'INTEGER')
  ensureColumn('plans', 'status', "TEXT NOT NULL DEFAULT 'active'")
  ensureColumn('plans', 'created_at', 'TEXT')
  ensureColumn('plans', 'updated_at', 'TEXT')

  db.run(`
    CREATE TABLE IF NOT EXISTS company_subscriptions (
      id TEXT PRIMARY KEY,
      company_id TEXT UNIQUE NOT NULL,
      plan_code TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      current_period_start TEXT,
      current_period_end TEXT,
      grace_until TEXT,
      last_payment_id TEXT,
      mrr_rub INTEGER NOT NULL DEFAULT 0,
      auto_suspend_enabled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)
  ensureColumn('company_subscriptions', 'plan_code', 'TEXT')
  ensureColumn('company_subscriptions', 'status', "TEXT NOT NULL DEFAULT 'active'")
  ensureColumn('company_subscriptions', 'current_period_start', 'TEXT')
  ensureColumn('company_subscriptions', 'current_period_end', 'TEXT')
  ensureColumn('company_subscriptions', 'grace_until', 'TEXT')
  ensureColumn('company_subscriptions', 'last_payment_id', 'TEXT')
  ensureColumn('company_subscriptions', 'mrr_rub', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn('company_subscriptions', 'auto_suspend_enabled', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn('company_subscriptions', 'created_at', 'TEXT')
  ensureColumn('company_subscriptions', 'updated_at', 'TEXT')

  db.run(`
    CREATE TABLE IF NOT EXISTS company_payments (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      plan_code TEXT,
      amount INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'RUB',
      payment_date TEXT NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      payment_method TEXT,
      document_number TEXT,
      comment TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)
  ensureColumn('company_payments', 'plan_code', 'TEXT')
  ensureColumn('company_payments', 'amount', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn('company_payments', 'currency', "TEXT NOT NULL DEFAULT 'RUB'")
  ensureColumn('company_payments', 'payment_date', 'TEXT')
  ensureColumn('company_payments', 'period_start', 'TEXT')
  ensureColumn('company_payments', 'period_end', 'TEXT')
  ensureColumn('company_payments', 'payment_method', 'TEXT')
  ensureColumn('company_payments', 'document_number', 'TEXT')
  ensureColumn('company_payments', 'comment', 'TEXT')
  ensureColumn('company_payments', 'status', "TEXT NOT NULL DEFAULT 'active'")
  ensureColumn('company_payments', 'created_by', 'TEXT')
  ensureColumn('company_payments', 'created_at', 'TEXT')
  ensureColumn('company_payments', 'updated_at', 'TEXT')

  db.run(`
    CREATE TABLE IF NOT EXISTS company_billing (
      id TEXT PRIMARY KEY,
      company_id TEXT UNIQUE NOT NULL,
      plan_code TEXT NOT NULL DEFAULT 'pilot',
      billing_status TEXT NOT NULL DEFAULT 'trial',
      paid_until TEXT,
      trial_until TEXT,
      last_payment_date TEXT,
      last_payment_amount_rub INTEGER,
      last_payment_period_start TEXT,
      last_payment_period_end TEXT,
      payment_method TEXT,
      payment_comment TEXT,
      invoice_number TEXT,
      contract_number TEXT,
      created_by_user_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS company_billing_details (
      company_id TEXT PRIMARY KEY,
      legal_name TEXT,
      inn TEXT,
      kpp TEXT,
      ogrn TEXT,
      legal_address TEXT,
      postal_address TEXT,
      billing_email TEXT,
      support_email TEXT,
      support_phone TEXT,
      updated_by_user_id TEXT,
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (company_id) REFERENCES companies(id)
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS company_billing_events (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      comment TEXT,
      created_by_user_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS company_ocr_usage (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      recognition_type TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)
  db.run('CREATE INDEX IF NOT EXISTS idx_company_ocr_usage_company_created ON company_ocr_usage(company_id, created_at)')

  db.run(`
    CREATE TABLE IF NOT EXISTS company_notifications (
      id TEXT PRIMARY KEY,
      company_id TEXT,
      recipient_user_id TEXT,
      recipient_role TEXT,
      type TEXT NOT NULL,
      channel TEXT NOT NULL DEFAULT 'in_app',
      title TEXT NOT NULL,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      sent_at TEXT,
      read_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)
  ensureColumn('company_notifications', 'recipient_user_id', 'TEXT')
  ensureColumn('company_notifications', 'recipient_role', 'TEXT')
  ensureColumn('company_notifications', 'type', 'TEXT')
  ensureColumn('company_notifications', 'channel', "TEXT NOT NULL DEFAULT 'in_app'")
  ensureColumn('company_notifications', 'title', 'TEXT')
  ensureColumn('company_notifications', 'message', 'TEXT')
  ensureColumn('company_notifications', 'status', "TEXT NOT NULL DEFAULT 'new'")
  ensureColumn('company_notifications', 'sent_at', 'TEXT')
  ensureColumn('company_notifications', 'read_at', 'TEXT')
  ensureColumn('company_notifications', 'created_by_user_id', 'TEXT')
  ensureColumn('company_notifications', 'template_id', 'TEXT')
  ensureColumn('company_notifications', 'source', "TEXT NOT NULL DEFAULT 'system'")
  ensureColumn('company_notifications', 'created_at', 'TEXT')

  db.run(`
    CREATE TABLE IF NOT EXISTS resource_user_permissions (
      user_id TEXT NOT NULL,
      permission TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, permission),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS notification_templates (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'system',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_by_user_id TEXT,
      updated_by_user_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS service_profile (
      id TEXT PRIMARY KEY,
      service_name TEXT,
      legal_name TEXT,
      inn TEXT,
      kpp TEXT,
      ogrn TEXT,
      legal_address TEXT,
      postal_address TEXT,
      bank_name TEXT,
      bik TEXT,
      bank_account TEXT,
      correspondent_account TEXT,
      billing_email TEXT,
      support_email TEXT,
      support_phone TEXT,
      updated_by_user_id TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)
  db.run(`INSERT OR IGNORE INTO service_profile (id, service_name) VALUES ('default', 'AuditAvto')`)

  db.run(`
    CREATE TABLE IF NOT EXISTS pilot_requests (
      id TEXT PRIMARY KEY,
      company_name TEXT NOT NULL,
      contact_name TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      vehicle_count INTEGER NOT NULL,
      region TEXT,
      preferred_plan_code TEXT,
      comment TEXT,
      status TEXT NOT NULL DEFAULT 'new'
        CHECK (status IN ('new', 'in_progress', 'approved', 'rejected', 'converted')),
      assigned_user_id TEXT,
      internal_comment TEXT,
      rejection_reason TEXT,
      source TEXT,
      utm_source TEXT,
      utm_medium TEXT,
      utm_campaign TEXT,
      utm_content TEXT,
      utm_term TEXT,
      consent_given INTEGER NOT NULL DEFAULT 0,
      consent_at TEXT,
      linked_company_id TEXT,
      converted_at TEXT,
      anonymized_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (assigned_user_id) REFERENCES users(id),
      FOREIGN KEY (linked_company_id) REFERENCES companies(id)
    )
  `)
  ensureColumn('pilot_requests', 'contact_name', 'TEXT')
  ensureColumn('pilot_requests', 'contact_email', 'TEXT')
  ensureColumn('pilot_requests', 'contact_phone', 'TEXT')
  ensureColumn('pilot_requests', 'vehicle_count', 'INTEGER')
  ensureColumn('pilot_requests', 'region', 'TEXT')
  ensureColumn('pilot_requests', 'preferred_plan_code', 'TEXT')
  ensureColumn('pilot_requests', 'comment', 'TEXT')
  ensureColumn('pilot_requests', 'status', "TEXT NOT NULL DEFAULT 'new'")
  ensureColumn('pilot_requests', 'assigned_user_id', 'TEXT')
  ensureColumn('pilot_requests', 'internal_comment', 'TEXT')
  ensureColumn('pilot_requests', 'rejection_reason', 'TEXT')
  ensureColumn('pilot_requests', 'source', 'TEXT')
  ensureColumn('pilot_requests', 'utm_source', 'TEXT')
  ensureColumn('pilot_requests', 'utm_medium', 'TEXT')
  ensureColumn('pilot_requests', 'utm_campaign', 'TEXT')
  ensureColumn('pilot_requests', 'utm_content', 'TEXT')
  ensureColumn('pilot_requests', 'utm_term', 'TEXT')
  ensureColumn('pilot_requests', 'consent_given', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn('pilot_requests', 'consent_at', 'TEXT')
  ensureColumn('pilot_requests', 'linked_company_id', 'TEXT')
  ensureColumn('pilot_requests', 'converted_at', 'TEXT')
  ensureColumn('pilot_requests', 'anonymized_at', 'TEXT')
  ensureColumn('pilot_requests', 'created_at', 'TEXT')
  ensureColumn('pilot_requests', 'updated_at', 'TEXT')
  db.run('CREATE INDEX IF NOT EXISTS idx_pilot_requests_status_created ON pilot_requests(status, created_at DESC)')
  db.run('CREATE INDEX IF NOT EXISTS idx_pilot_requests_assigned_created ON pilot_requests(assigned_user_id, created_at DESC)')
  db.run('CREATE INDEX IF NOT EXISTS idx_pilot_requests_region_created ON pilot_requests(region, created_at DESC)')
  db.run('CREATE INDEX IF NOT EXISTS idx_pilot_requests_linked_company ON pilot_requests(linked_company_id)')

  db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      company_id TEXT,
      actor_user_id TEXT,
      actor_role TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      payload_json TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)
  ensureColumn('audit_logs', 'company_id', 'TEXT')
  ensureColumn('audit_logs', 'actor_user_id', 'TEXT')
  ensureColumn('audit_logs', 'actor_role', 'TEXT')
  ensureColumn('audit_logs', 'action', 'TEXT')
  ensureColumn('audit_logs', 'entity_type', 'TEXT')
  ensureColumn('audit_logs', 'entity_id', 'TEXT')
  ensureColumn('audit_logs', 'payload_json', 'TEXT')
  ensureColumn('audit_logs', 'created_at', 'TEXT')

  db.run(`
    UPDATE defects
    SET checklist_item_id = (
      SELECT ci.id
      FROM checklist_items ci
      WHERE ci.inspection_id = defects.inspection_id
        AND ci.title = defects.title
      LIMIT 1
    )
    WHERE checklist_item_id IS NULL
      AND EXISTS (
        SELECT 1
        FROM checklist_items ci
        WHERE ci.inspection_id = defects.inspection_id
          AND ci.title = defects.title
      )
  `)

  db.run(`
    UPDATE photos
    SET company_id = COALESCE(
      company_id,
      (SELECT company_id FROM inspections WHERE inspections.id = photos.inspection_id),
      'default'
    )
  `)

  db.run("UPDATE users SET created_at = datetime('now') WHERE created_at IS NULL")
  db.run("UPDATE vehicles SET created_at = datetime('now') WHERE created_at IS NULL")
  db.run("UPDATE inspections SET created_at = datetime('now') WHERE created_at IS NULL")
  db.run("UPDATE defects SET created_at = datetime('now') WHERE created_at IS NULL")
  db.run("UPDATE photos SET created_at = datetime('now') WHERE created_at IS NULL")
  db.run('UPDATE photos SET original_url = url WHERE original_url IS NULL AND url IS NOT NULL')
  db.run('UPDATE photos SET webp_url = url WHERE webp_url IS NULL AND url IS NOT NULL')
  db.run('UPDATE photos SET thumb_url = url WHERE thumb_url IS NULL AND url IS NOT NULL')
  db.run("UPDATE photos SET upload_status = 'uploaded' WHERE upload_status IS NULL OR upload_status = ''")
  db.run('UPDATE photos SET captured_at = created_at WHERE captured_at IS NULL')
  db.run(`
    UPDATE inspections
    SET odometer_confirmed_at = COALESCE(odometer_recognized_at, created_at)
    WHERE odometer_value IS NOT NULL AND odometer_confirmed_at IS NULL
  `)
  db.run('CREATE INDEX IF NOT EXISTS idx_vehicles_company_status_created ON vehicles(company_id, status, created_at DESC)')
  db.run('CREATE INDEX IF NOT EXISTS idx_vehicles_company_number ON vehicles(company_id, number)')
  db.run('CREATE INDEX IF NOT EXISTS idx_inspections_company_vehicle_created ON inspections(company_id, vehicle_id, created_at DESC, id DESC)')
  db.run('CREATE INDEX IF NOT EXISTS idx_defects_inspection ON defects(inspection_id)')
  db.run(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_inspections_company_client_id
    ON inspections(company_id, client_inspection_id)
    WHERE client_inspection_id IS NOT NULL
  `)
  db.run(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_photos_company_inspection_client_id
    ON photos(company_id, inspection_id, client_photo_id)
    WHERE client_photo_id IS NOT NULL
  `)
  db.run('CREATE INDEX IF NOT EXISTS idx_reports_company_inspection ON inspection_reports(company_id, inspection_id)')
  seedDefaultPlans()
}

export async function initDatabase() {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })

  db?.close?.()
  db = createDatabase(dbPath)

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('inspector', 'manager', 'owner', 'admin', 'resource_manager')),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
      company_id TEXT DEFAULT 'default',
      mfa_enabled INTEGER NOT NULL DEFAULT 0,
      mfa_secret TEXT,
      service_notifications_enabled INTEGER NOT NULL DEFAULT 0,
      service_notification_types TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)

  ensureColumn('users', 'status', "TEXT NOT NULL DEFAULT 'active'")
  ensureColumn('users', 'service_notifications_enabled', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn('users', 'service_notification_types', 'TEXT')
  ensureColumn('users', 'resource_permission_preset', "TEXT NOT NULL DEFAULT 'custom'")
  ensureColumn('users', 'last_login_at', 'TEXT')
  ensureColumn('users', 'owner_setup_nonce', 'TEXT')
  ensureColumn('users', 'owner_setup_issued_at', 'TEXT')
  ensureColumn('users', 'owner_setup_expires_at', 'TEXT')
  ensureColumn('users', 'owner_setup_accepted_at', 'TEXT')
  ensureUsersRoleSupportsAdminAndOwner()
  ensureColumn('users', 'service_notifications_enabled', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn('users', 'service_notification_types', 'TEXT')

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
      access_mode TEXT NOT NULL DEFAULT 'standard',
      region_code TEXT,
      data_residency TEXT,
      api_cluster_key TEXT,
      storage_cluster_key TEXT,
      ocr_cluster_key TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)
  ensureColumn('companies', 'legal_name', 'TEXT')
  ensureColumn('companies', 'short_name', 'TEXT')
  ensureColumn('companies', 'inn', 'TEXT')
  ensureColumn('companies', 'kpp', 'TEXT')
  ensureColumn('companies', 'ogrn', 'TEXT')
  ensureColumn('companies', 'legal_address', 'TEXT')
  ensureColumn('companies', 'postal_address', 'TEXT')
  ensureColumn('companies', 'billing_email', 'TEXT')
  ensureColumn('companies', 'billing_contact_name', 'TEXT')
  ensureColumn('companies', 'billing_contact_phone', 'TEXT')
  ensureColumn('companies', 'accounting_comment', 'TEXT')
  ensureColumn('companies', 'default_quick_inspection_interval_days', 'INTEGER NOT NULL DEFAULT 7')
  ensureColumn('companies', 'default_planned_inspection_interval_days', 'INTEGER NOT NULL DEFAULT 30')

  db.run(`
    CREATE TABLE IF NOT EXISTS company_limits (
      id TEXT PRIMARY KEY,
      company_id TEXT UNIQUE NOT NULL,
      plan_code TEXT,
      max_vehicles INTEGER,
      max_users INTEGER,
      max_storage_mb INTEGER,
      ocr_enabled INTEGER,
      accident_module_enabled INTEGER,
      analytics_enabled INTEGER,
      api_access_enabled INTEGER,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)

  db.run(`
    INSERT OR IGNORE INTO companies (
      id,
      slug,
      name,
      region_code,
      data_residency,
      api_cluster_key,
      storage_cluster_key,
      ocr_cluster_key
    )
    VALUES ('default', 'default', 'Default company', NULL, NULL, NULL, NULL, NULL)
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id TEXT PRIMARY KEY,
      number TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'repair', 'archived')),
      company_id TEXT DEFAULT 'default',
      region TEXT,
      last_scheduled_inspection TEXT,
      quick_inspection_interval_days INTEGER,
      planned_inspection_interval_days INTEGER,
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
      checklist_item_id TEXT,
      company_id TEXT DEFAULT 'default',
      title TEXT NOT NULL,
      comment TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      severity TEXT NOT NULL DEFAULT 'medium',
      resolved_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      closed_at TEXT,
      closed_by TEXT,
      manager_comment TEXT
    )
  `)
  // Migrate if needed: ensure columns exist in existing DB
  try { db.run(`ALTER TABLE defects ADD COLUMN status TEXT NOT NULL DEFAULT 'open'`) } catch {}
  try { db.run(`ALTER TABLE defects ADD COLUMN closed_at TEXT`) } catch {}
  try { db.run(`ALTER TABLE defects ADD COLUMN severity TEXT NOT NULL DEFAULT 'medium'`) } catch {}
  try { db.run(`ALTER TABLE defects ADD COLUMN resolved_at TEXT`) } catch {}
  try { db.run(`ALTER TABLE defects ADD COLUMN closed_by TEXT`) } catch {}
  try { db.run(`ALTER TABLE defects ADD COLUMN manager_comment TEXT`) } catch {}
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
      company_id TEXT DEFAULT 'default',
      photo_type TEXT,
      url TEXT NOT NULL,
      original_url TEXT,
      webp_url TEXT,
      thumb_url TEXT,
      original_mime TEXT,
      original_name TEXT,
      width INTEGER,
      height INTEGER,
      size_original INTEGER,
      size_webp INTEGER,
      size_thumb INTEGER,
      hash TEXT,
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
          db.run('UPDATE users SET role = ? WHERE email = ?', ['admin', ADMIN_EMAIL])
          console.log(`Admin already exists: ${ADMIN_EMAIL}`)
        } else {
          const hashedPassword = bcrypt.hashSync(ADMIN_PASSWORD, 10)
          db.run(
            'INSERT INTO users (id, email, password, name, role, company_id) VALUES (?, ?, ?, ?, ?, ?)',
            [uuidv4(), ADMIN_EMAIL, hashedPassword, 'Администратор', 'admin', 'default'],
          )
          saveDatabase()
        }
      } catch (e) {
        console.log('[DB] Error checking admin:', e.message)
      }
    }
  }

  repairVehicleNumbers()
  syncRegionDirectory()

  saveDatabase()
  console.log('Database initialized')
}

function saveDatabase() {
  // better-sqlite3 writes changes directly to the database file.
}

export function getDb() {
  return {
    prepare: (sql) => ({
      run: (...params) => {
        const result = db.run(sql, ...params)
        return { changes: result.changes || 0, lastInsertRowid: result.lastInsertRowid }
      },
      get: (...params) => {
        return getStatement(db.raw.prepare(sql), params)
      },
      all: (...params) => {
        return allStatement(db.raw.prepare(sql), params)
      },
    }),
    exec: (sql) => {
      db.exec(sql)
    },
    transaction: (fn) => db.raw.transaction(fn),
  }
}

export function closeDatabase() {
  db?.close?.()
  db = null
}

export default {
  get prepare() {
    return getDb().prepare
  },
  get exec() {
    return getDb().exec
  },
}
