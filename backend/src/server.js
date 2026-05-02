import express from 'express'
import speakeasy from 'speakeasy'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { initDatabase, getDb } from './db.js'
import registerCompleteInspectionRoutes from './routes/completeInspection.js'
import { registerOdometerRoutes, registerVehicleNumberRecognitionRoutes } from './routes/odometer.js'
import { photoRequirements, photoTypeLabels, defectCategories } from './routes/photo-requirements.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadsDir = path.join(__dirname, '../uploads')

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

const app = express()
const PORT = process.env.PORT || 3001
const DEFAULT_JWT_SECRET = 'audit-secret-key-2024'
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_JWT_SECRET
const isProduction = process.env.NODE_ENV === 'production'
const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3002')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean)
const allowAllCorsOrigins = corsOrigins.includes('*')

if (isProduction && JWT_SECRET === DEFAULT_JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production')
}

if (!isProduction && JWT_SECRET === DEFAULT_JWT_SECRET) {
  console.warn('[config] Using fallback JWT_SECRET for local development')
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`
    cb(null, uniqueName)
  }
})
const upload = multer({ storage })

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowAllCorsOrigins || corsOrigins.includes(origin)) {
      callback(null, true)
      return
    }

    callback(new Error(`CORS blocked for origin: ${origin}`))
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))

app.use(express.json())

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} from ${req.ip}`)
  next()
})
app.use('/uploads', express.static(uploadsDir))

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 401, API_MESSAGES.authRequired)
  }

  const token = authHeader.split(' ')[1]
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = decoded
    next()
  } catch (err) {
    return sendError(res, 401, API_MESSAGES.invalidToken)
  }
}

const db = getDb()
const NUMERIC_SETTING_KEYS = new Set(['scheduled_inspection_days', 'notification_days_before', 'timezone_offset'])

function readSettings() {
  const settings = db.prepare('SELECT key, value FROM settings').all()
  const result = {}

  settings.forEach((setting) => {
    result[setting.key] = NUMERIC_SETTING_KEYS.has(setting.key) ? Number(setting.value) : setting.value
  })

  return result
}

function getUserSummaryById(id) {
  return db.prepare('SELECT id, email, name, role FROM users WHERE id = ?').get(id)
}

function getUserIdByEmail(email) {
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
  return user?.id ?? null
}

function getUserRecordById(id) {
  return db.prepare('SELECT id, email, name, role, created_at FROM users WHERE id = ?').get(id)
}

function getVehicleById(id) {
  return db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id)
}

function getVehicleByNumber(number) {
  return db.prepare('SELECT * FROM vehicles WHERE number = ?').get(number)
}

function getRegionByName(name) {
  return db.prepare('SELECT id, name, created_at FROM regions WHERE name = ?').get(name)
}

function getRegionById(id) {
  return db.prepare('SELECT id, name, created_at FROM regions WHERE id = ?').get(id)
}

function listRegions() {
  return db.prepare(`
    SELECT r.id, r.name, r.created_at, COUNT(v.id) as vehicle_count
    FROM regions r
    LEFT JOIN vehicles v ON v.region = r.name
    GROUP BY r.id, r.name, r.created_at
    ORDER BY r.name
  `).all()
}

function getInspectionById(id) {
  return db.prepare('SELECT * FROM inspections WHERE id = ?').get(id)
}

function createUserRecord({ id, email, passwordHash, name, role, ignoreExisting = false }) {
  const statement = ignoreExisting
    ? db.prepare('INSERT OR IGNORE INTO users (id, email, password, name, role) VALUES (?, ?, ?, ?, ?)')
    : db.prepare('INSERT INTO users (id, email, password, name, role) VALUES (?, ?, ?, ?, ?)')

  return statement.run(id, email, passwordHash, name, role)
}

function updateUserRecord(id, { email, name, role, passwordHash }) {
  if (email !== undefined) {
    db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email, id)
  }

  if (name !== undefined) {
    db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, id)
  }

  if (role !== undefined) {
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id)
  }

  if (passwordHash !== undefined) {
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(passwordHash, id)
  }
}

function createVehicleRecord({ id, number, name, status, qrCode, region }) {
  return db.prepare(`
    INSERT INTO vehicles (id, number, name, status, qr_code, region)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, number.toUpperCase(), name, status, qrCode || null, region || null)
}

function updateVehicleRecord(id, { number, name, status, qrCode, region }) {
  return db.prepare(`
    UPDATE vehicles SET number = ?, name = ?, status = ?, qr_code = ?, region = ?
    WHERE id = ?
  `).run(number.toUpperCase(), name, status, qrCode || null, region || null, id)
}

function recordVehicleStatusChange({ vehicleId, oldStatus, newStatus, reason, changedBy }) {
  return db.prepare(`
    INSERT INTO vehicle_status_history (id, vehicle_id, old_status, new_status, reason, changed_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(uuidv4(), vehicleId, oldStatus, newStatus, reason || null, changedBy)
}

function upsertSettingValue(key, value) {
  return db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value))
}

function createRegionRecord(name) {
  return db.prepare(`
    INSERT INTO regions (id, name, created_at)
    VALUES (?, ?, datetime('now'))
  `).run(uuidv4(), name)
}

function deleteRegionRecord(id) {
  return db.prepare('DELETE FROM regions WHERE id = ?').run(id)
}

const LICENSE_PLATE_LATIN_TO_CYRILLIC = {
  A: 'А',
  B: 'В',
  E: 'Е',
  K: 'К',
  M: 'М',
  H: 'Н',
  O: 'О',
  P: 'Р',
  C: 'С',
  T: 'Т',
  Y: 'У',
  X: 'Х',
}

const LICENSE_PLATE_ALLOWED_LETTERS = ['А', 'В', 'Е', 'К', 'М', 'Н', 'О', 'Р', 'С', 'Т', 'У', 'Х']
const RUSSIAN_LICENSE_PLATE_PATTERN = /^[АВЕКМНОРСТУХ]\d{3}[АВЕКМНОРСТУХ]{2}\d{2,3}$/

function randomInteger(maxExclusive) {
  return Math.floor(Math.random() * maxExclusive)
}

function randomItem(items) {
  return items[randomInteger(items.length)]
}

function randomDateBetween(startDate, endDate) {
  const start = startDate.getTime()
  const end = endDate.getTime()
  const timestamp = start + Math.random() * Math.max(end - start, 1)
  return new Date(timestamp)
}

function generateDemoVehicleNumber() {
  const pickLetter = () => randomItem(LICENSE_PLATE_ALLOWED_LETTERS)
  const digits = String(randomInteger(1000)).padStart(3, '0')
  const regionNumber = String(10 + randomInteger(190)).padStart(2, '0')
  return `${pickLetter()}${digits}${pickLetter()}${pickLetter()}${regionNumber}`
}

