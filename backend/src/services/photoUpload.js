import crypto from 'crypto'
import fs from 'fs'
import multer from 'multer'
import path from 'path'
import sharp from 'sharp'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'
import { MAX_FILE_SIZE, MAX_IMAGE_PIXELS } from '../config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const uploadsDir = process.env.UPLOAD_DIR
  ? path.resolve(process.cwd(), process.env.UPLOAD_DIR)
  : path.join(__dirname, '../../uploads')

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

const ALLOWED_UPLOAD_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const UPLOAD_MIME_FORMATS = new Map([
  ['image/jpeg', new Set(['jpeg'])],
  ['image/png', new Set(['png'])],
  ['image/webp', new Set(['webp'])],
])

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`
    cb(null, uniqueName)
  },
})

export const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_UPLOAD_MIME_TYPES.has(file.mimetype)) {
      cb(null, true)
      return
    }

    cb(new Error('Only image uploads are allowed'))
  },
})

export function uploadPhoto(req, res, next) {
  upload.single('photo')(req, res, (err) => {
    if (!err) {
      next()
      return
    }

    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: `Photo exceeds ${MAX_FILE_SIZE} bytes` })
    }

    return res.status(400).json({ error: 'Only JPG, PNG and WebP uploads are allowed' })
  })
}

export function isUploadMiddlewareError(err) {
  return err instanceof multer.MulterError
}

export function getMimeType(filename) {
  const ext = filename.toLowerCase().split('.').pop()
  const types = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' }
  return types[ext] || 'application/octet-stream'
}

function mimeToExtension(mimetype) {
  if (mimetype === 'image/jpeg') return 'jpg'
  if (mimetype === 'image/png') return 'png'
  if (mimetype === 'image/webp') return 'webp'
  return null
}

function createSharpImage(buffer) {
  return sharp(buffer, {
    failOn: 'error',
    limitInputPixels: MAX_IMAGE_PIXELS,
  })
}

function assertUploadedPhotoFormat(metadata, mimetype) {
  const detectedFormat = String(metadata?.format || '').toLowerCase()
  const allowedFormats = UPLOAD_MIME_FORMATS.get(mimetype)

  if (!allowedFormats?.has(detectedFormat)) {
    throw new Error('Photo content does not match the declared image format')
  }
}

function normalizeStorageSegment(value) {
  return String(value || 'unknown').replace(/[^a-zA-Z0-9_.-]/g, '_') || 'unknown'
}

export function buildUploadUrl(relativePath) {
  return `/uploads/${relativePath.replace(/\\/g, '/')}`
}

export function resolveUploadPath(relativePath) {
  const input = String(relativePath || '').replace(/\\/g, '/')
  if (!input || input.includes('\0')) return null

  const normalized = path.normalize(input).replace(/\\/g, '/')
  if (!normalized || normalized === '.' || normalized.startsWith('..') || path.isAbsolute(normalized)) return null

  const uploadsRoot = path.resolve(uploadsDir)
  const filePath = path.resolve(uploadsRoot, normalized)
  if (filePath !== uploadsRoot && !filePath.startsWith(`${uploadsRoot}${path.sep}`)) return null

  return { relativePath: normalized, filePath }
}

export async function removeFileIfExists(filePath) {
  if (!filePath) return
  try {
    await fs.promises.unlink(filePath)
  } catch (err) {
    if (err?.code !== 'ENOENT') {
      console.warn(`[uploads] Failed to remove file ${filePath}:`, err.message)
    }
  }
}

export async function removePhotoFiles(photo) {
  const urls = new Set([photo?.url, photo?.original_url, photo?.webp_url, photo?.thumb_url].filter(Boolean))
  await Promise.all(Array.from(urls).map(async (url) => {
    if (!url.startsWith('/uploads/')) return
    const resolved = resolveUploadPath(url.slice('/uploads/'.length))
    if (resolved) await removeFileIfExists(resolved.filePath)
  }))
}

export async function removePhotoFilesForRows(photos) {
  await Promise.all((photos || []).map((photo) => removePhotoFiles(photo)))
}

export async function processUploadedPhoto({ tempPath, originalName, mimetype, inspectionId, photoId }) {
  const extension = mimeToExtension(mimetype)
  if (!extension) {
    throw new Error('Unsupported photo format')
  }

  const inspectionSegment = normalizeStorageSegment(inspectionId)
  const photoSegment = normalizeStorageSegment(photoId)
  const relativeDir = `inspections/${inspectionSegment}/photos/${photoSegment}`
  const targetDir = path.join(uploadsDir, relativeDir)
  const originalPath = path.join(targetDir, `original.${extension}`)
  const mainPath = path.join(targetDir, 'main.webp')
  const thumbPath = path.join(targetDir, 'thumb.webp')

  await fs.promises.mkdir(targetDir, { recursive: true })
  await fs.promises.rename(tempPath, originalPath)

  try {
    const originalBuffer = await fs.promises.readFile(originalPath)
    const metadata = await createSharpImage(originalBuffer).metadata()
    assertUploadedPhotoFormat(metadata, mimetype)

    await createSharpImage(originalBuffer)
      .rotate()
      .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(mainPath)

    await createSharpImage(originalBuffer)
      .rotate()
      .resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 76 })
      .toFile(thumbPath)

    const [originalStat, mainStat, thumbStat] = await Promise.all([
      fs.promises.stat(originalPath),
      fs.promises.stat(mainPath),
      fs.promises.stat(thumbPath),
    ])

    return {
      url: buildUploadUrl(`${relativeDir}/main.webp`),
      original_url: buildUploadUrl(`${relativeDir}/original.${extension}`),
      webp_url: buildUploadUrl(`${relativeDir}/main.webp`),
      thumb_url: buildUploadUrl(`${relativeDir}/thumb.webp`),
      original_mime: mimetype,
      original_name: originalName || null,
      width: Number.isFinite(metadata.width) ? metadata.width : null,
      height: Number.isFinite(metadata.height) ? metadata.height : null,
      size_original: originalStat.size,
      size_webp: mainStat.size,
      size_thumb: thumbStat.size,
      hash: crypto.createHash('sha256').update(originalBuffer).digest('hex'),
    }
  } catch (err) {
    await fs.promises.rm(targetDir, { recursive: true, force: true })
    throw err
  }
}
