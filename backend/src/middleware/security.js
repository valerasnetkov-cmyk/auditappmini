import cors from 'cors'

export function createSecurityHeadersMiddleware({
  csp,
  crossOriginOpenerPolicy,
  crossOriginResourcePolicy,
  hstsEnabled,
  hstsMaxAge,
}) {
  return (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader('X-DNS-Prefetch-Control', 'off')
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    res.setHeader('Content-Security-Policy', csp)
    res.setHeader('Cross-Origin-Opener-Policy', crossOriginOpenerPolicy)
    res.setHeader('Cross-Origin-Resource-Policy', crossOriginResourcePolicy)

    if (hstsEnabled) {
      res.setHeader('Strict-Transport-Security', `max-age=${hstsMaxAge}; includeSubDomains`)
    }

    next()
  }
}

export function createCorsMiddleware({ allowAllOrigins, origins, requestIdHeader }) {
  return cors({
    origin: (origin, callback) => {
      if (!origin || allowAllOrigins || origins.includes(origin)) {
        callback(null, true)
        return
      }

      callback(new Error(`CORS blocked for origin: ${origin}`))
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', requestIdHeader],
    exposedHeaders: [requestIdHeader, 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset', 'Retry-After'],
    credentials: true,
  })
}
