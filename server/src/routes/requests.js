import { Router } from 'express'
import mongoose from 'mongoose'
import BloodRequest from '../models/Request.js'
import Donor from '../models/Donor.js'
import { donorReady } from '../lib/ready.js'
import { canDonateTo } from '../lib/compat.js'
import { genToken, hashToken, genConfirmCode, hashCode, secureEqual } from '../lib/tokens.js'
import { validateRequestPayload } from '../validators/validate.js'
import { rateLimit, asyncHandler } from '../middleware/security.js'
import { nextReqId } from '../services/counter.js'
import { isRequestExpired, lazyExpireRequests } from '../services/expiry.js'
import { completeRequest } from '../services/complete.js'
import { dispatchNotifications } from '../services/notify.js'

const router = Router()

const PUBLIC_FIELDS = 'reqId group city hospital bottles deadlineHrs status donorName attendant createdAt expiresAt -_id'

// GET /api/requests — public list (phone/code/hash KABHI nahi), pagination ke sath
router.get('/', asyncHandler(async (req, res) => {
  await lazyExpireRequests()
  const { city } = req.query
  let page = parseInt(req.query.page, 10)
  let limit = parseInt(req.query.limit, 10)
  if (!Number.isInteger(page) || page < 1) page = 1
  if (!Number.isInteger(limit) || limit < 1) limit = 50
  if (limit > 50) limit = 50
  const filter = city ? { city } : {}
  const [items, total] = await Promise.all([
    BloodRequest.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
      .select(PUBLIC_FIELDS).lean(),
    BloodRequest.countDocuments(filter),
  ])
  return res.json({ items, total, page, limit })
}))

// POST /api/requests — nayi request (+ duplicate active protection + owner token)
router.post('/', rateLimit({ windowMs: 60 * 60 * 1000, max: 20 }), asyncHandler(async (req, res) => {
  const { error, field, value } = validateRequestPayload(req.body || {})
  if (error) return res.status(400).json({ error, field })

  await lazyExpireRequests()
  const dup = await BloodRequest.findOne({
    phone: value.phone,
    group: value.group,
    city: value.city,
    status: { $in: ['searching', 'donor-found'] },
  }).lean()
  if (dup && !isRequestExpired(dup)) {
    return res.status(409).json({ error: 'Isi number se isi group/city ki active request pehle se hai', reqId: dup.reqId })
  }

  const reqId = await nextReqId()
  const requestToken = genToken()
  const expiresAt = new Date(Date.now() + value.deadlineHrs * 3600 * 1000)

  const draft = { reqId, group: value.group, city: value.city }
  const eligible = await Donor.find({ city: value.city, banned: false, notifyConsent: true }).lean()
  const notifications = await dispatchNotifications(draft, eligible)

  const r = await BloodRequest.create({
    ...value,
    reqId,
    ownerTokenHash: hashToken(requestToken),
    expiresAt,
    notifications,
  })
  // requestToken sirf is response me ek dafa — family confirm ke waqt yahi lagega.
  return res.status(201).json({ reqId: r.reqId, status: r.status, requestToken, expiresAt: r.expiresAt })
}))

