import fs from 'node:fs/promises'
import path from 'node:path'
import bcrypt from 'bcryptjs'
import sharp from 'sharp'
import { uploadsDir, buildUploadUrl } from '../services/photoUpload.js'

export const PUBLIC_DEMO_COMPANY_ID = 'demo'
export const PUBLIC_DEMO_USER_ID = 'demo-manager'
export const PUBLIC_DEMO_EMAIL = 'demo@auditavto.ru'

const VEHICLES = [
  ['demo-vehicle-01', 'А123ВС65', 'ГАЗель Next', 'active', 'Невельск'],
  ['demo-vehicle-02', 'В456СТ65', 'Toyota Hiace', 'active', 'Невельск'],
  ['demo-vehicle-03', 'К777МХ65', 'КамАЗ самосвал', 'repair', 'Южно-Сахалинск'],
  ['demo-vehicle-04', 'М321ОР65', 'Hyundai HD78', 'active', 'Южно-Сахалинск'],
  ['demo-vehicle-05', 'Е505КХ65', 'Ford Transit', 'active', 'Корсаков'],
  ['demo-vehicle-06', 'Н808ТМ65', 'Mercedes Sprinter', 'active', 'Холмск'],
  ['demo-vehicle-07', 'О114РС65', 'ГАЗель Бизнес', 'repair', 'Корсаков'],
  ['demo-vehicle-08', 'Р909КЕ65', 'Isuzu NQR', 'active', 'Южно-Сахалинск'],
  ['demo-vehicle-09', 'С240АМ65', 'УАЗ Профи', 'active', 'Холмск'],
  ['demo-vehicle-10', 'Т615ВН65', 'Toyota Dyna', 'active', 'Южно-Сахалинск'],
  ['demo-vehicle-11', 'У333ХК65', 'КамАЗ 5490', 'active', 'Корсаков'],
  ['demo-vehicle-12', 'Х701МР65', 'Volkswagen Crafter', 'active', 'Невельск'],
]

const DEFECT_TITLES = [
  'Трещина на переднем бампере',
  'Повреждение левого борта',
  'Не работает задний габарит',
  'Износ передней шины',
  'Замечание по тормозной системе',
  'Несоответствие по чек-листу',
]

const RECENT_INSPECTION_DAY_OFFSETS = [
  6, 6,
  5, 5, 5,
  4, 4, 4, 4,
  3, 3, 3,
  2, 2, 2, 2, 2,
  1, 1, 1,
  0,
]

export function getPublicDemoReadiness(db) {
  const company = db.prepare(`
    SELECT id, access_mode, status
    FROM companies
    WHERE id = ?
  `).get(PUBLIC_DEMO_COMPANY_ID)
  const user = db.prepare(`
    SELECT id, status, company_id
    FROM users
    WHERE lower(email) = lower(?)
  `).get(PUBLIC_DEMO_EMAIL)
  const vehicleCount = db.prepare(`
    SELECT COUNT(*) AS count
    FROM vehicles
    WHERE company_id = ?
  `).get(PUBLIC_DEMO_COMPANY_ID)?.count || 0
  const requiredVehicle = db.prepare(`
    SELECT id
    FROM vehicles
    WHERE id = ? AND company_id = ?
  `).get(VEHICLES[0][0], PUBLIC_DEMO_COMPANY_ID)

  return {
    ready: Boolean(
      company?.access_mode === 'demo_readonly'
        && company.status === 'active'
        && user?.status === 'active'
        && user.company_id === PUBLIC_DEMO_COMPANY_ID
        && vehicleCount >= VEHICLES.length
        && requiredVehicle,
    ),
    vehicleCount,
  }
}

function resolveDemoUserId(db) {
  const byEmail = db.prepare('SELECT id FROM users WHERE lower(email) = lower(?)').get(PUBLIC_DEMO_EMAIL)
  if (byEmail?.id) return byEmail.id

  const byId = db.prepare('SELECT id FROM users WHERE id = ?').get(PUBLIC_DEMO_USER_ID)
  if (byId?.id) return byId.id

  return PUBLIC_DEMO_USER_ID
}

