import { isRedisConfigured, getRedisStatus, pingRedis } from '../services/redisClient.js'
import { uploadStorage } from '../services/photoUpload.js'

function buildLivenessPayload() {
  return {
    ok: true,
    status: 'ok',
    service: 'audit-backend',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  }
}

async function checkUploadsWritable() {
  const probeKey = `.healthcheck-${process.pid}-${Date.now()}.tmp`
  await uploadStorage.save(probeKey, Buffer.from('ok'))
  await uploadStorage.delete(probeKey)
  return true
}

async function buildReadinessPayload({ getDb, isAppShuttingDown }) {
  const checks = {
    shutdown: !isAppShuttingDown(),
    database: false,
    uploads: false,
    redis: !isRedisConfigured(),
  }
  const errors = []

  if (isAppShuttingDown()) {
    errors.push('Server is shutting down')
  }

  try {
    const result = getDb().prepare('SELECT 1 as ok').get()
    checks.database = Number(result?.ok) === 1
    if (!checks.database) {
      errors.push('Database query did not return expected result')
    }
  } catch (error) {
    errors.push(`Database check failed: ${error.message}`)
  }

  try {
    checks.uploads = await checkUploadsWritable()
  } catch (error) {
    errors.push(`Uploads check failed: ${error.message}`)
  }

  if (isRedisConfigured()) {
    try {
      const ping = await pingRedis()
      checks.redis = ping.ok
      if (!ping.ok) {
        errors.push(`Redis ping failed: ${ping.reason || 'unknown'}`)
      }
    } catch (error) {
      checks.redis = false
      errors.push(`Redis check failed: ${error.message}`)
    }
  }

  const ok = Object.values(checks).every(Boolean)
  return {
    ok,
    status: ok ? 'ok' : 'error',
    ready: ok,
    checks,
    errors,
    redis: isRedisConfigured() ? getRedisStatus() : { configured: false },
  }
}

export default function registerHealthRoutes({
  app,
  getDb,
  isAppShuttingDown,
  sendError,
}) {
  app.get(['/health', '/api/health', '/api/health/live'], (req, res) => {
    res.json(buildLivenessPayload())
  })

  app.get('/api/health/ready', async (req, res) => {
    const payload = await buildReadinessPayload({ getDb, isAppShuttingDown })
    res.status(payload.ready ? 200 : 503).json(payload)
  })

  app.use((req, res, next) => {
    if (!isAppShuttingDown()) {
      next()
      return
    }

    res.setHeader('Connection', 'close')
    return sendError(res, 503, 'Server is shutting down')
  })
}
