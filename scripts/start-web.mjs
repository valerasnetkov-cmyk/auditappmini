import http from 'node:http'
import net from 'node:net'
import path from 'node:path'
import process from 'node:process'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const webRoot = path.join(projectRoot, 'web')
const nextBin = path.join(webRoot, 'node_modules', 'next', 'dist', 'bin', 'next')
const port = 3002

function ping(url) {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.resume()
      resolve({ ok: true, status: response.statusCode || 0 })
    })

    request.on('error', () => resolve({ ok: false, status: 0 }))
    request.setTimeout(1500, () => {
      request.destroy()
      resolve({ ok: false, status: 0 })
    })
  })
}

function isPortBusy(targetPort) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port: targetPort })

    socket.on('connect', () => {
      socket.destroy()
      resolve(true)
    })

    socket.on('error', () => resolve(false))
    socket.setTimeout(1500, () => {
      socket.destroy()
      resolve(false)
    })
  })
}

const existing = await ping(`http://127.0.0.1:${port}`)

if (existing.ok) {
  console.log(`Web already running on http://localhost:${port}`)
  process.exit(0)
}

const busy = await isPortBusy(port)
if (busy) {
  console.log(`Port ${port} is already in use. Open http://localhost:${port} or free the port before restarting web.`)
  process.exit(0)
}

const child = spawn(process.execPath, [nextBin, 'start', '-p', String(port)], {
  cwd: webRoot,
  stdio: 'inherit',
  env: process.env,
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 0)
})
