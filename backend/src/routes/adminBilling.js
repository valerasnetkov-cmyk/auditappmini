import { v4 as uuidv4 } from 'uuid'

const BILLING_STATUSES = new Set(['trial', 'active', 'payment_due', 'suspended', 'archived'])
const LIMIT_FIELDS = [
  'max_vehicles',
  'max_users',
  'max_inspections_per_month',
  'storage_limit_gb',
  'ocr_monthly_limit',
]
const FEATURE_FIELDS = [
  'ocr_enabled',
  'accident_module_enabled',
  'analytics_enabled',
  'export_enabled',
  'api_access_enabled',
  'custom_branding_enabled',
  'regional_storage_enabled',
]

function toSnakeCasePayload(body = {}) {
  return {
    plan_code: body.planCode ?? body.plan_code,
    billing_status: body.billingStatus ?? body.billing_status,
    paid_until: body.paidUntil ?? body.paid_until,
    trial_until: body.trialUntil ?? body.trial_until,
    payment_comment: body.paymentComment ?? body.payment_comment,
  }
}

function writeEvent(db, companyId, eventType, oldValue, newValue, comment, actorId) {
  db.prepare(`
    INSERT INTO company_billing_events (
      id, company_id, event_type, old_value, new_value, comment, created_by_user_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    uuidv4(),
    companyId,
    eventType,
    oldValue === null ? null : JSON.stringify(oldValue),
    newValue === null ? null : JSON.stringify(newValue),
    comment || null,
    actorId || null,
  )
}

function getBillingBundle(db, planLimits, companyId) {
  const policy = planLimits.getResolvedPolicy(companyId)
  const events = db.prepare(`
    SELECT * FROM company_billing_events
    WHERE company_id = ?
    ORDER BY created_at DESC
    LIMIT 100
  `).all(companyId)
  const payments = db.prepare(`
    SELECT * FROM company_payments
    WHERE company_id = ?
    ORDER BY payment_date DESC, created_at DESC
    LIMIT 100
  `).all(companyId)
  return {
    plan: policy.plan,
    billing: policy.billing,
    limits: policy.overrides,
    resolved: {
      limits: policy.limits,
      features: policy.features,
      supportLevel: policy.supportLevel,
    },
    usage: {
      vehicles: planLimits.getLimitState(companyId, 'vehicles'),
      users: planLimits.getLimitState(companyId, 'users'),
      inspectionsMonth: planLimits.getLimitState(companyId, 'inspections_month'),
      storageGb: planLimits.getLimitState(companyId, 'storage_gb'),
      ocrMonth: planLimits.getLimitState(companyId, 'ocr_month'),
    },
    payments,
    events,
  }
}

export default function registerAdminBillingRoutes({
  app,
  db,
  authenticate,
  ensureAdmin,
  planLimits,
}) {
  const admin = [authenticate, (req, res, next) => {
    if (ensureAdmin(req, res)) next()
  }]

  app.get('/api/admin/saas/plans', ...admin, (req, res) => {
    res.json({ plans: db.prepare('SELECT * FROM plans ORDER BY position, name').all() })
  })

  app.post('/api/admin/saas/plans', ...admin, (req, res) => {
    const code = String(req.body?.code || '').trim().toLowerCase()
    const name = String(req.body?.name || '').trim()
    if (!code || !name) return res.status(400).json({ error: 'plan_fields_required', message: 'Укажите код и название тарифа.' })
    if (planLimits.getPlan(code)) return res.status(409).json({ error: 'plan_exists', message: 'Тариф с таким кодом уже существует.' })

    db.prepare(`
      INSERT INTO plans (code, name, description, position, monthly_price_rub, yearly_price_rub, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', datetime('now'), datetime('now'))
    `).run(code, name, req.body.description || null, Number(req.body.position || 0), req.body.monthlyPriceRub ?? null, req.body.yearlyPriceRub ?? null)
    res.status(201).json(planLimits.getPlan(code))
  })

  app.put('/api/admin/saas/plans/:code', ...admin, (req, res) => {
    const existing = planLimits.getPlan(req.params.code)
    if (!existing) return res.status(404).json({ error: 'plan_not_found', message: 'Тариф не найден.' })
    const allowed = [
      'name', 'description', 'position', 'is_active', 'is_public', 'monthly_price_rub',
      'yearly_price_rub', 'trial_months', 'recommended', ...LIMIT_FIELDS, ...FEATURE_FIELDS,
      'support_level',
    ]
    const entries = allowed
      .filter((field) => Object.hasOwn(req.body, field))
      .map((field) => [field, req.body[field]])
    if (!entries.length) return res.json(existing)
    db.prepare(`UPDATE plans SET ${entries.map(([field]) => `${field} = ?`).join(', ')}, updated_at = datetime('now') WHERE code = ?`)
      .run(...entries.map(([, value]) => value), req.params.code)
    res.json(planLimits.getPlan(req.params.code))
  })

  app.get('/api/admin/saas/companies/:id/billing', ...admin, (req, res) => {
    const company = db.prepare('SELECT id FROM companies WHERE id = ?').get(req.params.id)
    if (!company) return res.status(404).json({ error: 'company_not_found', message: 'Компания не найдена.' })
    res.json(getBillingBundle(db, planLimits, req.params.id))
  })

  app.put('/api/admin/saas/companies/:id/billing', ...admin, (req, res) => {
    const companyId = req.params.id
    const existing = db.prepare('SELECT * FROM company_billing WHERE company_id = ?').get(companyId)
    if (!existing) return res.status(404).json({ error: 'billing_not_found', message: 'Billing компании не найден.' })
    const payload = toSnakeCasePayload(req.body)
    const nextPlan = payload.plan_code || existing.plan_code
    const nextStatus = payload.billing_status || existing.billing_status
    if (!planLimits.getPlan(nextPlan)) return res.status(400).json({ error: 'plan_not_found', message: 'Тариф не найден.' })
    if (!BILLING_STATUSES.has(nextStatus)) return res.status(400).json({ error: 'invalid_billing_status', message: 'Некорректный статус оплаты.' })

    db.prepare(`
      UPDATE company_billing
      SET plan_code = ?, billing_status = ?, paid_until = ?, trial_until = ?,
          payment_comment = ?, created_by_user_id = ?, updated_at = datetime('now')
      WHERE company_id = ?
    `).run(
      nextPlan,
      nextStatus,
      payload.paid_until ?? existing.paid_until,
      payload.trial_until ?? existing.trial_until,
      payload.payment_comment ?? existing.payment_comment,
      req.user.id,
      companyId,
    )
    db.prepare('UPDATE company_limits SET plan_code = ?, updated_at = datetime(\'now\') WHERE company_id = ?').run(nextPlan, companyId)
    writeEvent(db, companyId, existing.plan_code !== nextPlan ? 'plan_changed' : 'status_changed', existing, payload, payload.payment_comment, req.user.id)
    res.json(getBillingBundle(db, planLimits, companyId))
  })

  app.post('/api/admin/saas/companies/:id/payments', ...admin, (req, res) => {
    const companyId = req.params.id
    const billing = db.prepare('SELECT * FROM company_billing WHERE company_id = ?').get(companyId)
    if (!billing) return res.status(404).json({ error: 'billing_not_found', message: 'Billing компании не найден.' })
    const amount = Number(req.body?.amountRub ?? req.body?.amount)
    const paymentDate = req.body?.paymentDate || new Date().toISOString().slice(0, 10)
    const periodStart = req.body?.periodStart
    const periodEnd = req.body?.periodEnd
    if (!Number.isFinite(amount) || amount <= 0 || !periodStart || !periodEnd) {
      return res.status(400).json({ error: 'payment_fields_required', message: 'Укажите сумму и период оплаты.' })
    }
    const paymentId = uuidv4()
    db.prepare(`
      INSERT INTO company_payments (
        id, company_id, plan_code, amount, currency, payment_date, period_start, period_end,
        payment_method, document_number, comment, status, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'RUB', ?, ?, ?, ?, ?, ?, 'active', ?, datetime('now'), datetime('now'))
    `).run(
      paymentId, companyId, billing.plan_code, amount, paymentDate, periodStart, periodEnd,
      req.body.paymentMethod || null, req.body.invoiceNumber || null, req.body.comment || null, req.user.id,
    )
    db.prepare(`
      UPDATE company_billing
      SET billing_status = 'active', paid_until = ?, last_payment_date = ?,
          last_payment_amount_rub = ?, last_payment_period_start = ?,
          last_payment_period_end = ?, payment_method = ?, payment_comment = ?,
          invoice_number = ?, contract_number = ?, created_by_user_id = ?,
          updated_at = datetime('now')
      WHERE company_id = ?
    `).run(
      periodEnd, paymentDate, amount, periodStart, periodEnd,
      req.body.paymentMethod || null, req.body.comment || null,
      req.body.invoiceNumber || null, req.body.contractNumber || null,
      req.user.id, companyId,
    )
    writeEvent(db, companyId, 'payment_added', null, { paymentId, amount, paymentDate, periodStart, periodEnd }, req.body.comment, req.user.id)
    res.status(201).json(getBillingBundle(db, planLimits, companyId))
  })

  app.put('/api/admin/saas/companies/:id/limits', ...admin, (req, res) => {
    const companyId = req.params.id
    const current = db.prepare('SELECT * FROM company_limits WHERE company_id = ?').get(companyId)
    if (!current) return res.status(404).json({ error: 'limits_not_found', message: 'Лимиты компании не найдены.' })
    const body = req.body || {}
    const updates = [...LIMIT_FIELDS, ...FEATURE_FIELDS, 'support_level', 'limits_comment']
      .filter((field) => Object.hasOwn(body, field))
      .map((field) => [field, body[field]])
    if (updates.length) {
      db.prepare(`UPDATE company_limits SET ${updates.map(([field]) => `${field} = ?`).join(', ')}, updated_at = datetime('now') WHERE company_id = ?`)
        .run(...updates.map(([, value]) => value), companyId)
      writeEvent(db, companyId, 'limits_changed', current, body, body.limits_comment, req.user.id)
    }
    res.json(getBillingBundle(db, planLimits, companyId))
  })
}
