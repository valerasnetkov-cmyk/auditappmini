import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import {
  RESOURCE_PERMISSIONS,
  RESOURCE_PERMISSION_PRESETS,
  getResourcePermissions,
  hasResourcePermission,
  replaceResourcePermissions,
} from '../services/resourcePermissions.js'

const CYRILLIC_MAP = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
}

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function writeAudit(db, req, action, entityType, entityId, payload = null, companyId = null) {
  db.prepare(`
    INSERT INTO audit_logs (id, company_id, actor_user_id, actor_role, action, entity_type, entity_id, payload_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    uuidv4(), companyId, req.user?.id || null, req.user?.role || null,
    action, entityType, entityId, payload ? JSON.stringify(payload) : null,
  )
}

export function slugifyCompanyName(value) {
  const withoutLegalForm = text(value)
    .toLowerCase()
    .replace(/^(ооо|ип|ао|пао|зао|оао)\s+/i, '')
  return withoutLegalForm
    .split('')
    .map((char) => CYRILLIC_MAP[char] ?? char)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function uniqueCompanySlug(db, value, excludeId = null) {
  const base = slugifyCompanyName(value) || 'company'
  let candidate = base
  let suffix = 2
  while (db.prepare('SELECT id FROM companies WHERE slug = ? AND (? IS NULL OR id != ?)').get(candidate, excludeId, excludeId)) {
    candidate = `${base}-${suffix}`
    suffix += 1
  }
  return candidate
}

function requirePermission(db, permission) {
  return (req, res, next) => {
    if (hasResourcePermission(db, req.user, permission)) return next()
    return res.status(403).json({ error: 'Access denied' })
  }
}

function mapResourceUser(db, user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    preset: user.resource_permission_preset || 'custom',
    permissions: getResourcePermissions(db, user),
    createdAt: user.created_at || null,
  }
}

export default function registerAdminOperationsRoutes({ app, db, authenticate }) {
  app.get('/api/admin/resource/access', authenticate, (req, res) => {
    if (!['admin', 'resource_manager'].includes(req.user?.role)) return res.status(403).json({ error: 'Access denied' })
    res.json({
      role: req.user.role,
      permissions: getResourcePermissions(db, req.user),
      availablePermissions: RESOURCE_PERMISSIONS,
      presets: RESOURCE_PERMISSION_PRESETS,
    })
  })

  app.put('/api/admin/resource/profile', authenticate, (req, res) => {
    if (!['admin', 'resource_manager'].includes(req.user?.role)) return res.status(403).json({ error: 'Access denied' })
    const current = db.prepare("SELECT * FROM users WHERE id = ? AND role IN ('admin', 'resource_manager')").get(req.user.id)
    if (!current) return res.status(404).json({ error: 'Профиль не найден' })
    const name = text(req.body?.name) || current.name
    const email = text(req.body?.email).toLowerCase() || current.email
    const duplicate = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, current.id)
    if (duplicate) return res.status(409).json({ error: 'Email уже используется' })
    const password = text(req.body?.password)
    if (password && password.length < 8) return res.status(400).json({ error: 'Пароль должен содержать не менее 8 символов' })
    db.prepare(`
      UPDATE users SET name = ?, email = ?, password = ? WHERE id = ?
    `).run(name, email, password ? bcrypt.hashSync(password, 10) : current.password, current.id)
    writeAudit(db, req, 'resource_profile.updated', 'user', current.id, { name, email })
    res.json({ id: current.id, name, email, role: current.role, status: current.status })
  })

  app.get('/api/admin/resource/companies-list', authenticate, requirePermission(db, 'companies.view'), (req, res) => {
    const clauses = []
    const params = []
    const search = text(req.query.search)
    if (search) {
      clauses.push('(c.name LIKE ? OR c.slug LIKE ? OR c.inn LIKE ?)')
      const pattern = `%${search}%`
      params.push(pattern, pattern, pattern)
    }
    if (['active', 'inactive'].includes(req.query.status)) {
      clauses.push('c.status = ?')
      params.push(req.query.status)
    }
    if (text(req.query.plan)) {
      clauses.push('limits.plan_code = ?')
      params.push(text(req.query.plan))
    }
    if (text(req.query.region)) {
      clauses.push('c.region_code = ?')
      params.push(text(req.query.region))
    }
    if (req.query.has_owner === 'true') clauses.push('owner.id IS NOT NULL')
    if (req.query.has_owner === 'false') clauses.push('owner.id IS NULL')
    if (text(req.query.expires_before)) {
      clauses.push('subscription.current_period_end <= ?')
      params.push(text(req.query.expires_before))
    }
    if (text(req.query.expires_after)) {
      clauses.push('subscription.current_period_end >= ?')
      params.push(text(req.query.expires_after))
    }
    if (req.query.billing === 'overdue') clauses.push("subscription.status IN ('expired', 'suspended', 'grace')")
    if (text(req.query.subscription_status)) {
      clauses.push('subscription.status = ?')
      params.push(text(req.query.subscription_status))
    }
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100))
    const rows = db.prepare(`
      SELECT c.id, c.slug, c.name, c.status, c.region_code, c.data_residency, c.created_at,
        limits.plan_code, limits.max_vehicles, limits.max_users, limits.max_storage_mb,
        subscription.status AS subscription_status, subscription.current_period_end,
        owner.id AS owner_id, owner.name AS owner_name, owner.email AS owner_email
      FROM companies c
      LEFT JOIN company_limits limits ON limits.company_id = c.id
      LEFT JOIN company_subscriptions subscription ON subscription.company_id = c.id
      LEFT JOIN users owner ON owner.company_id = c.id AND owner.role = 'owner' AND owner.status = 'active'
      ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
      GROUP BY c.id
      ORDER BY c.name COLLATE NOCASE
      LIMIT ?
    `).all(...params, limit)
    res.json({ companies: rows })
  })

  app.get('/api/admin/resource/companies/:id/billing-details', authenticate, requirePermission(db, 'company_billing_details.view'), (req, res) => {
    const company = db.prepare(`
      SELECT id, legal_name, short_name, inn, kpp, ogrn, legal_address, postal_address,
        billing_email, billing_contact_name, billing_contact_phone, accounting_comment
      FROM companies WHERE id = ?
    `).get(req.params.id)
    if (!company) return res.status(404).json({ error: 'Компания не найдена' })
    res.json(company)
  })

  app.put('/api/admin/resource/companies/:id/billing-details', authenticate, requirePermission(db, 'company_billing_details.manage'), (req, res) => {
    const company = db.prepare('SELECT id FROM companies WHERE id = ?').get(req.params.id)
    if (!company) return res.status(404).json({ error: 'Компания не найдена' })
    const fields = [
      'legal_name', 'short_name', 'inn', 'kpp', 'ogrn', 'legal_address', 'postal_address',
      'billing_email', 'billing_contact_name', 'billing_contact_phone', 'accounting_comment',
    ]
    const payload = Object.fromEntries(fields.map((field) => [field, text(req.body?.[field]) || null]))
    if (payload.inn && !/^\d{10}(\d{2})?$/.test(payload.inn)) return res.status(400).json({ error: 'ИНН должен содержать 10 или 12 цифр' })
    if (payload.billing_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.billing_email)) return res.status(400).json({ error: 'Некорректный billing email' })
    db.prepare(`
      UPDATE companies SET ${fields.map((field) => `${field} = ?`).join(', ')} WHERE id = ?
    `).run(...fields.map((field) => payload[field]), company.id)
    writeAudit(db, req, 'company.billing_details.updated', 'company', company.id, payload, company.id)
    res.json({ id: company.id, ...payload })
  })

  app.get('/api/admin/resource/service-users', authenticate, requirePermission(db, 'service_users.view'), (req, res) => {
    const users = db.prepare(`
      SELECT id, email, name, role, status, resource_permission_preset, created_at
      FROM users WHERE role IN ('admin', 'resource_manager')
      ORDER BY CASE role WHEN 'admin' THEN 0 ELSE 1 END, name COLLATE NOCASE
    `).all()
    res.json({ users: users.map((user) => mapResourceUser(db, user)), presets: RESOURCE_PERMISSION_PRESETS, permissions: RESOURCE_PERMISSIONS })
  })

  app.post('/api/admin/resource/service-users', authenticate, requirePermission(db, 'service_users.manage'), (req, res) => {
    const email = text(req.body?.email).toLowerCase()
    const name = text(req.body?.name)
    const password = text(req.body?.password)
    const preset = RESOURCE_PERMISSION_PRESETS[req.body?.preset] ? req.body.preset : 'custom'
    if (!email || !name || password.length < 8) return res.status(400).json({ error: 'Укажите имя, email и пароль не короче 8 символов' })
    if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) return res.status(409).json({ error: 'Email уже используется' })
    const id = uuidv4()
    db.prepare(`
      INSERT INTO users (id, email, password, name, role, status, company_id, resource_permission_preset)
      VALUES (?, ?, ?, ?, 'resource_manager', 'active', NULL, ?)
    `).run(id, email, bcrypt.hashSync(password, 10), name, preset)
    const permissions = Array.isArray(req.body?.permissions) ? req.body.permissions : RESOURCE_PERMISSION_PRESETS[preset]
    replaceResourcePermissions(db, id, permissions)
    writeAudit(db, req, 'service_user.created', 'user', id, { email, preset })
    res.status(201).json(mapResourceUser(db, db.prepare('SELECT * FROM users WHERE id = ?').get(id)))
  })

  app.put('/api/admin/resource/service-users/:id', authenticate, requirePermission(db, 'service_users.manage'), (req, res) => {
    const user = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'resource_manager'").get(req.params.id)
    if (!user) return res.status(404).json({ error: 'Сотрудник не найден' })
    const preset = RESOURCE_PERMISSION_PRESETS[req.body?.preset] ? req.body.preset : (user.resource_permission_preset || 'custom')
    const status = req.body?.status === undefined
      ? user.status
      : (req.body.status === 'inactive' ? 'inactive' : 'active')
    db.prepare(`
      UPDATE users SET name = ?, status = ?, resource_permission_preset = ? WHERE id = ?
    `).run(text(req.body?.name) || user.name, status, preset, user.id)
    if (Array.isArray(req.body?.permissions)) replaceResourcePermissions(db, user.id, req.body.permissions)
    else if (req.body?.preset) replaceResourcePermissions(db, user.id, RESOURCE_PERMISSION_PRESETS[preset])
    writeAudit(db, req, 'service_user.updated', 'user', user.id, { preset, status: req.body?.status })
    res.json(mapResourceUser(db, db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)))
  })

  app.get('/api/admin/resource/service-profile', authenticate, requirePermission(db, 'service_profile.view'), (req, res) => {
    res.json(db.prepare("SELECT * FROM service_profile WHERE id = 'default'").get())
  })

  app.put('/api/admin/resource/service-profile', authenticate, requirePermission(db, 'service_profile.manage'), (req, res) => {
    const fields = [
      'service_name', 'legal_name', 'inn', 'kpp', 'ogrn', 'legal_address', 'postal_address',
      'bank_name', 'bik', 'bank_account', 'correspondent_account', 'billing_email',
      'support_email', 'support_phone',
    ]
    const values = fields.map((field) => text(req.body?.[field]) || null)
    db.prepare(`
      UPDATE service_profile SET ${fields.map((field) => `${field} = ?`).join(', ')},
        updated_by_user_id = ?, updated_at = datetime('now') WHERE id = 'default'
    `).run(...values, req.user.id)
    writeAudit(db, req, 'service_profile.updated', 'service_profile', 'default')
    res.json(db.prepare("SELECT * FROM service_profile WHERE id = 'default'").get())
  })

  app.get('/api/admin/resource/notification-templates', authenticate, requirePermission(db, 'templates.view'), (req, res) => {
    res.json({ templates: db.prepare('SELECT * FROM notification_templates ORDER BY code').all() })
  })

  app.post('/api/admin/resource/notification-templates', authenticate, requirePermission(db, 'templates.manage'), (req, res) => {
    const code = slugifyCompanyName(req.body?.code)
    const title = text(req.body?.title)
    const body = text(req.body?.body)
    if (!code || !title || !body) return res.status(400).json({ error: 'Код, заголовок и текст обязательны' })
    const id = uuidv4()
    db.prepare(`
      INSERT INTO notification_templates (id, code, title, body, category, created_by_user_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, code, title, body, text(req.body?.category) || 'system', req.user.id)
    writeAudit(db, req, 'notification_template.created', 'notification_template', id)
    res.status(201).json(db.prepare('SELECT * FROM notification_templates WHERE id = ?').get(id))
  })

  app.put('/api/admin/resource/notification-templates/:id', authenticate, requirePermission(db, 'templates.manage'), (req, res) => {
    const template = db.prepare('SELECT * FROM notification_templates WHERE id = ?').get(req.params.id)
    if (!template) return res.status(404).json({ error: 'Шаблон не найден' })
    db.prepare(`
      UPDATE notification_templates SET title = ?, body = ?, category = ?, is_active = ?,
        updated_by_user_id = ?, updated_at = datetime('now') WHERE id = ?
    `).run(
      text(req.body?.title) || template.title, text(req.body?.body) || template.body,
      text(req.body?.category) || template.category, req.body?.is_active === false ? 0 : 1,
      req.user.id, template.id,
    )
    writeAudit(db, req, 'notification_template.updated', 'notification_template', template.id)
    res.json(db.prepare('SELECT * FROM notification_templates WHERE id = ?').get(template.id))
  })

  app.post('/api/admin/resource/messages', authenticate, requirePermission(db, 'notifications.manage'), (req, res) => {
    const companyId = text(req.body?.companyId)
    const recipientUserId = text(req.body?.recipientUserId) || null
    const title = text(req.body?.title)
    const message = text(req.body?.message)
    if (!companyId || !title || !message) return res.status(400).json({ error: 'Компания, тема и текст обязательны' })
    if (!db.prepare('SELECT id FROM companies WHERE id = ?').get(companyId)) return res.status(404).json({ error: 'Компания не найдена' })
    if (recipientUserId && !db.prepare('SELECT id FROM users WHERE id = ? AND company_id = ?').get(recipientUserId, companyId)) {
      return res.status(400).json({ error: 'Получатель не относится к компании' })
    }
    const recipients = recipientUserId
      ? [{ id: recipientUserId, role: null }]
      : db.prepare(`
          SELECT id, role FROM users WHERE company_id = ? AND status = 'active'
          AND (role = 'owner' OR (role = 'manager' AND service_notifications_enabled = 1))
        `).all(companyId)
    const insert = db.prepare(`
      INSERT INTO company_notifications (
        id, company_id, recipient_user_id, recipient_role, type, channel, title, message,
        status, created_by_user_id, template_id, source, created_at
      ) VALUES (?, ?, ?, ?, 'service_message', 'in_app', ?, ?, 'new', ?, ?, 'manual', datetime('now'))
    `)
    recipients.forEach((recipient) => insert.run(
      uuidv4(), companyId, recipient.id, recipient.role, title, message, req.user.id,
      text(req.body?.templateId) || null,
    ))
    writeAudit(db, req, 'notification.created', 'company', companyId, { recipientUserId, recipients: recipients.length }, companyId)
    res.status(201).json({ created: recipients.length })
  })

  app.get('/api/admin/resource/companies/:id/notification-recipients', authenticate, requirePermission(db, 'notifications.view'), (req, res) => {
    if (!db.prepare('SELECT id FROM companies WHERE id = ?').get(req.params.id)) {
      return res.status(404).json({ error: 'Компания не найдена' })
    }
    const recipients = db.prepare(`
      SELECT id, email, name, role, status, service_notifications_enabled
      FROM users
      WHERE company_id = ? AND status = 'active'
        AND (role = 'owner' OR (role = 'manager' AND service_notifications_enabled = 1))
      ORDER BY CASE role WHEN 'owner' THEN 0 ELSE 1 END, name COLLATE NOCASE
    `).all(req.params.id).map((recipient) => ({
      id: recipient.id,
      email: recipient.email,
      name: recipient.name,
      role: recipient.role,
      status: recipient.status,
      serviceNotificationsEnabled: Boolean(recipient.service_notifications_enabled),
    }))
    res.json({ recipients })
  })
}
