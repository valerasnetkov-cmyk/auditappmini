import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import {
  getPublicReportUrl,
  hashFile,
} from '../../src/services/inspectionReports.js'
import { getPublicReportTokenExpiresAt } from '../../src/utils/publicReportLinks.js'
import { buildPhotoWatermarkLines, photoCoordinates } from '../../src/utils/photoWatermark.js'

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

test('getPublicReportUrl uses localhost fallback outside production', () => {
  const url = getPublicReportUrl('token-123', { NODE_ENV: 'development' })
  assert.equal(url, 'http://localhost:3002/reports/public/token-123')
})

test('getPublicReportUrl requires a public HTTPS WEB_APP_URL in production', () => {
  assert.equal(
    getPublicReportUrl('token-123', {
      NODE_ENV: 'production',
      WEB_APP_URL: 'https://app.auditavto.ru',
    }),
    'https://app.auditavto.ru/reports/public/token-123',
  )

  assert.throws(
    () => getPublicReportUrl('token-123', { NODE_ENV: 'production' }),
    /WEB_APP_URL must be configured/,
  )
  assert.throws(
    () => getPublicReportUrl('token-123', {
      NODE_ENV: 'production',
      WEB_APP_URL: 'http://app.auditavto.ru',
    }),
    /HTTPS/,
  )
  assert.throws(
    () => getPublicReportUrl('token-123', {
      NODE_ENV: 'production',
      WEB_APP_URL: 'https://localhost:3002',
    }),
    /public hostname/,
  )
  assert.throws(
    () => getPublicReportUrl('token-123', {
      NODE_ENV: 'production',
      WEB_APP_URL: 'https://192.168.1.10',
    }),
    /public hostname/,
  )
})

test('getPublicReportTokenExpiresAt defaults to 30 days and supports indefinite links', () => {
  const now = new Date('2026-06-25T00:00:00.000Z')
  assert.equal(
    getPublicReportTokenExpiresAt(now, {}),
    '2026-07-25T00:00:00.000Z',
  )
  assert.equal(
    getPublicReportTokenExpiresAt(now, { PUBLIC_REPORT_TOKEN_TTL_DAYS: '0' }),
    null,
  )
})

test('photo watermark lines include captured coordinates with geo fallback', () => {
  assert.equal(photoCoordinates({ captured_lat: 46.959, captured_lng: 142.738 }), '46.959, 142.738')
  assert.equal(photoCoordinates({ geo: '46.95, 142.72' }), '46.95, 142.72')

  const lines = buildPhotoWatermarkLines({
    photo: {
      inspection_id: 'inspection-1',
      captured_at: '2026-06-25T00:00:00.000Z',
      captured_lat: 46.959,
      captured_lng: 142.738,
    },
    inspection: {
      type: 'quick',
      company_name: 'AuditAvto',
      vehicle_number: 'А123ВС65',
    },
  })

  assert.ok(lines.includes('Координаты: 46.959, 142.738'))
})
