import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import PDFDocument from 'pdfkit'
import QRCode from 'qrcode'
import sharp from 'sharp'
import { v4 as uuidv4 } from 'uuid'
import {
  generateWatermarkedPhoto,
  resolveUploadPath,
  uploadsDir,
} from './photoUpload.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const regularFontPath = path.resolve(__dirname, '../../node_modules/dejavu-fonts-ttf/ttf/DejaVuSans.ttf')
const boldFontPath = path.resolve(__dirname, '../../node_modules/dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf')

function formatDate(value) {
  if (!value) return 'не указано'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('ru-RU')
}

function photoCoordinates(photo) {
  if (photo.captured_lat !== null && photo.captured_lat !== undefined
    && photo.captured_lng !== null && photo.captured_lng !== undefined) {
    return `${photo.captured_lat}, ${photo.captured_lng}`
  }
  return String(photo.geo || '').trim() || 'недоступны'
}

function ensurePageSpace(doc, requiredHeight = 180) {
  if (doc.y + requiredHeight > doc.page.height - 60) doc.addPage()
}

function writeHeading(doc, text) {
  ensurePageSpace(doc, 70)
  doc.moveDown(0.6).font('Bold').fontSize(16).fillColor('#17324d').text(text)
  doc.moveDown(0.35).font('Regular').fontSize(10).fillColor('#222222')
}

function writeRow(doc, label, value) {
  ensurePageSpace(doc, 30)
  doc.font('Bold').text(`${label}: `, { continued: true })
  doc.font('Regular').text(value === null || value === undefined || value === '' ? 'не указано' : String(value))
}

export async function hashFile(filePath) {
  const hash = crypto.createHash('sha256')
  const input = fs.createReadStream(filePath)
  for await (const chunk of input) hash.update(chunk)
  return hash.digest('hex')
}

