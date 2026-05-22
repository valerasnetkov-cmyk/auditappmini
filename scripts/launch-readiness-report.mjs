import { execFileSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { collectMobileContour } from './mobile-contour-report.mjs'

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

async function readJson(targetPath) {
  return JSON.parse(await fs.readFile(targetPath, 'utf8'))
}

function hasScript(packageJson, scriptName) {
  return Boolean(packageJson?.scripts?.[scriptName])
}

function addMissingScriptBlockers(blockers, packageName, packageJson, scriptNames) {
  for (const scriptName of scriptNames) {
    if (!hasScript(packageJson, scriptName)) {
      blockers.push({
        id: `missing-script-${packageName}-${scriptName}`,
        severity: 'blocker',
        title: `Missing ${packageName} script: ${scriptName}`,
        action: `Restore or add the ${scriptName} script before release.`,
      })
    }
  }
}

function addMissingFileBlockers(blockers, files) {
  for (const file of files) {
    if (!file.exists) {
      blockers.push({
        id: `missing-file-${file.path.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
        severity: 'blocker',
        title: `Missing required file: ${file.path}`,
        action: `Restore ${file.path} before release.`,
      })
    }
  }
}

async function collectReadiness() {
  const rootPackage = await readJson(path.join(repoRoot, 'package.json'))
  const backendPackage = await readJson(path.join(repoRoot, 'backend', 'package.json'))
  const webPackage = await readJson(path.join(repoRoot, 'web', 'package.json'))
  const mobilePackage = await readJson(path.join(repoRoot, 'mobile', 'package.json'))
  const statusShort = runGit(['status', '--short']) || ''

  const requiredFiles = [
    'backend/.env.production.example',
    'web/.env.production.example',
    'mobile/.env.production.example',
    'mobile/eas.json',
    'backend/ecosystem.config.cjs',
    'docs/production-env.md',
    'docs/release-runbook.md',
    'docs/first-production-start.md',
    'docs/production-server-commands.md',
    'docs/mobile-app-retirement.md',
    'docs/launch-checklist.md',
    'docs/backup-restore.md',
  ]

  const fileChecks = []
  for (const relativePath of requiredFiles) {
    fileChecks.push({
      path: relativePath,
      exists: await exists(path.join(repoRoot, relativePath)),
    })
  }

  const activeCodebases = {
    backend: await exists(path.join(repoRoot, 'backend', 'package.json')),
    web: await exists(path.join(repoRoot, 'web', 'package.json')),
    mobile: await exists(path.join(repoRoot, 'mobile', 'package.json')),
    legacyMobileApp: await exists(path.join(repoRoot, 'mobile-app', 'package.json')),
  }
  const mobileContour = await collectMobileContour()

  const blockers = []
  addMissingFileBlockers(blockers, fileChecks)
  addMissingScriptBlockers(blockers, 'root', rootPackage, [
    'verify:launch',
    'doctor:production',
    'backup:local',
    'backup:verify',
    'release:evidence',
    'release:first-start',
  ])
  addMissingScriptBlockers(blockers, 'backend', backendPackage, [
    'smoke',
    'smoke:security',
    'smoke:observability',
    'smoke:shutdown',
    'doctor:production',
    'pm2:start',
    'pm2:logrotate:install',
    'pm2:logrotate:configure',
  ])
  addMissingScriptBlockers(blockers, 'web', webPackage, ['build', 'start', 'doctor:production'])
  addMissingScriptBlockers(blockers, 'mobile', mobilePackage, ['verify', 'doctor:production', 'eas:readiness'])

  const releaseActions = []
  if (statusShort) {
    releaseActions.push({
      id: 'commit-working-tree',
      severity: 'release-action',
      title: 'Working tree has uncommitted changes',
      action: 'Commit, tag, or archive the exact release version before production deployment.',
    })
  }

  releaseActions.push(
    {
      id: 'server-production-env',
      severity: 'release-action',
      title: 'Production env must be configured on the server',
      action: 'Run npm run doctor:production on the production/staging host and keep errors=[].',
    },
    {
      id: 'pre-release-backup',
      severity: 'release-action',
      title: 'Pre-release backup must be created and verified',
      action: 'Run npm run backup:local and npm run backup:verify before migration/start.',
    },
    {
      id: 'first-start-evidence',
      severity: 'release-action',
      title: 'First-start checklist should be reviewed by the operator',
      action: 'Run npm run release:first-start and attach/review the output before the first production start.',
    },
    {
      id: 'mobile-eas-build',
      severity: 'release-action',
      title: 'Mobile EAS build must be created from the active mobile contour',
      action: 'Configure EAS secrets, run npm run mobile:eas:readiness, then build the preview or production artifact from mobile/.',
    },
  )

  const acceptedPilotRisks = [
    {
      id: 'sqlite-pilot-storage',
      severity: 'accepted-pilot-risk',
      title: 'SQLite is acceptable for controlled pilot only',
      action: 'Move to PostgreSQL before larger multi-company production usage.',
    },
    {
      id: 'local-upload-storage',
      severity: 'accepted-pilot-risk',
      title: 'Local uploads require persistent volume and backup discipline',
      action: 'Keep UPLOAD_DIR on persistent storage and verify backups after every migration/release.',
    },
  ]

  if (mobileContour.legacy.present) {
    acceptedPilotRisks.push({
      id: 'legacy-mobile-app-excluded',
      severity: 'accepted-pilot-risk',
      title: 'Legacy mobile-app must stay out of production',
      action: 'Use mobile/ as the active Expo app; follow docs/mobile-app-retirement.md, then delete or separately upgrade mobile-app before any production use.',
    })
  }

  const auditCommands = [
    {
      id: 'backend-audit',
      command: 'npm --prefix backend audit --audit-level=moderate',
      expected: '0 vulnerabilities',
    },
    {
      id: 'web-audit',
      command: 'npm --prefix web audit --audit-level=moderate',
      expected: '0 vulnerabilities for the active web app',
    },
    {
      id: 'mobile-audit',
      command: 'npm --prefix mobile audit --audit-level=moderate',
      expected: '0 vulnerabilities for the active mobile app',
    },
  ]

  if (mobileContour.legacy.present) {
    auditCommands.push({
      id: 'legacy-mobile-app-audit',
      command: 'npm --prefix mobile-app audit --audit-level=moderate',
      expected: 'Not part of production unless separately upgraded; failures here should keep mobile-app excluded.',
    })
  }

  const overall = blockers.length > 0
    ? 'blocked'
    : releaseActions.length > 0
      ? 'pilot-ready-after-release-actions'
      : 'pilot-ready'

  return {
    schemaVersion: 1,
    project: 'Auditmini',
    generatedAt: new Date().toISOString(),
    repoRoot,
    overall,
    git: {
      branch: runGit(['branch', '--show-current']),
      commit: runGit(['rev-parse', 'HEAD']),
      dirty: Boolean(statusShort),
      statusShort: statusShort.split(/\r?\n/).filter(Boolean),
    },
    activeCodebases,
    mobileContour,
    fileChecks,
    blockers,
    releaseActions,
    acceptedPilotRisks,
    auditCommands,
    finalGateCommands: [
      'npm run mobile:status',
      'npm run mobile:eas:readiness',
      'npm run verify:launch',
      'npm run doctor:production',
      'npm run backup:local',
      'npm run backup:verify',
      'npm run release:first-start',
      'npm run release:evidence',
    ],
  }
}

function renderMarkdown(report) {
  const lines = [
    '# Auditmini launch readiness report',
    '',
    `Generated at: ${report.generatedAt}`,
    `Overall: ${report.overall}`,
    '',
    'This report is read-only. It does not run audits, create backups, start services, or print secret values.',
    '',
    '## Git',
    '',
    `- Branch: ${report.git.branch || '(unknown)'}`,
    `- Commit: ${report.git.commit || '(unknown)'}`,
    `- Dirty working tree: ${report.git.dirty ? 'yes' : 'no'}`,
  ]

  if (report.git.statusShort.length > 0) {
    lines.push('', 'Changed files:')
    for (const item of report.git.statusShort) {
      lines.push(`- ${item}`)
    }
  }

  lines.push('', '## Required files', '', '| File | Status |', '| --- | --- |')
  for (const file of report.fileChecks) {
    lines.push(`| ${file.path} | ${file.exists ? 'ok' : 'missing'} |`)
  }

  lines.push('', '## Mobile contour', '')
  lines.push(`- Active production mobile app: \`${report.mobileContour.activeDirectory}/\`.`)
  lines.push(`- Legacy mobile directory: \`${report.mobileContour.legacyDirectory}/\`${report.mobileContour.legacy.present ? ' is present' : ' is not present'}.`)
  lines.push(`- Status: ${report.mobileContour.status}.`)
  lines.push(`- Recommendation: ${report.mobileContour.recommendation}`)
  lines.push(`- Root scripts referencing \`mobile-app\`: ${report.mobileContour.rootScripts.referencesToLegacyMobileApp.length}.`)

  lines.push('', '## Blockers', '')
  if (report.blockers.length === 0) {
    lines.push('No structural blockers found in the repository.')
  } else {
    for (const item of report.blockers) {
      lines.push(`- **${item.title}** - ${item.action}`)
    }
  }

  lines.push('', '## Required release actions', '')
  for (const item of report.releaseActions) {
    lines.push(`- **${item.title}** - ${item.action}`)
  }

  lines.push('', '## Accepted pilot risks', '')
  for (const item of report.acceptedPilotRisks) {
    lines.push(`- **${item.title}** - ${item.action}`)
  }

  lines.push('', '## Audit commands to attach before release', '')
  for (const item of report.auditCommands) {
    lines.push(`- \`${item.command}\` - ${item.expected}`)
  }

  lines.push('', '## Final gate commands', '', '```powershell')
  lines.push(...report.finalGateCommands)
  lines.push('```')

  return lines.join('\n')
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const report = await collectReadiness()

  if (options.json) {
    console.log(JSON.stringify(report, null, 2))
    return
  }

  console.log(renderMarkdown(report))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
