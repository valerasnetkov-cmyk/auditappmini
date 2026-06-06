function upsertSettingValue(db, key, value) {
  return db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value))
}

export default function registerSettingsRoutes({
  app,
  db,
  authenticate,
  readSettings,
  ensureManager,
  ensureCompanyOperationalWriteAllowed,
  API_MESSAGES,
}) {
  app.get('/api/settings', authenticate, (req, res) => {
    res.json(readSettings())
  })

  app.put('/api/settings', authenticate, (req, res) => {
    if (!ensureManager(req, res, API_MESSAGES.settingsManagerOnly)) return
    if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'write' })) return

    const { scheduled_inspection_days, notification_days_before, timezone_offset } = req.body

    if (scheduled_inspection_days !== undefined) {
      upsertSettingValue(db, 'scheduled_inspection_days', scheduled_inspection_days)
    }
    if (notification_days_before !== undefined) {
      upsertSettingValue(db, 'notification_days_before', notification_days_before)
    }
    if (timezone_offset !== undefined) {
      upsertSettingValue(db, 'timezone_offset', timezone_offset)
    }
    return res.json(readSettings())
  })
}
