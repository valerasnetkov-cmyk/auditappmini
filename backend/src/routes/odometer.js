import fs from 'node:fs/promises'
import { normalizeVehicleNumberToCyrillic } from '../utils/transliteration.js'
import { sendInspectionCompletedError } from '../services/inspectionReadiness.js'
import {
  OcrFailedError,
  OcrProviderUnavailableError,
  recognizeOdometerPhoto,
} from '../services/odometerOcr.js'

function ocrGate(ensureOcrAvailable) {
  return (req, res, next) => {
    if (!ensureOcrAvailable) {
      next()
      return
    }

    if (ensureOcrAvailable(req, res)) {
      next()
    }
  }
}

function subscriptionGate(ensureOperationalWriteAllowed, mode = 'create') {
  return (req, res, next) => {
    if (!ensureOperationalWriteAllowed) {
      next()
      return
    }

    if (ensureOperationalWriteAllowed(req, res, { mode })) {
      next()
    }
  }
}

function sendOcrError(res, err) {
  if (err instanceof OcrProviderUnavailableError) {
    return res.status(503).json({ error: err.code, message: err.message })
  }

  if (err instanceof OcrFailedError) {
    return res.status(422).json({ error: err.code, message: err.message })
  }

  console.error('[odometer-ocr] Unexpected OCR error:', err)
  return res.status(500).json({ error: 'ocr_failed', message: 'OCR failed' })
}

async function removeUploadedRecognitionFile(file) {
  if (!file?.path) return
  await fs.rm(file.path, { force: true }).catch(() => {})
}

function getPreviousOdometerReading(db, inspection) {
  return db.prepare(`
    SELECT id, odometer_value, odometer_unit, COALESCE(completed_at, created_at) AS measured_at
    FROM inspections
    WHERE company_id = ?
      AND vehicle_id = ?
      AND id <> ?
      AND odometer_value IS NOT NULL
      AND datetime(COALESCE(completed_at, created_at)) <= datetime(COALESCE(?, ?))
    ORDER BY datetime(COALESCE(completed_at, created_at)) DESC
    LIMIT 1
  `).get(
    inspection.company_id,
    inspection.vehicle_id,
    inspection.id,
    inspection.completed_at,
    inspection.created_at,
  )
}

function validateOdometerProgression(db, inspection, nextValue) {
  const previous = getPreviousOdometerReading(db, inspection)
  if (!previous || Number(nextValue) >= Number(previous.odometer_value)) return null

  return {
    previous,
    message: `Показание одометра не может быть меньше предыдущего: ${previous.odometer_value} ${previous.odometer_unit || 'km'}`,
  }
}

