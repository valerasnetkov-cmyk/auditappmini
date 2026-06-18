import { v4 as uuidv4 } from 'uuid'

const DAY_MS = 24 * 60 * 60 * 1000
const EXPIRATION_THRESHOLDS = [14, 7, 3, 1]
const SUBSCRIPTION_STATUSES = new Set(['active', 'expiring', 'grace', 'expired', 'suspended'])

function toNumber(value) {
  return Number(value || 0)
}

function getDaysUntil(value, now = new Date()) {
  if (!value) return null
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return null
  const today = new Date(now)
  today.setUTCHours(0, 0, 0, 0)
  return Math.ceil((date.getTime() - today.getTime()) / DAY_MS)
}

export function resolveSubscriptionStatus(subscription, now = new Date()) {
  const today = new Date(now).toISOString().slice(0, 10)
  const daysUntilEnd = getDaysUntil(subscription.current_period_end, now)

  if (subscription.current_period_end && subscription.current_period_end < today) {
    const graceUntil = subscription.grace_until || subscription.current_period_end
    return graceUntil >= today
      ? 'grace'
      : (toNumber(subscription.auto_suspend_enabled) ? 'suspended' : 'expired')
  }

  if (daysUntilEnd !== null && daysUntilEnd <= 14) return 'expiring'
  return 'active'
}

export function getSubscriptionAlertsSummary(db) {
  const row = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as unread,
      SUM(CASE WHEN type LIKE 'subscription_expiring_%' AND status = 'new' THEN 1 ELSE 0 END) as expiring,
      SUM(CASE WHEN type IN ('subscription_expired', 'subscription_grace_started', 'subscription_suspended') AND status = 'new' THEN 1 ELSE 0 END) as critical
    FROM company_notifications
    WHERE COALESCE(recipient_role, 'admin') = 'admin'
      AND recipient_user_id IS NULL
  `).get()

  return {
    total: toNumber(row?.total),
    unread: toNumber(row?.unread),
    expiring: toNumber(row?.expiring),
    critical: toNumber(row?.critical),
  }
}

function createNotificationOnce(db, {
  companyId,
  recipientUserId = null,
  recipientRole = 'admin',
  type,
  title,
  message,
}) {
  const exists = db.prepare(`
    SELECT id
    FROM company_notifications
    WHERE company_id = ?
      AND type = ?
      AND COALESCE(recipient_user_id, '') = COALESCE(?, '')
      AND COALESCE(recipient_role, '') = COALESCE(?, '')
      AND COALESCE(message, '') = COALESCE(?, '')
    LIMIT 1
  `).get(companyId, type, recipientUserId || '', recipientRole || '', message || '')

  if (exists) return false

  db.prepare(`
    INSERT INTO company_notifications (
      id, company_id, recipient_user_id, recipient_role, type, channel, title, message, status, sent_at, created_at
    )
    VALUES (?, ?, ?, ?, ?, 'in_app', ?, ?, 'new', datetime('now'), datetime('now'))
  `).run(uuidv4(), companyId, recipientUserId, recipientRole, type, title, message)

  return true
}

function getRecipients(db, companyId) {
  return db.prepare(`
    SELECT id, role
    FROM users
    WHERE company_id = ?
      AND COALESCE(status, 'active') = 'active'
      AND (
        role = 'owner'
        OR (role = 'manager' AND COALESCE(service_notifications_enabled, 0) = 1)
      )
    ORDER BY CASE role WHEN 'owner' THEN 0 ELSE 1 END, created_at ASC
  `).all(companyId)
}

function createNotificationForAudience(db, payload) {
  let created = 0

  if (createNotificationOnce(db, { ...payload, recipientUserId: null, recipientRole: 'admin' })) {
    created += 1
  }

  getRecipients(db, payload.companyId).forEach((recipient) => {
    if (createNotificationOnce(db, {
      ...payload,
      recipientUserId: recipient.id,
      recipientRole: recipient.role,
    })) {
      created += 1
    }
  })

  return created
}

export function scanSubscriptionAlerts(
  db,
  { actorUserId = null, actorRole = 'system', now = new Date() } = {},
) {
  const subscriptions = db.prepare(`
    SELECT s.*, c.name as company_name
    FROM company_subscriptions s
    JOIN companies c ON c.id = s.company_id
  `).all()
  let createdNotifications = 0
  let updatedSubscriptions = 0

  subscriptions.forEach((subscription) => {
    const daysUntilEnd = getDaysUntil(subscription.current_period_end, now)
    const currentStatus = SUBSCRIPTION_STATUSES.has(subscription.status) ? subscription.status : 'active'
    const nextStatus = resolveSubscriptionStatus(subscription, now)

    if (nextStatus !== currentStatus) {
      db.prepare(`
        UPDATE company_subscriptions
        SET status = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(nextStatus, subscription.id)
      updatedSubscriptions += 1

      db.prepare(`
        INSERT INTO audit_logs (id, company_id, actor_user_id, actor_role, action, entity_type, entity_id, payload_json)
        VALUES (?, ?, ?, ?, ?, 'company_subscription', ?, ?)
      `).run(
        uuidv4(),
        subscription.company_id,
        actorUserId,
        actorRole,
        'subscription_status_changed',
        subscription.id,
        JSON.stringify({ from: subscription.status, to: nextStatus }),
      )
    }

    if (daysUntilEnd !== null && EXPIRATION_THRESHOLDS.includes(daysUntilEnd)) {
      createdNotifications += createNotificationForAudience(db, {
        companyId: subscription.company_id,
        type: `subscription_expiring_${daysUntilEnd}d`,
        title: `Тариф заканчивается через ${daysUntilEnd} дн.`,
        message: `Тариф компании "${subscription.company_name}" заканчивается ${subscription.current_period_end}.`,
      })
    }

    if (nextStatus === 'grace') {
      createdNotifications += createNotificationForAudience(db, {
        companyId: subscription.company_id,
        type: 'subscription_grace_started',
        title: 'Подписка перешла в grace period',
        message: `Тариф компании "${subscription.company_name}" перешел в grace period до ${subscription.grace_until || subscription.current_period_end}.`,
      })
    }

    if (nextStatus === 'expired' || nextStatus === 'suspended') {
      createdNotifications += createNotificationForAudience(db, {
        companyId: subscription.company_id,
        type: nextStatus === 'suspended' ? 'subscription_suspended' : 'subscription_expired',
        title: nextStatus === 'suspended' ? 'Компания приостановлена' : 'Подписка просрочена',
        message: `Тариф компании "${subscription.company_name}" имеет статус ${nextStatus}.`,
      })
    }
  })

  return {
    scannedSubscriptions: subscriptions.length,
    updatedSubscriptions,
    createdNotifications,
    summary: getSubscriptionAlertsSummary(db),
  }
}
