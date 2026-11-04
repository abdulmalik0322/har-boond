import mongoose from 'mongoose'

const donorSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  group: { type: String, required: true, enum: ['A+','A-','B+','B-','AB+','AB-','O+','O-'] },
  city: { type: String, required: true, enum: ['Hangu','Kohat'] },
  lastDonation: { type: Date, default: null },
  nightAvailable: { type: Boolean, default: true },
  donations: { type: Number, default: 0 },
  verified: { type: Boolean, default: false },
  banned: { type: Boolean, default: false },
}, { timestamps: true })

export default mongoose.model('Donor', donorSchema)
