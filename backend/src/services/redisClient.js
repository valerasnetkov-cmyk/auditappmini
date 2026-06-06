// Redis client wrapper.
//
// Поведение:
//   - Если REDIS_URL задан — создаёт ioredis client с lazyConnect
//     (не подключается до первого использования).
//   - Если REDIS_URL не задан — `isAvailable()` возвращает false;
//     rateLimiter и health-check корректно деградируют.
//   - При ошибках подключения клиент остаётся «недоступным»
//     (повторные попытки не спамят лог).
//   - Production guard: в `NODE_ENV=production` с заданным
//     REDIS_URL отказ подключения приводит к 503 в `/api/health/ready`.
//
// Все методы безопасны для вызова, даже если клиент не сконфигурирован.

import { Redis } from 'ioredis'

let client = null
let configured = false
let connected = false
let lastConnectErrorAt = 0
let lastConnectErrorMessage = null

const CONNECT_ERROR_THROTTLE_MS = 30 * 1000

function shouldLogConnectError() {
  return Date.now() - lastConnectErrorAt > CONNECT_ERROR_THROTTLE_MS
}

export function getRedisClient() {
  if (client) return client

  const url = process.env.REDIS_URL
  if (!url) {
    configured = false
    return null
  }

  configured = true

  try {
    client = new Redis(url, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      retryStrategy(times) {
        if (times > 5) return null
        return Math.min(times * 200, 2000)
      },
      reconnectOnError() {
        return false
      },
    })

    client.on('connect', () => {
      connected = true
      lastConnectErrorAt = 0
      lastConnectErrorMessage = null
    })

    client.on('ready', () => {
      connected = true
    })

    client.on('end', () => {
      connected = false
    })

    client.on('error', (err) => {
      connected = false
      lastConnectErrorMessage = err?.message || String(err)
      if (shouldLogConnectError()) {
        console.warn(
          `[redis] connection error: ${lastConnectErrorMessage}` +
            ' (further errors within 30s are silenced)',
        )
        lastConnectErrorAt = Date.now()
      }
    })

    return client
  } catch (err) {
    lastConnectErrorMessage = err?.message || String(err)
    console.warn(`[redis] failed to create client: ${lastConnectErrorMessage}`)
    return null
  }
}

export function isRedisConfigured() {
  return Boolean(process.env.REDIS_URL)
}

export function isRedisAvailable() {
  if (!isRedisConfigured()) return false
  const c = getRedisClient()
  return Boolean(c && c.status === 'ready')
}

export function getRedisStatus() {
  if (!isRedisConfigured()) {
    return { configured: false, connected: false, error: null }
  }
  const c = getRedisClient()
  return {
    configured: true,
    connected: c ? c.status === 'ready' : false,
    status: c?.status || 'not-initialized',
    error: lastConnectErrorMessage,
  }
}

export async function pingRedis() {
  if (!isRedisConfigured()) {
    return { ok: false, reason: 'REDIS_URL is not set' }
  }
  const c = getRedisClient()
  if (!c) {
    return { ok: false, reason: 'redis client not initialized' }
  }
  try {
    if (c.status !== 'ready') {
      await c.connect().catch((err) => {
        throw err
      })
    }
    const reply = await c.ping()
    connected = reply === 'PONG'
    return { ok: connected, reply }
  } catch (err) {
    connected = false
    lastConnectErrorMessage = err?.message || String(err)
    return { ok: false, reason: lastConnectErrorMessage }
  }
}

export async function shutdownRedis() {
  if (!client) return
  try {
    await client.quit()
  } catch {
    client.disconnect()
  } finally {
    client = null
    connected = false
  }
}

// Test-only: clear module state between test runs.
export function resetRedisForTests() {
  if (client) {
    client.disconnect()
    client = null
  }
  configured = false
  connected = false
  lastConnectErrorAt = 0
  lastConnectErrorMessage = null
}
