import crypto from 'node:crypto'

// Audit logging utility
export function createAuditLogger({ db, getCurrentUser }) {
  return function logAudit({ action, entityType, entityId, oldValue, newValue, req }) {
    try {
      const userId = req?.user?.id || null
      const ipAddress = req?.ip || req?.connection?.remoteAddress || null
      const userAgent = req?.headers?.['user-agent'] || null
      
      db.prepare(`
        INSERT INTO audit_logs (id, company_id, user_id, action, entity_type, entity_id, old_value, new_value, ip_address, user_agent, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        crypto.randomUUID(),
        req?.user?.company_id || 'default',
        userId,
        action,
        entityType,
        entityId,
        oldValue ? JSON.stringify(oldValue) : null,
        newValue ? JSON.stringify(newValue) : null,
        ipAddress,
        userAgent
      )
    } catch (err) {
      console.error('Audit log error:', err.message)
    }
  }
}

// Predefined audit actions
export const AuditActions = {
  // User actions
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',
  
  // Vehicle actions
  VEHICLE_CREATED: 'vehicle.created',
  VEHICLE_UPDATED: 'vehicle.updated',
  VEHICLE_DELETED: 'vehicle.deleted',
  VEHICLE_STATUS_CHANGED: 'vehicle.status_changed',
  
  // Inspection actions
  INSPECTION_CREATED: 'inspection.created',
  INSPECTION_COMPLETED: 'inspection.completed',
  INSPECTION_DELETED: 'inspection.deleted',
  
  // Defect actions
  DEFECT_CREATED: 'defect.created',
  DEFECT_UPDATED: 'defect.updated',
  DEFECT_CLOSED: 'defect.closed',
  DEFECT_REOPENED: 'defect.reopened',
  DEFECT_DELETED: 'defect.deleted',
  
  // Photo actions
  PHOTO_UPLOADED: 'photo.uploaded',
  PHOTO_DELETED: 'photo.deleted',
  
  // Settings actions
  SETTINGS_UPDATED: 'settings.updated',
  
  // Admin actions
  SEED_CREATED: 'seed.created',
}
