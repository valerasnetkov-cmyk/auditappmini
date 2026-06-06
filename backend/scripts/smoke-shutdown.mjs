import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import http from 'node:http'
import crypto from 'node:crypto'
import process from 'node:process'

const HOST = '127.0.0.1'
let PORT = Number(process.env.PORT || 0)
const DATABASE_PATH = `./.tmp-smoke/smoke-shutdown-${process.pid}.sqlite`
const UPLOAD_DIR = `./.tmp-smoke/uploads-shutdown-${process.pid}`
let BASE_URL = ''

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer()
    server.once('error', reject)
    server.listen(0, HOST, () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : null
      server.close(() => {
        if (!port) {
          reject(new Error('Could not allocate a free port'))
          return
        }

        resolve(port)
      })
    })
  })
}

async function waitForServer(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs
  let lastError

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/api/health/ready`)
      const body = await response.json().catch(() => null)
      if (response.ok && body?.ready) return body
    } catch (error) {
      lastError = error
    }

    await sleep(250)
  }

  throw new Error(`Server did not become ready: ${lastError?.message || 'timeout'}`)
}

function waitForExit(child, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error(`Server did not exit within ${timeoutMs}ms after shutdown request`))
    }, timeoutMs)

    child.once('close', (code, signal) => {
      clearTimeout(timer)
      resolve({ code, signal })
    })
  })
}

async function run() {
  if (!PORT) {
    PORT = await getFreePort()
  }

  BASE_URL = `http://${HOST}:${PORT}`

  const server = spawn(process.execPath, ['src/server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(PORT),
      DATABASE_PATH,
      UPLOAD_DIR,
      JWT_SECRET: crypto.randomBytes(32).toString('hex'),
      GRACEFUL_SHUTDOWN_TIMEOUT_MS: '3000',
    },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  })

  let stdout = ''
  let stderr = ''

  server.stdout.on('data', (chunk) => {
    stdout += chunk.toString()
  })

  server.stderr.on('data', (chunk) => {
    stderr += chunk.toString()
  })

  try {
    const ready = await waitForServer()
    if (ready.checks?.shutdown !== true) {
      throw new Error(`Readiness payload should include shutdown=true before SIGTERM: ${JSON.stringify(ready)}`)
    }

    server.send('shutdown')
    const result = await waitForExit(server)

    if (result.code !== 0) {
      throw new Error(`Server exited with code=${result.code} signal=${result.signal}; stderr=${stderr}; stdout=${stdout}`)
    }

    if (!stdout.includes('[shutdown] HTTP server closed gracefully')) {
      throw new Error(`Graceful shutdown log was not found. stdout=${stdout}; stderr=${stderr}`)
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          readyBeforeShutdown: true,
          trigger: 'IPC_SHUTDOWN',
          exitCode: result.code,
          gracefulLog: true,
        },
        null,
        2,
      ),
    )
  } finally {
    if (!server.killed) {
      server.kill('SIGKILL')
    }

    await fs.rm(DATABASE_PATH, { force: true })
    await fs.rm(UPLOAD_DIR, { recursive: true, force: true })
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
