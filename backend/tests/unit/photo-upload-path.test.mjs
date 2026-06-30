import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test, { after } from 'node:test'
import sharp from 'sharp'

const uploadRoot = path.join(os.tmpdir(), `audit-photo-upload-${process.pid}-${Date.now()}`)
process.env.UPLOAD_DIR = uploadRoot

const { processUploadedPhoto } = await import(`../../src/services/photoUpload.js?upload-path-test=${Date.now()}`)

after(async () => {
  await fs.rm(uploadRoot, { recursive: true, force: true })
})

test('processUploadedPhoto stores processed files under the company segment', async () => {
  const tempDir = path.join(uploadRoot, 'tmp')
  const tempPath = path.join(tempDir, 'input.png')
  await fs.mkdir(tempDir, { recursive: true })
  await sharp({
    create: {
      width: 8,
      height: 8,
      channels: 3,
      background: '#f97316',
    },
  }).png().toFile(tempPath)

  const processed = await processUploadedPhoto({
    tempPath,
    originalName: 'input.png',
    mimetype: 'image/png',
    companyId: 'company-1',
    inspectionId: 'inspection-1',
    photoId: 'photo-1',
  })

  assert.equal(
    processed.url,
    '/uploads/companies/company-1/inspections/inspection-1/photos/photo-1/main.webp',
  )
  assert.equal(
    processed.original_url,
    '/uploads/companies/company-1/inspections/inspection-1/photos/photo-1/original.png',
  )
  assert.equal(
    processed.thumb_url,
    '/uploads/companies/company-1/inspections/inspection-1/photos/photo-1/thumb.webp',
  )

  await fs.access(path.join(uploadRoot, 'companies', 'company-1', 'inspections', 'inspection-1', 'photos', 'photo-1', 'main.webp'))
  await fs.access(path.join(uploadRoot, 'companies', 'company-1', 'inspections', 'inspection-1', 'photos', 'photo-1', 'original.png'))
  await fs.access(path.join(uploadRoot, 'companies', 'company-1', 'inspections', 'inspection-1', 'photos', 'photo-1', 'thumb.webp'))
})