// Odometer recognition routes.
// OCR suggestions are assistive only; inspector confirmation remains required.
export function registerOdometerRoutes({
  app,
  db,
  authenticate,
  API_MESSAGES,
  upload,
  ensureOcrAvailable = null,
  recordOcrUsage = null,
  ensureOperationalWriteAllowed = null,
}) {
  app.post(
    '/api/odometer/recognize',
    authenticate,
    subscriptionGate(ensureOperationalWriteAllowed, 'create'),
    ocrGate(ensureOcrAvailable),
    upload.single('photo'),
    async (req, res) => {
      if (!req.file) {
        return res.status(400).json({
          error: 'odometer_photo_required',
          message: API_MESSAGES?.odometerPhotoRequired || 'Фото одометра обязательно',
        })
      }

      try {
        const recognition = await recognizeOdometerPhoto({ filePath: req.file.path })
        recordOcrUsage?.(req.user.company_id || 'default', 'odometer')

        return res.json({
          raw_value: recognition.rawText || null,
          normalized_value: recognition.normalizedValue,
          unit: 'km',
          confidence: recognition.confidence,
          candidates: recognition.candidates,
          provider: recognition.provider,
          requires_manual_confirmation: true,
          message: API_MESSAGES?.odometerRequiresManualConfirmation || 'Требуется ручное подтверждение показаний',
          photo_url: `/uploads/${req.file.filename}`,
          recognized_at: new Date().toISOString(),
        })
      } catch (err) {
        await removeUploadedRecognitionFile(req.file)
        return sendOcrError(res, err)
      }
    },
  )

  app.post('/api/inspections/:id/odometer', authenticate, (req, res) => {
    if (ensureOperationalWriteAllowed && !ensureOperationalWriteAllowed(req, res, { mode: 'write' })) return

    const inspectionId = req.params.id
    const { odometer_value, odometer_unit = 'km' } = req.body
    const companyId = req.user.company_id || 'default'

    if (!odometer_value || isNaN(Number(odometer_value))) {
      return res.status(400).json({ error: API_MESSAGES?.odometerValueRequired || 'Укажите корректное значение одометра' })
    }

    const inspection = db.prepare('SELECT * FROM inspections WHERE id = ? AND company_id = ?').get(inspectionId, companyId)
    if (!inspection) {
      return res.status(404).json({ error: API_MESSAGES?.inspectionNotFound || 'Осмотр не найден' })
    }
    if (inspection.completed) return sendInspectionCompletedError(res)

    const progressionError = validateOdometerProgression(db, inspection, Number(odometer_value))
    if (progressionError) {
      return res.status(400).json({
        error: 'odometer_value_decreased',
        message: progressionError.message,
        previous: progressionError.previous,
      })
    }

    db.prepare(`
      UPDATE inspections
      SET odometer_value = ?,
          odometer_unit = ?,
          odometer_recognized_at = datetime('now'),
          odometer_confirmed_at = datetime('now'),
          odometer_unavailable_reason = NULL
      WHERE id = ? AND company_id = ?
    `).run(odometer_value, odometer_unit, inspectionId, companyId)

    res.json({
      id: inspectionId,
      odometer_value: Number(odometer_value),
      odometer_unit,
      odometer_confirmed_at: new Date().toISOString(),
    })
  })
}

// Vehicle number recognition routes.
// MVP returns manual-confirmation placeholders until a real ANPR provider is wired.
export function registerVehicleNumberRecognitionRoutes({
  app,
  db,
  authenticate,
  API_MESSAGES,
  upload,
  ensureOcrAvailable = null,
  recordOcrUsage = null,
  ensureOperationalWriteAllowed = null,
}) {
  app.post(
    '/api/vehicle-number/recognize',
    authenticate,
    subscriptionGate(ensureOperationalWriteAllowed, 'create'),
    ocrGate(ensureOcrAvailable),
    upload.single('photo'),
    (req, res) => {
      if (!req.file) {
        return res.status(400).json({ error: API_MESSAGES?.vehicleNumberPhotoRequired || 'Фото номера обязательно' })
      }
      recordOcrUsage?.(req.user.company_id || 'default', 'vehicle_number')

      res.json({
        raw_value: null,
        normalized_value: null,
        confidence: 0,
        requires_confirmation: true,
        message: API_MESSAGES?.vehicleNumberRequiresConfirmation || 'Требуется подтверждение номера инспектором',
        photo_url: `/uploads/${req.file.filename}`,
        recognized_at: new Date().toISOString(),
      })
    },
  )

  app.post('/api/vehicles/resolve-number', authenticate, (req, res) => {
    const { number } = req.body

    if (!number || typeof number !== 'string') {
      return res.status(400).json({ error: API_MESSAGES?.vehicleNumberRequired || 'Укажите номер техники' })
    }

    const normalized = normalizeVehicleNumberToCyrillic(number)
    const companyId = req.user.company_id || 'default'
    const vehicle = db.prepare(`
      SELECT id, number, name, status, region, company_id
      FROM vehicles
      WHERE number = ? AND company_id = ?
    `).get(normalized, companyId)

    if (vehicle) {
      return res.json({
        found: true,
        normalized_number: normalized,
        data: {
          id: vehicle.id,
          number: vehicle.number,
          name: vehicle.name,
          status: vehicle.status,
          region: vehicle.region,
          company_id: vehicle.company_id,
        },
      })
    }

    res.json({
      found: false,
      normalized_number: normalized,
      message: API_MESSAGES?.vehicleNotFound || 'Техника с таким номером не найдена',
    })
  })
}
