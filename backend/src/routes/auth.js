import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import speakeasy from 'speakeasy'
import crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import {
  JWT_SECRET,
  MFA_LOGIN_TOKEN_TTL,
  PUBLIC_REGISTRATION_ENABLED,
} from '../config.js'
import { setAuthCookie, clearAuthCookie } from '../middleware/auth.js'

function getWebAppUrl() {
  return (process.env.WEB_APP_URL || process.env.FRONTEND_URL || 'http://localhost:3002').replace(/\/+$/, '')
}

function getOwnerSetupFingerprint(passwordHash) {
  return crypto
    .createHmac('sha256', JWT_SECRET)
    .update(String(passwordHash || ''))
    .digest('hex')
}

function parseDurationSeconds(value, fallbackSeconds) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value)
  }

  const text = String(value || '').trim()
  if (/^\d+$/.test(text)) {
    return Number(text)
  }

  const match = text.match(/^(\d+)\s*([smhd])$/i)
  if (!match) return fallbackSeconds

  const amount = Number(match[1])
  const unit = match[2].toLowerCase()
  const multipliers = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 24 * 60 * 60,
  }

  return amount * multipliers[unit]
}

function createAuthToken(user) {
  const companyId = user.company_id || 'default'
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name, company_id: companyId },
    JWT_SECRET,
    { expiresIn: '7d' },
  )
}

function createMfaLoginToken(user) {
  return jwt.sign(
    {
      purpose: 'mfa_login',
      id: user.id,
      email: user.email,
      company_id: user.company_id || 'default',
    },
    JWT_SECRET,
    { expiresIn: MFA_LOGIN_TOKEN_TTL },
  )
}

function toAuthUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    company_id: user.company_id || 'default',
  }
}

function sendAuthSession(res, user) {
  const token = createAuthToken(user)
  setAuthCookie(res, token)
  return res.json({
    token,
    user: toAuthUser(user),
  })
}

function markUserLogin(db, userId) {
  try {
    db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(userId)
  } catch (error) {
    console.warn('Unable to update last_login_at:', error.message)
  }
}

export function createOwnerSetupInvitationFactory({ db }) {
  return function createOwnerSetupInvitation(user) {
    const expiresIn = process.env.OWNER_SETUP_TOKEN_TTL || '7d'
    const expiresInSeconds = parseDurationSeconds(expiresIn, 7 * 24 * 60 * 60)
    const nonce = uuidv4()
    const issuedAt = new Date()
    const expiresAt = new Date(issuedAt.getTime() + expiresInSeconds * 1000)
    const owner = db.prepare(`
      SELECT id, email, password, role, status, company_id
      FROM users
      WHERE id = ?
    `).get(user.id)

    if (!owner || owner.role !== 'owner' || owner.status === 'inactive') {
      throw new Error('Owner setup invitation requires an active owner user')
    }

    db.prepare(`
      UPDATE users
      SET owner_setup_nonce = ?,
          owner_setup_issued_at = ?,
          owner_setup_expires_at = ?,
          owner_setup_accepted_at = NULL
      WHERE id = ?
    `).run(nonce, issuedAt.toISOString(), expiresAt.toISOString(), owner.id)

    const token = jwt.sign(
      {
        purpose: 'owner_setup',
        id: owner.id,
        email: owner.email,
        company_id: owner.company_id || 'default',
        setup_fingerprint: getOwnerSetupFingerprint(owner.password),
        setup_nonce: nonce,
      },
      JWT_SECRET,
      { expiresIn },
    )

    return {
      token,
      setup_url: `${getWebAppUrl()}/owner-setup?token=${encodeURIComponent(token)}`,
      expires_in: expiresIn,
      expires_at: expiresAt.toISOString(),
    }
  }
}