const API_MESSAGES = {
  authRequired: 'Необходима авторизация',
  invalidToken: 'Недействительный токен',
  loginCredentialsRequired: 'Укажите email и пароль',
  userNotFound: 'Пользователь не найден',
  invalidPassword: 'Неверный пароль',
  accessDenied: 'Доступ запрещён',
  mfaNotConfigured: 'MFA не настроен',
  invalidMfaCode: 'Неверный код MFA',
  registerFieldsRequired: 'Укажите email, пароль и имя',
  userEmailExists: 'Пользователь с таким email уже существует',
  managersOnly: 'Доступ только для менеджеров',
  allFieldsRequired: 'Заполните все поля',
  emailAlreadyUsed: 'Email уже используется',
  noAccess: 'Нет доступа',
  selfDeleteForbidden: 'Нельзя удалить себя',
  vehicleFieldsRequired: 'Укажите госномер и название техники',
  vehicleNumberExists: 'Техника с таким госномером уже существует',
  invalidVehicleNumber: 'Некорректный госномер. Используйте формат А123ВС77 и только разрешённые буквы: А, В, Е, К, М, Н, О, Р, С, Т, У, Х',
  vehicleNotFound: 'Техника не найдена',
  regionNameRequired: 'Укажите название региона',
  regionAlreadyExists: 'Такой регион уже существует',
  regionNotFound: 'Регион не найден',
  regionInUse: 'Нельзя удалить регион, пока он используется в карточках техники',
  invalidRegion: 'Выберите регион из справочника',
  defectNotFound: 'Дефект не найден',
  defectTitleRequired: 'Заголовок дефекта обязателен',
  inspectionNotFound: 'Осмотр не найден',
  accidentDetailsRequired: 'Для осмотра ДТП укажите время и место происшествия',
  settingsManagerOnly: 'Только менеджер может изменять настройки',
  demoDataCreated: 'Демо-данные созданы',
photosRequiredForDefect: 'Фото для дефекта не загружено',
  odometerPhotoRequired: 'Фото одометра обязательно',
  odometerValueRequired: 'Укажите корректное значение одометра',
  vehicleNumberPhotoRequired: 'Фото номера обязательно',
  vehicleNumberRequired: 'Укажите номер техники',
  internalServerError: 'Внутренняя ошибка сервера',
}

// Register the complete-inspection route after API_MESSAGES is defined
registerCompleteInspectionRoutes({ app, db, API_MESSAGES, getInspectionById, authenticate, photoRequirements })

// Register odometer and vehicle number recognition routes
registerOdometerRoutes({ app, db, authenticate, API_MESSAGES, upload })
registerVehicleNumberRecognitionRoutes({ app, db, authenticate, API_MESSAGES, upload })

function sendError(res, status, message) {
  return res.status(status).json({ error: message })
}

function sendInternalError(res, scope, err) {
  console.error(`${scope}:`, err)
  return res.status(500).json({ error: API_MESSAGES.internalServerError })
}

function normalizeRegionName(region) {
  if (typeof region !== 'string') return null
  const trimmed = region.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeVehicleNumber(number) {
  if (typeof number !== 'string') return ''

  return number
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .split('')
    .map((symbol) => LICENSE_PLATE_LATIN_TO_CYRILLIC[symbol] || symbol)
    .join('')
}

function isValidRussianLicensePlate(number) {
  return RUSSIAN_LICENSE_PLATE_PATTERN.test(normalizeVehicleNumber(number))
}

function validateVehiclePayload({ number, name, region }) {
  const normalizedNumber = normalizeVehicleNumber(number)
  const normalizedName = typeof name === 'string' ? name.trim() : ''
  const normalizedRegion = normalizeRegionName(region)

  if (!normalizedNumber || !normalizedName) {
    return { error: API_MESSAGES.vehicleFieldsRequired }
  }

  if (!isValidRussianLicensePlate(normalizedNumber)) {
    return { error: API_MESSAGES.invalidVehicleNumber }
  }

  if (normalizedRegion && !getRegionByName(normalizedRegion)) {
    return { error: API_MESSAGES.invalidRegion }
  }

  return {
    number: normalizedNumber,
    name: normalizedName,
    region: normalizedRegion,
  }
}

function ensureVehicleNumberAvailable(number, currentVehicleId = null) {
  const existingVehicle = getVehicleByNumber(number)
  if (!existingVehicle) return null
  if (currentVehicleId && existingVehicle.id === currentVehicleId) return null
  return API_MESSAGES.vehicleNumberExists
}

function isManager(req) {
  return req.user?.role === 'manager'
}

function isSelf(req, userId) {
  return req.user?.id === userId
}

function ensureManager(req, res, message = API_MESSAGES.managersOnly) {
  if (isManager(req)) return true
  sendError(res, 403, message)
  return false
}

function ensureManagerOrSelf(req, res, userId, message = API_MESSAGES.noAccess) {
  if (isManager(req) || isSelf(req, userId)) return true
  sendError(res, 403, message)
  return false
}

function validateAccidentDetails(type, accidentOccurredAt, accidentLocation) {
  if (type !== 'accident') {
    return {
      accidentOccurredAt: accidentOccurredAt || null,
      accidentLocation: accidentLocation?.trim() || null,
    }
  }

  const normalizedOccurredAt = typeof accidentOccurredAt === 'string' ? accidentOccurredAt.trim() : ''
  const normalizedLocation = typeof accidentLocation === 'string' ? accidentLocation.trim() : ''

  if (!normalizedOccurredAt || !normalizedLocation) {
    return { error: API_MESSAGES.accidentDetailsRequired }
  }

  return {
    accidentOccurredAt: normalizedOccurredAt,
    accidentLocation: normalizedLocation,
  }
}

// ============ AUTH ============

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return sendError(res, 400, API_MESSAGES.loginCredentialsRequired)
  }

  const user = db.prepare('SELECT id, email, password, name, role, mfa_enabled, mfa_secret FROM users WHERE email = ?').get(email)

  if (!user) {
    return sendError(res, 401, API_MESSAGES.userNotFound)
  }

  const passwordOk = bcrypt.compareSync(password, user.password)
  if (!passwordOk) {
    return sendError(res, 401, API_MESSAGES.invalidPassword)
  }

  // MFA check: if enabled, require MFA verification before issuing JWT
  if (user.mfa_enabled) {
    return res.json({ mfaRequired: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } })
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  )

  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role }
  })
})

// MFA: setup for admin to configure per-user
app.post('/api/users/:id/mfa/setup', authenticate, (req, res) => {
  const userId = req.params.id
  // Only managers can set MFA for others; allow self as well
  if (!ensureManagerOrSelf(req, res, userId, API_MESSAGES.accessDenied)) return
  const secret = speakeasy.generateSecret({ length: 20 })
  // Save secret into user row
  db.prepare('UPDATE users SET mfa_secret = ? WHERE id = ?').run(secret.base32, userId)
  res.json({ otpauth_url: secret.otpauth_url, secret: secret.base32 })
})

app.post('/api/users/:id/mfa/verify', authenticate, (req, res) => {
  const userId = req.params.id
  const { token } = req.body
  const user = db.prepare('SELECT id, email, name, role, mfa_secret FROM users WHERE id = ?').get(userId)
  if (!user) return sendError(res, 404, API_MESSAGES.userNotFound)
  if (!user.mfa_secret) return sendError(res, 400, API_MESSAGES.mfaNotConfigured)
  const verified = speakeasy.totp.verify({ secret: user.mfa_secret, encoding: 'base32', token })
  if (!verified) return sendError(res, 401, API_MESSAGES.invalidMfaCode)
  // Activate MFA for user
  db.prepare('UPDATE users SET mfa_enabled = 1 WHERE id = ?').run(userId)
  // Issue new token as if login successful
  const tokenJwt = jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  )
  res.json({ token: tokenJwt, user: { id: user.id, email: user.email, name: user.name, role: user.role } })
})

