import { isOlderThan } from './resourceCompanies.js'

const number = (value) => Number(value || 0)

function count(db, sql, params = []) {
  const row = db.prepare(sql).get(...params)
  return number(row?.count)
}

function listHealthCompanies(db, sql) {
  return db.prepare(sql).all().map((company) => ({
    id: company.id,
    slug: company.slug || null,
    name: company.name,
    status: company.status || 'active',
  }))
}

function createDateBuckets(days = 30) {
  const buckets = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(today)
    date.setDate(today.getDate() - index)
    buckets.push(date.toISOString().slice(0, 10))
  }

  return buckets
}

function rowsToDateMap(rows, field = 'count') {
  return rows.reduce((acc, row) => {
    acc[row.date] = number(row[field])
    return acc
  }, {})
}

export function getServiceHealth(db) {
  const companiesWithoutOwnerList = listHealthCompanies(db, `
    SELECT c.id, c.slug, c.name, COALESCE(c.status, 'active') as status
    FROM companies c
    LEFT JOIN users u ON u.company_id = c.id AND u.role = 'owner' AND COALESCE(u.status, 'active') = 'active'
    WHERE u.id IS NULL
    ORDER BY c.name COLLATE NOCASE ASC
    LIMIT 20
  `)
  const companiesWithoutLimitsList = listHealthCompanies(db, `
    SELECT c.id, c.slug, c.name, COALESCE(c.status, 'active') as status
    FROM companies c
    LEFT JOIN company_limits l ON l.company_id = c.id
    WHERE l.company_id IS NULL
    ORDER BY c.name COLLATE NOCASE ASC
    LIMIT 20
  `)

  return {
    companiesWithoutOwner: companiesWithoutOwnerList.length,
    companiesWithoutLimits: companiesWithoutLimitsList.length,
    companiesWithoutOwnerList,
    companiesWithoutLimitsList,
  }
}

export function buildHealthItems({
  serviceHealth,
  inactiveCompanies14d,
  unfinishedInspectionsOlderThan24h,
  defectsWithoutPhotos,
  accidentInspectionsWithoutRequiredData,
}) {
  const dataQualityCount = unfinishedInspectionsOlderThan24h
    + defectsWithoutPhotos
    + accidentInspectionsWithoutRequiredData

  return [
    {
      key: 'companies_without_owner',
      severity: serviceHealth.companiesWithoutOwner ? 'high' : 'ok',
      title: 'Компании без владельца',
      description: 'Нужно назначить владельца, чтобы компания могла управлять своей командой.',
      count: serviceHealth.companiesWithoutOwner,
      actionLabel: 'Назначить владельца',
      actionHref: '/saas-admin/companies',
    },
    {
      key: 'companies_without_limits',
      severity: serviceHealth.companiesWithoutLimits ? 'high' : 'ok',
      title: 'Компании без лимитов',
      description: 'Без лимитов нельзя корректно контролировать тариф и потребление.',
      count: serviceHealth.companiesWithoutLimits,
      actionLabel: 'Настроить лимиты',
      actionHref: '/saas-admin/companies',
    },
    {
      key: 'inactive_14d',
      severity: inactiveCompanies14d ? 'medium' : 'ok',
      title: 'Нет активности 14+ дней',
      description: 'Кандидаты на customer success контакт или проверку запуска.',
      count: inactiveCompanies14d,
      actionLabel: 'Проверить запуск',
      actionHref: '/saas-admin/dashboard',
    },
    {
      key: 'data_quality',
      severity: dataQualityCount ? 'medium' : 'ok',
      title: 'Качество данных',
      description: 'Незавершенные осмотры, дефекты без фото или ДТП без обязательных полей.',
      count: dataQualityCount,
      actionLabel: 'Смотреть агрегаты',
      actionHref: '/saas-admin/dashboard',
    },
  ]
}

