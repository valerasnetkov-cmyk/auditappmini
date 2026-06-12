export const RESOURCE_PERMISSIONS = [
  'dashboard.view',
  'companies.view',
  'companies.manage',
  'company_billing_details.view',
  'company_billing_details.manage',
  'plans.view',
  'plans.manage',
  'payments.view',
  'payments.manage',
  'notifications.view',
  'notifications.manage',
  'pilot_requests.view',
  'pilot_requests.manage',
  'templates.view',
  'templates.manage',
  'service_users.view',
  'service_users.manage',
  'service_profile.view',
  'service_profile.manage',
]

export const RESOURCE_PERMISSION_PRESETS = {
  support: [
    'dashboard.view', 'companies.view', 'notifications.view', 'notifications.manage',
    'pilot_requests.view', 'pilot_requests.manage',
    'templates.view', 'templates.manage',
  ],
  finance: [
    'dashboard.view', 'companies.view', 'company_billing_details.view',
    'company_billing_details.manage', 'plans.view', 'payments.view', 'payments.manage',
    'notifications.view', 'notifications.manage', 'service_profile.view', 'service_profile.manage',
  ],
  marketing: [
    'dashboard.view', 'companies.view', 'notifications.view', 'notifications.manage',
    'pilot_requests.view', 'pilot_requests.manage',
    'templates.view', 'templates.manage',
  ],
  custom: [],
}

export function getResourcePermissions(db, user) {
  if (user?.role === 'admin') return [...RESOURCE_PERMISSIONS]
  if (user?.role !== 'resource_manager') return []
  return db.prepare(`
    SELECT permission FROM resource_user_permissions
    WHERE user_id = ? AND enabled = 1
  `).all(user.id).map((row) => row.permission)
}

export function hasResourcePermission(db, user, permission) {
  return user?.role === 'admin' || getResourcePermissions(db, user).includes(permission)
}

export function replaceResourcePermissions(db, userId, permissions) {
  const allowed = new Set(RESOURCE_PERMISSIONS)
  const normalized = [...new Set(permissions)].filter((permission) => allowed.has(permission))
  db.prepare('DELETE FROM resource_user_permissions WHERE user_id = ?').run(userId)
  const insert = db.prepare(`
    INSERT INTO resource_user_permissions (user_id, permission, enabled, created_at, updated_at)
    VALUES (?, ?, 1, datetime('now'), datetime('now'))
  `)
  normalized.forEach((permission) => insert.run(userId, permission))
  return normalized
}