// Registration endpoint for mobile app
app.post('/api/auth/register', (req, res) => {
  const { email, password, name } = req.body
  // Public registration: always register as inspector
  const role = 'inspector'
  if (!email || !password || !name) {
    return sendError(res, 400, API_MESSAGES.registerFieldsRequired)
  }
  const existing = getUserIdByEmail(email)
  if (existing) {
    return sendError(res, 400, API_MESSAGES.userEmailExists)
  }

  const id = uuidv4()
  const hashedPassword = bcrypt.hashSync(password, 10)
  createUserRecord({ id, email, passwordHash: hashedPassword, name, role })

  const user = getUserSummaryById(id)
  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  )
  res.json({ token, user })
})

app.get('/api/auth/me', authenticate, (req, res) => {
  const user = getUserSummaryById(req.user.id)
  res.json(user)
})

// ============ USERS ============

app.get('/api/users', authenticate, (req, res) => {
  if (!ensureManager(req, res)) return
  
  const users = db.prepare(`
    SELECT id, email, name, role, created_at, mfa_enabled FROM users ORDER BY created_at DESC
  `).all()
  
  res.json(users)
})

app.get('/api/users/:id', authenticate, (req, res) => {
  const user = getUserRecordById(req.params.id)
  if (!user) {
    return sendError(res, 404, API_MESSAGES.userNotFound)
  }
  res.json(user)
})

app.post('/api/users', authenticate, (req, res) => {
  if (!ensureManager(req, res)) return
  
  const { email, password, name, role = 'inspector' } = req.body
  
  if (!email || !password || !name) {
    return sendError(res, 400, API_MESSAGES.allFieldsRequired)
  }
  
  const existing = getUserIdByEmail(email)
  if (existing) {
    return sendError(res, 400, API_MESSAGES.emailAlreadyUsed)
  }
  
  const id = uuidv4()
  const hashedPassword = bcrypt.hashSync(password, 10)

  createUserRecord({ id, email, passwordHash: hashedPassword, name, role })
  
  const user = getUserRecordById(id)
  res.status(201).json(user)
})

app.put('/api/users/:id', authenticate, (req, res) => {
  if (!ensureManagerOrSelf(req, res, req.params.id)) return
  
  const { email, name, role, password } = req.body
  
  if (!isManager(req)) {
    // Users can only update their own name
    if (name) {
      updateUserRecord(req.params.id, { name })
    }
  } else {
    // Managers can update name and role
    if (email) {
      const existing = getUserIdByEmail(email)
      if (existing && existing !== req.params.id) {
        return sendError(res, 400, API_MESSAGES.emailAlreadyUsed)
      }
    }

    const passwordHash = password ? bcrypt.hashSync(password, 10) : undefined
    updateUserRecord(req.params.id, { email, name, role, passwordHash })
  }
  
  const user = getUserRecordById(req.params.id)
  res.json(user)
})

app.delete('/api/users/:id', authenticate, (req, res) => {
  if (!ensureManager(req, res)) return
  
  if (isSelf(req, req.params.id)) {
    return sendError(res, 400, API_MESSAGES.selfDeleteForbidden)
  }
  
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id)
  res.status(204).send()
})

// ============ REGIONS ============

app.get('/api/regions', authenticate, (req, res) => {
  res.json(listRegions())
})

app.post('/api/regions', authenticate, (req, res) => {
  if (!ensureManager(req, res)) return

  const regionName = normalizeRegionName(req.body?.name)
  if (!regionName) {
    return sendError(res, 400, API_MESSAGES.regionNameRequired)
  }

  if (getRegionByName(regionName)) {
    return sendError(res, 400, API_MESSAGES.regionAlreadyExists)
  }

  createRegionRecord(regionName)
  const region = getRegionByName(regionName)
  res.status(201).json(region)
})

app.delete('/api/regions/:id', authenticate, (req, res) => {
  if (!ensureManager(req, res)) return

  const region = getRegionById(req.params.id)
  if (!region) {
    return sendError(res, 404, API_MESSAGES.regionNotFound)
  }

  const vehicleUsage = db.prepare('SELECT COUNT(*) as count FROM vehicles WHERE region = ?').get(region.name)
  if (Number(vehicleUsage?.count || 0) > 0) {
    return sendError(res, 400, API_MESSAGES.regionInUse)
  }

  deleteRegionRecord(req.params.id)
  res.status(204).send()
})

// ============ VEHICLES ============

app.get('/api/vehicles', authenticate, (req, res) => {
  const { page = 1, limit = 20, search = '', status = 'all' } = req.query
  const offset = (page - 1) * limit

  let whereClause = '1=1'
  const params = []

  if (search) {
    whereClause += ' AND (number LIKE ? OR name LIKE ?)'
    params.push(`%${search}%`, `%${search}%`)
  }

  if (status !== 'all') {
    whereClause += ' AND status = ?'
    params.push(status)
  }

  const countQuery = db.prepare(`SELECT COUNT(*) as count FROM vehicles WHERE ${whereClause}`)
  const { count } = countQuery.get(...params)

  const query = db.prepare(`
    SELECT * FROM vehicles 
    WHERE ${whereClause}
    ORDER BY created_at DESC 
    LIMIT ? OFFSET ?
  `)
  const vehicles = query.all(...params, Number(limit), offset)

  // Get last inspection and defects count for each vehicle
  const vehiclesWithStats = vehicles.map(v => {
    const lastInspection = db.prepare(`
      SELECT id, created_at FROM inspections 
      WHERE vehicle_id = ? ORDER BY created_at DESC LIMIT 1
    `).get(v.id)

    const defectsCount = db.prepare(`
      SELECT COUNT(*) as count FROM defects d
      JOIN inspections i ON d.inspection_id = i.id
      WHERE i.vehicle_id = ?
    `).get(v.id).count

    return { ...v, lastInspection, defectsCount: Number(defectsCount) }
  })

  res.json({
    data: vehiclesWithStats,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: count,
      pages: Math.ceil(count / limit)
    }
  })
})

app.get('/api/vehicles/list', authenticate, (req, res) => {
  try {
    const vehicles = db.prepare('SELECT id, number, name, status, region FROM vehicles ORDER BY number').all()
    res.json(vehicles)
  } catch (err) {
    console.error('Vehicles list error:', err)
    return sendInternalError(res, 'Vehicles list error', err)
  }
})

app.get('/api/vehicles/:id/history', authenticate, (req, res) => {
  const history = db.prepare(`
    SELECT h.*, u.name as changed_by_name
    FROM vehicle_status_history h
    LEFT JOIN users u ON h.changed_by = u.id
    WHERE h.vehicle_id = ?
    ORDER BY h.created_at DESC
  `).all(req.params.id)
  res.json(history)
})

