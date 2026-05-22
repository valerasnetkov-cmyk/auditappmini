import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const currentFile = fileURLToPath(import.meta.url)
const mobileRoot = path.resolve(path.dirname(currentFile), '..')
const repoRoot = path.resolve(mobileRoot, '..')

async function readJson(relativePath) {
  const absolutePath = path.join(mobileRoot, relativePath)
  return JSON.parse(await fs.readFile(absolutePath, 'utf8'))
}

async function readText(relativePath) {
  const absolutePath = path.join(mobileRoot, relativePath)
  return fs.readFile(absolutePath, 'utf8')
}

function hasScript(packageJson, scriptName) {
  return Boolean(packageJson?.scripts?.[scriptName])
}

function addError(errors, message) {
  errors.push(message)
}

function addWarning(warnings, message) {
  warnings.push(message)
}

async function exists(absolutePath) {
  try {
    await fs.access(absolutePath)
    return true
  } catch {
    return false
  }
}

async function collectReadiness() {
  const errors = []
  const warnings = []
  const packageJson = await readJson('package.json')
  const appJson = await readJson('app.json')
  const easJson = await readJson('eas.json')
  const productionEnvExample = await readText('.env.production.example')

  const requiredScripts = [
    'eas:readiness',
    'eas:configure',
    'eas:preview:android',
    'eas:production',
    'doctor:production',
    'verify',
  ]

  for (const scriptName of requiredScripts) {
    if (!hasScript(packageJson, scriptName)) {
      addError(errors, `mobile/package.json is missing script "${scriptName}".`)
    }
  }

  if (!packageJson.scripts?.verify?.includes('eas:readiness')) {
    addError(errors, 'mobile/package.json script "verify" must include "eas:readiness".')
  }

  if (easJson?.cli?.appVersionSource !== 'local') {
    addError(errors, 'mobile/eas.json must set cli.appVersionSource to "local" for reproducible local version evidence.')
  }

  const preview = easJson?.build?.preview
  if (!preview) {
    addError(errors, 'mobile/eas.json is missing build.preview profile.')
  } else {
    if (preview.distribution !== 'internal') {
      addError(errors, 'mobile/eas.json build.preview.distribution must be "internal".')
    }
    if (preview.environment !== 'preview') {
      addError(errors, 'mobile/eas.json build.preview.environment must be "preview".')
    }
    if (preview.android?.buildType !== 'apk') {
      addError(errors, 'mobile/eas.json build.preview.android.buildType must be "apk" for direct Android pilot installation.')
    }
  }

  const production = easJson?.build?.production
  if (!production) {
    addError(errors, 'mobile/eas.json is missing build.production profile.')
  } else if (production.environment !== 'production') {
    addError(errors, 'mobile/eas.json build.production.environment must be "production".')
  }

  const androidPackage = appJson?.expo?.android?.package
  if (!androidPackage) {
    addError(errors, 'mobile/app.json is missing expo.android.package.')
  }

  const iosBundleIdentifier = appJson?.expo?.ios?.bundleIdentifier
  if (!iosBundleIdentifier) {
    addError(errors, 'mobile/app.json is missing expo.ios.bundleIdentifier.')
  }

  if (!productionEnvExample.includes('EXPO_PUBLIC_API_URL=')) {
    addError(errors, 'mobile/.env.production.example must document EXPO_PUBLIC_API_URL.')
  }

  if (!productionEnvExample.includes('/api')) {
    addWarning(warnings, 'mobile/.env.production.example should point EXPO_PUBLIC_API_URL to the backend /api path.')
  }

  const legacyEasJson = path.join(repoRoot, 'mobile-app', 'eas.json')
  if (await exists(legacyEasJson)) {
    addWarning(warnings, 'legacy mobile-app/eas.json exists; keep it outside production evidence unless mobile-app is explicitly upgraded.')
  }

  return {
    schemaVersion: 1,
    status: errors.length === 0 ? 'ready' : 'blocked',
    mobileRoot,
    checks: {
      easJson: 'mobile/eas.json',
      androidPackage: androidPackage || null,
      iosBundleIdentifier: iosBundleIdentifier || null,
      previewProfile: preview || null,
      productionProfile: production || null,
      usesProductionEnvExample: productionEnvExample.includes('EXPO_PUBLIC_API_URL='),
    },
    errors,
    warnings,
  }
}

function render(report) {
  const lines = [
    '# Auditmini mobile EAS readiness',
    '',
    `Status: ${report.status}`,
    `Mobile root: ${report.mobileRoot}`,
    '',
    '## Checks',
    '',
    `- EAS config: \`${report.checks.easJson}\``,
    `- Android package: \`${report.checks.androidPackage || 'missing'}\``,
    `- iOS bundle identifier: \`${report.checks.iosBundleIdentifier || 'missing'}\``,
    `- Preview profile: ${report.checks.previewProfile ? 'ok' : 'missing'}`,
    `- Production profile: ${report.checks.productionProfile ? 'ok' : 'missing'}`,
    `- Production env example documents EXPO_PUBLIC_API_URL: ${report.checks.usesProductionEnvExample ? 'yes' : 'no'}`,
  ]

  lines.push('', '## Errors', '')
  if (report.errors.length === 0) {
    lines.push('No EAS readiness errors found.')
  } else {
    for (const error of report.errors) {
      lines.push(`- ${error}`)
    }
  }

  if (report.warnings.length > 0) {
    lines.push('', '## Warnings', '')
    for (const warning of report.warnings) {
      lines.push(`- ${warning}`)
    }
  }

  return lines.join('\n')
}

collectReadiness()
  .then((report) => {
    console.log(render(report))
    if (report.errors.length > 0) {
      process.exit(1)
    }
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