export function buildHealthCenter(db, companies) {
  const serviceHealth = getServiceHealth(db)
  const inactiveCompanies14d = companies.filter(
    (company) => company.status !== 'inactive' && isOlderThan(company.lastActivityAt, 14),
  ).length
  const companiesWithoutPlan = companies.filter((company) => !company.limits?.planCode).length
  const unfinishedInspectionsOlderThan24h = count(db, `
    SELECT COUNT(*) as count
    FROM inspections
    WHERE COALESCE(completed, 0) = 0 AND created_at < datetime('now', '-24 hours')
  `)
  const defectsWithoutPhotos = count(db, `
    SELECT COUNT(*) as count
    FROM defects d
    LEFT JOIN photos p ON p.defect_id = d.id
    WHERE p.id IS NULL
  `)
  const accidentInspectionsWithoutRequiredData = count(db, `
    SELECT COUNT(*) as count
    FROM inspections
    WHERE type = 'accident'
      AND (accident_occurred_at IS NULL OR accident_location IS NULL OR trim(accident_location) = '')
  `)
  const orphanRecords = {
    vehicles: count(db, `SELECT COUNT(*) as count FROM vehicles v LEFT JOIN companies c ON c.id = v.company_id WHERE c.id IS NULL`),
    inspections: count(db, `SELECT COUNT(*) as count FROM inspections i LEFT JOIN companies c ON c.id = i.company_id WHERE c.id IS NULL`),
    defects: count(db, `SELECT COUNT(*) as count FROM defects d LEFT JOIN companies c ON c.id = d.company_id WHERE c.id IS NULL`),
    photos: count(db, `SELECT COUNT(*) as count FROM photos p LEFT JOIN companies c ON c.id = p.company_id WHERE c.id IS NULL`),
    users: count(db, `SELECT COUNT(*) as count FROM users u LEFT JOIN companies c ON c.id = u.company_id WHERE u.role NOT IN ('admin', 'resource_manager') AND c.id IS NULL`),
  }

  return {
    ...serviceHealth,
    companiesWithoutPlan,
    inactiveCompanies14d,
    orphanRecords,
    unfinishedInspectionsOlderThan24h,
    defectsWithoutPhotos,
    accidentInspectionsWithoutRequiredData,
    items: buildHealthItems({
      serviceHealth,
      inactiveCompanies14d,
      unfinishedInspectionsOlderThan24h,
      defectsWithoutPhotos,
      accidentInspectionsWithoutRequiredData,
    }),
  }
}

export function mapTotals(row = {}) {
  return {
    companies: number(row.companies),
    activeCompanies: number(row.activeCompanies),
    activeCompanies7d: number(row.activeCompanies7d),
    activeCompanies30d: number(row.activeCompanies30d),
    inactiveCompanies: number(row.inactiveCompanies),
    tenantUsers: number(row.tenantUsers),
    owners: number(row.owners),
    managers: number(row.managers),
    inspectors: number(row.inspectors),
    plans: number(row.plans),
    vehicles: number(row.vehicles),
    inspections: number(row.inspections),
    inspections24h: number(row.inspections24h),
    inspections7d: number(row.inspections7d),
    accidents: number(row.accidents),
    defects: number(row.defects),
    photos: number(row.photos),
    inspections30d: number(row.inspections30d),
    accidents30d: number(row.accidents30d),
    quickInspections30d: number(row.quickInspections30d),
    scheduledInspections30d: number(row.scheduledInspections30d),
    completedInspections: number(row.completedInspections),
    unfinishedInspections: number(row.unfinishedInspections),
    activeInspectors30d: number(row.activeInspectors30d),
    openDefects: number(row.openDefects),
    activeVehicles: number(row.activeVehicles),
    repairVehicles: number(row.repairVehicles),
  }
}

