import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'

export default function registerUserRoutes({
  app,
  db,
  authenticate,
  sendError,
  sendCompanyLimitViolation,
  API_MESSAGES,
  getUserIdByEmail,
  getUserRecordById,
  createUserRecord,
  updateUserRecord,
  getCompanyLimitViolation,
  ensureCompanyOwner,
  ensureCompanyOwnerOrSelf,
  ensureCompanyOperationalWriteAllowed,
  isCompanyOwner,
  isSelf,
  canAssignRole,
  isAssignableCompanyUserRole,
}) {
  app.get('/api/users', authenticate, (req, res) => {
    if (!ensureCompanyOwner(req, res)) return
    const companyId = req.user.company_id || 'default'

    const users = db.prepare(`
      SELECT id, email, name, role, status, company_id, created_at, mfa_enabled FROM users WHERE company_id = ? ORDER BY created_at DESC
    `).all(companyId)

    res.json(users)
  })

  app.get('/api/users/:id', authenticate, (req, res) => {
    if (!ensureCompanyOwnerOrSelf(req, res, req.params.id)) return

    const companyId = req.user.company_id || 'default'
    const user = getUserRecordById(req.params.id, isSelf(req, req.params.id) ? null : companyId)
    if (!user) {
      return sendError(res, 404, API_MESSAGES.userNotFound)
    }
    res.json(user)
  })

  app.post('/api/users', authenticate, (req, res) => {
    if (!ensureCompanyOwner(req, res)) return
    if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'write' })) return

    const companyId = req.user.company_id || 'default'
    const { email, password, name, role = 'inspector' } = req.body

    if (!email || !password || !name) {
      return sendError(res, 400, API_MESSAGES.allFieldsRequired)
    }

    if (!canAssignRole(req, role)) {
      return sendError(res, 403, API_MESSAGES.accessDenied)
    }

    const existing = getUserIdByEmail(email)
    if (existing) {
      return sendError(res, 400, API_MESSAGES.emailAlreadyUsed)
    }

    const limitViolation = getCompanyLimitViolation(companyId, 'users')
    if (limitViolation) {
      return sendCompanyLimitViolation(res, limitViolation)
    }

    const id = uuidv4()
    const hashedPassword = bcrypt.hashSync(password, 10)

    createUserRecord({ id, email, passwordHash: hashedPassword, name, role, companyId })

    const user = getUserRecordById(id, companyId)
    res.status(201).json(user)
  })

  app.put('/api/users/:id', authenticate, (req, res) => {
    if (!ensureCompanyOwnerOrSelf(req, res, req.params.id)) return
    if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'write' })) return

    const companyId = req.user.company_id || 'default'
    const targetUser = getUserRecordById(req.params.id, isSelf(req, req.params.id) ? null : companyId)
    if (!targetUser) {
      return sendError(res, 404, API_MESSAGES.userNotFound)
    }

    const { email, name, role, password } = req.body

    if (!isCompanyOwner(req)) {
      if (name) {
        updateUserRecord(req.params.id, { name, companyId: targetUser.company_id })
      }
    } else {
      if (!isSelf(req, req.params.id) && !isAssignableCompanyUserRole(targetUser.role)) {
        return sendError(res, 403, API_MESSAGES.accessDenied)
      }

      const requestedRole = role === targetUser.role ? undefined : role
      if (isSelf(req, req.params.id) && !isAssignableCompanyUserRole(targetUser.role) && requestedRole !== undefined) {
        return sendError(res, 403, API_MESSAGES.accessDenied)
      }
      if (requestedRole !== undefined && !canAssignRole(req, requestedRole)) {
        return sendError(res, 403, API_MESSAGES.accessDenied)
      }

      if (email) {
        const existing = getUserIdByEmail(email)
        if (existing && existing !== req.params.id) {
          return sendError(res, 400, API_MESSAGES.emailAlreadyUsed)
        }
      }

      const passwordHash = password ? bcrypt.hashSync(password, 10) : undefined
      updateUserRecord(req.params.id, { email, name, role: requestedRole, passwordHash, companyId: targetUser.company_id })
    }

    const user = getUserRecordById(req.params.id, targetUser.company_id)
    res.json(user)
  })

  app.delete('/api/users/:id', authenticate, (req, res) => {
    if (!ensureCompanyOwner(req, res)) return
    if (!ensureCompanyOperationalWriteAllowed(req, res, { mode: 'write' })) return

    if (isSelf(req, req.params.id)) {
      return sendError(res, 400, API_MESSAGES.selfDeleteForbidden)
    }

    const companyId = req.user.company_id || 'default'
    const user = getUserRecordById(req.params.id, companyId)
    if (!user) {
      return sendError(res, 404, API_MESSAGES.userNotFound)
    }
    if (!isAssignableCompanyUserRole(user.role)) {
      return sendError(res, 403, API_MESSAGES.accessDenied)
    }

    db.prepare('DELETE FROM users WHERE id = ? AND company_id = ?').run(req.params.id, companyId)
    res.status(204).send()
  })
}
