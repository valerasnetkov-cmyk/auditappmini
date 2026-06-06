export default function registerDashboardRoutes({
  app,
  db,
  authenticate,
  readSettings,
  sendInternalError,
}) {
  app.get('/api/notifications', authenticate, (req, res) => {
    try {
      const settings = readSettings()
      const scheduledDays = Number(settings.scheduled_inspection_days ?? 30)
      const notifyDays = Number(settings.notification_days_before ?? 3)
      const companyId = req.user.company_id || 'default'

      const vehicles = db.prepare('SELECT id, number, name, last_scheduled_inspection FROM vehicles WHERE status = ? AND company_id = ?').all('active', companyId)

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
          is_overdue: daysUntil <= 0,
        }
      }).filter(n => n.days_until <= notifyDays)
        .sort((a, b) => a.days_until - b.days_until)

      res.json(notifications)
    } catch (err) {
      console.error('Notifications error:', err)
      return sendInternalError(res, 'Notifications error', err)
    }
  })

  app.get('/api/dashboard/stats', authenticate, (req, res) => {
    const today = new Date().toISOString().split('T')[0]
    const companyId = req.user.company_id || 'default'

    const totalVehicles = db.prepare('SELECT COUNT(*) as count FROM vehicles WHERE company_id = ?').get(companyId).count
    const totalInspections = db.prepare('SELECT COUNT(*) as count FROM inspections WHERE company_id = ?').get(companyId).count

    const todayInspections = db.prepare(`
      SELECT COUNT(*) as count FROM inspections
      WHERE company_id = ? AND date(created_at) = date(?)
    `).get(companyId, today).count

    const vehiclesWithDefects = db.prepare(`
      SELECT COUNT(DISTINCT v.id) as count
      FROM vehicles v
      JOIN inspections i ON i.vehicle_id = v.id
      JOIN defects d ON d.inspection_id = i.id
      WHERE v.company_id = ?
    `).get(companyId).count

    res.json({
      totalVehicles,
      totalInspections,
      inspectionsToday: todayInspections,
      vehiclesWithDefects,
    })
  })
}
