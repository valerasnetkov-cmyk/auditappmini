import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
const backendRoot = process.cwd()
const databasePath = process.env.DATABASE_PATH
  ? path.resolve(backendRoot, process.env.DATABASE_PATH)
  : path.join(backendRoot, 'src', 'database.sqlite')
const uploadsDir = process.env.UPLOAD_DIR
  ? path.resolve(backendRoot, process.env.UPLOAD_DIR)
  : path.join(backendRoot, 'uploads')
const backupRoot = process.env.BACKUP_DIR
  ? path.resolve(backendRoot, process.env.BACKUP_DIR)
  : path.join(backendRoot, 'backups')
const backupDir = path.join(backupRoot, timestamp)

async function exists(targetPath) {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

async function copyIfExists(source, destination) {
  if (!(await exists(source))) {
    return false
  }

  const stat = await fs.stat(source)
  if (stat.isDirectory()) {
    await fs.cp(source, destination, { recursive: true })
  } else {
    await fs.copyFile(source, destination)
  }

  return true
}

await fs.mkdir(backupDir, { recursive: true })

const databaseCopied = await copyIfExists(databasePath, path.join(backupDir, 'database.sqlite'))
const uploadsCopied = await copyIfExists(uploadsDir, path.join(backupDir, 'uploads'))

const manifest = {
  createdAt: new Date().toISOString(),
  databasePath,
  uploadsDir,
  backupDir,
  databaseCopied,
  uploadsCopied,
}

await fs.writeFile(path.join(backupDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')

console.log(JSON.stringify({ ok: true, ...manifest }, null, 2))
