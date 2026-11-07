import BloodRequest from '../models/Request.js'
import Donor from '../models/Donor.js'

// Donor ki donation history update — IDEMPOTENT.
// countedRequestIds me reqId pehle se ho to donation dobara nahi gini jati.
export async function applyDonorHistory(request) {
  if (!request) return null
  let donor = null
  const filter = { countedRequestIds: { $ne: request.reqId } }
  if (request.donorId) filter._id = request.donorId
  else if (request.donorPhone) filter.phone = request.donorPhone
  else return null

  donor = await Donor.findOneAndUpdate(
    filter,
    {
      $inc: { donations: 1 },
      $set: { lastDonation: new Date() },
      $push: { countedRequestIds: request.reqId },
    },
    { new: true },
  )
  // donor null hai to ya donor mila nahi, ya ye reqId pehle gin chuke hain.
  // Dono surat me request par flag laga do taake ye step dobara na chale.
  await BloodRequest.updateOne({ _id: request._id }, { $set: { donorHistoryApplied: true } })
  request.donorHistoryApplied = true
  return donor
}

// Request ko complete karne ka WAHID rasta — family confirm aur admin
// completion dono yahi istemal karte hain taake donor history hamesha update ho.
// NOTE: type 'family-confirmed' ka matlab hai sirf family ne code se tasdeeq ki —
// ye kisi hospital/blood-bank ki medical verification NAHI hai.
export async function completeRequest(request, type) {
  const now = new Date()
  const set = {
    status: 'completed',
    confirmationType: type,
    code: null,
    codeHash: null,
  }
  if (type === 'family-confirmed') set.familyConfirmedAt = now
  const updated = await BloodRequest.findOneAndUpdate(
    { reqId: request.reqId, status: 'donor-found' },
    { $set: set },
    { new: true },
  )
  if (!updated) return null // race: koi aur pehle complete/reset kar gaya
  await applyDonorHistory(updated)
  const fresh = await BloodRequest.findById(updated._id)
  return fresh || updated
}
