import mongoose from 'mongoose'

// Admin actions ka record — kis entity par kya action hua.
const auditLogSchema = new mongoose.Schema({
  action: { type: String, required: true },
  entity: { type: String, required: true },
  entityId: { type: String, default: null },
  note: { type: String, default: null },
}, { timestamps: true })

export default mongoose.model('AuditLog', auditLogSchema)
