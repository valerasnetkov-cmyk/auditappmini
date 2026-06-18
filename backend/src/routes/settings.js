function upsertSettingValue(db, key, value) {
  return db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value))
}

function parseInterval(value, field) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 3650) {
    return { error: `${field} должен быть целым числом от 1 до 3650` }
  }
  return { value: parsed }
}

export default function registerSettingsRoutes({
  app,
  db,
  authenticate,
  readSettings,
  ensureManager,
  ensureCompanyOperationalWriteAllowed,
  API_MESSAGES,
  inspectionSchedule,
}) {
  app.get('/api/settings', authenticate, (req, res) => {
    const companyId = req.user.company_id || 'default'
    const schedule = inspectionSchedule.getCompanySettings(companyId)
    res.json({
      ...readSettings(),
      default_quick_inspection_interval_days: schedule.companyQuickIntervalDays,
      default_planned_inspection_interval_days: schedule.companyPlannedIntervalDays,
    })
  })

  app.put('/api/settings', authenticate, (req, res) => {
    if (!ensureManager(req, res, API_MESSAGES.settingsManagerOnly)) return
    if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'write' })) return

    const {
      scheduled_inspection_days,
      notification_days_before,
      timezone_offset,
      default_quick_inspection_interval_days,
      default_planned_inspection_interval_days,
    } = req.body
    const companyId = req.user.company_id || 'default'
    const quickInterval = default_quick_inspection_interval_days === undefined
      ? null
      : parseInterval(default_quick_inspection_interval_days, 'Интервал быстрого осмотра')
    const plannedInterval = default_planned_inspection_interval_days === undefined
      ? null
      : parseInterval(default_planned_inspection_interval_days, 'Интервал планового осмотра')
    if (quickInterval?.error) return res.status(400).json({ error: quickInterval.error })
    if (plannedInterval?.error) return res.status(400).json({ error: plannedInterval.error })

    if (scheduled_inspection_days !== undefined) {
      upsertSettingValue(db, 'scheduled_inspection_days', scheduled_inspection_days)
    }
    if (notification_days_before !== undefined) {
      upsertSettingValue(db, 'notification_days_before', notification_days_before)
    }
    if (timezone_offset !== undefined) {
      upsertSettingValue(db, 'timezone_offset', timezone_offset)
    }
    if (quickInterval) {
      db.prepare(`
        UPDATE companies SET default_quick_inspection_interval_days = ? WHERE id = ?
      `).run(quickInterval.value, companyId)
    }
    if (plannedInterval) {
      db.prepare(`
        UPDATE companies SET default_planned_inspection_interval_days = ? WHERE id = ?
      `).run(plannedInterval.value, companyId)
    }
    const schedule = inspectionSchedule.getCompanySettings(companyId)
    return res.json({
      ...readSettings(),
      default_quick_inspection_interval_days: schedule.companyQuickIntervalDays,
      default_planned_inspection_interval_days: schedule.companyPlannedIntervalDays,
    })
  })
}
