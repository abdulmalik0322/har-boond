import BloodRequest from '../models/Request.js'

// Request expire kab hoti hai? expiresAt guzar gaya ho — ya purani request
// (expiresAt nahi) ki createdAt + deadlineHrs guzar gayi ho.
export function isRequestExpired(request, now = new Date()) {
  if (!request) return false
  if (request.expiresAt) return new Date(request.expiresAt).getTime() <= now.getTime()
  if (request.createdAt && request.deadlineHrs) {
    return new Date(request.createdAt).getTime() + request.deadlineHrs * 3600 * 1000 <= now.getTime()
  }
  return false
}

// 'searching' requests jo expire ho chuki hain unhe 'expired' mark karo (lazy).
export async function lazyExpireRequests(now = new Date()) {
  await BloodRequest.updateMany(
    { status: 'searching', expiresAt: { $ne: null, $lte: now } },
    { $set: { status: 'expired' } },
  )
  const legacy = await BloodRequest.find({ status: 'searching', expiresAt: null })
    .select('createdAt deadlineHrs').lean()
  const expiredIds = legacy.filter((r) => isRequestExpired(r, now)).map((r) => r._id)
  if (expiredIds.length) {
    await BloodRequest.updateMany({ _id: { $in: expiredIds } }, { $set: { status: 'expired' } })
  }
}