function dateDaysAgo(days, hour = 9) {
  const value = new Date()
  value.setUTCHours(hour, 0, 0, 0)
  value.setUTCDate(value.getUTCDate() - days)
  return value.toISOString()
}

function demoOdometerValue(vehicleIndex, daysAgo) {
  const baseMileage = 38_000 + vehicleIndex * 3_200
  const activeDays = Math.max(0, 120 - daysAgo)
  return baseMileage + activeDays * 58
}

function escapeSvgText(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

async function ensureDemoImage({ inspectionId, photoId, title, accent }) {
  const relativeDir = `companies/${PUBLIC_DEMO_COMPANY_ID}/inspections/${inspectionId}/photos/${photoId}`
  const targetDir = path.join(uploadsDir, relativeDir)
  const mainPath = path.join(targetDir, 'main.webp')
  const thumbPath = path.join(targetDir, 'thumb.webp')
  await fs.mkdir(targetDir, { recursive: true })

  const svg = Buffer.from(`
    <svg width="1200" height="800" viewBox="0 0 1200 800" xmlns="http://www.w3.org/2000/svg">
      <rect width="1200" height="800" fill="#f8fafc"/>
      <rect x="70" y="70" width="1060" height="660" rx="42" fill="#ffffff" stroke="#dbe4ee" stroke-width="4"/>
      <rect x="70" y="70" width="1060" height="18" rx="9" fill="${accent}"/>
      <text x="130" y="190" font-family="Arial, sans-serif" font-size="38" font-weight="700" fill="#172033">AuditAvto</text>
      <text x="130" y="280" font-family="Arial, sans-serif" font-size="58" font-weight="700" fill="#172033">${escapeSvgText(title)}</text>
      <text x="130" y="350" font-family="Arial, sans-serif" font-size="30" fill="#64748b">Тестовая фотофиксация демо-парка</text>
      <rect x="130" y="440" width="940" height="170" rx="28" fill="#f1f5f9"/>
      <circle cx="240" cy="525" r="54" fill="${accent}" opacity="0.18"/>
      <path d="M208 525h64M240 493v64" stroke="${accent}" stroke-width="16" stroke-linecap="round"/>
      <text x="330" y="510" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#334155">Демонстрационные данные</text>
      <text x="330" y="558" font-family="Arial, sans-serif" font-size="24" fill="#64748b">Не относятся к реальной компании или технике</text>
    </svg>
  `)

  await sharp(svg).webp({ quality: 84 }).toFile(mainPath)
  await sharp(svg).resize({ width: 480 }).webp({ quality: 76 }).toFile(thumbPath)
  const [mainStat, thumbStat] = await Promise.all([fs.stat(mainPath), fs.stat(thumbPath)])

  return {
    url: buildUploadUrl(`${relativeDir}/main.webp`),
    webpUrl: buildUploadUrl(`${relativeDir}/main.webp`),
    thumbUrl: buildUploadUrl(`${relativeDir}/thumb.webp`),
    sizeWebp: mainStat.size,
    sizeThumb: thumbStat.size,
  }
}

export async function provisionPublicDemo({ db, password }) {
  const demoPassword = String(password || '').trim()
  if (demoPassword.length < 12) {
    throw new Error('PUBLIC_DEMO_PASSWORD must contain at least 12 characters')
  }
  const demoUserId = resolveDemoUserId(db)

  const photos = await Promise.all([
    ensureDemoImage({
      inspectionId: 'demo-inspection-01',
      photoId: 'demo-photo-front',
      title: 'Общий вид автомобиля',
      accent: '#f97316',
    }),
    ensureDemoImage({
      inspectionId: 'demo-inspection-02',
      photoId: 'demo-photo-odometer',
      title: 'Показания одометра',
      accent: '#2563eb',
    }),
    ensureDemoImage({
      inspectionId: 'demo-inspection-03',
      photoId: 'demo-photo-defect',
      title: 'Фото дефекта',
      accent: '#dc2626',
    }),
  ])

  db.exec('BEGIN TRANSACTION')
  try {
    db.prepare(`
      INSERT INTO companies (id, slug, name, access_mode, region_code, data_residency, status)
      VALUES (?, ?, ?, 'demo_readonly', ?, ?, 'active')
      ON CONFLICT(id) DO UPDATE SET
        slug = excluded.slug,
        name = excluded.name,
        access_mode = 'demo_readonly',
        status = 'active'
    `).run(PUBLIC_DEMO_COMPANY_ID, 'demo', 'Демо-парк', 'RU-SAK', 'Russia')

    const passwordHash = bcrypt.hashSync(demoPassword, 10)
    db.prepare(`
      INSERT INTO users (id, email, password, name, role, status, company_id, mfa_enabled, mfa_secret)
      VALUES (?, ?, ?, ?, 'manager', 'active', ?, 0, NULL)
      ON CONFLICT(email) DO UPDATE SET
        password = excluded.password,
        name = excluded.name,
        role = 'manager',
        status = 'active',
        company_id = excluded.company_id,
        mfa_enabled = 0,
        mfa_secret = NULL
      ON CONFLICT(id) DO UPDATE SET
        email = excluded.email,
        password = excluded.password,
        name = excluded.name,
        role = 'manager',
        status = 'active',
        company_id = excluded.company_id,
        mfa_enabled = 0,
        mfa_secret = NULL
    `).run(
      demoUserId,
      PUBLIC_DEMO_EMAIL,
      passwordHash,
      'Демо-менеджер',
      PUBLIC_DEMO_COMPANY_ID,
    )

    db.prepare(`
      INSERT INTO company_limits (
        id, company_id, plan_code, max_vehicles, max_users, max_inspections_per_month,
        max_storage_mb, analytics_enabled, accident_module_enabled, pdf_report_enabled, export_enabled, updated_at
      )
      VALUES (?, ?, 'standard', 20, 3, 100, 1024, 1, 1, 1, 1, datetime('now'))
      ON CONFLICT(company_id) DO UPDATE SET
        plan_code = 'standard',
        max_vehicles = 20,
        max_users = 3,
        max_inspections_per_month = 100,
        max_storage_mb = 1024,
        analytics_enabled = 1,
        accident_module_enabled = 1,
        pdf_report_enabled = 1,
        export_enabled = 1,
        updated_at = datetime('now')
    `).run('demo-limits', PUBLIC_DEMO_COMPANY_ID)

    db.prepare(`
      INSERT INTO company_billing (
        id, company_id, plan_code, billing_status, paid_until, created_at, updated_at
      )
      VALUES (?, ?, 'standard', 'active', date('now', '+10 years'), datetime('now'), datetime('now'))
      ON CONFLICT(company_id) DO UPDATE SET
        plan_code = 'standard',
        billing_status = 'active',
        paid_until = date('now', '+10 years'),
        updated_at = datetime('now')
    `).run('demo-billing', PUBLIC_DEMO_COMPANY_ID)

    for (const [id, number, name, status, region] of VEHICLES) {
      db.prepare(`
        INSERT INTO vehicles (id, number, name, status, region, company_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          number = excluded.number,
          name = excluded.name,
          status = excluded.status,
          region = excluded.region,
          company_id = excluded.company_id
      `).run(id, number, name, status, region, PUBLIC_DEMO_COMPANY_ID, dateDaysAgo(120))
    }

    for (let index = 0; index < 36; index += 1) {
      const id = `demo-inspection-${String(index + 1).padStart(2, '0')}`
      const vehicleIndex = index % VEHICLES.length
      const vehicle = VEHICLES[vehicleIndex]
      const type = index % 11 === 0 ? 'accident' : index % 3 === 0 ? 'scheduled' : 'quick'
      const daysAgo = index < RECENT_INSPECTION_DAY_OFFSETS.length
        ? RECENT_INSPECTION_DAY_OFFSETS[index]
        : 9 + (index - RECENT_INSPECTION_DAY_OFFSETS.length) * 4
      const createdAt = dateDaysAgo(daysAgo, 8 + (index % 8))
      db.prepare(`
        INSERT INTO inspections (
          id, vehicle_id, inspector_id, company_id, type, completed,
          accident_occurred_at, accident_location, odometer_value, odometer_unit, odometer_confirmed_at, created_at
        )
        VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, 'km', ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          vehicle_id = excluded.vehicle_id,
          inspector_id = excluded.inspector_id,
          company_id = excluded.company_id,
          type = excluded.type,
          completed = 1,
          accident_occurred_at = excluded.accident_occurred_at,
          accident_location = excluded.accident_location,
          odometer_value = excluded.odometer_value,
          odometer_unit = 'km',
          odometer_confirmed_at = excluded.odometer_confirmed_at,
          created_at = excluded.created_at
      `).run(
        id,
        vehicle[0],
        demoUserId,
        PUBLIC_DEMO_COMPANY_ID,
        type,
        type === 'accident' ? createdAt : null,
        type === 'accident' ? 'Южно-Сахалинск, проспект Мира' : null,
        demoOdometerValue(vehicleIndex, daysAgo),
        createdAt,
        createdAt,
      )

      const checklistTitles = type === 'scheduled'
        ? ['Кузов', 'Шины и диски', 'Тормозная система', 'Электрика и свет']
        : ['Общий вид', 'Кузов', 'Госномер', 'Одометр']
      for (let itemIndex = 0; itemIndex < checklistTitles.length; itemIndex += 1) {
        const itemId = `${id}-check-${itemIndex + 1}`
        db.prepare(`
          INSERT INTO checklist_items (id, inspection_id, title, result, comment)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            inspection_id = excluded.inspection_id,
            title = excluded.title,
            result = excluded.result,
            comment = excluded.comment
        `).run(itemId, id, checklistTitles[itemIndex], itemIndex === 1 && index % 4 === 0 ? 0 : 1, null)
      }
    }

    for (let index = 0; index < 16; index += 1) {
      const inspectionIndex = index * 2 + 1
      const inspectionId = `demo-inspection-${String(inspectionIndex).padStart(2, '0')}`
      const id = `demo-defect-${String(index + 1).padStart(2, '0')}`
      const closed = index >= 8
      db.prepare(`
        INSERT INTO defects (
          id, inspection_id, company_id, title, comment, status, created_at, closed_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          inspection_id = excluded.inspection_id,
          company_id = excluded.company_id,
          title = excluded.title,
          comment = excluded.comment,
          status = excluded.status,
          created_at = excluded.created_at,
          closed_at = excluded.closed_at
      `).run(
        id,
        inspectionId,
        PUBLIC_DEMO_COMPANY_ID,
        DEFECT_TITLES[index % DEFECT_TITLES.length],
        'Зафиксировано при демонстрационном осмотре.',
        closed ? 'closed' : 'open',
        dateDaysAgo(inspectionIndex * 2),
        closed ? dateDaysAgo(Math.max(1, inspectionIndex - 5)) : null,
      )
    }

    const photoRows = [
      ['demo-photo-front', 'demo-inspection-01', null, 'front', photos[0]],
      ['demo-photo-odometer', 'demo-inspection-02', null, 'odometer', photos[1]],
      ['demo-photo-defect', 'demo-inspection-03', 'demo-defect-02', 'damage_detail', photos[2]],
    ]
    for (const [id, inspectionId, defectId, photoType, photo] of photoRows) {
      db.prepare(`
        INSERT INTO photos (
          id, inspection_id, defect_id, company_id, photo_type, url, webp_url, thumb_url,
          original_mime, original_name, width, height, size_webp, size_thumb, is_required, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'image/webp', ?, 1200, 800, ?, ?, 1, datetime('now'))
        ON CONFLICT(id) DO UPDATE SET
          inspection_id = excluded.inspection_id,
          defect_id = excluded.defect_id,
          company_id = excluded.company_id,
          photo_type = excluded.photo_type,
          url = excluded.url,
          webp_url = excluded.webp_url,
          thumb_url = excluded.thumb_url,
          size_webp = excluded.size_webp,
          size_thumb = excluded.size_thumb
      `).run(
        id,
        inspectionId,
        defectId,
        PUBLIC_DEMO_COMPANY_ID,
        photoType,
        photo.url,
        photo.webpUrl,
        photo.thumbUrl,
        `${id}.webp`,
        photo.sizeWebp,
        photo.sizeThumb,
      )
    }

    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}
