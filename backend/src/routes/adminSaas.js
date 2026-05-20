const LAST_7_DAYS_MS = 7 * 24 * 60 * 60 * 1000

function toNumber(value) {
  return Number(value || 0)
}

function count(db, sql, params = []) {
  const row = db.prepare(sql).get(...params)
  return toNumber(row?.count)
}

function countSince(db, table, sinceIso, where = '1 = 1') {
  return count(db, `SELECT COUNT(*) as count FROM ${table} WHERE ${where} AND created_at >= ?`, [sinceIso])
}

function listHealthCompanies(db, sql) {
  return db.prepare(sql).all().map((company) => ({
    id: company.id,
    slug: company.slug || null,
    name: company.name,
    status: company.status || 'active',
  }))
}

function getTotals(db, sinceIso) {
  const row = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM companies) as companies,
      (SELECT COUNT(*) FROM companies WHERE status = 'active') as activeCompanies,
      (SELECT COUNT(*) FROM companies WHERE status = 'inactive') as inactiveCompanies,
      (SELECT COUNT(*) FROM users) as users,
      (SELECT COUNT(*) FROM users WHERE role = 'owner') as owners,
      (SELECT COUNT(*) FROM users WHERE role = 'manager') as managers,
      (SELECT COUNT(*) FROM users WHERE role = 'inspector') as inspectors,
      (SELECT COUNT(*) FROM vehicles) as vehicles,
      (SELECT COUNT(*) FROM vehicles WHERE status = 'active') as activeVehicles,
      (SELECT COUNT(*) FROM vehicles WHERE status = 'repair') as repairVehicles,
      (SELECT COUNT(*) FROM inspections) as inspections,
      (SELECT COUNT(*) FROM inspections WHERE completed = 1) as completedInspections,
      (SELECT COUNT(*) FROM inspections WHERE type = 'accident') as accidents,
      (SELECT COUNT(*) FROM defects) as defects,
      (SELECT COUNT(*) FROM defects WHERE COALESCE(status, 'open') = 'open') as openDefects,
      (SELECT COUNT(*) FROM defects WHERE status = 'closed') as closedDefects,
      (SELECT COUNT(*) FROM photos) as photos
  `).get()

  return {
    companies: toNumber(row?.companies),
    activeCompanies: toNumber(row?.activeCompanies),
    inactiveCompanies: toNumber(row?.inactiveCompanies),
    users: toNumber(row?.users),
    owners: toNumber(row?.owners),
    managers: toNumber(row?.managers),
    inspectors: toNumber(row?.inspectors),
    vehicles: toNumber(row?.vehicles),
    activeVehicles: toNumber(row?.activeVehicles),
    repairVehicles: toNumber(row?.repairVehicles),
    inspections: toNumber(row?.inspections),
    completedInspections: toNumber(row?.completedInspections),
    accidents: toNumber(row?.accidents),
    defects: toNumber(row?.defects),
    openDefects: toNumber(row?.openDefects),
    closedDefects: toNumber(row?.closedDefects),
    photos: toNumber(row?.photos),
    inspections7d: countSince(db, 'inspections', sinceIso),
    defects7d: countSince(db, 'defects', sinceIso),
    accidents7d: countSince(db, 'inspections', sinceIso, "type = 'accident'"),
  }
}

function getOperationalHealth(db) {
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
    companiesWithoutOwner: count(db, `
      SELECT COUNT(*) as count
      FROM companies c
      LEFT JOIN users u ON u.company_id = c.id AND u.role = 'owner' AND COALESCE(u.status, 'active') = 'active'
      WHERE u.id IS NULL
    `),
    companiesWithoutLimits: count(db, `
      SELECT COUNT(*) as count
      FROM companies c
      LEFT JOIN company_limits l ON l.company_id = c.id
      WHERE l.company_id IS NULL
    `),
    companiesWithoutOwnerList,
    companiesWithoutLimitsList,
    unassignedVehicles: count(db, "SELECT COUNT(*) as count FROM vehicles WHERE company_id IS NULL OR TRIM(company_id) = ''"),
    unassignedInspections: count(db, "SELECT COUNT(*) as count FROM inspections WHERE company_id IS NULL OR TRIM(company_id) = ''"),
    unassignedDefects: count(db, "SELECT COUNT(*) as count FROM defects WHERE company_id IS NULL OR TRIM(company_id) = ''"),
  }
}

function getCompanies(db) {
  const rows = db.prepare(`
    SELECT
      c.id,
      c.slug,
      c.name,
      c.region_code,
      c.data_residency,
      COALESCE(c.status, 'active') as status,
      c.created_at,
      COALESCE(users.users, 0) as users,
      COALESCE(owners.owners, 0) as owners,
      COALESCE(vehicles.vehicles, 0) as vehicles,
      COALESCE(activeVehicles.activeVehicles, 0) as activeVehicles,
      COALESCE(repairVehicles.repairVehicles, 0) as repairVehicles,
      COALESCE(inspections.inspections, 0) as inspections,
      COALESCE(accidents.accidents, 0) as accidents,
      COALESCE(defects.defects, 0) as defects,
      COALESCE(openDefects.openDefects, 0) as openDefects,
      lastInspections.lastInspectionAt as lastInspectionAt,
      limits.plan_code as planCode,
      limits.max_vehicles as maxVehicles,
      limits.max_users as maxUsers,
      limits.max_storage_mb as maxStorageMb,
      limits.ocr_enabled as ocrEnabled,
      limits.accident_module_enabled as accidentModuleEnabled,
      limits.analytics_enabled as analyticsEnabled,
      limits.api_access_enabled as apiAccessEnabled
    FROM companies c
    LEFT JOIN company_limits limits ON limits.company_id = c.id
    LEFT JOIN (
      SELECT company_id, COUNT(*) as users
      FROM users
      WHERE role != 'admin'
      GROUP BY company_id
    ) users ON users.company_id = c.id
    LEFT JOIN (
      SELECT company_id, COUNT(*) as owners
      FROM users
      WHERE role = 'owner'
      GROUP BY company_id
    ) owners ON owners.company_id = c.id
    LEFT JOIN (
      SELECT company_id, COUNT(*) as vehicles
      FROM vehicles
      GROUP BY company_id
    ) vehicles ON vehicles.company_id = c.id
    LEFT JOIN (
      SELECT company_id, COUNT(*) as activeVehicles
      FROM vehicles
      WHERE status = 'active'
      GROUP BY company_id
    ) activeVehicles ON activeVehicles.company_id = c.id
    LEFT JOIN (
      SELECT company_id, COUNT(*) as repairVehicles
      FROM vehicles
      WHERE status = 'repair'
      GROUP BY company_id
    ) repairVehicles ON repairVehicles.company_id = c.id
    LEFT JOIN (
      SELECT company_id, COUNT(*) as inspections
      FROM inspections
      GROUP BY company_id
    ) inspections ON inspections.company_id = c.id
    LEFT JOIN (
      SELECT company_id, COUNT(*) as accidents
      FROM inspections
      WHERE type = 'accident'
      GROUP BY company_id
    ) accidents ON accidents.company_id = c.id
    LEFT JOIN (
      SELECT company_id, COUNT(*) as defects
      FROM defects
      GROUP BY company_id
    ) defects ON defects.company_id = c.id
    LEFT JOIN (
      SELECT company_id, COUNT(*) as openDefects
      FROM defects
      WHERE COALESCE(status, 'open') = 'open'
      GROUP BY company_id
    ) openDefects ON openDefects.company_id = c.id
    LEFT JOIN (
      SELECT company_id, MAX(created_at) as lastInspectionAt
      FROM inspections
      GROUP BY company_id
    ) lastInspections ON lastInspections.company_id = c.id
    ORDER BY c.name COLLATE NOCASE ASC
  `).all()

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    region_code: row.region_code || null,
    data_residency: row.data_residency || null,
    status: row.status,
    created_at: row.created_at || null,
    users: toNumber(row.users),
    owners: toNumber(row.owners),
    vehicles: toNumber(row.vehicles),
    activeVehicles: toNumber(row.activeVehicles),
    repairVehicles: toNumber(row.repairVehicles),
    inspections: toNumber(row.inspections),
    accidents: toNumber(row.accidents),
    defects: toNumber(row.defects),
    openDefects: toNumber(row.openDefects),
    lastInspectionAt: row.lastInspectionAt || null,
    limits: {
      planCode: row.planCode || null,
      maxVehicles: row.maxVehicles === null || row.maxVehicles === undefined ? null : toNumber(row.maxVehicles),
      maxUsers: row.maxUsers === null || row.maxUsers === undefined ? null : toNumber(row.maxUsers),
      maxStorageMb: row.maxStorageMb === null || row.maxStorageMb === undefined ? null : toNumber(row.maxStorageMb),
      ocrEnabled: row.ocrEnabled === null || row.ocrEnabled === undefined ? null : Boolean(Number(row.ocrEnabled)),
      accidentModuleEnabled: row.accidentModuleEnabled === null || row.accidentModuleEnabled === undefined ? null : Boolean(Number(row.accidentModuleEnabled)),
      analyticsEnabled: row.analyticsEnabled === null || row.analyticsEnabled === undefined ? null : Boolean(Number(row.analyticsEnabled)),
      apiAccessEnabled: row.apiAccessEnabled === null || row.apiAccessEnabled === undefined ? null : Boolean(Number(row.apiAccessEnabled)),
    },
  }))
}

export function buildSaasAdminStats(db) {
  const generatedAt = new Date()
  const sinceIso = new Date(generatedAt.getTime() - LAST_7_DAYS_MS).toISOString()

  return {
    generated_at: generatedAt.toISOString(),
    window: {
      recent_days: 7,
      from: sinceIso,
    },
    totals: getTotals(db, sinceIso),
    operational_health: getOperationalHealth(db),
    companies: getCompanies(db),
  }
}

export default function registerSaasAdminRoutes({ app, db, authenticate, ensureAdmin, sendError, API_MESSAGES }) {
  app.get('/api/admin/saas/stats', authenticate, (req, res) => {
    if (!ensureAdmin(req, res)) return

    try {
      res.json(buildSaasAdminStats(db))
    } catch (error) {
      console.error('SaaS admin stats error:', error)
      sendError(res, 500, API_MESSAGES.internalServerError)
    }
  })
}
