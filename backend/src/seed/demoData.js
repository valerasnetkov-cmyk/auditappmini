import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { LICENSE_PLATE_ALLOWED_CYRILLIC } from '../utils/transliteration.js'

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
  const pickLetter = () => LICENSE_PLATE_ALLOWED_CYRILLIC[Math.floor(Math.random() * LICENSE_PLATE_ALLOWED_CYRILLIC.length)]
  const digits = String(Math.floor(Math.random() * 1000)).padStart(3, '0')
  const regionNumber = String(10 + Math.floor(Math.random() * 190)).padStart(2, '0')
  return `${pickLetter()}${digits}${pickLetter()}${pickLetter()}${regionNumber}`
}

export default function registerDemoDataSeedRoutes({
  app,
  db,
  authenticate,
  ensureManager,
  API_MESSAGES,
  createUserRecord,
  getUserIdByEmail,
}) {
  app.post('/api/seed', authenticate, (req, res) => {
    if (!ensureManager(req, res)) return

    const { vehicles = 50, inspections = 100 } = req.body

    const existingCompanies = db.prepare('SELECT COUNT(*) as count FROM companies').get().count
    if (existingCompanies === 0) {
      db.prepare(`
        INSERT INTO companies (id, slug, name, region_code, data_residency, api_cluster_key, storage_cluster_key, ocr_cluster_key)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'default',
        'default',
        'Тестовая компания',
        'RU-MOS',
        'Russia',
        'default-key',
        'default-storage',
        'default-ocr'
      )
    }

    try {
      db.prepare('UPDATE users SET company_id = ? WHERE company_id IS NULL OR company_id = ? OR company_id = ?').run('default', 'default', 'default')
      db.prepare('UPDATE vehicles SET company_id = ? WHERE company_id IS NULL OR company_id = ? OR company_id = ?').run('default', 'default', 'default')
      db.prepare('UPDATE inspections SET company_id = ? WHERE company_id IS NULL OR company_id = ? OR company_id = ?').run('default', 'default', 'default')
      db.prepare('UPDATE defects SET company_id = ? WHERE company_id IS NULL OR company_id = ? OR company_id = ?').run('default', 'default', 'default')
    } catch (e) {
      console.log('Note: Some company_id columns may not exist yet:', e.message)
    }

    const demoUsers = [
      { email: 'demo_inspector_1@example.com', name: 'Иванов Иван', role: 'inspector' },
      { email: 'demo_inspector_2@example.com', name: 'Петров Петр', role: 'inspector' },
      { email: 'demo_manager@example.com', name: 'Сидоров Сидор', role: 'manager' },
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

    const now = new Date()
    const vehicleRecords = []
    const latestScheduledInspectionByVehicle = new Map()
    const insertVehicle = db.prepare(`
      INSERT INTO vehicles (id, number, name, status, region, company_id, created_at, last_scheduled_inspection)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const carNames = ['ГАЗель Next', 'ГАЗель Бизнес', 'Соболь', 'Ford Transit', 'Mercedes Sprinter', 'Volkswagen Crafter']
    const statuses = ['active', 'repair']
    const regions = ['Москва', 'Московская обл.', 'Санкт-Петербург', 'Краснодар', 'Екатеринбург', 'Новосибирск']
    const companyId = 'default'

    for (let i = 1; i <= vehicles; i++) {
      const id = uuidv4()
      const number = generateDemoVehicleNumber()
      const name = randomItem(carNames)
      const status = randomItem(statuses)
      const region = randomItem(regions)
      const createdAt = randomDateBetween(new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000), now).toISOString()

      insertVehicle.run(id, number, name, status, region, companyId, createdAt, null)
      vehicleRecords.push({ id, createdAt })
    }

    const insertInspection = db.prepare(`
      INSERT INTO inspections (id, vehicle_id, inspector_id, type, completed, accident_occurred_at, accident_location, company_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const insertChecklist = db.prepare(`
      INSERT INTO checklist_items (id, inspection_id, title, result)
      VALUES (?, ?, ?, ?)
    `)

    const insertDefect = db.prepare(`
      INSERT INTO defects (id, inspection_id, title, comment, company_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
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

      insertInspection.run(insId, vehicleId, userId, type, 1, accidentOccurredAt, accidentLocation, companyId, inspectionDateIso)

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
          insertDefect.run(defectId, insId, title, 'Зафиксировано при осмотре', companyId, defectDateIso)
        }
      })
    }

    const updateVehicleSchedule = db.prepare('UPDATE vehicles SET last_scheduled_inspection = ? WHERE id = ?')
    latestScheduledInspectionByVehicle.forEach((inspectionDate, vehicleId) => {
      updateVehicleSchedule.run(inspectionDate, vehicleId)
    })

    res.json({ message: API_MESSAGES.demoDataCreated, vehicles: vehicleRecords.length, inspections })
  })
}
