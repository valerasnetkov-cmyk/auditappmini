export default function registerDashboardRoutes({
  app,
  db,
  authenticate,
  sendInternalError,
  inspectionSchedule,
}) {
  app.get('/api/notifications', authenticate, (req, res) => {
    try {
      const companyId = req.user.company_id || 'default'
      const vehicles = db.prepare(`
        SELECT
          v.id, v.number, v.name, v.last_scheduled_inspection,
          v.quick_inspection_interval_days, v.planned_inspection_interval_days,
          (
            SELECT COALESCE(i.completed_at, i.created_at)
            FROM inspections i
            WHERE i.vehicle_id = v.id AND i.company_id = v.company_id
              AND i.type = 'quick' AND i.completed = 1
            ORDER BY COALESCE(i.completed_at, i.created_at) DESC, i.id DESC
            LIMIT 1
          ) AS last_quick_inspection_at,
          (
            SELECT COALESCE(i.completed_at, i.created_at)
            FROM inspections i
            WHERE i.vehicle_id = v.id AND i.company_id = v.company_id
              AND i.type = 'scheduled' AND i.completed = 1
            ORDER BY COALESCE(i.completed_at, i.created_at) DESC, i.id DESC
            LIMIT 1
          ) AS last_planned_inspection_at
        FROM vehicles v
        WHERE v.status = 'active' AND v.company_id = ?
      `).all(companyId)
      const scheduledVehicles = inspectionSchedule.enrichVehicles(vehicles, companyId)
      const notifications = scheduledVehicles.flatMap((vehicle) => (
        ['quick', 'planned'].map((inspectionType) => {
          const schedule = vehicle.inspection_schedule[inspectionType]
          return {
            vehicle_id: vehicle.id,
            vehicle_number: vehicle.number,
            vehicle_name: vehicle.name,
            inspection_type: inspectionType,
            schedule_status: schedule.status,
            last_inspection: schedule.last_inspection_at,
            next_due: schedule.next_due,
            days_until: schedule.days_until,
            is_overdue: schedule.status === 'inspection_overdue',
          }
        })
      )).filter((notification) => (
        notification.schedule_status === 'never_inspected'
        || notification.schedule_status === 'inspection_due_soon'
        || notification.schedule_status === 'inspection_overdue'
      )).sort((left, right) => {
        if (left.days_until === null) return 1
        if (right.days_until === null) return -1
        return left.days_until - right.days_until
      })

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
