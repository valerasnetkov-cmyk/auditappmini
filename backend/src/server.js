import 'dotenv/config'
import { initDatabase } from './db.js'
import { GRACEFUL_SHUTDOWN_TIMEOUT_MS } from './config.js'
import { isRedisConfigured, shutdownRedis } from './services/redisClient.js'
import { createApp } from './app.js'

const PORT = process.env.PORT || 3001

let isShuttingDown = false
let server = null
const openSockets = new Set()

const app = createApp({
  getIsShuttingDown: () => isShuttingDown,
})

function forceCloseOpenSockets() {
  for (const socket of openSockets) {
    socket.destroy()
  }
  openSockets.clear()
}

function gracefulShutdown(signal) {
  if (isShuttingDown) {
    console.log(`[shutdown] ${signal} received while shutdown is already in progress`)
    return
  }

  isShuttingDown = true
  console.log(`[shutdown] ${signal} received; stopping HTTP server`)

  if (!server) {
    process.exit(0)
    return
  }

  const shutdownTimer = setTimeout(() => {
    console.error(`[shutdown] Forced shutdown after ${GRACEFUL_SHUTDOWN_TIMEOUT_MS}ms`)
    forceCloseOpenSockets()
    process.exit(1)
  }, GRACEFUL_SHUTDOWN_TIMEOUT_MS)
  shutdownTimer.unref?.()

  server.close((err) => {
    clearTimeout(shutdownTimer)

    if (err) {
      console.error('[shutdown] HTTP server closed with error:', err)
      process.exit(1)
      return
    }

    if (isRedisConfigured()) {
      shutdownRedis()
        .catch((shutdownErr) => {
          console.error('[shutdown] Redis shutdown error:', shutdownErr)
        })
        .finally(() => {
          console.log('[shutdown] HTTP server closed gracefully')
          process.exit(0)
        })
      return
    }

    console.log('[shutdown] HTTP server closed gracefully')
    process.exit(0)
  })

  server.closeIdleConnections?.()
}

process.once('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.once('SIGINT', () => gracefulShutdown('SIGINT'))

if (typeof process.send === 'function') {
  process.on('message', (message) => {
    if (message === 'shutdown') {
      gracefulShutdown('IPC_SHUTDOWN')
    }
  })
}

initDatabase().then(() => {
  server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`вњ… Server running on http://0.0.0.0:${PORT}`)
  })

  server.on('connection', (socket) => {
    openSockets.add(socket)
    socket.on('close', () => {
      openSockets.delete(socket)
    })
  })
}).catch(err => {
  console.error('Failed to initialize database:', err)
  process.exit(1)
})
