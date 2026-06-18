import { normalizeVehicleNumberToCyrillic } from '../utils/transliteration.js'
import { sendInspectionCompletedError } from '../services/inspectionReadiness.js'

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

// Odometer recognition routes.
// MVP returns manual-confirmation placeholders until a real OCR provider is wired.
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
    (req, res) => {
      if (!req.file) {
        return res.status(400).json({ error: API_MESSAGES?.odometerPhotoRequired || 'Фото одометра обязательно' })
      }
      recordOcrUsage?.(req.user.company_id || 'default', 'odometer')

      res.json({
        raw_value: null,
        normalized_value: null,
        unit: 'km',
        confidence: 0,
        requires_manual_confirmation: true,
        message: API_MESSAGES?.odometerRequiresManualConfirmation || 'Требуется ручное подтверждение показаний',
        photo_url: `/uploads/${req.file.filename}`,
        recognized_at: new Date().toISOString(),
      })
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
