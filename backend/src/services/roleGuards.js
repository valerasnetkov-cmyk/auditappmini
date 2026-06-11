export function createRoleGuards({ sendError, API_MESSAGES }) {
  const ASSIGNABLE_USER_ROLES = new Set(['inspector', 'manager'])

  function isManager(req) {
    return req.user?.role === 'manager' || req.user?.role === 'owner'
  }

  function isAdmin(req) {
    return req.user?.role === 'admin'
  }

  function isResourceUser(req) {
    return req.user?.role === 'admin' || req.user?.role === 'resource_manager'
  }

  function isCompanyOwner(req) {
    return req.user?.role === 'owner'
  }

  function isSelf(req, userId) {
    return req.user?.id === userId
  }

  function ensureManager(req, res, message = API_MESSAGES.managersOnly) {
    if (isManager(req)) return true
    sendError(res, 403, message)
    return false
  }

  function ensureManagerOrSelf(req, res, userId, message = API_MESSAGES.noAccess) {
    if (isManager(req) || isSelf(req, userId)) return true
    sendError(res, 403, message)
    return false
  }

  function ensureCompanyOwner(req, res, message = API_MESSAGES.companyOwnersOnly) {
    if (isCompanyOwner(req)) return true
    sendError(res, 403, message)
    return false
  }

  function ensureCompanyOwnerOrSelf(req, res, userId, message = API_MESSAGES.noAccess) {
    if (isCompanyOwner(req) || isSelf(req, userId)) return true
    sendError(res, 403, message)
    return false
  }

  function ensureAdmin(req, res, message = API_MESSAGES.adminsOnly) {
    if (isAdmin(req)) return true
    sendError(res, 403, message)
    return false
  }

  function canAssignRole(req, role) {
    if (!role || !ASSIGNABLE_USER_ROLES.has(role)) return false
    return isCompanyOwner(req)
  }

  function isAssignableCompanyUserRole(role) {
    return ASSIGNABLE_USER_ROLES.has(role)
  }

  return {
    isManager,
    isAdmin,
    isResourceUser,
    isCompanyOwner,
    isSelf,
    ensureManager,
    ensureManagerOrSelf,
    ensureCompanyOwner,
    ensureCompanyOwnerOrSelf,
    ensureAdmin,
    canAssignRole,
    isAssignableCompanyUserRole,
  }
}
