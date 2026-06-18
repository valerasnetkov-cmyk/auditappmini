import { v4 as uuidv4 } from 'uuid'

const DAY_MS = 86400000
const number = (value) => Number(value || 0)
const text = (value) => typeof value === 'string' ? value.trim() : ''
const identifier = (value) => text(value).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')

function date(value, fallback = null) {
  const valueText = text(value)
  if (!valueText) return fallback
  const parsed = new Date(valueText)
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString().slice(0, 10)
}

function daysUntil(value, now = new Date()) {
  if (!value) return null
  const target = new Date(`${String(value).slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(target.getTime())) return null
  const today = new Date(now)
  today.setUTCHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / DAY_MS)
}

export function calculateMrrRub(amount, periodStart, periodEnd) {
  const amountNumber = number(amount)
  if (!amountNumber) return 0
  const start = new Date(`${periodStart}T00:00:00Z`)
  const end = new Date(`${periodEnd}T00:00:00Z`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return amountNumber
  const months = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / DAY_MS) / 30)
  return Math.round(amountNumber / months)
}

export function buildPaymentPayload(body = {}, now = new Date()) {
  const paymentDate = date(body.paymentDate ?? body.payment_date, now.toISOString().slice(0, 10))
  return {
    companyId: identifier(body.companyId ?? body.company_id),
    planCode: identifier(body.planCode ?? body.plan_code),
    amount: number(body.amount),
    currency: text(body.currency || 'RUB').toUpperCase() || 'RUB',
    paymentDate,
    periodStart: date(body.periodStart ?? body.period_start, paymentDate),
    periodEnd: date(body.periodEnd ?? body.period_end),
    paymentMethod: text(body.paymentMethod ?? body.payment_method) || null,
    documentNumber: text(body.documentNumber ?? body.document_number) || null,
    comment: text(body.comment) || null,
  }
}

export function mapPayment(row) {
  return {
    id: row.id, companyId: row.company_id, companyName: row.company_name || null,
    planCode: row.plan_code || null, amount: number(row.amount), currency: row.currency || 'RUB',
    paymentDate: row.payment_date || null, periodStart: row.period_start || null,
    periodEnd: row.period_end || null, paymentMethod: row.payment_method || null,
    documentNumber: row.document_number || null, comment: row.comment || null,
    status: row.status === 'cancelled' ? 'cancelled' : 'active',
    createdBy: row.created_by || null, createdByName: row.created_by_name || null,
    createdAt: row.created_at || null, updatedAt: row.updated_at || null,
  }
}

export function getPayments(db, { companyId = null, limit = 100 } = {}) {
  const where = companyId ? 'WHERE p.company_id = ?' : ''
  const params = companyId ? [companyId, limit] : [limit]
  return db.prepare(`
    SELECT p.*, c.name as company_name, u.name as created_by_name
    FROM company_payments p
    LEFT JOIN companies c ON c.id = p.company_id
    LEFT JOIN users u ON u.id = p.created_by
    ${where}
    ORDER BY p.payment_date DESC, p.created_at DESC
    LIMIT ?
  `).all(...params).map(mapPayment)
}

export function getPaymentSummary(db) {
  const payment = db.prepare(`
    SELECT
      SUM(CASE WHEN status != 'cancelled' AND payment_date >= date('now', 'start of month') THEN amount ELSE 0 END) paid,
      COUNT(CASE WHEN status != 'cancelled' AND payment_date >= date('now', 'start of month') THEN 1 END) payment_count,
      AVG(CASE WHEN status != 'cancelled' THEN amount END) average
    FROM company_payments
  `).get()
  const subscription = db.prepare(`
    SELECT
      COUNT(CASE WHEN status = 'expiring' THEN 1 END) expiring,
      COUNT(CASE WHEN status = 'grace' THEN 1 END) grace,
      COUNT(CASE WHEN status = 'expired' THEN 1 END) expired,
      COUNT(CASE WHEN status = 'suspended' THEN 1 END) suspended,
      SUM(CASE WHEN status IN ('active', 'expiring') AND current_period_end <= date('now', '+30 days') THEN mrr_rub ELSE 0 END) renewals
    FROM company_subscriptions
  `).get()
  return {
    paidThisMonthRub: number(payment?.paid), paymentsThisMonth: number(payment?.payment_count),
    averagePaymentRub: Math.round(number(payment?.average)), expectedRenewalsRub: number(subscription?.renewals),
    expiringCount: number(subscription?.expiring), graceCount: number(subscription?.grace),
    expiredCount: number(subscription?.expired), suspendedCount: number(subscription?.suspended),
  }
}

export function getExpiringSubscriptions(db, { limit = 20 } = {}) {
  return db.prepare(`
    SELECT s.id subscription_id, s.company_id, c.name company_name, c.slug company_slug,
      s.plan_code, s.status, s.current_period_start, s.current_period_end, s.grace_until,
      s.last_payment_id, s.mrr_rub, p.payment_date last_payment_date, p.amount last_payment_amount,
      owner.email owner_email, owner.name owner_name
    FROM company_subscriptions s
    JOIN companies c ON c.id = s.company_id
    LEFT JOIN company_payments p ON p.id = s.last_payment_id
    LEFT JOIN users owner ON owner.company_id = c.id AND owner.role = 'owner' AND COALESCE(owner.status, 'active') = 'active'
    WHERE s.status IN ('expiring', 'grace', 'expired', 'suspended')
      OR s.current_period_end <= date('now', '+14 days')
    GROUP BY s.id ORDER BY s.current_period_end ASC LIMIT ?
  `).all(limit).map((row) => ({
    id: row.subscription_id, companyId: row.company_id, companyName: row.company_name,
    companySlug: row.company_slug || null, ownerEmail: row.owner_email || null,
    ownerName: row.owner_name || null, planCode: row.plan_code || null,
    status: ['active', 'expiring', 'grace', 'expired', 'suspended'].includes(row.status) ? row.status : 'active',
    currentPeriodStart: row.current_period_start || null, currentPeriodEnd: row.current_period_end || null,
    graceUntil: row.grace_until || null, daysUntilEnd: daysUntil(row.current_period_end),
    lastPaymentId: row.last_payment_id || null, lastPaymentDate: row.last_payment_date || null,
    lastPaymentAmount: number(row.last_payment_amount), mrrRub: number(row.mrr_rub),
  }))
}

export function recalculateCompanySubscription(db, companyId, now = new Date()) {
  const payment = db.prepare(`
    SELECT * FROM company_payments WHERE company_id = ? AND status != 'cancelled'
    ORDER BY period_end DESC, payment_date DESC, created_at DESC LIMIT 1
  `).get(companyId)
  if (!payment) {
    db.prepare(`UPDATE company_subscriptions SET status = 'expired', last_payment_id = NULL,
      mrr_rub = 0, updated_at = datetime('now') WHERE company_id = ?`).run(companyId)
    return null
  }

  const today = now.toISOString().slice(0, 10)
  const graceDate = new Date(`${payment.period_end}T00:00:00Z`)
  graceDate.setUTCDate(graceDate.getUTCDate() + 7)
  const graceUntil = graceDate.toISOString().slice(0, 10)
  const remainingDays = daysUntil(payment.period_end, now)
  let status = 'active'
  if (payment.period_end < today) status = graceUntil >= today ? 'grace' : 'expired'
  else if (remainingDays !== null && remainingDays <= 14) status = 'expiring'

  const existing = db.prepare('SELECT id FROM company_subscriptions WHERE company_id = ?').get(companyId)
  db.prepare(`
    INSERT INTO company_subscriptions (id, company_id, plan_code, status, current_period_start,
      current_period_end, grace_until, last_payment_id, mrr_rub, auto_suspend_enabled, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))
    ON CONFLICT(company_id) DO UPDATE SET plan_code = excluded.plan_code, status = excluded.status,
      current_period_start = excluded.current_period_start, current_period_end = excluded.current_period_end,
      grace_until = excluded.grace_until, last_payment_id = excluded.last_payment_id,
      mrr_rub = excluded.mrr_rub, updated_at = datetime('now')
  `).run(existing?.id || uuidv4(), companyId, payment.plan_code, status, payment.period_start,
    payment.period_end, graceUntil, payment.id,
    calculateMrrRub(payment.amount, payment.period_start, payment.period_end))
  return db.prepare('SELECT * FROM company_subscriptions WHERE company_id = ?').get(companyId)
}