app.get('/api/vehicles/:id/defects', authenticate, (req, res) => {
  const vehicle = getVehicleById(req.params.id)
  if (!vehicle) {
    return sendError(res, 404, API_MESSAGES.vehicleNotFound)
  }

  const limit = Number(req.query.limit || 20)
  const defects = db.prepare(`
    SELECT d.id, d.inspection_id, d.title, d.comment, d.created_at,
           i.type as inspection_type, i.created_at as inspection_date, i.created_at as inspection_time,
           i.accident_occurred_at, i.accident_location,
           v.id as vehicle_id, v.number as vehicle_number, v.name as vehicle_name, v.region as vehicle_region,
           u.name as inspector_name
    FROM defects d
    JOIN inspections i ON d.inspection_id = i.id
    JOIN vehicles v ON i.vehicle_id = v.id
    JOIN users u ON i.inspector_id = u.id
    WHERE v.id = ?
    ORDER BY d.created_at DESC
    LIMIT ?
  `).all(req.params.id, limit)

  const defectsWithPhotos = defects.map((defect) => {
    const photos = db.prepare('SELECT id, url, geo FROM photos WHERE defect_id = ? ORDER BY created_at ASC').all(defect.id)
    return { ...defect, photos }
  })

  res.json(defectsWithPhotos)
})

app.get('/api/vehicles/:id', authenticate, (req, res) => {
  const vehicle = getVehicleById(req.params.id)
  if (!vehicle) {
    return sendError(res, 404, API_MESSAGES.vehicleNotFound)
  }
  res.json(vehicle)
})

app.post('/api/vehicles', authenticate, (req, res) => {
  const { number, name, status = 'active', qr_code, region } = req.body
  const validated = validateVehiclePayload({ number, name, region })
  if (validated.error) {
    return sendError(res, 400, validated.error)
  }

  const duplicateError = ensureVehicleNumberAvailable(validated.number)
  if (duplicateError) {
    return sendError(res, 400, duplicateError)
  }
  const id = uuidv4()

  createVehicleRecord({
    id,
    number: validated.number,
    name: validated.name,
    status,
    qrCode: qr_code,
    region: validated.region,
  })

  const vehicle = getVehicleById(id)
  res.status(201).json(vehicle)
})

app.put('/api/vehicles/:id', authenticate, (req, res) => {
  const { number, name, status, qr_code, region, reason } = req.body

  const oldVehicle = getVehicleById(req.params.id)
  if (!oldVehicle) {
    return sendError(res, 404, API_MESSAGES.vehicleNotFound)
  }

  const validated = validateVehiclePayload({ number, name, region })
  if (validated.error) {
    return sendError(res, 400, validated.error)
  }

  const duplicateError = ensureVehicleNumberAvailable(validated.number, req.params.id)
  if (duplicateError) {
    return sendError(res, 400, duplicateError)
  }

  updateVehicleRecord(req.params.id, {
    number: validated.number,
    name: validated.name,
    status,
    qrCode: qr_code,
    region: validated.region,
  })

  if (oldVehicle.status !== status) {
    recordVehicleStatusChange({
      vehicleId: req.params.id,
      oldStatus: oldVehicle.status,
      newStatus: status,
      reason,
      changedBy: req.user.id
    })
  }

  const vehicle = getVehicleById(req.params.id)
  res.json(vehicle)
})

app.delete('/api/vehicles/:id', authenticate, (req, res) => {
  db.prepare('DELETE FROM vehicles WHERE id = ?').run(req.params.id)
  res.status(204).send()
})

// ============ INSPECTIONS ============

app.get('/api/inspections', authenticate, (req, res) => {
  const { page = 1, limit = 20, type = '', vehicle = '', from = '', to = '' } = req.query
  const offset = (page - 1) * limit

  let whereClause = '1=1'
  const params = []

  if (type) {
    whereClause += ' AND i.type = ?'
    params.push(type)
  }

  if (vehicle) {
    whereClause += ' AND i.vehicle_id = ?'
    params.push(vehicle)
  }

  if (from) {
    whereClause += ' AND i.created_at >= ?'
    params.push(from)
  }

  if (to) {
    whereClause += ' AND i.created_at <= ?'
    params.push(to + ' 23:59:59')
  }

  const countQuery = db.prepare(`SELECT COUNT(*) as count FROM inspections i WHERE ${whereClause}`)
  const { count } = countQuery.get(...params)

  const query = db.prepare(`
    SELECT i.id, i.vehicle_id, i.type, i.completed, i.created_at, i.accident_occurred_at, i.accident_location,
           v.number as vehicle_number, v.name as vehicle_name, v.region as vehicle_region, u.name as inspector_name,
           (SELECT COUNT(*) FROM defects WHERE inspection_id = i.id) as defects_count
    FROM inspections i
    JOIN vehicles v ON i.vehicle_id = v.id
    JOIN users u ON i.inspector_id = u.id
    WHERE ${whereClause}
    ORDER BY i.created_at DESC 
    LIMIT ? OFFSET ?
  `)
  const inspections = query.all(...params, Number(limit), offset)

  res.json({
    data: inspections,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: count,
      pages: Math.ceil(count / limit)
    }
  })
})

app.get('/api/vehicles/:vehicleId/inspections', authenticate, (req, res) => {
  const { page = 1, limit = 5 } = req.query
  const offset = (page - 1) * limit

  const countQuery = db.prepare('SELECT COUNT(*) as count FROM inspections WHERE vehicle_id = ?')
  const { count } = countQuery.get(req.params.vehicleId)

  const query = db.prepare(`
    SELECT i.id, i.vehicle_id, i.type, i.completed, i.created_at,
           v.number as vehicle_number, v.name as vehicle_name, v.region as vehicle_region,
           u.name as inspector_name,
           (SELECT COUNT(*) FROM defects WHERE inspection_id = i.id) as defects_count
    FROM inspections i
    JOIN vehicles v ON i.vehicle_id = v.id
    JOIN users u ON i.inspector_id = u.id
    WHERE i.vehicle_id = ?
    ORDER BY i.created_at DESC 
    LIMIT ? OFFSET ?
  `)
  const inspections = query.all(req.params.vehicleId, Number(limit), offset)

  res.json({
    data: inspections,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: count,
      pages: Math.ceil(count / limit)
    }
  })
})

app.post('/api/inspections', authenticate, (req, res) => {
  const { vehicle_id, type = 'quick', checklist = [], accident_occurred_at = null, accident_location = null } = req.body
  const accidentValidation = validateAccidentDetails(type, accident_occurred_at, accident_location)
  if (accidentValidation.error) {
    return sendError(res, 400, accidentValidation.error)
  }
  const id = uuidv4()

  db.prepare(`
    INSERT INTO inspections (id, vehicle_id, inspector_id, type, completed, accident_occurred_at, accident_location)
    VALUES (?, ?, ?, ?, 0, ?, ?)
  `).run(id, vehicle_id, req.user.id, type, accidentValidation.accidentOccurredAt, accidentValidation.accidentLocation)

  if (type === 'scheduled') {
    db.prepare('UPDATE vehicles SET last_scheduled_inspection = datetime("now") WHERE id = ?').run(vehicle_id)
  }

  const insertChecklist = db.prepare(`
    INSERT INTO checklist_items (id, inspection_id, title, result, comment)
    VALUES (?, ?, ?, ?, ?)
  `)

  checklist.forEach(item => {
    const itemId = uuidv4()
    insertChecklist.run(itemId, id, item.title, item.result ? 1 : 0, item.comment || null)
    // Defects are now created via dedicated API call '/api/inspections/:id/defects'
  })

  // Completion is deferred to /api/inspections/:id/complete

  const inspection = getInspectionById(id)
  res.status(201).json(inspection)
})

