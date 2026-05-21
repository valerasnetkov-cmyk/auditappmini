import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { spawn } from 'node:child_process'
import initSqlJs from 'sql.js'

const backendRoot = process.cwd()
const tmpRoot = path.join(backendRoot, '.tmp-smoke', `smoke-backup-${process.pid}`)
const databasePath = path.join(tmpRoot, 'database.sqlite')
const uploadsDir = path.join(tmpRoot, 'uploads')
const backupRoot = path.join(tmpRoot, 'backups')

function runNode(args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: backendRoot,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })

    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })

    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr })
      } else {
        reject(new Error(`Command failed: node ${args.join(' ')}\n${stdout}\n${stderr}`))
      }
    })
  })
}

function parseJsonOutput(stdout) {
  const start = stdout.indexOf('{')
  const end = stdout.lastIndexOf('}')

  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`Command did not return JSON: ${stdout}`)
  }

  return JSON.parse(stdout.slice(start, end + 1))
}

await fs.mkdir(uploadsDir, { recursive: true })
await fs.writeFile(path.join(uploadsDir, 'sample-photo.txt'), 'backup-smoke-upload', 'utf8')

const SQL = await initSqlJs()
const db = new SQL.Database()
db.run(`
  CREATE TABLE companies (id TEXT PRIMARY KEY, name TEXT);
  CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT);
  CREATE TABLE vehicles (id TEXT PRIMARY KEY, number TEXT);
  CREATE TABLE inspections (id TEXT PRIMARY KEY, vehicle_id TEXT);
  CREATE TABLE defects (id TEXT PRIMARY KEY, inspection_id TEXT);
  CREATE TABLE photos (id TEXT PRIMARY KEY, inspection_id TEXT, url TEXT);
  INSERT INTO companies (id, name) VALUES ('default', 'Default company');
  INSERT INTO users (id, email) VALUES ('admin', 'admin@example.com');
  INSERT INTO vehicles (id, number) VALUES ('vehicle-1', 'А001АА65');
  INSERT INTO inspections (id, vehicle_id) VALUES ('inspection-1', 'vehicle-1');
  INSERT INTO defects (id, inspection_id) VALUES ('defect-1', 'inspection-1');
  INSERT INTO photos (id, inspection_id, url) VALUES ('photo-1', 'inspection-1', '/uploads/sample-photo.txt');
`)
await fs.writeFile(databasePath, Buffer.from(db.export()))
db.close()

try {
  const backup = parseJsonOutput(
    (await runNode(['scripts/backup-local-data.mjs'], {
      DATABASE_PATH: databasePath,
      UPLOAD_DIR: uploadsDir,
      BACKUP_DIR: backupRoot,
    })).stdout,
  )

  const verify = parseJsonOutput(
    (await runNode(['scripts/verify-local-backup.mjs', '--latest', '--backup-root', backupRoot, '--strict-uploads'])).stdout,
  )

  if (!backup.databaseCopied || !backup.uploadsCopied) {
    throw new Error('Backup did not copy both database and uploads')
  }

  if (!verify.ok || verify.database?.integrity !== 'ok') {
    throw new Error('Backup verification failed')
  }

  if (verify.database?.counts?.vehicles !== 1 || verify.database?.counts?.photos !== 1) {
    throw new Error('Backup verification returned unexpected table counts')
  }

  if (!verify.uploads?.exists || verify.uploads.fileCount !== 1) {
    throw new Error('Backup verification did not find copied uploads')
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        backupDir: backup.backupDir,
        databaseIntegrity: verify.database.integrity,
        vehicles: verify.database.counts.vehicles,
        photos: verify.database.counts.photos,
        uploadFiles: verify.uploads.fileCount,
      },
      null,
      2,
    ),
  )
} finally {
  await fs.rm(tmpRoot, { recursive: true, force: true })
}
