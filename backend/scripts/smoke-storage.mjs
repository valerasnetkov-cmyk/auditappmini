import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createLocalStorage } from '../src/services/storage.js'

const tmpRoot = path.join(process.cwd(), '.tmp-smoke', `smoke-storage-${process.pid}`)
const storage = createLocalStorage({ rootDir: tmpRoot })

try {
  const key = 'companies/default/storage-smoke/sample.txt'
  const content = Buffer.from('storage-smoke')
  const hash = crypto.createHash('sha256').update(content).digest('hex')

  await storage.save(key, content, { contentType: 'text/plain' })
  const read = await storage.read(key)
  const verified = await storage.verify(key, hash, content.length)
  const traversalPath = storage.getPrivatePath('../escape.txt')
  const signedUrl = storage.getSignedUrl(key)

  if (read.toString('utf8') !== content.toString('utf8')) {
    throw new Error('Storage read did not return saved content')
  }

  if (!verified.ok || verified.status !== 'valid' || verified.sha256 !== hash) {
    throw new Error(`Storage verify failed: ${JSON.stringify(verified)}`)
  }

  if (traversalPath !== null) {
    throw new Error('Storage accepted traversal key')
  }

  if (signedUrl !== `/uploads/${key}`) {
    throw new Error(`Unexpected signed/local URL: ${signedUrl}`)
  }

  await storage.delete(key)
  if (await storage.exists(key)) {
    throw new Error('Storage delete did not remove object')
  }

  console.log(JSON.stringify({
    ok: true,
    driver: storage.driver,
    key,
    signedUrl,
    verified: verified.status,
    traversalRejected: true,
  }, null, 2))
} finally {
  await fs.rm(tmpRoot, { recursive: true, force: true })
}