// Create a defect for a specific inspection
app.post('/api/inspections/:id/defects', authenticate, (req, res) => {
  const inspectionId = req.params.id
  const { title, comment } = req.body
  if (!title) return sendError(res, 400, API_MESSAGES.defectTitleRequired || 'Заголовок дефекта обязателен')
  const inspection = getInspectionById(inspectionId)
  if (!inspection) return sendError(res, 404, API_MESSAGES.inspectionNotFound)
  const defectId = uuidv4()
  db.prepare(`INSERT INTO defects (id, inspection_id, title, comment, status, created_at) VALUES (?, ?, ?, ?, 'open', datetime('now'))`).run(defectId, inspectionId, title, comment || null)
  const defect = db.prepare('SELECT * FROM defects WHERE id = ?').get(defectId)
  res.status(201).json(defect)
})

// (Legacy duplicate complete route removed)

// (Legacy duplicate complete route removed)

app.get('/api/inspections/:id', authenticate, (req, res) => {
  const inspection = db.prepare(`
    SELECT i.*, v.number as vehicle_number, v.name as vehicle_name, u.name as inspector_name
    FROM inspections i
    JOIN vehicles v ON i.vehicle_id = v.id
    JOIN users u ON i.inspector_id = u.id
    WHERE i.id = ?
  `).get(req.params.id)

  if (!inspection) {
    return sendError(res, 404, API_MESSAGES.inspectionNotFound)
  }

  const checklist = db.prepare('SELECT * FROM checklist_items WHERE inspection_id = ?').all(req.params.id)
  const defects = db.prepare(`
    SELECT d.*, GROUP_CONCAT(p.url) as photos
    FROM defects d
    LEFT JOIN photos p ON p.defect_id = d.id
    WHERE d.inspection_id = ?
    GROUP BY d.id
  `).all(req.params.id)

  res.json({ ...inspection, checklist_items: checklist, defects })
})

app.put('/api/inspections/:id', authenticate, (req, res) => {
  const inspection = getInspectionById(req.params.id)
  if (!inspection) {
    return sendError(res, 404, API_MESSAGES.inspectionNotFound)
  }

  const { checklist = [], accident_occurred_at = null, accident_location = null } = req.body
  const accidentValidation = validateAccidentDetails(inspection.type, accident_occurred_at, accident_location)
  if (accidentValidation.error) {
    return sendError(res, 400, accidentValidation.error)
  }

  db.prepare(`
    UPDATE inspections
    SET completed = 1, accident_occurred_at = ?, accident_location = ?
    WHERE id = ?
  `).run(accidentValidation.accidentOccurredAt, accidentValidation.accidentLocation, req.params.id)

  const existingDefects = db.prepare('SELECT id FROM defects WHERE inspection_id = ?').all(req.params.id)
  existingDefects.forEach((defect) => {
    db.prepare('DELETE FROM photos WHERE defect_id = ?').run(defect.id)
  })
  db.prepare('DELETE FROM checklist_items WHERE inspection_id = ?').run(req.params.id)
  db.prepare('DELETE FROM defects WHERE inspection_id = ?').run(req.params.id)

  const insertChecklist = db.prepare(`
    INSERT INTO checklist_items (id, inspection_id, title, result, comment)
    VALUES (?, ?, ?, ?, ?)
  `)

  const insertDefect = db.prepare(`
    INSERT INTO defects (id, inspection_id, title, comment, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `)

  checklist.forEach((item) => {
    const itemId = uuidv4()
    insertChecklist.run(itemId, req.params.id, item.title, item.result ? 1 : 0, item.comment || null)

    if (!item.result) {
      insertDefect.run(uuidv4(), req.params.id, item.title, item.comment || null)
    }
  })

  const updatedInspection = db.prepare(`
    SELECT i.*, v.number as vehicle_number, v.name as vehicle_name, u.name as inspector_name
    FROM inspections i
    JOIN vehicles v ON i.vehicle_id = v.id
    JOIN users u ON i.inspector_id = u.id
    WHERE i.id = ?
  `).get(req.params.id)

  const updatedChecklist = db.prepare('SELECT * FROM checklist_items WHERE inspection_id = ?').all(req.params.id)
  const updatedDefects = db.prepare(`
    SELECT d.*, GROUP_CONCAT(p.url) as photos
    FROM defects d
    LEFT JOIN photos p ON p.defect_id = d.id
    WHERE d.inspection_id = ?
    GROUP BY d.id
  `).all(req.params.id)

  res.json({ ...updatedInspection, checklist_items: updatedChecklist, defects: updatedDefects })
})

app.delete('/api/inspections/:id', authenticate, (req, res) => {
  const { id } = req.params
  
  const inspection = getInspectionById(id)
  if (!inspection) {
    return sendError(res, 404, API_MESSAGES.inspectionNotFound)
  }
  
  db.prepare('DELETE FROM checklist_items WHERE inspection_id = ?').run(id)
  db.prepare('DELETE FROM defects WHERE inspection_id = ?').run(id)
  db.prepare('DELETE FROM photos WHERE inspection_id = ?').run(id)
  db.prepare('DELETE FROM inspections WHERE id = ?').run(id)
  
  res.status(204).send()
})

// ============ DEFECTS ============

app.get('/api/defects', authenticate, (req, res) => {
  const { page = 1, limit = 20, search = '', vehicle = '', from = '', to = '' } = req.query
  const offset = (page - 1) * limit

  let whereClause = '1=1'
  const params = []

  if (search) {
    whereClause += ' AND (d.title LIKE ? OR d.comment LIKE ?)'
    params.push(`%${search}%`, `%${search}%`)
  }

  if (vehicle) {
    whereClause += ' AND v.id = ?'
    params.push(vehicle)
  }

  if (from) {
    whereClause += ' AND d.created_at >= ?'
    params.push(from)
  }

  if (to) {
    whereClause += ' AND d.created_at <= ?'
    params.push(to + ' 23:59:59')
  }

  const countQuery = db.prepare(`SELECT COUNT(*) as count FROM defects d JOIN inspections i ON d.inspection_id = i.id JOIN vehicles v ON i.vehicle_id = v.id WHERE ${whereClause}`)
  const { count } = countQuery.get(...params)

  const query = db.prepare(`
    SELECT d.id, d.title, d.comment, d.created_at as created_at, d.status as status, d.closed_at as closed_at,
           i.type as inspection_type, i.created_at as inspection_date, i.created_at as inspection_time,
           i.accident_occurred_at, i.accident_location,
           v.id as vehicle_id, v.number as vehicle_number, v.name as vehicle_name, v.region as vehicle_region,
           u.name as inspector_name
    FROM defects d
    JOIN inspections i ON d.inspection_id = i.id
    JOIN vehicles v ON i.vehicle_id = v.id
    JOIN users u ON i.inspector_id = u.id
    WHERE ${whereClause}
    ORDER BY d.created_at DESC 
    LIMIT ? OFFSET ?
  `)
  const defects = query.all(...params, Number(limit), offset)

  const defectsWithPhotos = defects.map(defect => {
    const photos = db.prepare('SELECT id, url, geo FROM photos WHERE defect_id = ?').all(defect.id)
    return { ...defect, photos }
  })

  res.json({
    data: defectsWithPhotos,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: count,
      pages: Math.ceil(count / limit)
    }
  })
})

