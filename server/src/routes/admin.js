import { Router } from 'express'
import mongoose from 'mongoose'
import Donor from '../models/Donor.js'
import BloodRequest from '../models/Request.js'
import AuditLog from '../models/AuditLog.js'
import { donorReady } from '../lib/ready.js'
import { secureEqual, genToken, hashToken } from '../lib/tokens.js'
import { rateLimit, asyncHandler } from '../middleware/security.js'
import { logAudit } from '../services/audit.js'
import { completeRequest, applyDonorHistory } from '../services/complete.js'

const router = Router()

router.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 60 }))

// Admin auth — timing-safe muqabla. ADMIN_KEY set na ho to panel band (503).
router.use((req, res, next) => {
  const key = process.env.ADMIN_KEY
  if (!key) return res.status(503).json({ error: 'Admin panel band hai — server par ADMIN_KEY set nahi' })
  const given = req.get('x-admin-key') || ''
  if (!secureEqual(given, key)) return res.status(401).json({ error: 'Admin key ghalat hai' })
  return next()
})

function pageLimit(req, def = 100, max = 200) {
  let page = parseInt(req.query.page, 10)
  let limit = parseInt(req.query.limit, 10)
  if (!Number.isInteger(page) || page < 1) page = 1
  if (!Number.isInteger(limit) || limit < 1) limit = def
  if (limit > max) limit = max
  return { page, limit, skip: (page - 1) * limit }
}

// ID _id bhi ho sakti hai aur reqId bhi — dono se dhundo.
async function findRequestByParam(param) {
  if (mongoose.Types.ObjectId.isValid(String(param))) {
    const byId = await BloodRequest.findById(param)
    if (byId) return byId
  }
  return BloodRequest.findOne({ reqId: param })
}

// GET /api/admin/overview — counts/aggregation, poori lists memory me nahi late
router.get('/overview', asyncHandler(async (req, res) => {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  const readyFilter = { banned: false, $or: [{ lastDonation: null }, { lastDonation: { $lte: cutoff } }] }
  const [
    total, ready, verified, banned, hangu, kohat, donationsAgg,
    rTotal, rSearching, rDonorFound, rCompleted,
  ] = await Promise.all([
    Donor.countDocuments({}),
    Donor.countDocuments(readyFilter),
    Donor.countDocuments({ verified: true }),
    Donor.countDocuments({ banned: true }),
    Donor.countDocuments({ banned: false, city: 'Hangu' }),
    Donor.countDocuments({ banned: false, city: 'Kohat' }),
    Donor.aggregate([{ $group: { _id: null, sum: { $sum: '$donations' } } }]),
    BloodRequest.countDocuments({}),
    BloodRequest.countDocuments({ status: 'searching' }),
    BloodRequest.countDocuments({ status: 'donor-found' }),
    BloodRequest.countDocuments({ status: 'completed' }),
  ])
  return res.json({
    donors: {
      total,
      ready,
      verified,
      banned,
      totalDonations: donationsAgg[0]?.sum || 0,
      hangu,
      kohat,
    },
    requests: {
      total: rTotal,
      searching: rSearching,
      donorFound: rDonorFound,
      completed: rCompleted,
    },
  })
}))

// GET /api/admin/donors — paginated (phones sirf admin ko)
router.get('/donors', asyncHandler(async (req, res) => {
  const { limit, skip } = pageLimit(req)
  const list = await Donor.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).lean()
  return res.json(list.map((d) => ({ ...d, ready: donorReady(d) })))
}))

// PATCH /api/admin/donors/:id — { banned } / { verified } + audit
router.patch('/donors/:id', asyncHandler(async (req, res) => {
  const { banned, verified } = req.body || {}
  const patch = {}
  if (typeof banned === 'boolean') patch.banned = banned
  if (typeof verified === 'boolean') patch.verified = verified
  if (!Object.keys(patch).length) return res.status(400).json({ error: 'Kuch badalna nahi bheja gaya' })
  if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) return res.status(404).json({ error: 'Donor nahi mila' })
  const d = await Donor.findByIdAndUpdate(req.params.id, patch, { new: true }).lean()
  if (!d) return res.status(404).json({ error: 'Donor nahi mila' })
  await logAudit('donor-update', 'Donor', d._id, JSON.stringify(patch))
  return res.json({ ...d, ready: donorReady(d) })
}))

