import fs from 'node:fs/promises'
import crypto from 'node:crypto'
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

async function hashFile(filePath) {
  if (!(await exists(filePath))) return null
  const data = await fs.readFile(filePath)
  return crypto.createHash('sha256').update(data).digest('hex')
}

async function fileStats(filePath) {
  if (!(await exists(filePath))) return null
  const stat = await fs.stat(filePath)
  return {
    sizeBytes: stat.size,
    sha256: stat.isFile() ? await hashFile(filePath) : null,
  }
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

await fs.mkdir(backupDir, { recursive: true })

const databaseCopied = await copyIfExists(databasePath, path.join(backupDir, 'database.sqlite'))
const uploadsCopied = await copyIfExists(uploadsDir, path.join(backupDir, 'uploads'))
const backupDatabasePath = path.join(backupDir, 'database.sqlite')
const backupUploadsDir = path.join(backupDir, 'uploads')

const manifest = {
  createdAt: new Date().toISOString(),
  databasePath,
  uploadsDir,
  backupDir,
  databaseCopied,
  uploadsCopied,
  database: {
    sourcePath: databasePath,
    backupPath: backupDatabasePath,
    copied: databaseCopied,
    ...(await fileStats(backupDatabasePath)),
  },
  uploads: {
    sourcePath: uploadsDir,
    backupPath: backupUploadsDir,
    copied: uploadsCopied,
    ...(await directoryStats(backupUploadsDir)),
  },
}

await fs.writeFile(path.join(backupDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')

console.log(JSON.stringify({ ok: true, ...manifest }, null, 2))
