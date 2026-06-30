import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { spawn } from 'node:child_process'
import Database from 'better-sqlite3'

const backendRoot = process.cwd()
const tmpRoot = path.join(backendRoot, '.tmp-smoke', `smoke-workers-${process.pid}`)
const databasePath = path.join(tmpRoot, 'database.sqlite')
const uploadDir = path.join(tmpRoot, 'uploads')

function runNode(args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: backendRoot,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr })
      else reject(new Error(`Command failed: node ${args.join(' ')}\n${stdout}\n${stderr}`))
    })
  })
}

function parseJsonOutput(stdout) {
  const start = stdout.indexOf('{')
  const end = stdout.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) throw new Error(`Command did not return JSON: ${stdout}`)
  return JSON.parse(stdout.slice(start, end + 1))
}

await fs.mkdir(uploadDir, { recursive: true })
process.env.DATABASE_PATH = databasePath
process.env.UPLOAD_DIR = uploadDir
process.env.JWT_SECRET = 'worker-smoke-secret-worker-smoke-secret'

const { initDatabase, getDb, closeDatabase } = await import('../src/db.js')
const { enqueueJob, getQueueSummary, getWorkerHeartbeats } = await import('../src/services/jobService.js')
const { collectOperationalStatus } = await import('../src/services/operationalStatus.js')
const { buildHealthItems } = await import('../src/services/resourceDashboard.js')

await initDatabase()
const db = getDb()

try {
  const first = enqueueJob(db, {
    jobType: 'billing.scan',
    payload: { source: 'smoke' },
    idempotencyKey: 'smoke-workers-billing-scan',
  })
  const second = enqueueJob(db, {
    jobType: 'billing.scan',
    payload: { source: 'smoke' },
    idempotencyKey: 'smoke-workers-billing-scan',
  })

  if (first.id !== second.id) throw new Error('Idempotency key did not return the existing job')
} finally {
  closeDatabase()
}

try {
  const result = parseJsonOutput((await runNode(['scripts/worker-run-once.mjs'], {
    DATABASE_PATH: databasePath,
    UPLOAD_DIR: uploadDir,
    JWT_SECRET: 'worker-smoke-secret-worker-smoke-secret',
    WORKER_NAME: 'smoke-worker',
  })).stdout)

  if (!result.ok || !result.processed || result.job.status !== 'completed') {
    throw new Error(`Worker did not complete the queued job: ${JSON.stringify(result)}`)
  }

  const verifyDb = new Database(databasePath, { readonly: true })
  try {
    const summary = getQueueSummary(verifyDb)
    const heartbeats = getWorkerHeartbeats(verifyDb)
    const operational = collectOperationalStatus({ db: verifyDb, env: { UPLOAD_DIR: uploadDir } })

    if (summary.completed !== 1 || summary.waiting !== 0 || summary.active !== 0) {
      throw new Error(`Unexpected queue summary: ${JSON.stringify(summary)}`)
    }

    if (!heartbeats.some((item) => item.workerName === 'smoke-worker')) {
      throw new Error('Worker heartbeat was not recorded')
    }

    if (!['running', 'idle'].includes(operational.workers.status)) {
      throw new Error(`Operational worker status is unexpected: ${JSON.stringify(operational.workers)}`)
    }

    const healthItems = buildHealthItems({
      serviceHealth: { companiesWithoutOwner: 0, companiesWithoutLimits: 0 },
      operationalStatus: operational,
      inactiveCompanies14d: 0,
      unfinishedInspectionsOlderThan24h: 0,
      defectsWithoutPhotos: 0,
      accidentInspectionsWithoutRequiredData: 0,
    })
    const workerHealth = healthItems.find((item) => item.key === 'worker_status')
    if (!workerHealth || workerHealth.severity !== 'ok' || workerHealth.count !== 0) {
      throw new Error(`Worker health item did not reflect heartbeat evidence: ${JSON.stringify(workerHealth)}`)
    }

    console.log(JSON.stringify({
      ok: true,
      jobId: result.job.id,
      jobType: result.job.jobType,
      queueCompleted: summary.completed,
      workerStatus: operational.workers.status,
      workerHealth: workerHealth.severity,
      heartbeat: operational.workers.heartbeat,
    }, null, 2))
  } finally {
    verifyDb.close()
  }
} finally {
  await fs.rm(tmpRoot, { recursive: true, force: true })
}
