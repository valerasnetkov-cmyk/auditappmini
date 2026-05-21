import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const MOBILE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const EXPO_DOCTOR_CLI = path.join(MOBILE_DIR, 'node_modules', 'expo-doctor', 'build', 'index.js')

const child = spawn(process.execPath, [EXPO_DOCTOR_CLI, ...process.argv.slice(2)], {
  cwd: MOBILE_DIR,
  stdio: 'inherit',
  env: {
    ...process.env,
    // Launch verification must stay deterministic when Expo API / React Native
    // Directory are temporarily unreachable. Keep strict validation available via
    // `npm run doctor:online`.
    EXPO_DOCTOR_WARN_ON_NETWORK_ERRORS: process.env.EXPO_DOCTOR_WARN_ON_NETWORK_ERRORS || '1',
    EXPO_DOCTOR_ENABLE_DIRECTORY_CHECK: process.env.EXPO_DOCTOR_ENABLE_DIRECTORY_CHECK || '0',
  },
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 1)
})

child.on('error', (error) => {
  console.error(error)
  process.exit(1)
})
