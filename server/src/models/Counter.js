import mongoose from 'mongoose'

// Request IDs ke liye atomic counter — countDocuments wala purana tareeka
// delete ke baad ID dobara istemal kar sakta tha, ye nahi karta.
const counterSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  seq: { type: Number, required: true, default: 0 },
}, { timestamps: true })

export default mongoose.model('Counter', counterSchema)
