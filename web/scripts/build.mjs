import { spawnSync } from 'node:child_process'
import process from 'node:process'

const args = ['next', 'build']

if (process.env.ANALYZE === 'true') {
  args.push('--webpack')
}

const result = spawnSync('npx', args, {
  cwd: process.cwd(),
  env: process.env,
  shell: process.platform === 'win32',
  stdio: 'inherit',
})

process.exit(result.status ?? 1)