// POST /api/requests/:reqId/accept — donor "Me Araha Hon"
// Pehchan sirf donorId + donorToken se hoti hai; naam/phone frontend se NAHI liya jata.
router.post('/:reqId/accept', rateLimit({ windowMs: 60 * 60 * 1000, max: 30 }), asyncHandler(async (req, res) => {
  const { donorId, donorToken } = req.body || {}
  const r = await BloodRequest.findOne({ reqId: req.params.reqId })
  if (!r) return res.status(404).json({ error: 'Request nahi mili' })
  if (r.status === 'expired') return res.status(410).json({ error: 'Ye request expire ho chuki hai' })
  if (r.status !== 'searching') return res.status(409).json({ error: 'Is request par donor pehle hi mil chuka hai' })
  if (isRequestExpired(r)) {
    await BloodRequest.updateOne({ _id: r._id, status: 'searching' }, { $set: { status: 'expired' } })
    return res.status(410).json({ error: 'Ye request expire ho chuki hai' })
  }

  // --- Donor pehchan ---
  if (!donorId || !mongoose.Types.ObjectId.isValid(String(donorId))) {
    return res.status(401).json({ error: 'Donor pehchan nahi ho saki' })
  }
  const donor = await Donor.findById(donorId)
  if (!donor) return res.status(401).json({ error: 'Donor pehchan nahi ho saki' })
  if (!donor.authTokenHash) {
    return res.status(403).json({
      error: 'Ye donor purane system par register hai — admin se naya token lo',
      code: 'DONOR_TOKEN_MISSING',
    })
  }
  if (!donorToken || !secureEqual(hashToken(donorToken), donor.authTokenHash)) {
    return res.status(401).json({ error: 'Donor pehchan nahi ho saki' })
  }

  // --- Eligibility (server khud, frontend par bharosa nahi) ---
  // Note: 90-day rule project ki readiness hai, medical clearance NAHI —
  // final medical faisla hospital/blood bank ka hai.
  if (donor.banned) return res.status(403).json({ error: 'Ye donor banned hai' })
  if (process.env.REQUIRE_VERIFIED_DONOR === 'true' && !donor.verified) {
    return res.status(403).json({ error: 'Ye donor abhi verified nahi hai' })
  }
  if (!donorReady(donor)) return res.status(409).json({ error: 'Donor abhi ready nahi hai — 90 din wala rule poora nahi' })
  if (donor.city !== r.city) return res.status(409).json({ error: 'Donor ka city request ke city se match nahi karta' })
  if (!canDonateTo(donor.group, r.group)) {
    return res.status(409).json({ error: 'Donor ka blood group is request ke liye compatible nahi hai' })
  }

  const code = genConfirmCode()
  const codeExpiresAt = new Date(Date.now() + 6 * 3600 * 1000)
  // ATOMIC accept: status 'searching' ki shart ke sath — race me sirf EK donor jeetega.
  const updated = await BloodRequest.findOneAndUpdate(
    { reqId: r.reqId, status: 'searching' },
    {
      $set: {
        status: 'donor-found',
        donorId: donor._id,
        donorName: donor.name,
        donorPhone: donor.phone,
        codeHash: hashCode(r.reqId, code),
        code: null,
        codeExpiresAt,
        confirmAttempts: 0,
        codeLocked: false,
      },
    },
    { new: true },
  )
  if (!updated) return res.status(409).json({ error: 'Is request par donor pehle hi mil chuka hai' })
  // Code (plaintext) aur attendant ka number SIRF is authenticated donor ko, ek dafa.
  return res.json({
    reqId: updated.reqId,
    status: updated.status,
    code,
    attendantPhone: r.phone,
    codeExpiresAt: updated.codeExpiresAt,
  })
}))

// POST /api/requests/:reqId/confirm — family code + owner token se tasdeeq
router.post('/:reqId/confirm', rateLimit({ windowMs: 60 * 60 * 1000, max: 30 }), asyncHandler(async (req, res) => {
  const { code, requestToken } = req.body || {}
  const r = await BloodRequest.findOne({ reqId: req.params.reqId })
  if (!r) return res.status(404).json({ error: 'Request nahi mili' })
  if (r.status === 'completed') return res.status(409).json({ error: 'Ye request pehle hi complete ho chuki hai' })
  if (r.status !== 'donor-found') return res.status(409).json({ error: 'Ye request is stage par nahi hai' })
  if (r.codeLocked || (r.confirmAttempts || 0) >= 5) {
    return res.status(429).json({ error: 'Code ki koshishein khatam — admin se rabta karo' })
  }
  if (r.codeExpiresAt && new Date(r.codeExpiresAt).getTime() <= Date.now()) {
    return res.status(410).json({ error: 'Code expire ho chuka hai' })
  }

  // Request-owner authorization: ownerTokenHash ho to sahi token lazmi hai.
  if (r.ownerTokenHash) {
    if (!requestToken || !secureEqual(hashToken(requestToken), r.ownerTokenHash)) {
      return res.status(401).json({ error: 'Request owner token ghalat hai' })
    }
  }

  const supplied = code === null || code === undefined ? '' : String(code).trim()
  let ok = false
  if (r.codeHash) ok = supplied !== '' && secureEqual(hashCode(r.reqId, supplied), r.codeHash)
  else if (r.code) ok = supplied !== '' && supplied === String(r.code) // legacy plaintext fallback

  if (!ok) {
    const upd = await BloodRequest.findOneAndUpdate(
      { reqId: r.reqId, status: 'donor-found' },
      { $inc: { confirmAttempts: 1 } },
      { new: true },
    )
    const attempts = upd ? upd.confirmAttempts : (r.confirmAttempts || 0) + 1
    if (upd && attempts >= 5) {
      await BloodRequest.updateOne({ _id: r._id }, { $set: { codeLocked: true } })
    }
    return res.status(400).json({ error: 'Code ghalat hai', attemptsLeft: Math.max(0, 5 - attempts) })
  }

  // 'family-confirmed' = family ne code se tasdeeq ki. Ye hospital ki
  // medical verification NAHI hai — final faisla hospital/blood bank ka hai.
  const completed = await completeRequest(r, 'family-confirmed')
  if (!completed) return res.status(409).json({ error: 'Ye request is stage par nahi hai' })
  return res.json({ reqId: completed.reqId, status: 'completed', confirmationType: 'family-confirmed' })
}))

export default router