app.get('/api/defects/:id', authenticate, (req, res) => {
  const defect = db.prepare(`
    SELECT d.id, d.inspection_id, d.title, d.comment, d.created_at,
           i.type as inspection_type, i.created_at as inspection_date, i.created_at as inspection_time,
           i.accident_occurred_at, i.accident_location,
           v.id as vehicle_id, v.number as vehicle_number, v.name as vehicle_name, v.region as vehicle_region,
           u.name as inspector_name
    FROM defects d
    JOIN inspections i ON d.inspection_id = i.id
    JOIN vehicles v ON i.vehicle_id = v.id
    JOIN users u ON i.inspector_id = u.id
    WHERE d.id = ?
  `).get(req.params.id)

  if (!defect) {
    return sendError(res, 404, API_MESSAGES.defectNotFound)
  }

  const photos = db.prepare('SELECT id, url, geo FROM photos WHERE defect_id = ? ORDER BY created_at ASC').all(req.params.id)
  res.json({ ...defect, photos })
})

// Close a defect (set status to 'closed' and log history)
app.post('/api/defects/:id/close', authenticate, (req, res) => {
  const defectId = req.params.id
  const defect = db.prepare('SELECT id, status, closed_at FROM defects WHERE id = ?').get(defectId)
  if (!defect) return sendError(res, 404, API_MESSAGES.defectNotFound)
  if (defect.status === 'closed') {
    return res.json({ id: defectId, status: 'closed', closed_at: defect.closed_at })
  }

  const now = new Date().toISOString()
  db.prepare('UPDATE defects SET status = ?, closed_at = ? WHERE id = ?').run('closed', now, defectId)
  const historyId = uuidv4()
  db.prepare('INSERT INTO defect_history (id, defect_id, status, changed_at, changed_by) VALUES (?, ?, ?, ?, ?)').run(historyId, defectId, 'closed', now, req.user?.id ?? null)
  const updated = db.prepare('SELECT id, inspection_id, title, comment, status, created_at, closed_at FROM defects WHERE id = ?').get(defectId)
  res.json(updated)
})

// Reopen a defect (set status to 'open', clear closed_at, add history)
app.post('/api/defects/:id/reopen', authenticate, (req, res) => {
  const defectId = req.params.id
  const defect = db.prepare('SELECT id, status FROM defects WHERE id = ?').get(defectId)
  if (!defect) return sendError(res, 404, API_MESSAGES.defectNotFound)
  if (defect.status !== 'closed') {
    return res.json({ id: defectId, status: defect.status })
  }

  const now = new Date().toISOString()
  db.prepare('UPDATE defects SET status = ?, closed_at = NULL WHERE id = ?').run('open', defectId)
  const historyId = uuidv4()
  db.prepare('INSERT INTO defect_history (id, defect_id, status, changed_at, changed_by) VALUES (?, ?, ?, ?, ?)').run(historyId, defectId, 'open', now, req.user?.id ?? null)
  const updated = db.prepare('SELECT id, inspection_id, title, comment, status, created_at, closed_at FROM defects WHERE id = ?').get(defectId)
  res.json(updated)
})

// Get defect history
app.get('/api/defects/:id/history', authenticate, (req, res) => {
  const defectId = req.params.id
  const history = db.prepare('SELECT id, defect_id, status, changed_at, changed_by FROM defect_history WHERE defect_id = ? ORDER BY changed_at DESC').all(defectId)
  res.json(history)
})

app.post('/api/defects/:id/photos', authenticate, upload.single('photo'), (req, res) => {
  const { geo } = req.body
  const id = uuidv4()
  const url = `/uploads/${req.file.filename}`

  db.prepare(`
    INSERT INTO photos (id, inspection_id, defect_id, url, geo, is_required)
    VALUES (?, (SELECT inspection_id FROM defects WHERE id = ?), ?, ?, ?, 0)
  `).run(id, req.params.id, req.params.id, url, geo || null)

  const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(id)
  res.status(201).json(photo)
})

app.delete('/api/photos/:id', authenticate, (req, res) => {
  const { id } = req.params
  db.prepare('DELETE FROM photos WHERE id = ?').run(id)
  res.status(204).send()
})

app.put('/api/defects/:id', authenticate, (req, res) => {
  const { title, comment } = req.body
  
  db.prepare('UPDATE defects SET title = ?, comment = ? WHERE id = ?')
    .run(title, comment || null, req.params.id)
  
  const defect = db.prepare('SELECT * FROM defects WHERE id = ?').get(req.params.id)
  res.json(defect)
})

app.delete('/api/defects/:id', authenticate, (req, res) => {
  const { id } = req.params
  
  db.prepare('DELETE FROM photos WHERE defect_id = ?').run(id)
  db.prepare('DELETE FROM defects WHERE id = ?').run(id)
  
  res.status(204).send()
})

// ============ SETTINGS ============

app.get('/api/settings', authenticate, (req, res) => {
  res.json(readSettings())
})

app.put('/api/settings', authenticate, (req, res) => {
  if (!ensureManager(req, res, API_MESSAGES.settingsManagerOnly)) return
  
  const { scheduled_inspection_days, notification_days_before, timezone_offset } = req.body
  
  if (scheduled_inspection_days !== undefined) {
    upsertSettingValue('scheduled_inspection_days', scheduled_inspection_days)
  }
  if (notification_days_before !== undefined) {
    upsertSettingValue('notification_days_before', notification_days_before)
  }
  if (timezone_offset !== undefined) {
    upsertSettingValue('timezone_offset', timezone_offset)
  }
  return res.json(readSettings())
  
})

// Get photo requirements for an inspection type
app.get('/api/photo-requirements/:type', authenticate, (req, res) => {
  const { type } = req.params
  if (!photoRequirements[type]) {
    return res.status(400).json({ error: 'Неизвестный тип осмотра' })
  }
  res.json({
    type,
    requirements: photoRequirements[type],
    labels: photoTypeLabels.ru  // Default to Russian labels
  })
})

// Get defect categories
app.get('/api/defect-categories', authenticate, (req, res) => {
  res.json({
    categories: defectCategories.ru  // Default to Russian
  })
})

// ============ NOTIFICATIONS ============