export function createInspectionReportService({ db, PHOTO_SELECT_COLUMNS }) {
  const generationLocks = new Map()

  function getReportData(inspectionId, companyId) {
    const inspection = db.prepare(`
      SELECT i.*, v.number AS vehicle_number, v.name AS vehicle_name, v.region AS vehicle_region,
             v.status AS vehicle_status, u.name AS inspector_name, c.name AS company_name
      FROM inspections i
      JOIN vehicles v ON v.id = i.vehicle_id
      JOIN users u ON u.id = i.inspector_id
      JOIN companies c ON c.id = i.company_id
      WHERE i.id = ? AND i.company_id = ?
    `).get(inspectionId, companyId)
    if (!inspection) return null

    const photos = db.prepare(`
      SELECT ${PHOTO_SELECT_COLUMNS}
      FROM photos
      WHERE inspection_id = ? AND company_id = ? AND defect_id IS NULL
      ORDER BY created_at ASC
    `).all(inspectionId, companyId)
    const checklist = db.prepare(`
      SELECT id, title, result, comment
      FROM checklist_items
      WHERE inspection_id = ?
      ORDER BY rowid ASC
    `).all(inspectionId)
    const defects = db.prepare(`
      SELECT *
      FROM defects
      WHERE inspection_id = ? AND company_id = ?
      ORDER BY created_at ASC
    `).all(inspectionId, companyId).map((defect) => ({
      ...defect,
      photos: db.prepare(`
        SELECT ${PHOTO_SELECT_COLUMNS}
        FROM photos
        WHERE defect_id = ? AND company_id = ?
        ORDER BY created_at ASC
      `).all(defect.id, companyId),
    }))

    return { inspection, photos, checklist, defects }
  }

  async function ensureWatermark(photo, inspection) {
    if (photo.watermark_url) {
      const resolved = resolveUploadPath(photo.watermark_url.replace(/^\/uploads\//, ''))
      if (resolved && fs.existsSync(resolved.filePath)) return photo.watermark_url
    }

    const watermarkUrl = await generateWatermarkedPhoto({
      photo,
      lines: [
        'auditavto.ru',
        `Компания: ${inspection.company_name}`,
        `Техника: ${inspection.vehicle_number}`,
        `Осмотр: ${inspection.id}`,
        `Тип: ${inspection.type}`,
        `Дата/время: ${formatDate(photo.captured_at || photo.created_at)}`,
        `Координаты: ${photoCoordinates(photo)}`,
      ],
    })
    const generatedAt = new Date().toISOString()
    db.prepare(`
      UPDATE photos
      SET watermark_url = ?, watermark_generated_at = ?
      WHERE id = ? AND company_id = ?
    `).run(watermarkUrl, generatedAt, photo.id, inspection.company_id)
    photo.watermark_url = watermarkUrl
    photo.watermark_generated_at = generatedAt
    return watermarkUrl
  }

  async function writePhoto(doc, photo, inspection, label) {
    const watermarkUrl = await ensureWatermark(photo, inspection)
    const resolved = resolveUploadPath(watermarkUrl.replace(/^\/uploads\//, ''))
    if (!resolved || !fs.existsSync(resolved.filePath)) return
    ensurePageSpace(doc, 260)
    doc.font('Bold').fontSize(10).text(label)
    const printableImage = await sharp(resolved.filePath).png().toBuffer()
    doc.image(printableImage, { fit: [480, 220], align: 'center' })
    doc.moveDown(0.4)
  }

  async function generateReportFile(inspectionId, companyId) {
    const data = getReportData(inspectionId, companyId)
    if (!data) return null

    const reportId = db.prepare(`
      SELECT id
      FROM inspection_reports
      WHERE company_id = ? AND inspection_id = ?
    `).get(companyId, inspectionId)?.id || uuidv4()
    const reportDir = path.join(uploadsDir, 'reports', companyId, inspectionId)
    const reportPath = path.join(reportDir, 'report.pdf')
    const temporaryReportPath = path.join(reportDir, `report-${uuidv4()}.tmp`)
    await fs.promises.mkdir(reportDir, { recursive: true })

    db.prepare(`
      INSERT INTO inspection_reports (
        id, company_id, inspection_id, status, integrity_status, created_at, updated_at
      ) VALUES (?, ?, ?, 'generating', 'unverified', datetime('now'), datetime('now'))
      ON CONFLICT(company_id, inspection_id) DO UPDATE SET
        status = 'generating',
        integrity_status = 'unverified',
        verified_at = NULL,
        updated_at = datetime('now')
    `).run(reportId, companyId, inspectionId)

    const verificationUrl = `${String(process.env.WEB_URL || 'http://localhost:3002').replace(/\/+$/, '')}/inspections/${inspectionId}/report`
    const qrBuffer = await QRCode.toBuffer(verificationUrl, { type: 'png', width: 220, margin: 1 })
    const doc = new PDFDocument({ size: 'A4', margin: 48, autoFirstPage: true })
    doc.registerFont('Regular', regularFontPath)
    doc.registerFont('Bold', boldFontPath)
    const output = fs.createWriteStream(temporaryReportPath, { flags: 'wx' })
    const completed = new Promise((resolve, reject) => {
      output.on('finish', resolve)
      output.on('error', reject)
      doc.on('error', reject)
    })
    doc.pipe(output)

    try {
    const { inspection, photos, checklist, defects } = data
    doc.font('Bold').fontSize(24).fillColor('#17324d').text('Акт осмотра техники')
    doc.moveDown(0.5).font('Regular').fontSize(12).fillColor('#222222')
    writeRow(doc, 'Компания', inspection.company_name)
    writeRow(doc, 'Номер отчёта', reportId)
    writeRow(doc, 'Тип осмотра', inspection.type)
    writeRow(doc, 'Статус', inspection.completed ? 'завершён' : 'черновик')
    writeRow(doc, 'Дата завершения', formatDate(inspection.completed_at))
    writeRow(doc, 'Согласование', inspection.approval_status || 'draft')
    writeRow(doc, 'Дата решения', formatDate(inspection.reviewed_at))
    if (inspection.approval_comment) writeRow(doc, 'Комментарий руководителя', inspection.approval_comment)

    writeHeading(doc, 'Техника')
    writeRow(doc, 'Госномер', inspection.vehicle_number)
    writeRow(doc, 'Название', inspection.vehicle_name)
    writeRow(doc, 'Регион', inspection.vehicle_region)
    writeRow(doc, 'Статус техники', inspection.vehicle_status)
    writeRow(doc, 'Пробег', inspection.odometer_value === null || inspection.odometer_value === undefined
      ? 'недоступен'
      : `${inspection.odometer_value} ${inspection.odometer_unit || 'km'}`)

    writeHeading(doc, 'Осмотр')
    writeRow(doc, 'Инспектор', inspection.inspector_name)
    writeRow(doc, 'Создан', formatDate(inspection.created_at))
    writeRow(doc, 'Место ДТП', inspection.accident_location)
    writeRow(doc, 'Время ДТП', formatDate(inspection.accident_occurred_at))

    writeHeading(doc, 'Обязательные фото')
    for (const photo of photos) {
      await writePhoto(doc, photo, inspection, photo.photo_type || 'Фото осмотра')
    }

    writeHeading(doc, 'Чек-лист')
    checklist.forEach((item) => {
      writeRow(doc, item.title, item.result === null ? 'не заполнено' : Number(item.result) === 1 ? 'Да' : 'Нет')
      if (item.comment) doc.font('Regular').fontSize(9).fillColor('#555555').text(`Комментарий: ${item.comment}`)
    })

    writeHeading(doc, 'Дефекты')
    if (defects.length === 0) doc.text('Дефекты не зафиксированы')
    for (const defect of defects) {
      writeRow(doc, defect.title, `${defect.status || 'open'}${defect.comment ? ` — ${defect.comment}` : ''}`)
      for (const photo of defect.photos) {
        await writePhoto(doc, photo, inspection, `Фото дефекта: ${defect.title}`)
      }
    }

    writeHeading(doc, 'Проверка отчёта')
    doc.image(qrBuffer, { fit: [130, 130] })
    doc.font('Regular').fontSize(8).fillColor('#555555').text(verificationUrl)
    doc.end()
    await completed

    const [sha256, fileStats] = await Promise.all([
      hashFile(temporaryReportPath),
      fs.promises.stat(temporaryReportPath),
    ])
    await fs.promises.rename(temporaryReportPath, reportPath)

    const generatedAt = new Date().toISOString()
    const pdfUrl = `/api/inspections/${inspectionId}/report.pdf`
    db.prepare(`
      UPDATE inspection_reports
      SET pdf_url = ?, sha256 = ?, file_size = ?, status = 'ready',
          integrity_status = 'valid', verified_at = ?, generated_at = ?, updated_at = ?
      WHERE id = ?
    `).run(pdfUrl, sha256, fileStats.size, generatedAt, generatedAt, generatedAt, reportId)

    return db.prepare('SELECT * FROM inspection_reports WHERE id = ?').get(reportId)
    } finally {
      await fs.promises.rm(temporaryReportPath, { force: true })
    }
  }

  function generateReport(inspectionId, companyId) {
    const lockKey = `${companyId}:${inspectionId}`
    const previous = generationLocks.get(lockKey) || Promise.resolve()
    const current = previous
      .catch(() => {})
      .then(() => generateReportFile(inspectionId, companyId))
      .finally(() => {
        if (generationLocks.get(lockKey) === current) generationLocks.delete(lockKey)
      })
    generationLocks.set(lockKey, current)
    return current
  }

  function getReport(inspectionId, companyId) {
    return db.prepare(`
      SELECT *
      FROM inspection_reports
      WHERE inspection_id = ? AND company_id = ?
    `).get(inspectionId, companyId) || null
  }

  function getReportPath(inspectionId, companyId) {
    return path.join(uploadsDir, 'reports', companyId, inspectionId, 'report.pdf')
  }

  async function verifyReport(inspectionId, companyId) {
    const report = getReport(inspectionId, companyId)
    if (!report) return null

    const reportPath = getReportPath(inspectionId, companyId)
    const verifiedAt = new Date().toISOString()
    let integrityStatus = 'missing'
    let actualSha256 = null
    let actualFileSize = null

    try {
      const [sha256, fileStats] = await Promise.all([
        hashFile(reportPath),
        fs.promises.stat(reportPath),
      ])
      actualSha256 = sha256
      actualFileSize = fileStats.size
      integrityStatus = report.sha256 === sha256
        && (report.file_size === null || report.file_size === undefined || Number(report.file_size) === fileStats.size)
        ? 'valid'
        : 'mismatch'
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }

    const status = integrityStatus === 'valid' ? 'ready' : 'corrupted'
    db.prepare(`
      UPDATE inspection_reports
      SET status = ?, integrity_status = ?, verified_at = ?, updated_at = ?
      WHERE id = ?
    `).run(status, integrityStatus, verifiedAt, verifiedAt, report.id)

    return {
      ...getReport(inspectionId, companyId),
      actual_sha256: actualSha256,
      actual_file_size: actualFileSize,
    }
  }

  function markFailed(inspectionId, companyId) {
    db.prepare(`
      UPDATE inspection_reports
      SET status = 'failed', updated_at = ?
      WHERE inspection_id = ? AND company_id = ?
    `).run(new Date().toISOString(), inspectionId, companyId)
  }

  return { generateReport, getReport, getReportPath, verifyReport, markFailed }
}
