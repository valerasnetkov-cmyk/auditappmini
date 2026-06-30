import process from 'node:process'
import { initDatabase, getDb, closeDatabase } from '../src/db.js'
import { claimNextJob, completeJob, failJob, heartbeatWorker } from '../src/services/jobService.js'
import { scanSubscriptionAlerts } from '../src/services/subscriptionAlerts.js'

const workerName = process.env.WORKER_NAME || 'worker-main'
const supportedJobTypes = ['billing.scan']

await initDatabase()
const db = getDb()

try {
  heartbeatWorker(db, { workerName, status: 'running' })
  const job = claimNextJob(db, { workerName, jobTypes: supportedJobTypes })

  if (!job) {
    heartbeatWorker(db, { workerName, status: 'idle' })
    console.log(JSON.stringify({ ok: true, workerName, processed: false }, null, 2))
    process.exit(0)
  }

  try {
    let result = null
    if (job.jobType === 'billing.scan') {
      result = scanSubscriptionAlerts(db, {
        actorUserId: null,
        actorRole: 'worker',
      })
    } else {
      throw new Error(`Unsupported job type: ${job.jobType}`)
    }

    const completed = completeJob(db, job.id)
    heartbeatWorker(db, { workerName, status: 'running' })
    console.log(JSON.stringify({ ok: true, workerName, processed: true, job: completed, result }, null, 2))
  } catch (error) {
    const failed = failJob(db, job.id, error)
    heartbeatWorker(db, { workerName, status: 'degraded', lastError: error.message })
    console.log(JSON.stringify({ ok: false, workerName, processed: true, job: failed, error: error.message }, null, 2))
    process.exitCode = 1
  }
} finally {
  closeDatabase()
}
