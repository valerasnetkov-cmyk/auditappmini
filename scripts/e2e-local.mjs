import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import net from 'node:net'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BACKEND_DIR = path.join(ROOT_DIR, 'backend')
const WEB_DIR = path.join(ROOT_DIR, 'web')
const NEXT_CLI = path.join(WEB_DIR, 'node_modules', 'next', 'dist', 'bin', 'next')
const PLAYWRIGHT_CLI = path.join(WEB_DIR, 'node_modules', '@playwright', 'test', 'cli.js')

const RUN_ID = `${Date.now()}-${process.pid}`
const TMP_DIR = path.join(ROOT_DIR, '.tmp-e2e', RUN_ID)
const DATABASE_PATH = path.join(TMP_DIR, 'database.sqlite')
const UPLOAD_DIR = path.join(TMP_DIR, 'uploads')

function formatArgs(args) {
  return args.map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg)).join(' ')
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      server.close(() => {
        if (!address || typeof address === 'string') {
          reject(new Error('Could not resolve an available local port'))
          return
        }

        resolve(address.port)
      })
    })
  })
}

function pipeOutput(label, child) {
  child.stdout?.on('data', (chunk) => {
    process.stdout.write(`[${label}] ${chunk}`)
  })

  child.stderr?.on('data', (chunk) => {
    process.stderr.write(`[${label}] ${chunk}`)
  })
}

function spawnNode(label, args, options = {}) {
  const child = spawn(process.execPath, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  })

  pipeOutput(label, child)
  return child
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 2500) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

async function waitForHttp(label, url, options = {}, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs
  let lastError = ''

  while (Date.now() < deadline) {
    try {
      const response = await fetchWithTimeout(url, options)
      if (response.status < 500) return response
      lastError = `${response.status} ${await response.text()}`
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }

    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  throw new Error(`${label} did not become ready within ${timeoutMs}ms. Last error: ${lastError}`)
}

function runCommand(label, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnNode(label, args, options)

    child.on('error', reject)
    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`${label} stopped by signal ${signal}`))
        return
      }

      if (code !== 0) {
        reject(new Error(`${label} exited with code ${code}`))
        return
      }

      resolve()
    })
  })
}

function killProcessTree(child) {
  if (!child?.pid || child.killed) return Promise.resolve()

  if (process.platform === 'win32') {
    return new Promise((resolve) => {
      const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
      })
      killer.on('exit', resolve)
      killer.on('error', resolve)
    })
  }

  child.kill('SIGTERM')
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (!child.killed) child.kill('SIGKILL')
      resolve()
    }, 3000)
    child.on('exit', () => {
      clearTimeout(timeout)
      resolve()
    })
  })
}

async function cleanup(children) {
  await Promise.all(children.map((child) => killProcessTree(child)))

  if (process.env.E2E_KEEP_TMP === '1') {
    console.log(`[e2e] Temporary data preserved: ${TMP_DIR}`)
    return
  }

  await fs.rm(TMP_DIR, { recursive: true, force: true })
}

async function ensureCliExists(label, filePath) {
  try {
    await fs.access(filePath)
  } catch {
    throw new Error(`${label} CLI not found at ${filePath}. Run npm install in the project first.`)
  }
}

async function main() {
  await ensureCliExists('Next.js', NEXT_CLI)
  await ensureCliExists('Playwright', PLAYWRIGHT_CLI)
  await fs.mkdir(UPLOAD_DIR, { recursive: true })

  const backendPort = await getFreePort()
  const webPort = await getFreePort()
  const backendBaseUrl = `http://127.0.0.1:${backendPort}`
  const webBaseUrl = `http://127.0.0.1:${webPort}`
  const children = []

  console.log('[e2e] Starting isolated launch E2E stack')
  console.log(`[e2e] Backend: ${backendBaseUrl}`)
  console.log(`[e2e] Web:     ${webBaseUrl}`)
  console.log(`[e2e] DB:      ${DATABASE_PATH}`)

  try {
    const backend = spawnNode('backend', ['src/server.js'], {
      cwd: BACKEND_DIR,
      env: {
        ...process.env,
        PORT: String(backendPort),
        CORS_ORIGINS: webBaseUrl,
        DATABASE_PATH,
        UPLOAD_DIR,
      },
    })
    children.push(backend)

    await waitForHttp('Backend', `${backendBaseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: process.env.E2E_ADMIN_EMAIL || 'admin@example.com',
        password: process.env.E2E_ADMIN_PASSWORD || 'admin123',
      }),
    })

    const web = spawnNode('web', [NEXT_CLI, 'dev', '-H', '127.0.0.1', '-p', String(webPort)], {
      cwd: WEB_DIR,
      env: {
        ...process.env,
        BASE_URL: webBaseUrl,
        BACKEND_API_BASE: backendBaseUrl,
        NEXT_PUBLIC_API_URL: `${backendBaseUrl}/api`,
      },
    })
    children.push(web)

    await waitForHttp('Web', `${webBaseUrl}/login`)

    const passthroughArgs = process.argv.slice(2)
    const playwrightArgs = [PLAYWRIGHT_CLI, 'test', '--project=Chromium', ...passthroughArgs]
    console.log(`[e2e] Running: node ${formatArgs(playwrightArgs)}`)

    await runCommand('playwright', playwrightArgs, {
      cwd: WEB_DIR,
      env: {
        ...process.env,
        BASE_URL: webBaseUrl,
        BACKEND_API_BASE: backendBaseUrl,
        NEXT_PUBLIC_API_URL: `${backendBaseUrl}/api`,
      },
    })

    console.log('[e2e] Chromium launch E2E passed')
  } finally {
    await cleanup(children)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
