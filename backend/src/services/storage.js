import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export const STORAGE_DRIVER = process.env.STORAGE_DRIVER || 'local'

function normalizeKey(key) {
  const input = String(key || '').replace(/\\/g, '/')
  if (!input || input.includes('\0')) return null

  const normalized = path.normalize(input).replace(/\\/g, '/')
  if (!normalized || normalized === '.' || normalized.startsWith('..') || path.isAbsolute(normalized)) return null

  return normalized
}

async function hashFile(filePath) {
  const hash = crypto.createHash('sha256')
  const input = fs.createReadStream(filePath)
  for await (const chunk of input) hash.update(chunk)
  return hash.digest('hex')
}

export function createLocalStorage({ rootDir }) {
  const root = path.resolve(rootDir)

  function resolveKey(key) {
    const normalized = normalizeKey(key)
    if (!normalized) return null

    const filePath = path.resolve(root, normalized)
    if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) return null

    return { key: normalized, filePath }
  }

  async function save(key, buffer, metadata = {}) {
    const resolved = resolveKey(key)
    if (!resolved) throw new Error('Invalid storage key')
    await fs.promises.mkdir(path.dirname(resolved.filePath), { recursive: true })
    await fs.promises.writeFile(resolved.filePath, buffer)
    return { key: resolved.key, size: Buffer.byteLength(buffer), metadata }
  }

  async function read(key) {
    const resolved = resolveKey(key)
    if (!resolved) throw new Error('Invalid storage key')
    return fs.promises.readFile(resolved.filePath)
  }

  async function exists(key) {
    const resolved = resolveKey(key)
    if (!resolved) return false
    try {
      await fs.promises.access(resolved.filePath)
      return true
    } catch {
      return false
    }
  }

  async function deleteObject(key) {
    const resolved = resolveKey(key)
    if (!resolved) return false
    try {
      await fs.promises.unlink(resolved.filePath)
      return true
    } catch (error) {
      if (error?.code === 'ENOENT') return false
      throw error
    }
  }

  async function verify(key, expectedHash = null, expectedSize = null) {
    const resolved = resolveKey(key)
    if (!resolved) return { ok: false, status: 'invalid_key' }

    try {
      const stat = await fs.promises.stat(resolved.filePath)
      const actualHash = expectedHash ? await hashFile(resolved.filePath) : null
      const hashOk = expectedHash ? actualHash === expectedHash : true
      const sizeOk = expectedSize === null || expectedSize === undefined ? true : Number(expectedSize) === stat.size

      return {
        ok: hashOk && sizeOk,
        status: hashOk && sizeOk ? 'valid' : 'mismatch',
        key: resolved.key,
        size: stat.size,
        sha256: actualHash,
      }
    } catch (error) {
      if (error?.code === 'ENOENT') return { ok: false, status: 'missing', key: resolved.key }
      throw error
    }
  }

  function getPrivatePath(key) {
    return resolveKey(key)?.filePath || null
  }

  function getSignedUrl(key) {
    const resolved = resolveKey(key)
    if (!resolved) return null
    return `/uploads/${resolved.key}`
  }

  return {
    driver: 'local',
    root,
    resolveKey,
    save,
    read,
    exists,
    delete: deleteObject,
    verify,
    getPrivatePath,
    getSignedUrl,
  }
}
