import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { hashFile } from '../../src/services/inspectionReports.js'

test('hashFile returns the SHA-256 of the complete report file', async () => {
  const directory = path.resolve('.tmp-smoke')
  const filePath = path.join(directory, `report-hash-${process.pid}.pdf`)
  const contents = Buffer.from('auditavto report integrity test')

  await fs.mkdir(directory, { recursive: true })
  try {
    await fs.writeFile(filePath, contents)
    const expected = crypto.createHash('sha256').update(contents).digest('hex')
    assert.equal(await hashFile(filePath), expected)
  } finally {
    await fs.rm(filePath, { force: true })
  }
})
