import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const currentFile = fileURLToPath(import.meta.url)
const repoRoot = path.resolve(path.dirname(currentFile), '..')

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

async function readJsonIfExists(targetPath) {
  if (!(await exists(targetPath))) return null

  try {
    return JSON.parse(await fs.readFile(targetPath, 'utf8'))
  } catch {
    return null
  }
}

function dependencyVersion(packageJson, name) {
  return packageJson?.dependencies?.[name] || packageJson?.devDependencies?.[name] || null
}

function hasScript(packageJson, scriptName) {
  return Boolean(packageJson?.scripts?.[scriptName])
}

function missingScripts(packageJson, scriptNames) {
  return scriptNames.filter((scriptName) => !hasScript(packageJson, scriptName))
}

function packageSummary(packageJson) {
  if (!packageJson) return null

  return {
    name: packageJson.name || null,
    version: packageJson.version || null,
    expo: dependencyVersion(packageJson, 'expo'),
    reactNative: dependencyVersion(packageJson, 'react-native'),
    scripts: Object.keys(packageJson.scripts || {}).sort(),
  }
}

function rootScriptReferences(packageJson, needle) {
  const scripts = packageJson?.scripts || {}
  return Object.entries(scripts)
    .filter(([, command]) => command.includes(needle))
    .map(([name, command]) => ({ name, command }))
}

export async function collectMobileContour() {
  const rootPackage = await readJsonIfExists(path.join(repoRoot, 'package.json'))
  const activePackage = await readJsonIfExists(path.join(repoRoot, 'mobile', 'package.json'))
  const legacyPackage = await readJsonIfExists(path.join(repoRoot, 'mobile-app', 'package.json'))

  const requiredActiveScripts = ['verify', 'doctor:launch', 'doctor:production', 'audit:moderate', 'eas:readiness']
  const expectedLegacyMissingScripts = ['verify', 'doctor:launch', 'doctor:production', 'audit:moderate']
  const activeMissingScripts = missingScripts(activePackage, requiredActiveScripts)
  const legacyMissingScripts = missingScripts(legacyPackage, expectedLegacyMissingScripts)
  const rootMobileRefs = rootScriptReferences(rootPackage, 'mobile')
  const rootLegacyRefs = rootScriptReferences(rootPackage, 'mobile-app')

  const activeReady = Boolean(activePackage) && activeMissingScripts.length === 0
  const legacyPresent = Boolean(legacyPackage)
  const legacyReferencedByRoot = rootLegacyRefs.length > 0
  const legacyExcluded = legacyPresent && !legacyReferencedByRoot

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    activeDirectory: 'mobile',
    legacyDirectory: 'mobile-app',
    status: activeReady
      ? legacyExcluded
        ? 'active-mobile-ready-legacy-mobile-app-excluded'
        : 'active-mobile-ready'
      : 'active-mobile-needs-attention',
    recommendation: legacyPresent
      ? 'Use mobile/ for production. Delete mobile-app/ after explicit owner confirmation, or upgrade it as a separate project before any production use.'
      : 'Use mobile/ for production. The legacy mobile-app/ directory is not present.',
    active: {
      present: Boolean(activePackage),
      readyForLaunchGate: activeReady,
      missingRequiredScripts: activeMissingScripts,
      package: packageSummary(activePackage),
    },
    legacy: {
      present: legacyPresent,
      excludedFromRootLaunchGates: legacyExcluded,
      referencedByRootScripts: rootLegacyRefs,
      missingLaunchScripts: legacyMissingScripts,
      package: packageSummary(legacyPackage),
    },
    rootScripts: {
      referencesToMobile: rootMobileRefs,
      referencesToLegacyMobileApp: rootLegacyRefs,
    },
    deletionCandidate: legacyExcluded,
  }
}

export function renderMobileContourMarkdown(report) {
  const lines = [
    '# Auditmini mobile contour report',
    '',
    `Generated at: ${report.generatedAt}`,
    `Status: ${report.status}`,
    '',
    'This report is read-only. It does not run installs, audits, builds, or destructive cleanup.',
    '',
    '## Conclusion',
    '',
    `- Active production mobile app: \`${report.activeDirectory}/\`.`,
    `- Legacy mobile directory: \`${report.legacyDirectory}/\`${report.legacy.present ? ' is present' : ' is not present'}.`,
    `- Recommendation: ${report.recommendation}`,
  ]

  lines.push('', '## Active mobile app', '')

  if (!report.active.present) {
    lines.push('- `mobile/package.json` is missing.')
  } else {
    lines.push(`- Package: ${report.active.package.name || '(unnamed)'} ${report.active.package.version || ''}`.trim())
    lines.push(`- Expo: ${report.active.package.expo || '(not declared)'}`)
    lines.push(`- React Native: ${report.active.package.reactNative || '(not declared)'}`)
    lines.push(`- Required launch scripts: ${report.active.readyForLaunchGate ? 'ok' : `missing ${report.active.missingRequiredScripts.join(', ')}`}`)
  }

  lines.push('', '## Legacy mobile-app', '')

  if (!report.legacy.present) {
    lines.push('- `mobile-app/package.json` is missing.')
  } else {
    lines.push(`- Package: ${report.legacy.package.name || '(unnamed)'} ${report.legacy.package.version || ''}`.trim())
    lines.push(`- Expo: ${report.legacy.package.expo || '(not declared)'}`)
    lines.push(`- React Native: ${report.legacy.package.reactNative || '(not declared)'}`)
    lines.push(`- Excluded from root launch gates: ${report.legacy.excludedFromRootLaunchGates ? 'yes' : 'no'}`)
    lines.push(`- Missing launch scripts: ${report.legacy.missingLaunchScripts.length ? report.legacy.missingLaunchScripts.join(', ') : 'none'}`)
  }

  lines.push('', '## Root script references', '')

  if (report.rootScripts.referencesToMobile.length === 0) {
    lines.push('- No root scripts reference `mobile`.')
  } else {
    for (const item of report.rootScripts.referencesToMobile) {
      lines.push(`- \`${item.name}\`: \`${item.command}\``)
    }
  }

  if (report.rootScripts.referencesToLegacyMobileApp.length === 0) {
    lines.push('- No root scripts reference `mobile-app`.')
  } else {
    for (const item of report.rootScripts.referencesToLegacyMobileApp) {
      lines.push(`- Legacy reference \`${item.name}\`: \`${item.command}\``)
    }
  }

  return lines.join('\n')
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const report = await collectMobileContour()

  if (options.json) {
    console.log(JSON.stringify(report, null, 2))
    return
  }

  console.log(renderMobileContourMarkdown(report))
}

if (path.resolve(process.argv[1] || '') === currentFile) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
