import { v4 as uuidv4 } from 'uuid'

function buildCompanyResourceUsage({
  getCompanyLimits,
  getCompanyResourceUsage,
  normalizeCompanyLimit,
}, companyId, resource) {
  const limits = getCompanyLimits(companyId)
  const field = resource === 'vehicles' ? 'max_vehicles' : resource === 'users' ? 'max_users' : null
  const current = getCompanyResourceUsage(companyId, resource)
  const max = field ? normalizeCompanyLimit(limits?.[field]) : null
  const remaining = max === null ? null : Math.max(max - current, 0)
  const percent = max === null || max <= 0 ? null : Math.min(100, Math.round((current / max) * 100))

  return {
    current,
    max,
    remaining,
    percent,
    unlimited: max === null,
    exceeded: max !== null && current > max,
  }
}

function buildCompanyFeatureAccess(normalizeCompanyFeatureFlag, limits, featureField) {
  const configured = normalizeCompanyFeatureFlag(limits?.[featureField])

  return {
    enabled: configured !== false,
    configured,
  }
}

function getDaysUntilDate(value) {
  if (!value) return null
  const target = new Date(value)
  if (Number.isNaN(target.getTime())) return null

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  target.setUTCHours(0, 0, 0, 0)

  return Math.ceil((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
}

function getCompanySubscriptionSummary(db, companyId) {
  const subscription = db.prepare(`
    SELECT id, plan_code, status, current_period_start, current_period_end,
           grace_until, mrr_rub, updated_at
    FROM company_subscriptions
    WHERE company_id = ?
  `).get(companyId)

  if (!subscription) return null

  return {
    id: subscription.id,
    planCode: subscription.plan_code || null,
    status: subscription.status || 'active',
    currentPeriodStart: subscription.current_period_start || null,
    currentPeriodEnd: subscription.current_period_end || null,
    graceUntil: subscription.grace_until || null,
    mrrRub: Number(subscription.mrr_rub || 0),
    daysUntilEnd: getDaysUntilDate(subscription.current_period_end),
    updatedAt: subscription.updated_at || null,
  }
}

function buildCompanyServiceWarnings(API_MESSAGES, company, subscription) {
  const warnings = []

  if (company?.status === 'inactive') {
    warnings.push({
      type: 'company_inactive',
      severity: 'danger',
      title: 'Компания отключена',
      message: API_MESSAGES.companyInactive,
    })
  }

  if (!subscription) return warnings

  if (subscription.status === 'suspended') {
    warnings.push({
      type: 'subscription_suspended',
      severity: 'danger',
      title: 'Подписка приостановлена',
      message: API_MESSAGES.subscriptionSuspended,
    })
    return warnings
  }

  if (subscription.status === 'expired') {
    warnings.push({
      type: 'subscription_expired',
      severity: 'danger',
      title: 'Тариф истек',
      message: API_MESSAGES.subscriptionExpired,
    })
    return warnings
  }

  if (subscription.status === 'grace') {
    warnings.push({
      type: 'subscription_grace',
      severity: 'warning',
      title: 'Идет льготный период',
      message: subscription.graceUntil
        ? `Продлите тариф до ${subscription.graceUntil}, чтобы избежать приостановки.`
        : 'Продлите тариф, чтобы избежать приостановки.',
    })
    return warnings
  }

  if (subscription.status === 'expiring' || (subscription.daysUntilEnd !== null && subscription.daysUntilEnd <= 14)) {
    const days = subscription.daysUntilEnd
    warnings.push({
      type: 'subscription_expiring',
      severity: days !== null && days <= 3 ? 'warning' : 'info',
      title: 'Тариф скоро закончится',
      message: days !== null
        ? `До окончания тарифа осталось ${Math.max(days, 0)} дн.`
        : 'Проверьте дату окончания тарифа.',
    })
  }

  return warnings
}

function getCompanyServiceNotifications(db, companyId, user) {
  return db.prepare(`
    SELECT id, type, title, message, status, created_at
    FROM company_notifications
    WHERE company_id = ?
      AND (
        recipient_user_id = ?
        OR (recipient_user_id IS NULL AND recipient_role = ?)
        OR (recipient_user_id IS NULL AND recipient_role IN ('company_owner', 'tenant') AND ? = 'owner')
      )
      AND COALESCE(recipient_role, '') != 'admin'
    ORDER BY CASE WHEN status = 'new' THEN 0 ELSE 1 END, created_at DESC
    LIMIT 5
  `).all(companyId, user?.id || '', user?.role || '', user?.role || '').map((item) => ({
    id: item.id,
    type: item.type,
    title: item.title,
    message: item.message || null,
    status: item.status || 'new',
    createdAt: item.created_at || null,
  }))
}

function parseJsonArray(value) {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}

function getServiceNotificationRecipients(db, companyId) {
  return db.prepare(`
    SELECT id, email, name, role, status, service_notifications_enabled, service_notification_types
    FROM users
    WHERE company_id = ?
      AND role IN ('owner', 'manager')
      AND COALESCE(status, 'active') = 'active'
    ORDER BY CASE role WHEN 'owner' THEN 0 ELSE 1 END, name COLLATE NOCASE
  `).all(companyId).map((user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status || 'active',
    serviceNotificationsEnabled: user.role === 'owner' ? true : Boolean(user.service_notifications_enabled),
    serviceNotificationTypes: parseJsonArray(user.service_notification_types),
    locked: user.role === 'owner',
  }))
}

function writeTenantAuditLog(db, req, action, entityType, entityId, payload = null) {
  try {
    db.prepare(`
      INSERT INTO audit_logs (id, company_id, actor_user_id, actor_role, action, entity_type, entity_id, payload_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      req.user?.company_id || 'default',
      req.user?.id || null,
      req.user?.role || null,
      action,
      entityType,
      entityId,
      payload ? JSON.stringify(payload) : null,
    )
  } catch (error) {
    console.warn('Unable to write tenant audit log:', error.message)
  }
}

export default function registerCompanyUsageRoutes({
  app,
  db,
  authenticate,
  API_MESSAGES,
  getCompanyLimits,
  getCompanyResourceUsage,
  normalizeCompanyLimit,
  normalizeCompanyFeatureFlag,
  ensureCompanyOwner,
}) {
  const usageHelpers = {
    getCompanyLimits,
    getCompanyResourceUsage,
    normalizeCompanyLimit,
  }

  app.get('/api/company/usage', authenticate, (req, res) => {
    const companyId = req.user.company_id || 'default'
    const company = db.prepare(`
      SELECT id, slug, name, status
      FROM companies
      WHERE id = ?
    `).get(companyId) || {
      id: companyId,
      slug: companyId,
      name: 'Компания',
      status: 'active',
    }
    const limits = getCompanyLimits(companyId)
    const subscription = getCompanySubscriptionSummary(db, companyId)

    res.json({
      company,
      plan: {
        code: limits?.plan_code || subscription?.planCode || null,
      },
      subscription,
      serviceWarnings: buildCompanyServiceWarnings(API_MESSAGES, company, subscription),
      alerts: getCompanyServiceNotifications(db, companyId, req.user),
      usage: {
        vehicles: buildCompanyResourceUsage(usageHelpers, companyId, 'vehicles'),
        users: buildCompanyResourceUsage(usageHelpers, companyId, 'users'),
      },
      limits: {
        maxStorageMb: normalizeCompanyLimit(limits?.max_storage_mb),
      },
      features: {
        ocr: buildCompanyFeatureAccess(normalizeCompanyFeatureFlag, limits, 'ocr_enabled'),
        accidentModule: buildCompanyFeatureAccess(normalizeCompanyFeatureFlag, limits, 'accident_module_enabled'),
        analytics: buildCompanyFeatureAccess(normalizeCompanyFeatureFlag, limits, 'analytics_enabled'),
        apiAccess: buildCompanyFeatureAccess(normalizeCompanyFeatureFlag, limits, 'api_access_enabled'),
      },
      updatedAt: limits?.updated_at || null,
    })
  })

  app.get('/api/company/service-notification-recipients', authenticate, (req, res) => {
    if (!ensureCompanyOwner(req, res)) return

    const companyId = req.user.company_id || 'default'
    res.json({
      recipients: getServiceNotificationRecipients(db, companyId),
    })
  })

  app.put('/api/company/service-notification-recipients', authenticate, (req, res) => {
    if (!ensureCompanyOwner(req, res)) return

    const companyId = req.user.company_id || 'default'
    const recipients = Array.isArray(req.body?.recipients) ? req.body.recipients : []
    const managerIds = new Set(
      recipients
        .filter((item) => item && typeof item.id === 'string')
        .filter((item) => Boolean(item.serviceNotificationsEnabled))
        .map((item) => item.id),
    )

    const managers = db.prepare(`
      SELECT id
      FROM users
      WHERE company_id = ? AND role = 'manager' AND COALESCE(status, 'active') = 'active'
    `).all(companyId)
    const validManagerIds = new Set(managers.map((manager) => manager.id))
    const enabledIds = [...managerIds].filter((id) => validManagerIds.has(id))

    db.prepare(`
      UPDATE users
      SET service_notifications_enabled = 0,
          service_notification_types = NULL
      WHERE company_id = ? AND role = 'manager'
    `).run(companyId)

    if (enabledIds.length) {
      db.prepare(`
        UPDATE users
        SET service_notifications_enabled = 1,
            service_notification_types = ?
        WHERE company_id = ? AND role = 'manager' AND id IN (${enabledIds.map(() => '?').join(',')})
      `).run(JSON.stringify(['subscription', 'system', 'limits']), companyId, ...enabledIds)
    }

    writeTenantAuditLog(db, req, 'service_notification_recipients_updated', 'company', companyId, {
      enabledManagerIds: enabledIds,
    })

    res.json({
      recipients: getServiceNotificationRecipients(db, companyId),
    })
  })
}
