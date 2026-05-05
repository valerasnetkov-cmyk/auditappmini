import { transliterateCyrillicToLatin } from '../utils/transliteration.js'

// Odometer recognition routes
// Note: This is a placeholder implementation. In production, integrate with OCR provider.
export function registerOdometerRoutes({ app, db, authenticate, API_MESSAGES, upload }) {
  // POST /api/odometer/recognize - recognize odometer from photo
  app.post('/api/odometer/recognize', authenticate, upload.single('photo'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: API_MESSAGES?.odometerPhotoRequired || 'Фото одометра обязательно' })
    }

    // In MVP, return a placeholder. In production, call OCR provider.
    // For now, return mock data to demonstrate the flow
    const mockOdometerReading = {
      raw_value: null,
      normalized_value: null,
      unit: 'km',
      confidence: 0,
      requires_manual_confirmation: true,
      message: 'Требуется ручное подтверждение показаний'
    }

    res.json({
      ...mockOdometerReading,
      photo_url: `/uploads/${req.file.filename}`,
      recognized_at: new Date().toISOString()
    })
  })

  // POST /api/inspections/:id/odometer - save confirmed odometer to inspection
  app.post('/api/inspections/:id/odometer', authenticate, (req, res) => {
    const inspectionId = req.params.id
    const { odometer_value, odometer_unit = 'km' } = req.body

    if (!odometer_value || isNaN(Number(odometer_value))) {
      return res.status(400).json({ error: API_MESSAGES?.odometerValueRequired || 'Укажите корректное значение одометра' })
    }

    const inspection = db.prepare('SELECT * FROM inspections WHERE id = ?').get(inspectionId)
    if (!inspection) {
      return res.status(404).json({ error: API_MESSAGES?.inspectionNotFound || 'Осмотр не найден' })
    }

    // Save odometer to inspection
    db.prepare(`
      UPDATE inspections 
      SET odometer_value = ?, odometer_unit = ?, odometer_recognized_at = datetime('now')
      WHERE id = ?
    `).run(odometer_value, odometer_unit, inspectionId)

    res.json({
      id: inspectionId,
      odometer_value: Number(odometer_value),
      odometer_unit,
      odometer_confirmed_at: new Date().toISOString()
    })
  })
}

// Vehicle number recognition routes
// Note: This is a placeholder implementation. In production, integrate with OCR/ANPR provider.
export function registerVehicleNumberRecognitionRoutes({ app, db, authenticate, API_MESSAGES, upload }) {
  // POST /api/vehicle-number/recognize - recognize vehicle number from photo
  app.post('/api/vehicle-number/recognize', authenticate, upload.single('photo'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: API_MESSAGES?.vehicleNumberPhotoRequired || 'Фото номера обязательно' })
    }

    // In MVP, return a placeholder. In production, call OCR/ANPR provider.
    const mockNumberReading = {
      raw_value: null,
      normalized_value: null,
      confidence: 0,
      requires_confirmation: true,
      message: 'Требуется подтверждение номера инспектором'
    }

    res.json({
      ...mockNumberReading,
      photo_url: `/uploads/${req.file.filename}`,
      recognized_at: new Date().toISOString()
    })
  })

  // POST /api/vehicles/resolve-number - normalize number and find vehicle
  app.post('/api/vehicles/resolve-number', authenticate, (req, res) => {
    const { number } = req.body

    if (!number || typeof number !== 'string') {
      return res.status(400).json({ error: API_MESSAGES?.vehicleNumberRequired || 'Укажите номер техники' })
    }

    
    // Transliterate Cyrillic -> Latin, then normalize
    console.log('Raw number input:', JSON.stringify(number))
    const latinInput = transliterateCyrillicToLatin(number)
    console.log('After transliteration:', latinInput)
    const normalized = latinInput.trim().toUpperCase().replace(/\s+/g, '')
    
    // Search by Latin number only (DB stores Latin)
    const companyId = req.user.company_id || 'default'
    const vehicle = db.prepare('SELECT * FROM vehicles WHERE number = ? AND (company_id = ? OR company_id IS NULL)').get(normalized, companyId)

    if (vehicle) {
      return res.json({
        found: true,
        normalized_number: normalized,
        data: {
          id: vehicle.id,
          number: vehicle.number,
          name: vehicle.name,
          status: vehicle.status,
          qr_code: vehicle.qr_code,
          region: vehicle.region,
          company_id: vehicle.company_id
        }
      })
    }

    res.json({
      found: false,
      normalized_number: normalized,
      message: API_MESSAGES?.vehicleNotFound || 'Техника с таким номером не найдена'
    })
  })
}