export function getTotals(db) {
  const row = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM companies) as companies,
      (SELECT COUNT(*) FROM companies WHERE COALESCE(status, 'active') = 'active') as activeCompanies,
      (SELECT COUNT(DISTINCT company_id) FROM inspections WHERE created_at >= datetime('now', '-7 days')) as activeCompanies7d,
      (SELECT COUNT(DISTINCT company_id) FROM inspections WHERE created_at >= datetime('now', '-30 days')) as activeCompanies30d,
      (SELECT COUNT(*) FROM companies WHERE status = 'inactive') as inactiveCompanies,
      (SELECT COUNT(*) FROM users WHERE role NOT IN ('admin', 'resource_manager')) as tenantUsers,
      (SELECT COUNT(*) FROM users WHERE role = 'owner') as owners,
      (SELECT COUNT(*) FROM users WHERE role = 'manager') as managers,
      (SELECT COUNT(*) FROM users WHERE role = 'inspector') as inspectors,
      (SELECT COUNT(*) FROM plans) as plans,
      (SELECT COUNT(*) FROM vehicles) as vehicles,
      (SELECT COUNT(*) FROM inspections) as inspections,
      (SELECT COUNT(*) FROM inspections WHERE created_at >= datetime('now', '-24 hours')) as inspections24h,
      (SELECT COUNT(*) FROM inspections WHERE created_at >= datetime('now', '-7 days')) as inspections7d,
      (SELECT COUNT(*) FROM inspections WHERE type = 'accident') as accidents,
      (SELECT COUNT(*) FROM defects) as defects,
      (SELECT COUNT(*) FROM photos) as photos,
      (SELECT COUNT(*) FROM inspections WHERE created_at >= datetime('now', '-30 days')) as inspections30d,
      (SELECT COUNT(*) FROM inspections WHERE type = 'accident' AND created_at >= datetime('now', '-30 days')) as accidents30d,
      (SELECT COUNT(*) FROM inspections WHERE type = 'quick' AND created_at >= datetime('now', '-30 days')) as quickInspections30d,
      (SELECT COUNT(*) FROM inspections WHERE type = 'scheduled' AND created_at >= datetime('now', '-30 days')) as scheduledInspections30d,
      (SELECT COUNT(*) FROM inspections WHERE COALESCE(completed, 0) = 1) as completedInspections,
      (SELECT COUNT(*) FROM inspections WHERE COALESCE(completed, 0) = 0) as unfinishedInspections,
      (SELECT COUNT(DISTINCT inspector_id) FROM inspections WHERE created_at >= datetime('now', '-30 days')) as activeInspectors30d,
      (SELECT COUNT(*) FROM defects WHERE status = 'open') as openDefects,
      (SELECT COUNT(*) FROM vehicles WHERE status = 'active') as activeVehicles,
      (SELECT COUNT(*) FROM vehicles WHERE status = 'repair') as repairVehicles
  `).get()

  return mapTotals(row)
}

export function getPlanBreakdown(db) {
  return db.prepare(`
    SELECT
      COALESCE(l.plan_code, 'unassigned') as planCode,
      COALESCE(p.name, 'Без тарифа') as planName,
      COALESCE(p.monthly_price_rub, 0) as monthlyPriceRub,
      COUNT(c.id) as companies,
      SUM(CASE WHEN COALESCE(c.status, 'active') = 'active' THEN 1 ELSE 0 END) as activeCompanies,
      SUM(CASE WHEN COALESCE(c.status, 'active') = 'active' THEN COALESCE(p.monthly_price_rub, 0) ELSE 0 END) as monthlyRevenueRub,
      SUM((SELECT COUNT(*) FROM vehicles v WHERE v.company_id = c.id)) as vehicles,
      SUM((SELECT COUNT(*) FROM inspections i WHERE i.company_id = c.id)) as inspections,
      SUM((SELECT COUNT(*) FROM inspections i WHERE i.company_id = c.id AND i.type = 'accident')) as accidents
    FROM companies c
    LEFT JOIN company_limits l ON l.company_id = c.id
    LEFT JOIN plans p ON p.code = l.plan_code
    GROUP BY COALESCE(l.plan_code, 'unassigned'), COALESCE(p.name, 'Без тарифа'), COALESCE(p.monthly_price_rub, 0)
    ORDER BY activeCompanies DESC, companies DESC, planName COLLATE NOCASE ASC
  `).all().map((row) => ({
    planCode: row.planCode,
    planName: row.planName,
    monthlyPriceRub: number(row.monthlyPriceRub),
    companies: number(row.companies),
    activeCompanies: number(row.activeCompanies),
    monthlyRevenueRub: number(row.monthlyRevenueRub),
    usage: {
      vehicles: number(row.vehicles),
      inspections: number(row.inspections),
      accidents: number(row.accidents),
    },
  }))
}

export function getActivityTrend(db) {
  return db.prepare(`
    SELECT
      date(created_at) as date,
      COUNT(*) as inspections,
      SUM(CASE WHEN type = 'accident' THEN 1 ELSE 0 END) as accidents
    FROM inspections
    WHERE created_at >= datetime('now', '-29 days')
    GROUP BY date(created_at)
    ORDER BY date(created_at) ASC
  `).all().map((row) => ({
    date: row.date,
    inspections: number(row.inspections),
    accidents: number(row.accidents),
  }))
}

export function buildProductActivity({
  companies,
  totals,
  dates,
  inspectionRows,
  defectRows,
  photoRows,
  accidentRows,
  typeRows,
}) {
  const inspectionsByDate = rowsToDateMap(inspectionRows)
  const defectsByDate = rowsToDateMap(defectRows)
  const photosByDate = rowsToDateMap(photoRows)
  const accidentsByDate = rowsToDateMap(accidentRows)
  const typeByDate = typeRows.reduce((acc, row) => {
    acc[row.date] = {
      quick: number(row.quick),
      scheduled: number(row.scheduled),
      accident: number(row.accident),
    }
    return acc
  }, {})

  const totalInspections = number(totals.inspections)
  const completedInspections = number(totals.completedInspections)
  const activeCompanies30d = Math.max(1, number(totals.activeCompanies30d))

  return {
    kpi: {
      inspections24h: number(totals.inspections24h),
      inspections7d: number(totals.inspections7d),
      inspections30d: number(totals.inspections30d),
      quickInspections30d: number(totals.quickInspections30d),
      scheduledInspections30d: number(totals.scheduledInspections30d),
      accidentInspections30d: number(totals.accidents30d),
      completedInspections,
      unfinishedInspections: number(totals.unfinishedInspections),
      completionRate: totalInspections ? Math.round((completedInspections / totalInspections) * 100) : 0,
      averagePhotosPerInspection: totalInspections ? Math.round((number(totals.photos) / totalInspections) * 10) / 10 : 0,
      defectsPer100Inspections: totalInspections ? Math.round((number(totals.defects) / totalInspections) * 100) : 0,
      activeInspectors30d: number(totals.activeInspectors30d),
      averageInspectionsPerActiveCompany30d: Math.round(number(totals.inspections30d) / activeCompanies30d),
    },
    series30d: dates.map((date) => ({
      date,
      inspections: inspectionsByDate[date] || 0,
      defects: defectsByDate[date] || 0,
      accidents: accidentsByDate[date] || 0,
      photos: photosByDate[date] || 0,
    })),
    inspectionTypesSeries30d: dates.map((date) => ({
      date,
      quick: typeByDate[date]?.quick || 0,
      scheduled: typeByDate[date]?.scheduled || 0,
      accident: typeByDate[date]?.accident || 0,
    })),
    companyWorkload: [...companies]
      .sort((a, b) => ((b.usage?.inspections || 0) + (b.usage?.photos || 0)) - ((a.usage?.inspections || 0) + (a.usage?.photos || 0)))
      .slice(0, 10)
      .map((company) => ({
        companyId: company.id,
        companyName: company.name,
        vehicles: company.usage?.vehicles || 0,
        inspections: company.usage?.inspections || 0,
        defects: company.usage?.defects || 0,
        accidents: company.usage?.accidents || 0,
        photos: company.usage?.photos || 0,
      })),
  }
}

export function getProductActivity(db, companies, totals) {
  const dates = createDateBuckets(30)
  const inspectionRows = db.prepare(`
    SELECT date(created_at) as date, COUNT(*) as count
    FROM inspections
    WHERE created_at >= datetime('now', '-29 days')
    GROUP BY date(created_at)
  `).all()
  const defectRows = db.prepare(`
    SELECT date(created_at) as date, COUNT(*) as count
    FROM defects
    WHERE created_at >= datetime('now', '-29 days')
    GROUP BY date(created_at)
  `).all()
  const photoRows = db.prepare(`
    SELECT date(created_at) as date, COUNT(*) as count
    FROM photos
    WHERE created_at >= datetime('now', '-29 days')
    GROUP BY date(created_at)
  `).all()
  const accidentRows = db.prepare(`
    SELECT date(created_at) as date, COUNT(*) as count
    FROM inspections
    WHERE type = 'accident' AND created_at >= datetime('now', '-29 days')
    GROUP BY date(created_at)
  `).all()
  const typeRows = db.prepare(`
    SELECT
      date(created_at) as date,
      SUM(CASE WHEN type = 'quick' THEN 1 ELSE 0 END) as quick,
      SUM(CASE WHEN type = 'scheduled' THEN 1 ELSE 0 END) as scheduled,
      SUM(CASE WHEN type = 'accident' THEN 1 ELSE 0 END) as accident
    FROM inspections
    WHERE created_at >= datetime('now', '-29 days')
    GROUP BY date(created_at)
  `).all()

  return buildProductActivity({
    companies,
    totals,
    dates,
    inspectionRows,
    defectRows,
    photoRows,
    accidentRows,
    typeRows,
  })
}

export function mapStorageStats(row = {}, byCompany = []) {
  return {
    totalPhotos: number(row.totalPhotos),
    photos30d: number(row.photos30d),
    totalStorageBytes: number(row.totalStorageBytes),
    avgOriginalSizeBytes: row.avgOriginalSizeBytes === null ? null : Math.round(number(row.avgOriginalSizeBytes)),
    avgWebpSizeBytes: row.avgWebpSizeBytes === null ? null : Math.round(number(row.avgWebpSizeBytes)),
    estimatedSavedBytes: number(row.estimatedSavedBytes),
    uploadErrors: 0,
    webpErrors: 0,
    byCompany,
  }
}

export function getStorageStats(db) {
  const row = db.prepare(`
    SELECT
      COUNT(*) as totalPhotos,
      SUM(CASE WHEN created_at >= datetime('now', '-30 days') THEN 1 ELSE 0 END) as photos30d,
      SUM(COALESCE(size_original, 0) + COALESCE(size_webp, 0) + COALESCE(size_thumb, 0)) as totalStorageBytes,
      AVG(size_original) as avgOriginalSizeBytes,
      AVG(size_webp) as avgWebpSizeBytes,
      SUM(CASE
        WHEN size_original IS NOT NULL AND size_webp IS NOT NULL AND size_original > size_webp
        THEN size_original - size_webp
        ELSE 0
      END) as estimatedSavedBytes
    FROM photos
  `).get()
  const byCompany = db.prepare(`
    SELECT
      c.id as companyId,
      c.name as companyName,
      COUNT(p.id) as photos,
      SUM(COALESCE(p.size_original, 0) + COALESCE(p.size_webp, 0) + COALESCE(p.size_thumb, 0)) as storageBytes
    FROM companies c
    LEFT JOIN photos p ON p.company_id = c.id
    GROUP BY c.id, c.name
    ORDER BY storageBytes DESC, photos DESC, c.name COLLATE NOCASE ASC
    LIMIT 10
  `).all().map((item) => ({
    companyId: item.companyId,
    companyName: item.companyName,
    photos: number(item.photos),
    storageBytes: number(item.storageBytes),
  }))

  return mapStorageStats(row, byCompany)
}

export function getOcrStats(db, companies) {
  const odometerSuccess = count(db, `SELECT COUNT(*) as count FROM inspections WHERE odometer_recognized_at IS NOT NULL`)
  return {
    plateAttempts: 0,
    plateSuccess: 0,
    plateSuccessRate: null,
    plateManualCorrections: 0,
    odometerAttempts: odometerSuccess,
    odometerSuccess,
    odometerSuccessRate: odometerSuccess ? 100 : null,
    avgConfidence: null,
    errors: 0,
    companiesWithOcrDisabled: companies.filter((company) => !company.limits?.ocrEnabled).length,
  }
}

export function mapActivationFunnel(row = {}) {
  const companiesCreated = number(row.companiesCreated)
  const active30d = number(row.active30d)

  return {
    activationRate: companiesCreated ? Math.round((active30d / companiesCreated) * 100) : 0,
    funnel: {
      companiesCreated,
      ownerAssigned: number(row.ownerAssigned),
      ownerLoggedIn: number(row.ownerLoggedIn),
      vehicleAdded: number(row.vehicleAdded),
      firstInspectionCreated: number(row.firstInspectionCreated),
      fiveInspectionsReached: number(row.fiveInspectionsReached),
      active30d,
    },
  }
}

export function getActivationFunnel(db) {
  const row = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM companies) as companiesCreated,
      (SELECT COUNT(DISTINCT c.id)
        FROM companies c
        JOIN users u ON u.company_id = c.id AND u.role = 'owner') as ownerAssigned,
      (SELECT COUNT(DISTINCT c.id)
        FROM companies c
        JOIN users u ON u.company_id = c.id AND u.role = 'owner' AND u.last_login_at IS NOT NULL) as ownerLoggedIn,
      (SELECT COUNT(DISTINCT company_id) FROM vehicles) as vehicleAdded,
      (SELECT COUNT(DISTINCT company_id) FROM inspections) as firstInspectionCreated,
      (SELECT COUNT(*)
        FROM (
          SELECT company_id
          FROM inspections
          GROUP BY company_id
          HAVING COUNT(*) >= 5
        )) as fiveInspectionsReached,
      (SELECT COUNT(DISTINCT company_id)
        FROM inspections
        WHERE created_at >= datetime('now', '-30 days')) as active30d
  `).get()

  return mapActivationFunnel(row)
}