app.get('/api/notifications', authenticate, (req, res) => {
  try {
    const settings = readSettings()
    const scheduledDays = Number(settings.scheduled_inspection_days ?? 30)
    const notifyDays = Number(settings.notification_days_before ?? 3)
    
    const vehicles = db.prepare('SELECT id, number, name, last_scheduled_inspection FROM vehicles WHERE status = ?').all('active')

    const now = new Date()
    const notifications = vehicles.map(v => {
      const defaultLastDate = new Date(now.getTime() - 1000 * 24 * 60 * 60 * 1000)
      const lastDateStr = v.last_scheduled_inspection || defaultLastDate.toISOString().split('T')[0]
      const lastDate = new Date(lastDateStr)
      const nextDue = new Date(lastDate)
      nextDue.setDate(nextDue.getDate() + scheduledDays)
      const daysUntil = Math.ceil((nextDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      return {
        vehicle_id: v.id,
        vehicle_number: v.number,
        vehicle_name: v.name,
        last_inspection: v.last_scheduled_inspection,
        next_due: nextDue.toISOString().split('T')[0],
        days_until: daysUntil,
        is_overdue: daysUntil <= 0
      }
    }).filter(n => n.days_until <= notifyDays)
      .sort((a, b) => a.days_until - b.days_until)

    res.json(notifications)
  } catch (err) {
    console.error('Notifications error:', err)
    return sendInternalError(res, 'Notifications error', err)
  }
})

// ============ DASHBOARD STATS ============

app.get('/api/dashboard/stats', authenticate, (req, res) => {
  const today = new Date().toISOString().split('T')[0]

  const totalVehicles = db.prepare('SELECT COUNT(*) as count FROM vehicles').get().count
  const totalInspections = db.prepare('SELECT COUNT(*) as count FROM inspections').get().count
  
  const todayInspections = db.prepare(`
    SELECT COUNT(*) as count FROM inspections 
    WHERE date(created_at) = date(?)
  `).get(today).count

  const vehiclesWithDefects = db.prepare(`
    SELECT COUNT(DISTINCT v.id) as count
    FROM vehicles v
    JOIN inspections i ON i.vehicle_id = v.id
    JOIN defects d ON d.inspection_id = i.id
  `).get().count

  res.json({
    totalVehicles,
    totalInspections,
    inspectionsToday: todayInspections,
    vehiclesWithDefects
  })
})

// ============ SEED DATA ============

app.post('/api/seed', authenticate, (req, res) => {
  if (!ensureManager(req, res)) return

  const { vehicles = 50, inspections = 100 } = req.body

  // Create demo users
  const demoUsers = [
    { email: 'demo_inspector_1@example.com', name: 'Иванов Иван', role: 'inspector' },
    { email: 'demo_inspector_2@example.com', name: 'Петров Петр', role: 'inspector' },
    { email: 'demo_manager@example.com', name: 'Сидоров Сидор', role: 'manager' }
  ]

  const userIds = []

  demoUsers.forEach(user => {
    const id = uuidv4()
    const hashedPassword = bcrypt.hashSync('demo123', 10)
    createUserRecord({ id, email: user.email, passwordHash: hashedPassword, name: user.name, role: user.role, ignoreExisting: true })

    const persistedUserId = getUserIdByEmail(user.email)
    if (persistedUserId) {
      userIds.push(persistedUserId)
    }
  })

  // Create vehicles
  const now = new Date()
  const vehicleRecords = []
  const latestScheduledInspectionByVehicle = new Map()
  const insertVehicle = db.prepare(`
    INSERT INTO vehicles (id, number, name, status, qr_code, region, created_at, last_scheduled_inspection)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const carNames = ['ГАЗель Next', 'ГАЗель Бизнес', 'Соболь', 'Ford Transit', 'Mercedes Sprinter', 'Volkswagen Crafter']
  const statuses = ['active', 'repair']
  const regions = ['Москва', 'Московская обл.', 'Санкт-Петербург', 'Краснодар', 'Екатеринбург', 'Новосибирск']

  for (let i = 1; i <= vehicles; i++) {
    const id = uuidv4()
    const number = generateDemoVehicleNumber()
    const name = randomItem(carNames)
    const status = randomItem(statuses)
    const region = randomItem(regions)
    const createdAt = randomDateBetween(new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000), now).toISOString()

    insertVehicle.run(id, number, name, status, name.split(' ')[0], region, createdAt, null)
    vehicleRecords.push({ id, createdAt })
  }

  // Create inspections
  const insertInspection = db.prepare(`
    INSERT INTO inspections (id, vehicle_id, inspector_id, type, completed, accident_occurred_at, accident_location, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const insertChecklist = db.prepare(`
    INSERT INTO checklist_items (id, inspection_id, title, result)
    VALUES (?, ?, ?, ?)
  `)

  const insertDefect = db.prepare(`
    INSERT INTO defects (id, inspection_id, title, comment, created_at)
    VALUES (?, ?, ?, ?, ?)
  `)

  const quickItems = ['Внешний вид', 'Повреждения кузова', 'Колёса', 'Стекла', 'Госномер']
  const scheduledItems = ['Внешний вид', 'Повреждения кузова', 'Лакокрасочное покрытие', 'Колёса', 'Стекла', 'Фары', 'Зеркала', 'Двери', 'Госномер', 'Двигатель', 'Салон', 'Приборная панель']
  const accidentItems = ['Повреждения кузова', 'Остекление', 'Ходовая', 'Кузов', 'Безопасность']

  for (let i = 0; i < inspections; i++) {
    const insId = uuidv4()
    const vehicle = randomItem(vehicleRecords)
    const vehicleId = vehicle.id
    const userId = randomItem(userIds.slice(0, 2))
    const type = Math.random() > 0.3 ? (Math.random() > 0.7 ? 'accident' : 'quick') : 'scheduled'
    const items = type === 'quick' ? quickItems : type === 'scheduled' ? scheduledItems : accidentItems

    const inspectionDate = randomDateBetween(new Date(vehicle.createdAt), now)
    const inspectionDateIso = inspectionDate.toISOString()
    const accidentOccurredAt = type === 'accident'
      ? new Date(inspectionDate.getTime() - randomInteger(6 * 60 * 60 * 1000)).toISOString()
      : null
    const accidentLocation = type === 'accident' ? `${randomItem(regions)}, участок ${1 + randomInteger(25)}` : null

    insertInspection.run(insId, vehicleId, userId, type, 1, accidentOccurredAt, accidentLocation, inspectionDateIso)

    if (type === 'scheduled') {
      const previousScheduledDate = latestScheduledInspectionByVehicle.get(vehicleId)
      if (!previousScheduledDate || previousScheduledDate < inspectionDateIso) {
        latestScheduledInspectionByVehicle.set(vehicleId, inspectionDateIso)
      }
    }

    items.forEach(title => {
      const itemId = uuidv4()
      const result = Math.random() > 0.2
      insertChecklist.run(itemId, insId, title, result ? 1 : 0)

      if (!result) {
        const defectId = uuidv4()
        const defectDateIso = new Date(inspectionDate.getTime() + randomInteger(4 * 60 * 60 * 1000)).toISOString()
        insertDefect.run(defectId, insId, title, 'Зафиксировано при осмотре', defectDateIso)
      }
    })
  }

  const updateVehicleSchedule = db.prepare('UPDATE vehicles SET last_scheduled_inspection = ? WHERE id = ?')
  latestScheduledInspectionByVehicle.forEach((inspectionDate, vehicleId) => {
    updateVehicleSchedule.run(inspectionDate, vehicleId)
  })

  res.json({ message: API_MESSAGES.demoDataCreated, vehicles: vehicleRecords.length, inspections })
})

// ============ ANALYTICS ============

app.get('/api/analytics/overview', authenticate, (req, res) => {
  const { from = '', to = '' } = req.query
  const now = new Date()
  
  let dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  let dateTo = now
  
  if (from) dateFrom = new Date(from)
  if (to) dateTo = new Date(to + ' 23:59:59')

  // Total stats
  const totalVehicles = db.prepare('SELECT COUNT(*) as count FROM vehicles').get().count
  const totalInspections = db.prepare('SELECT COUNT(*) as count FROM inspections').get().count
  const totalDefects = db.prepare('SELECT COUNT(*) as count FROM defects').get().count

  // Week stats
  const weekInspections = db.prepare(`
    SELECT COUNT(*) as count FROM inspections WHERE created_at >= ?
  `).get(dateFrom.toISOString()).count

  const weekDefects = db.prepare(`
    SELECT COUNT(*) as count FROM defects WHERE created_at >= ?
  `).get(dateFrom.toISOString()).count

  // Month stats
  const monthFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const monthInspections = db.prepare(`
    SELECT COUNT(*) as count FROM inspections WHERE created_at >= ?
  `).get(monthFrom.toISOString()).count

  // Vehicles by status
  const vehiclesByStatus = db.prepare(`
    SELECT status, COUNT(*) as count FROM vehicles GROUP BY status
  `).all()

  // Inspections by type
  const inspectionsByType = db.prepare(`
    SELECT type, COUNT(*) as count FROM inspections GROUP BY type
  `).all()

  // Accident stats
  const totalAccidents = db.prepare(`SELECT COUNT(*) as count FROM inspections WHERE type = 'accident'`).get().count
  const lastAccident = db.prepare(`
    SELECT i.created_at FROM inspections i WHERE type = 'accident' ORDER BY created_at DESC LIMIT 1
  `).get()
  
  let daysWithoutAccident = null
  if (lastAccident) {
    const lastDate = new Date(lastAccident.created_at)
    daysWithoutAccident = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24))
  } else {
    daysWithoutAccident = totalInspections > 0 ? Math.floor((now - new Date('2024-01-01')) / (1000 * 60 * 60 * 24)) : 0
  }

  // Recent accidents
  const recentAccidents = db.prepare(`
    SELECT i.id, i.created_at, v.number as vehicle_number, v.name as vehicle_name,
           u.name as inspector_name,
           (SELECT COUNT(*) FROM defects WHERE inspection_id = i.id) as defects_count
    FROM inspections i
    JOIN vehicles v ON i.vehicle_id = v.id
    JOIN users u ON i.inspector_id = u.id
    WHERE i.type = 'accident'
    ORDER BY i.created_at DESC
    LIMIT 10
  `).all()

  // Daily inspections for date range
  const dailyInspections = db.prepare(`
    SELECT DATE(created_at) as date, COUNT(*) as count 
    FROM inspections 
    WHERE created_at >= ? AND created_at <= ?
    GROUP BY DATE(created_at)
    ORDER BY date
  `).all(dateFrom.toISOString(), dateTo.toISOString())

  // Top vehicles with defects
  const topDefectiveVehicles = db.prepare(`
    SELECT v.id, v.number, v.name, COUNT(d.id) as defects_count
    FROM vehicles v
    JOIN inspections i ON i.vehicle_id = v.id
    JOIN defects d ON d.inspection_id = i.id
    GROUP BY v.id
    ORDER BY defects_count DESC
    LIMIT 10
  `).all()

  res.json({
    total: { vehicles: totalVehicles, inspections: totalInspections, defects: totalDefects },
    week: { inspections: weekInspections, defects: weekDefects },
    month: { inspections: monthInspections },
    vehiclesByStatus,
    inspectionsByType,
    dailyInspections,
    topDefectiveVehicles,
    accidents: {
      total: totalAccidents,
      daysWithoutAccident,
      recent: recentAccidents
    },
    vehiclesByRegion: db.prepare(`
      SELECT COALESCE(region, 'Не указано') as region, COUNT(*) as count
      FROM vehicles
      GROUP BY region
      ORDER BY count DESC
    `).all(),
    inspectionsByRegion: db.prepare(`
      SELECT COALESCE(v.region, 'Не указано') as region, COUNT(*) as count
      FROM inspections i
      JOIN vehicles v ON i.vehicle_id = v.id
      GROUP BY v.region
      ORDER BY count DESC
    `).all(),
    defectsByRegion: db.prepare(`
      SELECT COALESCE(v.region, 'Не указано') as region, COUNT(d.id) as count
      FROM defects d
      JOIN inspections i ON d.inspection_id = i.id
      JOIN vehicles v ON i.vehicle_id = v.id
      GROUP BY v.region
      ORDER BY count DESC
    `).all()
  })
})

app.get('/api/analytics/export/excel', authenticate, (req, res) => {
  const { type = 'vehicles' } = req.query

  let data
  let filename

  if (type === 'vehicles') {
    data = db.prepare(`
      SELECT v.number, v.name, v.status, v.qr_code, v.created_at,
             (SELECT COUNT(*) FROM inspections WHERE vehicle_id = v.id) as inspections_count,
             (SELECT COUNT(*) FROM defects d JOIN inspections i ON d.inspection_id = i.id WHERE i.vehicle_id = v.id) as defects_count
      FROM vehicles v
      ORDER BY v.number
    `).all()
    filename = 'vehicles.xlsx'
  } else if (type === 'inspections') {
    data = db.prepare(`
      SELECT i.id, v.number as vehicle_number, v.name as vehicle_name, 
             i.type, i.completed, i.created_at, u.name as inspector_name,
             (SELECT COUNT(*) FROM defects WHERE inspection_id = i.id) as defects_count
      FROM inspections i
      JOIN vehicles v ON i.vehicle_id = v.id
      JOIN users u ON i.inspector_id = u.id
      ORDER BY i.created_at DESC
      LIMIT 1000
    `).all()
    filename = 'inspections.xlsx'
  } else if (type === 'defects') {
    data = db.prepare(`
      SELECT d.title, d.comment, d.created_at,
             v.number as vehicle_number, v.name as vehicle_name,
             i.type as inspection_type
      FROM defects d
      JOIN inspections i ON d.inspection_id = i.id
      JOIN vehicles v ON i.vehicle_id = v.id
      ORDER BY d.created_at DESC
      LIMIT 1000
    `).all()
    filename = 'defects.xlsx'
  }

  // Return as JSON (frontend will handle Excel conversion)
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Content-Disposition', `attachment; filename=${filename.replace('xlsx', 'json')}`)
  res.json({ data, exportedAt: new Date().toISOString() })
})

initDatabase().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`вњ… Server running on http://0.0.0.0:${PORT}`)
  })
}).catch(err => {
  console.error('Failed to initialize database:', err)
  process.exit(1)
})
