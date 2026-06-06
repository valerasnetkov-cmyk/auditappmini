import crypto from 'crypto'

const randomSecrets = new Map()

const PREVIEW_LENGTH = 8

function preview(value) {
  if (typeof value !== 'string' || value.length === 0) return ''
  if (value.length <= PREVIEW_LENGTH * 2 + 3) return value
  return `${value.slice(0, PREVIEW_LENGTH)}...${value.slice(-PREVIEW_LENGTH)}`
}

function generateRandomSecret() {
  return crypto.randomBytes(48).toString('hex')
}

export function getSecret(name, { allowRandomFallback = false, minLength = 32 } = {}) {
  const fromEnv = process.env[name]
  if (fromEnv && fromEnv.length >= minLength) {
    return fromEnv
  }

  if (fromEnv && fromEnv.length > 0 && fromEnv.length < minLength) {
    throw new Error(`${name} must be at least ${minLength} characters long (got ${fromEnv.length})`)
  }

  if (allowRandomFallback) {
    let cached = randomSecrets.get(name)
    if (!cached) {
      cached = generateRandomSecret()
      randomSecrets.set(name, cached)
      console.warn(
        `[secretStore] ${name} is not set; generated an ephemeral random value for this process. ` +
        `Set ${name} in backend/.env (or process env) for stable tokens across restarts. ` +
        `Preview: ${preview(cached)}`,
      )
    }
    return cached
  }

  throw new Error(
    `${name} must be set in the environment ` +
    `(min length ${minLength} characters). ` +
    `Generate a value via: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`,
  )
}

export function resetSecretStoreForTests() {
  randomSecrets.clear()
}
