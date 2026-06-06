import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import Database from 'better-sqlite3'

const backendRoot = process.cwd()
const defaultBackupRoot = process.env.BACKUP_DIR
  ? path.resolve(backendRoot, process.env.BACKUP_DIR)
  : path.join(backendRoot, 'backups')
const errors = []
const warnings = []

function parseArgs(argv) {
  const result = {
    backupDir: process.env.BACKUP_VERIFY_DIR || '',
    backupRoot: process.env.BACKUP_DIR || '',
    latest: true,
    strictUploads: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--backup-dir') {
      result.backupDir = argv[index + 1] || ''
      result.latest = false
      index += 1
      continue
    }

    if (arg.startsWith('--backup-dir=')) {
      result.backupDir = arg.slice('--backup-dir='.length)
      result.latest = false
      continue
    }

    if (arg === '--backup-root') {
      result.backupRoot = argv[index + 1] || ''
      index += 1
      continue
    }

    if (arg.startsWith('--backup-root=')) {
      result.backupRoot = arg.slice('--backup-root='.length)
      continue
    }

    if (arg === '--latest') {
      result.latest = true
      continue
    }

    if (arg === '--strict-uploads') {
      result.strictUploads = true
      continue
    }

    warnings.push(`Unknown argument ignored: ${arg}`)
  }

  return result
}

async function exists(targetPath) {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

function resolveFromBackendRoot(value) {
  if (!value) return null
  return path.isAbsolute(value) ? value : path.resolve(backendRoot, value)
}

async function readJson(filePath) {
  const content = await fs.readFile(filePath, 'utf8')
  return JSON.parse(content)
}

async function directoryStats(directoryPath) {
  if (!(await exists(directoryPath))) {
    return {
      exists: false,
      fileCount: 0,
      totalBytes: 0,
    }
  }

  let fileCount = 0
  let totalBytes = 0

  async function walk(currentPath) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true })

    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name)

      if (entry.isDirectory()) {
        await walk(entryPath)
        continue
      }

      if (entry.isFile()) {
        const stat = await fs.stat(entryPath)
        fileCount += 1
        totalBytes += stat.size
      }
    }
  }

  await walk(directoryPath)

  return {
    exists: true,
    fileCount,
    totalBytes,
  }
}

async function findLatestBackup(backupRoot) {
  if (!(await exists(backupRoot))) {
    errors.push(`Backup root does not exist: ${backupRoot}`)
    return null
  }

  const entries = await fs.readdir(backupRoot, { withFileTypes: true })
  const candidates = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const entryPath = path.join(backupRoot, entry.name)
    const manifestPath = path.join(entryPath, 'manifest.json')

    if (!(await exists(manifestPath))) continue

    const stat = await fs.stat(manifestPath)
    candidates.push({
      path: entryPath,
      manifestPath,
      mtimeMs: stat.mtimeMs,
    })
  }

  candidates.sort((left, right) => right.mtimeMs - left.mtimeMs)
  return candidates[0]?.path || null
}

function queryCount(db, tableName) {
  const tableExists = db
    .prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table' AND name = ?
    `)
    .get(tableName)

  if (!tableExists) {
    return null
  }

  const countResult = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get()
  return Number(countResult?.count || 0)
}

async function verifyDatabase(databasePath) {
  if (!(await exists(databasePath))) {
    errors.push(`Backup database does not exist: ${databasePath}`)
    return null
  }

  const stat = await fs.stat(databasePath)
  const db = new Database(databasePath, { readonly: true, fileMustExist: true })

  try {
    const integrityResult = db.prepare('PRAGMA integrity_check').get()
    const integrity = String(integrityResult?.integrity_check || '')

    if (integrity !== 'ok') {
      errors.push(`SQLite integrity_check failed: ${integrity || '(empty result)'}`)
    }

    const tables = ['companies', 'users', 'vehicles', 'inspections', 'defects', 'photos', 'company_limits']
    const counts = Object.fromEntries(tables.map((table) => [table, queryCount(db, table)]))

    return {
      exists: true,
      sizeBytes: stat.size,
      integrity,
      counts,
    }
  } finally {
    db.close()
  }
}

const args = parseArgs(process.argv.slice(2))
const backupRoot = resolveFromBackendRoot(args.backupRoot) || defaultBackupRoot
const backupDir = args.backupDir
  ? resolveFromBackendRoot(args.backupDir)
  : await findLatestBackup(backupRoot)

if (!backupDir) {
  errors.push(`No backup with manifest.json found in ${backupRoot}`)
}

const manifestPath = backupDir ? path.join(backupDir, 'manifest.json') : null
let manifest = null

if (manifestPath) {
  if (await exists(manifestPath)) {
    try {
      manifest = await readJson(manifestPath)
    } catch (error) {
      errors.push(`Cannot read backup manifest: ${error.message}`)
    }
  } else {
    errors.push(`Backup manifest does not exist: ${manifestPath}`)
  }
}

const databasePath = backupDir ? path.join(backupDir, 'database.sqlite') : null
const uploadsDir = backupDir ? path.join(backupDir, 'uploads') : null
const database = databasePath ? await verifyDatabase(databasePath) : null
const uploads = uploadsDir ? await directoryStats(uploadsDir) : null

if (manifest) {
  if (manifest.databaseCopied === false || manifest.database?.copied === false) {
    errors.push('Backup manifest says database was not copied')
  }

  if (manifest.uploadsCopied === true && !uploads?.exists) {
    errors.push('Backup manifest says uploads were copied, but uploads directory is missing')
  }

  if (args.strictUploads && !uploads?.exists) {
    errors.push('Uploads directory is required in strict mode')
  }
}

const result = {
  ok: errors.length === 0,
  backupRoot,
  backupDir,
  manifestPath,
  manifestCreatedAt: manifest?.createdAt || null,
  database,
  uploads,
  warnings,
  errors,
}

console.log(JSON.stringify(result, null, 2))

if (errors.length > 0) {
  process.exit(1)
}
