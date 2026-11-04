import mongoose from 'mongoose'

const requestSchema = new mongoose.Schema({
  reqId: { type: String, required: true, unique: true },
  attendant: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  group: { type: String, required: true, enum: ['A+','A-','B+','B-','AB+','AB-','O+','O-'] },
  city: { type: String, required: true, enum: ['Hangu','Kohat'] },
  hospital: { type: String, required: true, trim: true },
  bottles: { type: Number, required: true, min: 1, max: 6 },
  deadlineHrs: { type: Number, required: true },
  status: { type: String, enum: ['searching','donor-found','completed'], default: 'searching' },
  donorName: { type: String, default: null },
  donorPhone: { type: String, default: null },
  code: { type: String, default: null },
}, { timestamps: true })

export default mongoose.model('BloodRequest', requestSchema)
