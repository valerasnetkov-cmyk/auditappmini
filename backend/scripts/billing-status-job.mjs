import process from 'node:process'
import { v4 as uuidv4 } from 'uuid'
import { initDatabase, getDb, closeDatabase } from '../src/db.js'

const GRACE_DAYS = Number(process.env.BILLING_GRACE_DAYS || 7)
const SUSPEND_AFTER_DAYS = Number(process.env.BILLING_SUSPEND_AFTER_DAYS || 14)
const WARNING_DAYS = new Set([14, 7, 3])

function daysUntil(value) {
  if (!value) return null
  const target = new Date(`${String(value).slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(target.getTime())) return null
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / 86400000)
}

function eventExists(db, companyId, eventType, marker) {
  return Boolean(db.prepare(`
    SELECT id FROM company_billing_events
    WHERE company_id = ? AND event_type = ? AND new_value = ?
    LIMIT 1
  `).get(companyId, eventType, marker))
}

function writeEvent(db, companyId, eventType, oldValue, newValue, comment) {
  const marker = JSON.stringify(newValue)
  if (eventExists(db, companyId, eventType, marker)) return false
  db.prepare(`
    INSERT INTO company_billing_events (
      id, company_id, event_type, old_value, new_value, comment, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(uuidv4(), companyId, eventType, JSON.stringify(oldValue), marker, comment)
  return true
}

function notify(db, companyId, type, title, message) {
  const existing = db.prepare(`
    SELECT id FROM company_notifications
    WHERE company_id = ? AND type = ? AND date(created_at) = date('now')
    LIMIT 1
  `).get(companyId, type)
  if (existing) return false
  db.prepare(`
    INSERT INTO company_notifications (
      id, company_id, recipient_role, type, channel, title, message, status, created_at
    ) VALUES (?, ?, 'company_owner', ?, 'in_app', ?, ?, 'new', datetime('now'))
  `).run(uuidv4(), companyId, type, title, message)
  return true
}

await initDatabase()
const db = getDb()
const rows = db.prepare('SELECT * FROM company_billing').all()
let updated = 0
let notifications = 0
let events = 0

for (const billing of rows) {
  const effectiveUntil = billing.billing_status === 'trial' ? billing.trial_until : billing.paid_until
  const days = daysUntil(effectiveUntil)
  if (days === null || billing.billing_status === 'archived') continue

  if (WARNING_DAYS.has(days)) {
    const type = `billing_expires_soon_${days}_days`
    notifications += Number(notify(
      db,
      billing.company_id,
      type,
      `До окончания тарифа осталось ${days} дней`,
      `Срок действия тарифа заканчивается ${effectiveUntil}. Продлите тариф заранее.`,
    ))
  }

  if (days < 0 && Math.abs(days) <= GRACE_DAYS && billing.billing_status !== 'payment_due') {
    db.prepare("UPDATE company_billing SET billing_status = 'payment_due', updated_at = datetime('now') WHERE company_id = ?")
      .run(billing.company_id)
    events += Number(writeEvent(db, billing.company_id, 'status_changed', billing.billing_status, 'payment_due', 'Срок оплаты закончился'))
    notifications += Number(notify(db, billing.company_id, 'billing_expired', 'Срок действия тарифа закончился', 'История доступна, новые действия могут быть ограничены после льготного периода.'))
    updated += 1
  }

  if (days < -SUSPEND_AFTER_DAYS && billing.billing_status !== 'suspended') {
    db.prepare("UPDATE company_billing SET billing_status = 'suspended', updated_at = datetime('now') WHERE company_id = ?")
      .run(billing.company_id)
    events += Number(writeEvent(db, billing.company_id, 'suspended', billing.billing_status, 'suspended', 'Автоматическая приостановка после просрочки'))
    notifications += Number(notify(db, billing.company_id, 'company_suspended', 'Компания временно ограничена', 'Просмотр истории доступен, создание новых данных отключено.'))
    updated += 1
  }
}

console.log(JSON.stringify({
  ok: true,
  scanned: rows.length,
  updated,
  notifications,
  events,
  graceDays: GRACE_DAYS,
  suspendAfterDays: SUSPEND_AFTER_DAYS,
}, null, 2))

closeDatabase()
