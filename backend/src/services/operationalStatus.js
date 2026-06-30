import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isRedisConfigured, getRedisStatus } from './redisClient.js'
import { uploadStorage, uploadsDir, STORAGE_DRIVER } from './photoUpload.js'
import { getAlertConfig } from './alertService.js'
import { getQueueSummary, getWorkerHeartbeats } from './jobService.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const backendRoot = path.resolve(__dirname, '../..')

function exists(targetPath) {
  try {
    fs.accessSync(targetPath)
    return true
  } catch {
    return false
  }
}

function readJsonIfExists(targetPath) {
  try {
    return JSON.parse(fs.readFileSync(targetPath, 'utf8'))
  } catch {
    return null
  }
}

export function findLatestBackupManifest({ backupRoot = process.env.BACKUP_DIR || path.join(backendRoot, 'backups') } = {}) {
  const resolvedRoot = path.resolve(process.cwd(), backupRoot)
  if (!exists(resolvedRoot)) {
    return {
      configured: Boolean(backupRoot),
      exists: false,
      root: resolvedRoot,
      latest: null,
    }
  }

  const manifests = fs.readdirSync(resolvedRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const manifestPath = path.join(resolvedRoot, entry.name, 'manifest.json')
      const manifest = readJsonIfExists(manifestPath)
      if (!manifest) return null

      return {
        path: manifestPath,
        relativePath: path.relative(backendRoot, manifestPath).replace(/\\/g, '/'),
        createdAt: manifest.createdAt || entry.name,
        databaseCopied: Boolean(manifest.databaseCopied ?? manifest.database?.copied),
        uploadsCopied: Boolean(manifest.uploadsCopied ?? manifest.uploads?.copied),
        uploadsFileCount: manifest.uploads?.fileCount ?? null,
      }
    })
    .filter(Boolean)
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))

  return {
    configured: Boolean(backupRoot),
    exists: true,
    root: resolvedRoot,
    latest: manifests[0] || null,
  }
}

function collectWorkerStatus(db) {
  if (!db) {
    return {
      status: 'not_configured',
      heartbeat: null,
      queues: [],
    }
  }

  try {
    const summary = getQueueSummary(db)
    const heartbeats = getWorkerHeartbeats(db)
    const hasQueueEvidence = summary.waiting + summary.active + summary.failed + summary.completed > 0
      || heartbeats.length > 0

    return {
      status: hasQueueEvidence ? (summary.failed24h ? 'degraded' : 'running') : 'idle',
      heartbeat: heartbeats[0]?.lastHeartbeatAt || null,
      queues: summary.byType,
      summary,
      workers: heartbeats,
    }
  } catch (error) {
    return {
      status: 'degraded',
      heartbeat: null,
      queues: [],
      error: error.message,
    }
  }
}

export function collectOperationalStatus({ env = process.env, db = null } = {}) {
  const alertConfig = getAlertConfig(env)
  const backup = findLatestBackupManifest({ backupRoot: env.BACKUP_DIR || path.join(backendRoot, 'backups') })

  return {
    generatedAt: new Date().toISOString(),
    readiness: {
      endpoint: '/api/health/ready',
      checks: ['database', 'uploads', 'redis-if-configured'],
    },
    redis: {
      configured: isRedisConfigured(),
      status: getRedisStatus(),
    },
    uploads: {
      configured: Boolean(env.UPLOAD_DIR),
      driver: STORAGE_DRIVER,
      path: uploadsDir,
      exists: exists(uploadStorage.root),
    },
    backup: {
      root: backup.root,
      rootExists: backup.exists,
      latestManifest: backup.latest,
    },
    billing: {
      scannerCommand: 'npm --prefix backend run billing:check',
      lastScan: null,
      status: 'not_recorded',
    },
    workers: collectWorkerStatus(db),
    alerts: {
      telegramEnabled: alertConfig.telegram.enabled,
      telegramConfigured: alertConfig.telegram.configured,
      sentryBackendConfigured: alertConfig.sentry.backendConfigured,
    },
  }
}
