import mongoose from 'mongoose'

const donorSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true, unique: true },
  group: { type: String, required: true, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },
  city: { type: String, required: true, enum: ['Hangu', 'Kohat'] },
  lastDonation: { type: Date, default: null },
  nightAvailable: { type: Boolean, default: true },
  donations: { type: Number, default: 0 },
  verified: { type: Boolean, default: false },
  banned: { type: Boolean, default: false },
  // Sirf token ka SHA-256 hash store hota hai — asal token donor ko ek dafa milta hai.
  authTokenHash: { type: String, default: null },
  // Donor ki razamandi ke baghair notification plan me shamil nahi hoga.
  notifyConsent: { type: Boolean, default: false },
  // Kin requests par is donor ki donation gin li gayi hai (idempotency ke liye).
  countedRequestIds: { type: [String], default: [] },
}, { timestamps: true })

donorSchema.index({ city: 1, group: 1, banned: 1 })

export default mongoose.model('Donor', donorSchema)
