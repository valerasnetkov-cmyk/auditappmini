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
import {
  LICENSE_PLATE_ALLOWED_CYRILLIC,
  LICENSE_PLATE_LATIN_TO_CYRILLIC,
  repairMojibakeRussian,
  isValidRussianLicensePlate,
} from '../utils/transliteration.js'
import {
  OcrFailedError,
  OcrProviderUnavailableError,
  parseTesseractTsv,
} from './odometerOcr.js'

const execFileAsync = promisify(execFile)

function normalizeOcrText(value) {
  return repairMojibakeRussian(value)
    .toUpperCase()
    .replace(/\s+/g, '')
    .split('')
    .map((symbol) => LICENSE_PLATE_LATIN_TO_CYRILLIC[symbol] ?? symbol)
    .filter((symbol) => /\d/.test(symbol) || LICENSE_PLATE_ALLOWED_CYRILLIC.includes(symbol))
    .join('')
}

export function parseVehicleNumberCandidates(rawText) {
  const normalized = normalizeOcrText(rawText)
  const seen = new Set()
  const candidates = []

  for (let start = 0; start < normalized.length; start += 1) {
    for (const length of [8, 9]) {
      const candidate = normalized.slice(start, start + length)
      if (candidate.length !== length || seen.has(candidate) || !isValidRussianLicensePlate(candidate)) continue
      seen.add(candidate)
      candidates.push(candidate)
    }
  }

  return candidates
}

async function createPreprocessedImage(sourcePath) {
  const targetPath = path.join(os.tmpdir(), `auditmini-plate-ocr-${Date.now()}-${Math.random().toString(36).slice(2)}.png`)
  await sharp(sourcePath, {
    failOn: 'error',
    limitInputPixels: MAX_IMAGE_PIXELS,
  })
    .rotate()
    .grayscale()
    .normalize()
    .resize({ width: 1600, height: 700, fit: 'inside', withoutEnlargement: false })
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
        'tessedit_char_whitelist=0123456789ABEKMHOPCTYXabekmhopctyx',
        'tsv',
      ],
      {
        timeout: TESSERACT_TIMEOUT_MS,
        windowsHide: true,
        maxBuffer: 1024 * 1024,
      },
    )

    const parsed = parseTesseractTsv(stdout)
    const candidates = parseVehicleNumberCandidates(parsed.rawText)
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

export async function recognizeVehicleNumberPhoto({ filePath }) {
  if (OCR_ODOMETER_PROVIDER === 'mock') {
    return recognizeWithMock()
  }

  if (OCR_ODOMETER_PROVIDER === 'tesseract-cli') {
    return recognizeWithTesseractCli({ filePath })
  }

  throw new OcrProviderUnavailableError(`Unsupported OCR_ODOMETER_PROVIDER: ${OCR_ODOMETER_PROVIDER}`)
}
