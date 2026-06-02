function formatAccessLogEntry(entry, format) {
  if (format === 'json') {
    return JSON.stringify(entry)
  }

  return `[${entry.timestamp}] ${entry.method} ${entry.path} ${entry.statusCode} ${entry.durationMs}ms request_id=${entry.requestId} ip=${entry.ip}`
}

function shouldSkipAccessLog(req, skipPaths) {
  if (skipPaths.length === 0) return false

  const requestPath = req.path || '/'
  return skipPaths.some((pathname) => {
    if (pathname === '/') return requestPath === '/'
    return requestPath === pathname || requestPath.startsWith(`${pathname}/`)
  })
}

function logAccess(req, res, startedAt, options) {
  if (options.format === 'off') return
  if (shouldSkipAccessLog(req, options.skipPaths)) return

  const durationMs = Math.max(0, Math.round(Number(process.hrtime.bigint() - startedAt) / 1_000_000))
  const entry = {
    type: 'access',
    timestamp: new Date().toISOString(),
    requestId: req.id,
    method: req.method,
    path: req.originalUrl,
    statusCode: res.statusCode,
    durationMs,
    slow: durationMs >= options.slowMs,
    ip: req.ip,
    userId: req.user?.id || null,
    companyId: req.user?.company_id || null,
    userAgent: req.get('user-agent') || null,
  }

  console.log(formatAccessLogEntry(entry, options.format))
}

export function createAccessLogMiddleware({ format, slowMs, skipPaths }) {
  const options = { format, slowMs, skipPaths }

  return (req, res, next) => {
    const startedAt = process.hrtime.bigint()
    res.on('finish', () => logAccess(req, res, startedAt, options))
    next()
  }
}
