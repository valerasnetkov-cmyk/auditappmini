export function createUserStore({ db }) {
  function getUserSummaryById(id, companyId = null) {
    const query = companyId
      ? db.prepare('SELECT id, email, name, role, status, company_id FROM users WHERE id = ? AND company_id = ?')
      : db.prepare('SELECT id, email, name, role, status, company_id FROM users WHERE id = ?')

    return companyId ? query.get(id, companyId) : query.get(id)
  }

  function getUserIdByEmail(email) {
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
    return user?.id ?? null
  }

  function getUserRecordById(id, companyId = null) {
    const query = companyId
      ? db.prepare('SELECT id, email, name, role, status, company_id, created_at FROM users WHERE id = ? AND company_id = ?')
      : db.prepare('SELECT id, email, name, role, status, company_id, created_at FROM users WHERE id = ?')

    return companyId ? query.get(id, companyId) : query.get(id)
  }

  function createUserRecord({ id, email, passwordHash, name, role, status = 'active', companyId = 'default', ignoreExisting = false }) {
    const statement = ignoreExisting
      ? db.prepare('INSERT OR IGNORE INTO users (id, email, password, name, role, status, company_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
      : db.prepare('INSERT INTO users (id, email, password, name, role, status, company_id) VALUES (?, ?, ?, ?, ?, ?, ?)')

    return statement.run(id, email, passwordHash, name, role, status, companyId)
  }

  function updateUserRecord(id, { email, name, role, status, passwordHash, companyId = null }) {
    const update = (sql, params) => {
      if (!companyId) {
        return db.prepare(sql).run(...params)
      }

      return db.prepare(`${sql} AND company_id = ?`).run(...params, companyId)
    }

    if (email !== undefined) {
      update('UPDATE users SET email = ? WHERE id = ?', [email, id])
    }

    if (name !== undefined) {
      update('UPDATE users SET name = ? WHERE id = ?', [name, id])
    }

    if (role !== undefined) {
      update('UPDATE users SET role = ? WHERE id = ?', [role, id])
    }

    if (status !== undefined) {
      update('UPDATE users SET status = ? WHERE id = ?', [status, id])
    }

    if (passwordHash !== undefined) {
      update('UPDATE users SET password = ? WHERE id = ?', [passwordHash, id])
    }
  }

  return {
    getUserSummaryById,
    getUserIdByEmail,
    getUserRecordById,
    createUserRecord,
    updateUserRecord,
  }
}
