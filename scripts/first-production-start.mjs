import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function parseArgs(argv) {
  const options = {
    json: false,
  }

  for (const arg of argv) {
    if (arg === '--json') {
      options.json = true
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  return options
}

async function exists(targetPath) {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

async function readJson(targetPath) {
  return JSON.parse(await fs.readFile(targetPath, 'utf8'))
}

function hasScript(packageJson, scriptName) {
  return Boolean(packageJson?.scripts?.[scriptName])
}

async function collectChecklist() {
  const rootPackage = await readJson(path.join(repoRoot, 'package.json'))
  const backendPackage = await readJson(path.join(repoRoot, 'backend', 'package.json'))

  const files = {
    backendEnvProduction: await exists(path.join(repoRoot, 'backend', '.env.production')),
    backendEnvProductionExample: await exists(path.join(repoRoot, 'backend', '.env.production.example')),
    webEnvProduction: await exists(path.join(repoRoot, 'web', '.env.production')),
    webEnvProductionExample: await exists(path.join(repoRoot, 'web', '.env.production.example')),
    mobileEnvProduction: await exists(path.join(repoRoot, 'mobile', '.env.production')),
    mobileEnvProductionExample: await exists(path.join(repoRoot, 'mobile', '.env.production.example')),
    backendEcosystemConfig: await exists(path.join(repoRoot, 'backend', 'ecosystem.config.cjs')),
    releaseRunbook: await exists(path.join(repoRoot, 'docs', 'release-runbook.md')),
    launchChecklist: await exists(path.join(repoRoot, 'docs', 'launch-checklist.md')),
    productionEnvRunbook: await exists(path.join(repoRoot, 'docs', 'production-env.md')),
    backupRestoreRunbook: await exists(path.join(repoRoot, 'docs', 'backup-restore.md')),
  }

  const scripts = {
    verifyLaunch: hasScript(rootPackage, 'verify:launch'),
    doctorProduction: hasScript(rootPackage, 'doctor:production'),
    backupLocal: hasScript(rootPackage, 'backup:local'),
    backupVerify: hasScript(rootPackage, 'backup:verify'),
    releaseEvidence: hasScript(rootPackage, 'release:evidence'),
    mobileStatus: hasScript(rootPackage, 'mobile:status'),
    backendPm2Start: hasScript(backendPackage, 'pm2:start'),
    backendPm2Logs: hasScript(backendPackage, 'pm2:logs'),
    backendPm2LogrotateInstall: hasScript(backendPackage, 'pm2:logrotate:install'),
    backendPm2LogrotateConfigure: hasScript(backendPackage, 'pm2:logrotate:configure'),
  }

  const steps = [
    {
      id: 'prepare-env',
      title: 'Prepare private production env',
      commands: [
        'copy backend/.env.production.example backend/.env.production',
        'copy web/.env.production.example web/.env.production',
        'copy mobile/.env.production.example mobile/.env.production',
      ],
      evidence: 'Private env files exist on the server or equivalent secret manager values are configured.',
      notes: [
        'Never commit .env.production files.',
        'Use persistent DATABASE_PATH, UPLOAD_DIR and BACKUP_DIR outside temporary release folders.',
      ],
    },
    {
      id: 'code-gate',
      title: 'Run code gate before publishing artifacts',
      commands: ['npm run mobile:status', 'npm run verify:launch'],
      evidence: 'Terminal output or CI link shows backend smoke, web build, mobile verify, E2E and audits passed.',
      notes: [
        'Confirm that mobile/ is the active production mobile app and mobile-app/ remains excluded until deleted or separately upgraded.',
      ],
    },
    {
      id: 'production-env-gate',
      title: 'Validate production environment on the server',
      commands: ['npm run doctor:production'],
      evidence: 'Doctor JSON has ok=true and errors=[].',
    },
    {
      id: 'backup-before-start',
      title: 'Create and verify a backup before data migration/start',
      commands: ['npm run backup:local', 'npm run backup:verify'],
      evidence: 'Backup manifest path and verify output are saved.',
    },
    {
      id: 'log-retention',
      title: 'Enable PM2 log retention',
      commands: [
        'npm --prefix backend run pm2:logrotate:install',
        'npm --prefix backend run pm2:logrotate:configure',
        'pm2 conf pm2-logrotate',
      ],
      evidence: 'PM2 logrotate config shows max_size=20M, retain=14 and compress=true.',
      notes: ['Do not enable PM2 timestamp prefix over backend JSON access logs.'],
    },
    {
      id: 'start-services',
      title: 'Start backend and web',
      commands: [
        'npm --prefix backend run pm2:start',
        'npm --prefix web run doctor:production',
        'npm --prefix web run build',
        'npm --prefix web run start',
      ],
      evidence: 'PM2/process manager shows backend online; web responds on the production domain.',
    },
    {
      id: 'health-and-diagnostics',
      title: 'Check health, readiness and diagnostics headers',
      commands: [
        'Invoke-RestMethod https://api.<project-domain>/health',
        'Invoke-RestMethod https://api.<project-domain>/api/health/ready',
      ],
      evidence: 'Responses are healthy, include X-Request-Id, and working API requests are visible in proxy/backend logs by the same request id.',
    },
    {
      id: 'manual-uat',
      title: 'Run manual UAT for business-critical flows',
      commands: [],
      evidence: 'Admin, owner, manager and inspector flows are checked; cross-company isolation is confirmed.',
      notes: [
        'Check company creation through CMS/admin contour, owner setup, vehicle import, inspections, required photos, defect close/reopen, dashboard and analytics.',
      ],
    },
    {
      id: 'release-evidence',
      title: 'Save release evidence manifest',
      commands: ['npm run release:evidence'],
      evidence: 'Generated JSON from release-evidence/ is stored with release notes outside Git.',
    },
  ]

  return {
    schemaVersion: 1,
    project: 'Auditmini',
    generatedAt: new Date().toISOString(),
    repoRoot,
    files,
    scripts,
    steps,
    docs: [
      'docs/production-env.md',
      'docs/release-runbook.md',
      'docs/launch-checklist.md',
      'docs/production-server-commands.md',
      'docs/mobile-app-retirement.md',
      'docs/backup-restore.md',
    ],
  }
}

function renderMarkdown(checklist) {
  const lines = [
    '# Auditmini first production start checklist',
    '',
    `Generated at: ${checklist.generatedAt}`,
    '',
    'This command is read-only. It does not start services, create backups, or print secret values.',
    '',
    '## Local repository readiness',
    '',
    '| Check | Status |',
    '| --- | --- |',
  ]

  for (const [name, ok] of Object.entries(checklist.files)) {
    lines.push(`| ${name} | ${ok ? 'ok' : 'missing / configure on server'} |`)
  }

  for (const [name, ok] of Object.entries(checklist.scripts)) {
    lines.push(`| script:${name} | ${ok ? 'ok' : 'missing'} |`)
  }

  lines.push('', '## Ordered operator flow', '')

  checklist.steps.forEach((step, index) => {
    lines.push(`### ${index + 1}. ${step.title}`, '')
    lines.push(`Evidence: ${step.evidence}`, '')

    if (step.commands.length > 0) {
      lines.push('Commands:', '')
      lines.push('```powershell')
      lines.push(...step.commands)
      lines.push('```', '')
    }

    if (step.notes?.length) {
      lines.push('Notes:')
      for (const note of step.notes) {
        lines.push(`- ${note}`)
      }
      lines.push('')
    }
  })

  lines.push('Reference docs:')
  for (const doc of checklist.docs) {
    lines.push(`- ${doc}`)
  }

  return lines.join('\n')
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const checklist = await collectChecklist()

  if (options.json) {
    console.log(JSON.stringify(checklist, null, 2))
    return
  }

  console.log(renderMarkdown(checklist))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
