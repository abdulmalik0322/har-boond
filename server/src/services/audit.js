import AuditLog from '../models/AuditLog.js'

// Audit likhna kabhi asal action ko fail na kare.
export async function logAudit(action, entity, entityId, note) {
  try {
    await AuditLog.create({
      action,
      entity,
      entityId: entityId ? String(entityId) : null,
      note: note ? String(note).slice(0, 500) : null,
    })
  } catch { /* ignore */ }
}
