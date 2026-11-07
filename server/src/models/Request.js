import mongoose from 'mongoose'

const notificationSchema = new mongoose.Schema({
  donorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Donor', default: null },
  channel: { type: String, default: 'whatsapp' },
  status: { type: String, default: 'planned' },
  at: { type: Date, default: Date.now },
}, { _id: false })

const requestSchema = new mongoose.Schema({
  reqId: { type: String, required: true, unique: true },
  attendant: { type: String, required: true, trim: true },
  // Attendant ka phone — KABHI public response me nahi jata.
  phone: { type: String, required: true, trim: true },
  group: { type: String, required: true, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },
  city: { type: String, required: true, enum: ['Hangu', 'Kohat'] },
  hospital: { type: String, required: true, trim: true },
  bottles: { type: Number, required: true, min: 1, max: 6 },
  deadlineHrs: { type: Number, required: true },
  status: { type: String, enum: ['searching', 'donor-found', 'completed', 'expired'], default: 'searching' },
  donorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Donor', default: null },
  donorName: { type: String, default: null },
  donorPhone: { type: String, default: null },
  // Legacy: purane live documents me plaintext code hai. Naye accepts sirf codeHash rakhte hain.
  code: { type: String, default: null },
  codeHash: { type: String, default: null },
  codeExpiresAt: { type: Date, default: null },
  confirmAttempts: { type: Number, default: 0 },
  codeLocked: { type: Boolean, default: false },
  expiresAt: { type: Date, default: null },
  // Request banane wale (family) ka token — sirf hash store hota hai.
  ownerTokenHash: { type: String, default: null },
  donorHistoryApplied: { type: Boolean, default: false },
  familyConfirmedAt: { type: Date, default: null },
  // 'family-confirmed' | 'admin-completed' — ye medical verification NAHI hai.
  confirmationType: { type: String, default: null },
  notifications: { type: [notificationSchema], default: [] },
}, { timestamps: true })

requestSchema.index({ status: 1, city: 1, createdAt: -1 })
requestSchema.index({ expiresAt: 1 })

export default mongoose.model('BloodRequest', requestSchema)
