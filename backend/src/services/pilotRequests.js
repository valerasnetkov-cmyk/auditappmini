import { v4 as uuidv4 } from 'uuid'

export const PILOT_REQUEST_STATUSES = ['new', 'in_progress', 'approved', 'rejected', 'converted']

export function anonymizeExpiredPilotRequests(db) {
  const expired = db.prepare(`
    SELECT id
    FROM pilot_requests
    WHERE status = 'rejected'
      AND anonymized_at IS NULL
      AND updated_at <= datetime('now', '-12 months')
  `).all()

  if (!expired.length) return { anonymized: 0 }

  const anonymize = db.prepare(`
    UPDATE pilot_requests
    SET contact_name = NULL,
        contact_email = NULL,
        contact_phone = NULL,
        comment = NULL,
        anonymized_at = datetime('now'),
        updated_at = datetime('now')
    WHERE id = ?
  `)
  const audit = db.prepare(`
    INSERT INTO audit_logs (
      id, company_id, actor_user_id, actor_role, action, entity_type, entity_id, payload_json
    ) VALUES (?, NULL, NULL, 'system', 'pilot_request.anonymized', 'pilot_request', ?, NULL)
  `)

  db.exec('BEGIN IMMEDIATE')
  try {
    expired.forEach(({ id }) => {
      anonymize.run(id)
      audit.run(uuidv4(), id)
    })
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  return { anonymized: expired.length }
}
