import { spawn } from 'node:child_process'

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'

function runProcess(label, args) {
  const child = spawn(npmCommand, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
  })

  child.on('exit', (code, signal) => {
    if (signal) {
      console.log(`[${label}] stopped by signal ${signal}`)
      return
    }

    if (code && code !== 0) {
      console.log(`[${label}] exited with code ${code}`)
    }
  })

  return child
}

const children = [
  runProcess('backend', ['--prefix', 'backend', 'run', 'dev']),
  runProcess('web', ['--prefix', 'web', 'run', 'dev']),
]

function shutdown(signal) {
  for (const child of children) {
    if (!child.killed) {
      child.kill(signal)
    }
  }
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

console.log('Starting local development stack...')
console.log('Backend: http://localhost:3001')
console.log('Web: http://localhost:3002')
