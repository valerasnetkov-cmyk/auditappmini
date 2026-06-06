export default function registerAnalyticsRoutes({
  app,
  db,
  authenticate,
  API_MESSAGES,
  ensureCompanyFeatureEnabled,
}) {
  app.get('/api/analytics/overview', authenticate, (req, res) => {
    const { from = '', to = '' } = req.query
    const now = new Date()
    const companyId = req.user.company_id || 'default'

    if (!ensureCompanyFeatureEnabled(req, res, 'analytics_enabled', API_MESSAGES.analyticsFeatureDisabled)) {
      return
    }

    let dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    let dateTo = now

    if (from) dateFrom = new Date(from)
    if (to) dateTo = new Date(to + ' 23:59:59')

    const totalVehicles = db.prepare('SELECT COUNT(*) as count FROM vehicles WHERE company_id = ?').get(companyId).count
    const totalInspections = db.prepare('SELECT COUNT(*) as count FROM inspections WHERE company_id = ?').get(companyId).count
    const totalDefects = db.prepare('SELECT COUNT(*) as count FROM defects WHERE company_id = ?').get(companyId).count

    const weekInspections = db.prepare(`
      SELECT COUNT(*) as count FROM inspections WHERE company_id = ? AND created_at >= ?
    `).get(companyId, dateFrom.toISOString()).count

    const weekDefects = db.prepare(`
      SELECT COUNT(*) as count FROM defects WHERE company_id = ? AND created_at >= ?
    `).get(companyId, dateFrom.toISOString()).count

    const monthFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const monthInspections = db.prepare(`
      SELECT COUNT(*) as count FROM inspections WHERE company_id = ? AND created_at >= ?
    `).get(companyId, monthFrom.toISOString()).count

    const vehiclesByStatus = db.prepare(`
      SELECT status, COUNT(*) as count FROM vehicles WHERE company_id = ? GROUP BY status
    `).all(companyId)

    const inspectionsByType = db.prepare(`
      SELECT type, COUNT(*) as count FROM inspections WHERE company_id = ? GROUP BY type
    `).all(companyId)

    const totalAccidents = db.prepare(`SELECT COUNT(*) as count FROM inspections WHERE company_id = ? AND type = 'accident'`).get(companyId).count
    const lastAccident = db.prepare(`
      SELECT i.created_at FROM inspections i WHERE i.company_id = ? AND i.type = 'accident' ORDER BY created_at DESC LIMIT 1
    `).get(companyId)

    let daysWithoutAccident = null
    if (lastAccident) {
      const lastDate = new Date(lastAccident.created_at)
      daysWithoutAccident = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24))
    } else {
      daysWithoutAccident = totalInspections > 0 ? Math.floor((now - new Date('2024-01-01')) / (1000 * 60 * 60 * 24)) : 0
    }

    const recentAccidents = db.prepare(`
      SELECT i.id, i.created_at, v.number as vehicle_number, v.name as vehicle_name,
             u.name as inspector_name,
             (SELECT COUNT(*) FROM defects WHERE inspection_id = i.id) as defects_count
      FROM inspections i
      JOIN vehicles v ON i.vehicle_id = v.id
      JOIN users u ON i.inspector_id = u.id
      WHERE i.company_id = ? AND i.type = 'accident'
      ORDER BY i.created_at DESC
      LIMIT 10
    `).all(companyId)

    const dailyInspections = db.prepare(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM inspections
      WHERE company_id = ? AND created_at >= ? AND created_at <= ?
      GROUP BY DATE(created_at)
      ORDER BY date
    `).all(companyId, dateFrom.toISOString(), dateTo.toISOString())

    const topDefectiveVehicles = db.prepare(`
      SELECT v.id, v.number, v.name, COUNT(d.id) as defects_count
      FROM vehicles v
      JOIN inspections i ON i.vehicle_id = v.id
      JOIN defects d ON d.inspection_id = i.id
      WHERE v.company_id = ?
      GROUP BY v.id
      ORDER BY defects_count DESC
      LIMIT 10
    `).all(companyId)

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
        recent: recentAccidents,
      },
      vehiclesByRegion: db.prepare(`
        SELECT COALESCE(region, 'Не указано') as region, COUNT(*) as count
        FROM vehicles
        WHERE company_id = ?
        GROUP BY region
        ORDER BY count DESC
      `).all(companyId),
      inspectionsByRegion: db.prepare(`
        SELECT COALESCE(v.region, 'Не указано') as region, COUNT(*) as count
        FROM inspections i
        JOIN vehicles v ON i.vehicle_id = v.id
        WHERE i.company_id = ?
        GROUP BY v.region
        ORDER BY count DESC
      `).all(companyId),
      defectsByRegion: db.prepare(`
        SELECT COALESCE(v.region, 'Не указано') as region, COUNT(d.id) as count
        FROM defects d
        JOIN inspections i ON d.inspection_id = i.id
        JOIN vehicles v ON i.vehicle_id = v.id
        WHERE d.company_id = ?
        GROUP BY v.region
        ORDER BY count DESC
      `).all(companyId),
    })
  })

  app.get('/api/analytics/export/excel', authenticate, (req, res) => {
    const { type = 'vehicles' } = req.query
    const companyId = req.user.company_id || 'default'

    if (!ensureCompanyFeatureEnabled(req, res, 'analytics_enabled', API_MESSAGES.analyticsFeatureDisabled)) {
      return
    }

    let data
    let filename

    if (type === 'vehicles') {
      data = db.prepare(`
        SELECT v.number, v.name, v.status, v.region, v.created_at,
               (SELECT COUNT(*) FROM inspections WHERE vehicle_id = v.id) as inspections_count,
               (SELECT COUNT(*) FROM defects d JOIN inspections i ON d.inspection_id = i.id WHERE i.vehicle_id = v.id) as defects_count
        FROM vehicles v
        WHERE v.company_id = ?
        ORDER BY v.number
      `).all(companyId)
      filename = 'vehicles.json'
    } else if (type === 'inspections') {
      data = db.prepare(`
        SELECT i.id, v.number as vehicle_number, v.name as vehicle_name,
               i.type, i.completed, i.created_at, i.accident_occurred_at, i.accident_location,
               u.name as inspector_name,
               (SELECT COUNT(*) FROM defects WHERE inspection_id = i.id) as defects_count
        FROM inspections i
        JOIN vehicles v ON i.vehicle_id = v.id
        JOIN users u ON i.inspector_id = u.id
        WHERE i.company_id = ?
        ORDER BY i.created_at DESC
        LIMIT 1000
      `).all(companyId)
      filename = 'inspections.json'
    } else if (type === 'defects') {
      data = db.prepare(`
        SELECT d.title, d.comment, d.status, d.created_at,
               v.number as vehicle_number, v.name as vehicle_name,
               i.type as inspection_type
        FROM defects d
        JOIN inspections i ON d.inspection_id = i.id
        JOIN vehicles v ON i.vehicle_id = v.id
        WHERE d.company_id = ?
        ORDER BY d.created_at DESC
        LIMIT 1000
      `).all(companyId)
      filename = 'defects.json'
    }

    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`)
    res.json({ data, exportedAt: new Date().toISOString() })
  })
}
