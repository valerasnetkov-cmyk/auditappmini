import crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'

function sanitizeRequestId(value) {
  if (typeof value !== 'string') return null
  const requestId = value.trim()

  if (!requestId || requestId.length > 128) return null
  if (!/^[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=-]+$/.test(requestId)) return null

  return requestId
}

function createRequestId() {
  return crypto.randomUUID ? crypto.randomUUID() : uuidv4()
}

export function createRequestIdMiddleware({ headerName }) {
  return (req, res, next) => {
    req.id = sanitizeRequestId(req.get(headerName)) || createRequestId()
    res.setHeader(headerName, req.id)
    next()
  }
}
