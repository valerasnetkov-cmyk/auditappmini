import { execFileSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { collectMobileContour } from './mobile-contour-report.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_OUTPUT_DIR = 'release-evidence'

function parseArgs(argv) {
  const options = {
    dryRun: false,
    outDir: DEFAULT_OUTPUT_DIR,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--dry-run') {
      options.dryRun = true
      continue
    }

    if (arg === '--out-dir') {
      const value = argv[index + 1]
      if (!value) throw new Error('--out-dir requires a value')
      options.outDir = value
      index += 1
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  return options
}

function runGit(args) {
  try {
    return execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return null
  }
}

async function exists(targetPath) {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

async function readJsonIfExists(targetPath) {
  if (!(await exists(targetPath))) return null

  try {
    return JSON.parse(await fs.readFile(targetPath, 'utf8'))
  } catch {
    return null
  }
}

async function findLatestBackupManifest() {
  const backupRoot = path.join(repoRoot, 'backend', 'backups')

  if (!(await exists(backupRoot))) return null

  const entries = await fs.readdir(backupRoot, { withFileTypes: true })
  const manifests = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const manifestPath = path.join(backupRoot, entry.name, 'manifest.json')
    const manifest = await readJsonIfExists(manifestPath)

    if (manifest) {
      manifests.push({
        path: path.relative(repoRoot, manifestPath),
        createdAt: manifest.createdAt || entry.name,
        databaseCopied: Boolean(manifest.databaseCopied ?? manifest.database?.copied),
        uploadsCopied: Boolean(manifest.uploadsCopied ?? manifest.uploads?.copied),
        databaseSha256: manifest.database?.sha256 || null,
        uploadsFileCount: manifest.uploads?.fileCount ?? null,
      })
    }
  }

  manifests.sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
  return manifests[0] || null
}

function collectObservabilityEvidence(env = process.env) {
  const telegramBotEnabled = env.TELEGRAM_BOT_ENABLED === undefined || env.TELEGRAM_BOT_ENABLED === ''
    ? String(env.TELEGRAM_ALERTS_ENABLED || '').toLowerCase() === 'true'
    : String(env.TELEGRAM_BOT_ENABLED || '').toLowerCase() === 'true'
  const telegramAdminChatConfigured = Boolean(env.TELEGRAM_ADMIN_CHAT_ID || env.TELEGRAM_ALERT_CHAT_ID)
  const telegramResourceAlertsChatConfigured = Boolean(env.TELEGRAM_RESOURCE_ALERTS_CHAT_ID || env.TELEGRAM_ADMIN_CHAT_ID || env.TELEGRAM_ALERT_CHAT_ID)

  return {
    alertDryRun: {
      command: 'npm --prefix backend run alerts:dry-run',
      expected: 'ok=true, dryRun=true, delivered=false unless operator explicitly enables live Telegram alerts',
    },
    sentry: {
      backendDsnPresent: Boolean(env.SENTRY_DSN || env.BACKEND_SENTRY_DSN),
      webDsnPresent: Boolean(env.NEXT_PUBLIC_SENTRY_DSN),
      environment: env.SENTRY_ENVIRONMENT || env.NODE_ENV || null,
    },
    telegram: {
      enabled: String(env.TELEGRAM_ALERTS_ENABLED || '').toLowerCase() === 'true',
      botTokenPresent: Boolean(env.TELEGRAM_BOT_TOKEN),
      alertChatIdPresent: Boolean(env.TELEGRAM_ALERT_CHAT_ID),
      dryRun: String(env.TELEGRAM_ALERTS_DRY_RUN || '').toLowerCase() === 'true',
    },
    telegramBot: {
      enabled: telegramBotEnabled,
      botTokenPresent: Boolean(env.TELEGRAM_BOT_TOKEN),
      adminChatConfigured: telegramAdminChatConfigured,
      resourceAlertsChatConfigured: telegramResourceAlertsChatConfigured,
      statusCommand: 'GET /api/admin/resource/telegram/status',
      testCommand: 'POST /api/admin/resource/telegram/send-test',
    },
    workers: {
      status: 'foundation_available',
      runOnceCommand: 'npm --prefix backend run worker:run-once',
      smokeCommand: 'npm --prefix backend run smoke:workers',
      expectedNextStep: 'run workers under PM2/systemd and attach heartbeat evidence on the production host',
    },
  }
}

async function collectEvidence() {
  const createdAt = new Date().toISOString()
  const packageJson = await readJsonIfExists(path.join(repoRoot, 'package.json'))
  const backendPackageJson = await readJsonIfExists(path.join(repoRoot, 'backend', 'package.json'))
  const statusShort = runGit(['status', '--short']) || ''

  return {
    schemaVersion: 1,
    project: 'Auditmini',
    createdAt,
    repoRoot,
    git: {
      branch: runGit(['branch', '--show-current']),
      commit: runGit(['rev-parse', 'HEAD']),
      dirty: statusShort.length > 0,
      statusShort: statusShort.split(/\r?\n/).filter(Boolean),
    },
    productionFiles: {
      backendEnvProductionExists: await exists(path.join(repoRoot, 'backend', '.env.production')),
      webEnvProductionExists: await exists(path.join(repoRoot, 'web', '.env.production')),
      mobileEnvProductionExists: await exists(path.join(repoRoot, 'mobile', '.env.production')),
      backendEcosystemConfigExists: await exists(path.join(repoRoot, 'backend', 'ecosystem.config.cjs')),
    },
    mobileContour: await collectMobileContour(),
    latestBackupManifest: await findLatestBackupManifest(),
    observability: collectObservabilityEvidence(),
    storage: {
      driver: process.env.STORAGE_DRIVER || 'local',
      smokeCommand: 'npm --prefix backend run smoke:storage',
      expected: 'local driver preserves upload URL shape and rejects traversal keys',
    },
    requiredCommands: [
      {
        id: 'mobile-status',
        command: 'npm run mobile:status',
        expected: 'confirms mobile/ is the active production mobile app and mobile-app/ is removed or absent',
      },
      {
        id: 'verify-launch',
        command: 'npm run verify:launch',
        expected: 'passes locally or in CI before release',
      },
      {
        id: 'doctor-production',
        command: 'npm run doctor:production',
        expected: 'passes on production/staging host without errors',
      },
      {
        id: 'backup-local',
        command: 'npm run backup:local',
        expected: 'creates a pre-release backup manifest',
      },
      {
        id: 'backup-verify',
        command: 'npm run backup:verify',
        expected: 'verifies the latest backup integrity',
      },
    {
      id: 'alert-dry-run',
      command: 'npm --prefix backend run alerts:dry-run',
      expected: 'verifies alert event shape and secret redaction without sending Telegram messages',
    },
    {
      id: 'telegram-smoke',
      command: 'npm --prefix backend run smoke:telegram',
      expected: 'verifies service-admin Telegram status/test endpoints, secret-safe payloads and admin-only access',
    },
    {
      id: 'worker-smoke',
        command: 'npm --prefix backend run smoke:workers',
        expected: 'verifies SQLite-backed job idempotency, billing.scan run-once worker and heartbeat status',
      },
      {
        id: 'storage-smoke',
        command: 'npm --prefix backend run smoke:storage',
        expected: 'verifies local storage save/read/verify/delete and traversal rejection',
      },
    ],
    operationalEvidenceChecklist: [
      'Attach terminal output or CI link for npm run verify:launch.',
      'Attach JSON output for npm run doctor:production without secret values.',
      'Attach backup manifest path and backup:verify output.',
      'Record production backend/web/mobile versions or artifact names.',
      'Attach or review npm run release:first-start output before the first server start.',
      'Attach or review npm run release:readiness output and explicitly accept remaining pilot risks.',
      'Record public health/readiness responses and one working API X-Request-Id.',
      'Record PM2/systemd process status and log rotation configuration.',
      'Record manual UAT notes for admin, owner, manager and inspector flows.',
    ],
    pm2LogRetention: {
      installCommand: backendPackageJson?.scripts?.['pm2:logrotate:install'] || 'pm2 install pm2-logrotate',
      configureCommand: backendPackageJson?.scripts?.['pm2:logrotate:configure'] || 'pm2 set pm2-logrotate:max_size 20M && pm2 set pm2-logrotate:retain 14 && pm2 set pm2-logrotate:compress true',
      inspectCommand: 'pm2 conf pm2-logrotate',
      logsCommand: backendPackageJson?.scripts?.['pm2:logs'] ? 'npm --prefix backend run pm2:logs' : 'pm2 logs audit-backend',
    },
    availableReleaseScripts: {
      releaseVerify: packageJson?.scripts?.['release:verify'] || null,
      releaseProductionCheck: packageJson?.scripts?.['release:production-check'] || null,
      releaseCheck: packageJson?.scripts?.['release:check'] || null,
      releaseEvidence: packageJson?.scripts?.['release:evidence'] || null,
      releaseFirstStart: packageJson?.scripts?.['release:first-start'] || null,
      releaseReadiness: packageJson?.scripts?.['release:readiness'] || null,
      mobileStatus: packageJson?.scripts?.['mobile:status'] || null,
    },
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const evidence = await collectEvidence()

  if (options.dryRun) {
    console.log(JSON.stringify(evidence, null, 2))
    return
  }

  const outputDir = path.resolve(repoRoot, options.outDir)
  await fs.mkdir(outputDir, { recursive: true })

  const safeTimestamp = evidence.createdAt.replace(/[:.]/g, '-')
  const outputPath = path.join(outputDir, `release-evidence-${safeTimestamp}.json`)
  await fs.writeFile(outputPath, JSON.stringify(evidence, null, 2), 'utf8')

  console.log(JSON.stringify({ ok: true, outputPath }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
