function parseJson(value) {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

export function mapNotification(row) {
  return {
    id: row.id,
    companyId: row.company_id || null,
    companyName: row.company_name || null,
    recipientUserId: row.recipient_user_id || null,
    recipientRole: row.recipient_role || null,
    type: row.type,
    channel: row.channel || 'in_app',
    title: row.title,
    message: row.message || null,
    status: row.status || 'new',
    sentAt: row.sent_at || null,
    readAt: row.read_at || null,
    createdAt: row.created_at || null,
  }
}

export function mapAuditLog(row) {
  return {
    id: row.id,
    companyId: row.company_id || null,
    actorUserId: row.actor_user_id || null,
    actorName: row.actor_name || null,
    actorEmail: row.actor_email || null,
    actorRole: row.actor_role || null,
    action: row.action,
    entityType: row.entity_type || null,
    entityId: row.entity_id || null,
    payload: parseJson(row.payload_json),
    createdAt: row.created_at || null,
  }
}

export function getResourceAlerts(db, { limit = 200 } = {}) {
  return db.prepare(`
    SELECT n.*, c.name as company_name
    FROM company_notifications n
    LEFT JOIN companies c ON c.id = n.company_id
    WHERE COALESCE(n.recipient_role, 'admin') = 'admin'
      AND n.recipient_user_id IS NULL
    ORDER BY CASE WHEN n.status = 'new' THEN 0 ELSE 1 END, n.created_at DESC
    LIMIT ?
  `).all(limit).map(mapNotification)
}

export function getCompanyAlerts(db, companyId, { limit = 50 } = {}) {
  return db.prepare(`
    SELECT n.*, c.name as company_name
    FROM company_notifications n
    LEFT JOIN companies c ON c.id = n.company_id
    WHERE n.company_id = ?
    ORDER BY CASE WHEN n.status = 'new' THEN 0 ELSE 1 END, n.created_at DESC
    LIMIT ?
  `).all(companyId, limit).map(mapNotification)
}

export function getCompanyAuditLogs(db, companyId, { limit = 80 } = {}) {
  return db.prepare(`
    SELECT log.*, actor.name as actor_name, actor.email as actor_email
    FROM audit_logs log
    LEFT JOIN users actor ON actor.id = log.actor_user_id
    WHERE log.company_id = ?
    ORDER BY log.created_at DESC
    LIMIT ?
  `).all(companyId, limit).map(mapAuditLog)
}

export function getNotification(db, id) {
  const row = db.prepare(`
    SELECT n.*, c.name as company_name
    FROM company_notifications n
    LEFT JOIN companies c ON c.id = n.company_id
    WHERE n.id = ?
  `).get(id)
  return row ? mapNotification(row) : null
}

export function markNotificationRead(db, id) {
  db.prepare(`
    UPDATE company_notifications
    SET status = 'read', read_at = datetime('now')
    WHERE id = ?
  `).run(id)
  return getNotification(db, id)
}
