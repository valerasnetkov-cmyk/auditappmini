import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const TMP_ROOT = path.resolve('.tmp-smoke', `smoke-production-guard-${process.pid}`)
const DATA_DIR = path.join(TMP_ROOT, 'data')
const UPLOADS_DIR = path.join(TMP_ROOT, 'uploads')
const BACKUPS_DIR = path.join(TMP_ROOT, 'backups')
const ENV_PATH = path.join(TMP_ROOT, 'production.env')

function runNode(args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      env: { ...process.env, ...(options.env || {}) },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.on('close', (code) => {
      resolve({ code, stdout, stderr })
    })
  })
}

async function writeProductionEnv({ publicRegistrationEnabled }) {
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.mkdir(UPLOADS_DIR, { recursive: true })
  await fs.mkdir(BACKUPS_DIR, { recursive: true })

  const tmpRelative = `./.tmp-smoke/smoke-production-guard-${process.pid}`
  const content = [
    'NODE_ENV=production',
    'PORT=3001',
    'JWT_SECRET=production-smoke-secret-64-characters-long-and-unique',
    'ADMIN_EMAIL=admin@auditmini.example',
    'ADMIN_PASSWORD=VeryStrongAdminPassword123!',
    `DATABASE_PATH=${tmpRelative}/data/database.sqlite`,
    `UPLOAD_DIR=${tmpRelative}/uploads`,
    `BACKUP_DIR=${tmpRelative}/backups`,
    'CORS_ORIGINS=https://app.auditmini.example',
    'WEB_APP_URL=https://app.auditmini.example',
    `PUBLIC_REGISTRATION_ENABLED=${publicRegistrationEnabled ? 'true' : 'false'}`,
    '',
  ].join('\n')

  await fs.writeFile(ENV_PATH, content, 'utf8')
}

async function runDoctor({ publicRegistrationEnabled, expectedCode }) {
  await writeProductionEnv({ publicRegistrationEnabled })

  const result = await runNode([
    'scripts/launch-doctor.mjs',
    '--production',
    '--doctor-env-file',
    ENV_PATH,
  ])

  if (result.code !== expectedCode) {
    throw new Error([
      `launch-doctor exit code mismatch for PUBLIC_REGISTRATION_ENABLED=${publicRegistrationEnabled}`,
      `expected: ${expectedCode}`,
      `actual: ${result.code}`,
      `stdout: ${result.stdout}`,
      `stderr: ${result.stderr}`,
    ].join('\n'))
  }

  if (publicRegistrationEnabled && !result.stdout.includes('PUBLIC_REGISTRATION_ENABLED must be false in production')) {
    throw new Error([
      'launch-doctor did not report public registration production error',
      `stdout: ${result.stdout}`,
      `stderr: ${result.stderr}`,
    ].join('\n'))
  }
}

async function run() {
  await runDoctor({ publicRegistrationEnabled: false, expectedCode: 0 })
  await runDoctor({ publicRegistrationEnabled: true, expectedCode: 1 })

  console.log('Production guard smoke passed')
}

run()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await fs.rm(TMP_ROOT, { recursive: true, force: true }).catch(() => {})
  })