export default function registerAuthRoutes({
  app,
  db,
  authenticate,
  publicAuthRateLimit,
  authenticatedSensitiveRateLimit,
  noStore,
  sendError,
  API_MESSAGES,
  getUserSummaryById,
  getUserIdByEmail,
  getUserRecordById,
  createUserRecord,
  updateUserRecord,
  ensureCompanyOwnerOrSelf,
  isSelf,
  isAssignableCompanyUserRole,
}) {
  function getManagedMfaUser(req, res, userId, columns = 'id, email, name, role, company_id, mfa_secret') {
    const companyId = req.user.company_id || 'default'
    if (!ensureCompanyOwnerOrSelf(req, res, userId, API_MESSAGES.accessDenied)) return null

    const user = db.prepare(`
      SELECT ${columns}
      FROM users
      WHERE id = ? AND company_id = ?
    `).get(userId, companyId)
    if (!user) {
      sendError(res, 404, API_MESSAGES.userNotFound)
      return null
    }
    if (!isSelf(req, userId) && !isAssignableCompanyUserRole(user.role)) {
      sendError(res, 403, API_MESSAGES.accessDenied)
      return null
    }

    return { user, companyId }
  }

  function handleUserMfaEnable(req, res) {
    const userId = req.params.id
    const { token } = req.body || {}
    const managed = getManagedMfaUser(req, res, userId)
    if (!managed) return

    const { user, companyId } = managed
    if (!user.mfa_secret) return sendError(res, 400, API_MESSAGES.mfaNotConfigured)
    const verified = speakeasy.totp.verify({
      secret: user.mfa_secret,
      encoding: 'base32',
      token: String(token || ''),
      window: 1,
    })
    if (!verified) return sendError(res, 401, API_MESSAGES.invalidMfaCode)
    db.prepare('UPDATE users SET mfa_enabled = 1 WHERE id = ? AND company_id = ?').run(userId, companyId)
    return sendAuthSession(res, {
      ...user,
      company_id: user.company_id || companyId,
    })
  }

  function handleUserMfaDisable(req, res) {
    const userId = req.params.id
    const { password, token } = req.body || {}
    const managed = getManagedMfaUser(req, res, userId, 'id, email, name, role, company_id, mfa_enabled, mfa_secret')
    if (!managed) return

    if (typeof password !== 'string' || !password) {
      return sendError(res, 400, 'Password is required to disable MFA')
    }

    const actor = db.prepare(`
      SELECT id, password
      FROM users
      WHERE id = ?
    `).get(req.user.id)
    const passwordOk = bcrypt.compareSync(password, actor?.password || '$2a$10$J9e3WdYLmopA7LzXnxjx7Oq4FMdt0MBGDGg2po7GTL58e86qfqxxK')
    if (!actor || !passwordOk) {
      return sendError(res, 401, API_MESSAGES.invalidCredentials)
    }

    const { user, companyId } = managed
    if (user.mfa_enabled && user.mfa_secret) {
      const verified = speakeasy.totp.verify({
        secret: user.mfa_secret,
        encoding: 'base32',
        token: String(token || ''),
        window: 1,
      })
      if (!verified) return sendError(res, 401, API_MESSAGES.invalidMfaCode)
    }

    db.prepare('UPDATE users SET mfa_enabled = 0, mfa_secret = NULL WHERE id = ? AND company_id = ?').run(userId, companyId)
    return res.json({ ok: true, mfa_enabled: false })
  }

  app.post('/api/auth/login', ...publicAuthRateLimit, (req, res) => {
    const { email, password } = req.body

    if (!email || !password) {
      return sendError(res, 400, API_MESSAGES.loginCredentialsRequired)
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    const user = db.prepare('SELECT id, email, password, name, role, status, company_id, mfa_enabled, mfa_secret FROM users WHERE email = ?').get(normalizedEmail)
    const passwordHash = user?.password || '$2a$10$J9e3WdYLmopA7LzXnxjx7Oq4FMdt0MBGDGg2po7GTL58e86qfqxxK'
    const passwordOk = bcrypt.compareSync(String(password), passwordHash)

    if (!user || !passwordOk) {
      return sendError(res, 401, API_MESSAGES.invalidCredentials)
    }

    if (user.status === 'inactive') {
      return sendError(res, 403, API_MESSAGES.userInactive)
    }

    if (user.mfa_enabled) {
      return res.json({
        mfaRequired: true,
        mfaToken: createMfaLoginToken(user),
        user: toAuthUser(user),
      })
    }

    markUserLogin(db, user.id)
    return sendAuthSession(res, user)
  })

  app.post('/api/auth/mfa/verify', ...publicAuthRateLimit, (req, res) => {
    const { mfaToken, token } = req.body || {}

    if (!mfaToken || !token) {
      return sendError(res, 400, 'MFA token and verification code are required')
    }

    let decoded
    try {
      decoded = jwt.verify(mfaToken, JWT_SECRET)
    } catch {
      return sendError(res, 401, API_MESSAGES.invalidToken)
    }

    if (decoded?.purpose !== 'mfa_login' || !decoded.id || !decoded.email) {
      return sendError(res, 401, API_MESSAGES.invalidToken)
    }

    const user = db.prepare(`
      SELECT id, email, password, name, role, status, company_id, mfa_enabled, mfa_secret
      FROM users
      WHERE id = ? AND email = ?
    `).get(decoded.id, decoded.email)

    if (!user) {
      return sendError(res, 401, API_MESSAGES.invalidToken)
    }

    if (user.status === 'inactive') {
      return sendError(res, 403, API_MESSAGES.userInactive)
    }

    if (!user.mfa_enabled || !user.mfa_secret) {
      return sendError(res, 400, 'MFA is not enabled for this user')
    }

    const verified = speakeasy.totp.verify({
      secret: user.mfa_secret,
      encoding: 'base32',
      token: String(token),
      window: 1,
    })

    if (!verified) {
      return sendError(res, 401, 'Invalid MFA token')
    }

    markUserLogin(db, user.id)
    return sendAuthSession(res, user)
  })

  app.post('/api/auth/owner-setup', ...publicAuthRateLimit, (req, res) => {
    const { token, password } = req.body || {}

    if (!token || typeof password !== 'string') {
      return sendError(res, 400, API_MESSAGES.registerFieldsRequired)
    }

    if (password.length < 8) {
      return sendError(res, 400, 'Password must contain at least 8 characters')
    }

    let decoded
    try {
      decoded = jwt.verify(token, JWT_SECRET)
    } catch {
      return sendError(res, 401, API_MESSAGES.invalidToken)
    }

    if (decoded?.purpose !== 'owner_setup' || !decoded.id || !decoded.company_id) {
      return sendError(res, 401, API_MESSAGES.invalidToken)
    }

    const user = db.prepare(`
      SELECT id, email, password, name, role, status, company_id, created_at, owner_setup_nonce
      FROM users
      WHERE id = ? AND company_id = ?
    `).get(decoded.id, decoded.company_id)

    if (!user || user.role !== 'owner') {
      return sendError(res, 404, API_MESSAGES.userNotFound)
    }

    if (user.status === 'inactive') {
      return sendError(res, 403, API_MESSAGES.userInactive)
    }

    if (
      decoded.email !== user.email ||
      !decoded.setup_fingerprint ||
      decoded.setup_fingerprint !== getOwnerSetupFingerprint(user.password) ||
      !decoded.setup_nonce ||
      decoded.setup_nonce !== user.owner_setup_nonce
    ) {
      return sendError(res, 401, API_MESSAGES.invalidToken)
    }

    const passwordHash = bcrypt.hashSync(password, 10)
    updateUserRecord(user.id, { passwordHash, status: 'active', companyId: user.company_id })
    db.prepare(`
      UPDATE users
      SET owner_setup_nonce = NULL,
          owner_setup_accepted_at = datetime('now')
      WHERE id = ?
    `).run(user.id)

    const updatedUser = getUserSummaryById(user.id, user.company_id)
    markUserLogin(db, user.id)
    return sendAuthSession(res, updatedUser)
  })

  // MFA: setup for company owners to configure managed users; self-service is also allowed.
  app.post('/api/users/:id/mfa/setup', authenticate, (req, res) => {
    const userId = req.params.id
    const companyId = req.user.company_id || 'default'
    // Company owners can set MFA for managed users; self-service is allowed for everyone.
    if (!ensureCompanyOwnerOrSelf(req, res, userId, API_MESSAGES.accessDenied)) return

    const user = getUserRecordById(userId, isSelf(req, userId) ? null : companyId)
    if (!user) {
      return sendError(res, 404, API_MESSAGES.userNotFound)
    }
    if (!isSelf(req, userId) && !isAssignableCompanyUserRole(user.role)) {
      return sendError(res, 403, API_MESSAGES.accessDenied)
    }

    const secret = speakeasy.generateSecret({ length: 20 })
    db.prepare('UPDATE users SET mfa_secret = ? WHERE id = ? AND company_id = ?').run(secret.base32, userId, user.company_id || companyId)
    res.json({ otpauth_url: secret.otpauth_url, secret: secret.base32 })
  })

  app.post('/api/users/:id/mfa/enable', authenticate, ...authenticatedSensitiveRateLimit, handleUserMfaEnable)
  app.post('/api/users/:id/mfa/verify', authenticate, ...authenticatedSensitiveRateLimit, handleUserMfaEnable)
  app.post('/api/users/:id/mfa/disable', authenticate, ...authenticatedSensitiveRateLimit, handleUserMfaDisable)

  // Legacy public registration endpoint for local/mobile experiments.
  // In the SaaS production model companies are created by the resource admin,
  // and company users are created by the company owner from the user panel.
  app.post('/api/auth/register', ...publicAuthRateLimit, (req, res) => {
    if (!PUBLIC_REGISTRATION_ENABLED) {
      return sendError(res, 403, 'Public registration is disabled')
    }

    const { email, password, name } = req.body
    // Public registration: always register as inspector
    const role = 'inspector'
    if (!email || !password || !name) {
      return sendError(res, 400, API_MESSAGES.registerFieldsRequired)
    }
    const existing = getUserIdByEmail(email)
    if (existing) {
      return sendError(res, 400, API_MESSAGES.userEmailExists)
    }

    const id = uuidv4()
    const hashedPassword = bcrypt.hashSync(password, 10)
    createUserRecord({ id, email, passwordHash: hashedPassword, name, role })

    const user = getUserSummaryById(id)
    return sendAuthSession(res, user)
  })

  app.post('/api/auth/logout', noStore, (req, res) => {
    clearAuthCookie(res)
    res.status(204).end()
  })

  app.get('/api/auth/me', authenticate, (req, res) => {
    const user = getUserSummaryById(req.user.id)
    res.json(user)
  })
}
