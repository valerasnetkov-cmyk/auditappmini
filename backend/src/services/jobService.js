import { v4 as uuidv4 } from 'uuid'

const JOB_STATUSES = new Set(['queued', 'active', 'completed', 'failed'])

function parsePayload(value) {
  if (!value) return {}
  try {
    return JSON.parse(value)
  } catch {
    return {}
  }
}

function mapJob(row) {
  if (!row) return null
  return {
    id: row.id,
    jobType: row.job_type,
    tenantId: row.tenant_id || null,
    entityId: row.entity_id || null,
    payload: parsePayload(row.payload_json),
    status: row.status,
    attempts: Number(row.attempts || 0),
    maxAttempts: Number(row.max_attempts || 0),
    idempotencyKey: row.idempotency_key || null,
    lastError: row.last_error || null,
    createdAt: row.created_at || null,
    availableAt: row.available_at || null,
    startedAt: row.started_at || null,
    finishedAt: row.finished_at || null,
    failedAt: row.failed_at || null,
    workerName: row.worker_name || null,
  }
}

export function enqueueJob(db, {
  jobType,
  tenantId = null,
  entityId = null,
  payload = {},
  maxAttempts = 3,
  idempotencyKey = null,
  availableAt = null,
} = {}) {
  if (!jobType || typeof jobType !== 'string') throw new Error('jobType is required')

  if (idempotencyKey) {
    const existing = db.prepare('SELECT * FROM worker_jobs WHERE idempotency_key = ?').get(idempotencyKey)
    if (existing) return mapJob(existing)
  }

  const id = uuidv4()
  db.prepare(`
    INSERT INTO worker_jobs (
      id, job_type, tenant_id, entity_id, payload_json, status, attempts,
      max_attempts, idempotency_key, created_at, available_at
    )
    VALUES (?, ?, ?, ?, ?, 'queued', 0, ?, ?, datetime('now'), COALESCE(?, datetime('now')))
  `).run(
    id,
    jobType,
    tenantId,
    entityId,
    JSON.stringify(payload || {}),
    Math.max(1, Number(maxAttempts || 3)),
    idempotencyKey,
    availableAt,
  )

  return getJob(db, id)
}

export function getJob(db, id) {
  return mapJob(db.prepare('SELECT * FROM worker_jobs WHERE id = ?').get(id))
}

export function claimNextJob(db, { workerName = 'worker', jobTypes = [] } = {}) {
  const typeFilter = jobTypes.length ? `AND job_type IN (${jobTypes.map(() => '?').join(', ')})` : ''
  const params = jobTypes.length ? jobTypes : []
  const row = db.prepare(`
    SELECT *
    FROM worker_jobs
    WHERE status = 'queued'
      AND datetime(COALESCE(available_at, created_at)) <= datetime('now')
      ${typeFilter}
    ORDER BY created_at ASC
    LIMIT 1
  `).get(...params)

  if (!row) return null

  const result = db.prepare(`
    UPDATE worker_jobs
    SET status = 'active',
      attempts = attempts + 1,
      started_at = datetime('now'),
      worker_name = ?,
      last_error = NULL
    WHERE id = ? AND status = 'queued'
  `).run(workerName, row.id)

  if (!result.changes) return null
  return getJob(db, row.id)
}

export function completeJob(db, id) {
  db.prepare(`
    UPDATE worker_jobs
    SET status = 'completed',
      finished_at = datetime('now'),
      failed_at = NULL,
      last_error = NULL
    WHERE id = ?
  `).run(id)
  return getJob(db, id)
}

export function failJob(db, id, error, { retryDelaySeconds = 60 } = {}) {
  const job = getJob(db, id)
  if (!job) return null
  const shouldRetry = job.attempts < job.maxAttempts
  const status = shouldRetry ? 'queued' : 'failed'
  const delay = Math.max(0, Number(retryDelaySeconds || 0))

  db.prepare(`
    UPDATE worker_jobs
    SET status = ?,
      failed_at = CASE WHEN ? = 'failed' THEN datetime('now') ELSE failed_at END,
      available_at = CASE WHEN ? = 'queued' THEN datetime('now', ?) ELSE available_at END,
      last_error = ?
    WHERE id = ?
  `).run(status, status, status, `+${delay} seconds`, String(error?.message || error || 'Job failed'), id)

  return getJob(db, id)
}

export function heartbeatWorker(db, { workerName, status = 'running', lastError = null } = {}) {
  if (!workerName) throw new Error('workerName is required')
  const stats = getQueueSummary(db)
  db.prepare(`
    INSERT INTO worker_heartbeats (
      worker_name, status, last_heartbeat_at, jobs_waiting, jobs_active,
      jobs_failed_24h, last_error, updated_at
    )
    VALUES (?, ?, datetime('now'), ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(worker_name) DO UPDATE SET
      status = excluded.status,
      last_heartbeat_at = excluded.last_heartbeat_at,
      jobs_waiting = excluded.jobs_waiting,
      jobs_active = excluded.jobs_active,
      jobs_failed_24h = excluded.jobs_failed_24h,
      last_error = excluded.last_error,
      updated_at = excluded.updated_at
  `).run(workerName, status, stats.waiting, stats.active, stats.failed24h, lastError)
  return getWorkerHeartbeats(db).find((item) => item.workerName === workerName)
}

export function getWorkerHeartbeats(db) {
  return db.prepare(`
    SELECT *
    FROM worker_heartbeats
    ORDER BY worker_name COLLATE NOCASE ASC
  `).all().map((row) => ({
    workerName: row.worker_name,
    status: row.status,
    lastHeartbeatAt: row.last_heartbeat_at,
    jobsWaiting: Number(row.jobs_waiting || 0),
    jobsActive: Number(row.jobs_active || 0),
    jobsFailed24h: Number(row.jobs_failed_24h || 0),
    avgDurationMs: row.avg_duration_ms === null ? null : Number(row.avg_duration_ms || 0),
    lastError: row.last_error || null,
    updatedAt: row.updated_at || null,
  }))
}

export function getQueueSummary(db) {
  const row = db.prepare(`
    SELECT
      SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) as waiting,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'failed' AND failed_at >= datetime('now', '-24 hours') THEN 1 ELSE 0 END) as failed24h
    FROM worker_jobs
  `).get()
  const byType = db.prepare(`
    SELECT job_type as jobType, status, COUNT(*) as count
    FROM worker_jobs
    GROUP BY job_type, status
    ORDER BY job_type ASC, status ASC
  `).all()

  return {
    waiting: Number(row?.waiting || 0),
    active: Number(row?.active || 0),
    failed: Number(row?.failed || 0),
    completed: Number(row?.completed || 0),
    failed24h: Number(row?.failed24h || 0),
    byType: byType.map((item) => ({
      jobType: item.jobType,
      status: JOB_STATUSES.has(item.status) ? item.status : 'queued',
      count: Number(item.count || 0),
    })),
  }
}
