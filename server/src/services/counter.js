import Counter from '../models/Counter.js'
import BloodRequest from '../models/Request.js'

const BASE = 1042 // purane system ki aakhri maloom bunyad — is se peeche kabhi nahi

async function maxExistingSeq() {
  const docs = await BloodRequest.find({}).select('reqId').lean()
  let max = BASE
  for (const d of docs) {
    const m = /^HB-(\d+)$/.exec(d.reqId || '')
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return max
}

// Atomic next request ID: Counter par $inc, upsert ke sath.
// Pehli dafa counter maujooda sab se bare number se shuru hota hai.
export async function nextReqId() {
  let counter = await Counter.findOne({ name: 'bloodRequest' })
  if (!counter) {
    const start = await maxExistingSeq()
    try {
      counter = await Counter.create({ name: 'bloodRequest', seq: start })
    } catch (e) {
      if (e.code !== 11000) throw e
      counter = await Counter.findOne({ name: 'bloodRequest' })
    }
  }
  if (counter) {
    // Agar purani requests counter se aage hain (import/legacy), counter ko wahan le jao.
    const max = await maxExistingSeq()
    if (counter.seq < max) {
      await Counter.updateOne({ name: 'bloodRequest' }, { $set: { seq: max } })
    }
  }
  const updated = await Counter.findOneAndUpdate(
    { name: 'bloodRequest' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  )
  return `HB-${updated.seq}`
}