// POST /api/admin/donors/:id/reissue-token — purane donor ke liye naya token (ek dafa wapas)
router.post('/donors/:id/reissue-token', asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) return res.status(404).json({ error: 'Donor nahi mila' })
  const donorToken = genToken()
  const d = await Donor.findByIdAndUpdate(req.params.id, { authTokenHash: hashToken(donorToken) }, { new: true })
  if (!d) return res.status(404).json({ error: 'Donor nahi mila' })
  await logAudit('donor-reissue-token', 'Donor', d._id, null)
  return res.json({ donorToken })
}))

// DELETE /api/admin/donors/:id — jiska donation record hai use delete NAHI, ban karo
router.delete('/donors/:id', asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) return res.status(404).json({ error: 'Donor nahi mila' })
  const d = await Donor.findById(req.params.id)
  if (!d) return res.status(404).json({ error: 'Donor nahi mila' })
  if ((d.donations || 0) > 0) {
    return res.status(409).json({ error: 'Is donor ka donation record hai — delete mat karo, ban karo taake history preserve rahe' })
  }
  await Donor.findByIdAndDelete(req.params.id)
  await logAudit('donor-delete', 'Donor', req.params.id, d.phone)
  return res.json({ ok: true })
}))

// GET /api/admin/requests — paginated, phones ke sath (admin only)
router.get('/requests', asyncHandler(async (req, res) => {
  const { limit, skip } = pageLimit(req)
  const list = await BloodRequest.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).lean()
  return res.json(list)
}))

// PATCH /api/admin/requests/:id — { status }
// searching reset: donor/code saaf. completed: sirf donor-found se, completeRequest
// ke zariye taake donor history update ho. Completed ko reset karna mana hai.
router.patch('/requests/:id', asyncHandler(async (req, res) => {
  const { status } = req.body || {}
  if (!['searching', 'donor-found', 'completed', 'expired'].includes(status)) {
    return res.status(400).json({ error: 'Status ghalat hai' })
  }
  const r = await findRequestByParam(req.params.id)
  if (!r) return res.status(404).json({ error: 'Request nahi mili' })

  if (r.status === 'completed' && status !== 'completed') {
    return res.status(409).json({ error: 'Completed request reset nahi ho sakti — donor history preserve karni hai' })
  }

  if (status === 'searching') {
    r.status = 'searching'
    r.donorId = null
    r.donorName = null
    r.donorPhone = null
    r.code = null
    r.codeHash = null
    r.codeExpiresAt = null
    r.confirmAttempts = 0
    r.codeLocked = false
    r.donorHistoryApplied = false
    r.familyConfirmedAt = null
    r.confirmationType = null
    await r.save()
    await logAudit('request-reset', 'BloodRequest', r.reqId, null)
    return res.json(r)
  }

  if (status === 'completed') {
    if (r.status === 'completed') {
      // Pehle se complete hai — agar history reh gayi thi to sirf wo apply karo (idempotent).
      if (!r.donorHistoryApplied) await applyDonorHistory(r)
      const fresh = await BloodRequest.findById(r._id)
      return res.json(fresh || r)
    }
    if (r.status !== 'donor-found') {
      return res.status(400).json({ error: 'Donor abhi mila hi nahi — searching request complete nahi ho sakti' })
    }
    const completed = await completeRequest(r, 'admin-completed')
    if (!completed) return res.status(409).json({ error: 'Request ka status badal chuka hai' })
    await logAudit('request-complete', 'BloodRequest', completed.reqId, 'admin-completed')
    return res.json(completed)
  }

  if (status === 'donor-found') {
    if (r.status !== 'donor-found') return res.status(400).json({ error: 'Donor ke baghair donor-found nahi laga sakte' })
    return res.json(r)
  }

  // status === 'expired'
  r.status = 'expired'
  await r.save()
  await logAudit('request-expire', 'BloodRequest', r.reqId, null)
  return res.json(r)
}))

// DELETE /api/admin/requests/:id — completed delete mana hai (history)
router.delete('/requests/:id', asyncHandler(async (req, res) => {
  const r = await findRequestByParam(req.params.id)
  if (!r) return res.status(404).json({ error: 'Request nahi mili' })
  if (r.status === 'completed') {
    return res.status(409).json({ error: 'Completed request delete nahi ho sakti — history preserve karni hai' })
  }
  await BloodRequest.findByIdAndDelete(r._id)
  await logAudit('request-delete', 'BloodRequest', r.reqId, null)
  return res.json({ ok: true })
}))

// GET /api/admin/audit — aakhri 100 admin actions
router.get('/audit', asyncHandler(async (req, res) => {
  const list = await AuditLog.find({}).sort({ createdAt: -1 }).limit(100).lean()
  return res.json(list)
}))

export default router
