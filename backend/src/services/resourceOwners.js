import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'

const OWNER_FIELDS = `
  id, email, name, role, status, company_id, created_at, last_login_at,
  owner_setup_issued_at, owner_setup_expires_at, owner_setup_accepted_at
`

export function getOwnerSetupStatus(owner, now = new Date()) {
  if (owner.owner_setup_accepted_at || owner.last_login_at) return 'accepted'
  if (!owner.owner_setup_issued_at) return 'not_sent'
  const expiresAt = owner.owner_setup_expires_at ? new Date(owner.owner_setup_expires_at) : null
  return expiresAt && Number.isFinite(expiresAt.getTime()) && expiresAt < now
    ? 'expired'
    : 'pending'
}

export function mapOwner(owner, now = new Date()) {
  const companyId = owner.company_id || 'default'
  return {
    id: owner.id,
    email: owner.email,
    name: owner.name,
    role: owner.role,
    status: owner.status || 'active',
    company_id: companyId,
    created_at: owner.created_at || null,
    last_login_at: owner.last_login_at || null,
    setup: {
      status: getOwnerSetupStatus(owner, now),
      issued_at: owner.owner_setup_issued_at || null,
      expires_at: owner.owner_setup_expires_at || null,
      accepted_at: owner.owner_setup_accepted_at || owner.last_login_at || null,
    },
  }
}

export function getOwnersByCompany(db) {
  const rows = db.prepare(`
    SELECT ${OWNER_FIELDS}
    FROM users
    WHERE role = 'owner'
    ORDER BY name COLLATE NOCASE ASC, email COLLATE NOCASE ASC
  `).all()
  return rows.reduce((result, owner) => {
    const companyId = owner.company_id || 'default'
    if (!result[companyId]) result[companyId] = []
    result[companyId].push(mapOwner(owner))
    return result
  }, {})
}

export function getOwner(db, id) {
  return db.prepare(`
    SELECT ${OWNER_FIELDS}
    FROM users
    WHERE id = ? AND role = 'owner'
  `).get(id)
}

export function findUserByEmail(db, email) {
  return db.prepare('SELECT id, role, company_id FROM users WHERE email = ?').get(email)
}

export function saveCompanyOwner(db, {
  existing,
  companyId,
  email,
  name,
  status,
}) {
  const userId = existing?.id || uuidv4()
  if (existing) {
    db.prepare(`
      UPDATE users
      SET name = ?, role = 'owner', status = ?, company_id = ?
      WHERE id = ?
    `).run(name, status, companyId, userId)
  } else {
    db.prepare(`
      INSERT INTO users (id, email, password, name, role, status, company_id)
      VALUES (?, ?, ?, ?, 'owner', ?, ?)
    `).run(userId, email, bcrypt.hashSync(uuidv4(), 10), name, status, companyId)
  }
  return getOwner(db, userId)
}

export function updateOwner(db, owner, { email, name, status }) {
  const emailChanged = email !== owner.email
  db.prepare(`
    UPDATE users
    SET email = ?, name = ?, status = ?,
        owner_setup_nonce = CASE WHEN ? THEN NULL ELSE owner_setup_nonce END,
        owner_setup_issued_at = CASE WHEN ? THEN NULL ELSE owner_setup_issued_at END,
        owner_setup_expires_at = CASE WHEN ? THEN NULL ELSE owner_setup_expires_at END,
        owner_setup_accepted_at = CASE WHEN ? THEN NULL ELSE owner_setup_accepted_at END
    WHERE id = ? AND role = 'owner'
  `).run(
    email,
    name,
    status,
    emailChanged ? 1 : 0,
    emailChanged ? 1 : 0,
    emailChanged ? 1 : 0,
    emailChanged ? 1 : 0,
    owner.id,
  )
  return getOwner(db, owner.id)
}

export function deactivateOwner(db, id) {
  db.prepare(`
    UPDATE users
    SET status = 'inactive',
        owner_setup_nonce = NULL,
        owner_setup_issued_at = NULL,
        owner_setup_expires_at = NULL
    WHERE id = ? AND role = 'owner'
  `).run(id)
}
