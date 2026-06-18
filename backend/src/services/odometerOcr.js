import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import sharp from 'sharp'
import {
  OCR_ODOMETER_PROVIDER,
  TESSERACT_CMD,
  TESSERACT_TIMEOUT_MS,
  MAX_IMAGE_PIXELS,
} from '../config.js'

const execFileAsync = promisify(execFile)
const DIGIT_PATTERN = /-?\d[\d\s.,-]{1,14}\d|-?\d/g

export class OcrProviderUnavailableError extends Error {
  constructor(message = 'OCR provider is unavailable') {
    super(message)
    this.name = 'OcrProviderUnavailableError'
    this.code = 'ocr_provider_unavailable'
  }
}

export class OcrFailedError extends Error {
  constructor(message = 'OCR failed') {
    super(message)
    this.name = 'OcrFailedError'
    this.code = 'ocr_failed'
  }
}

export function normalizeOdometerCandidate(value) {
  const input = String(value || '').trim()
  if (input.startsWith('-')) return null

  const digits = input.replace(/\D/g, '')
  if (!digits) return null

  const normalized = Number(digits)
  if (!Number.isSafeInteger(normalized) || normalized < 0) return null

  return normalized
}

export function parseOdometerCandidates(rawText) {
  const seen = new Set()
  return Array.from(String(rawText || '').matchAll(DIGIT_PATTERN))
    .map((match) => normalizeOdometerCandidate(match[0]))
    .filter((value) => {
      if (value === null || seen.has(value)) return false
      seen.add(value)
      return true
    })
}

export function parseTesseractTsv(tsvOutput) {
  const rows = String(tsvOutput || '').trim().split(/\r?\n/)
  if (rows.length <= 1) {
    return { rawText: '', confidence: 0 }
  }

  const words = []
  const confidences = []

  for (const row of rows.slice(1)) {
    const columns = row.split('\t')
    const confidence = Number(columns[10])
    const text = (columns.slice(11).join('\t') || '').trim()
    if (!text) continue

    words.push(text)
    if (Number.isFinite(confidence) && confidence >= 0) {
      confidences.push(confidence)
    }
  }

  const averageConfidence = confidences.length
    ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
    : 0

  return {
    rawText: words.join(' '),
    confidence: Math.max(0, Math.min(1, averageConfidence / 100)),
  }
}

async function createPreprocessedImage(sourcePath) {
  const targetPath = path.join(os.tmpdir(), `auditmini-odometer-ocr-${Date.now()}-${Math.random().toString(36).slice(2)}.png`)
  await sharp(sourcePath, {
    failOn: 'error',
    limitInputPixels: MAX_IMAGE_PIXELS,
  })
    .rotate()
    .grayscale()
    .normalize()
    .threshold(150)
    .resize({ width: 1800, height: 900, fit: 'inside', withoutEnlargement: false })
    .png()
    .toFile(targetPath)
  return targetPath
}

async function recognizeWithTesseractCli({ filePath }) {
  let preprocessedPath = null

  try {
    preprocessedPath = await createPreprocessedImage(filePath)
    const { stdout } = await execFileAsync(
      TESSERACT_CMD,
      [
        preprocessedPath,
        'stdout',
        '-l',
        'eng',
        '--oem',
        '1',
        '--psm',
        '7',
        '-c',
        'tessedit_char_whitelist=0123456789',
        'tsv',
      ],
      {
        timeout: TESSERACT_TIMEOUT_MS,
        windowsHide: true,
        maxBuffer: 1024 * 1024,
      },
    )

    const parsed = parseTesseractTsv(stdout)
    const candidates = parseOdometerCandidates(parsed.rawText)
    const normalizedValue = candidates[0] ?? null

    return {
      provider: 'tesseract-cli',
      rawText: parsed.rawText,
      normalizedValue,
      confidence: normalizedValue === null ? 0 : parsed.confidence,
      candidates,
    }
  } catch (err) {
    if (err?.code === 'ENOENT') {
      throw new OcrProviderUnavailableError(`Tesseract command not found: ${TESSERACT_CMD}`)
    }
    throw new OcrFailedError(err instanceof Error ? err.message : 'Tesseract OCR failed')
  } finally {
    if (preprocessedPath) {
      await fs.rm(preprocessedPath, { force: true }).catch(() => {})
    }
  }
}

async function recognizeWithMock() {
  return {
    provider: 'mock',
    rawText: '',
    normalizedValue: null,
    confidence: 0,
    candidates: [],
  }
}

export async function recognizeOdometerPhoto({ filePath }) {
  if (OCR_ODOMETER_PROVIDER === 'mock') {
    return recognizeWithMock()
  }

  if (OCR_ODOMETER_PROVIDER === 'tesseract-cli') {
    return recognizeWithTesseractCli({ filePath })
  }

  throw new OcrProviderUnavailableError(`Unsupported OCR_ODOMETER_PROVIDER: ${OCR_ODOMETER_PROVIDER}`)
}
