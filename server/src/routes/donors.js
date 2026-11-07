import { Router } from 'express'
import mongoose from 'mongoose'
import Donor from '../models/Donor.js'
import { donorReady } from '../lib/ready.js'
import { validateDonorPayload, GROUPS } from '../validators/validate.js'
import { genToken, hashToken, secureEqual } from '../lib/tokens.js'
import { rateLimit, asyncHandler } from '../middleware/security.js'

const router = Router()

// POST /api/donors — naya donor register (strict validation + duplicate protection)
router.post('/', rateLimit({ windowMs: 60 * 60 * 1000, max: 10 }), asyncHandler(async (req, res) => {
  const { error, field, value } = validateDonorPayload(req.body || {})
  if (error) return res.status(400).json({ error, field })

  const existing = await Donor.findOne({ phone: value.phone }).select('_id').lean()
  if (existing) return res.status(409).json({ error: 'Ye number pehle se register hai', field: 'phone' })

  const donorToken = genToken()
  let donor
  try {
    donor = await Donor.create({ ...value, authTokenHash: hashToken(donorToken) })
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'Ye number pehle se register hai', field: 'phone' })
    throw e
  }
  // donorToken sirf is response me ek dafa milta hai — DB me sirf hash hai.
  return res.status(201).json({ id: donor._id, ready: donorReady(donor), verified: false, donorToken })
}))

// POST /api/donors/opt-out — notification razamandi wapas lena (token lazmi)
router.post('/opt-out', rateLimit({ windowMs: 15 * 60 * 1000, max: 30 }), asyncHandler(async (req, res) => {
  const { donorId, donorToken } = req.body || {}
  if (!donorId || !mongoose.Types.ObjectId.isValid(String(donorId))) {
    return res.status(401).json({ error: 'Donor pehchan nahi ho saki' })
  }
  const donor = await Donor.findById(donorId)
  if (!donor || !donor.authTokenHash || !secureEqual(hashToken(donorToken || ''), donor.authTokenHash)) {
    return res.status(401).json({ error: 'Donor pehchan nahi ho saki' })
  }
  donor.notifyConsent = false
  await donor.save()
  return res.json({ ok: true })
}))

// GET /api/donors/counts?city=Hangu — board ke numbers, MongoDB aggregation se.
// Kisi ka naam/number is response me kabhi nahi jata.
router.get('/counts', asyncHandler(async (req, res) => {
  const { city } = req.query
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  const match = { banned: false }
  if (city) match.city = city
  const rows = await Donor.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$group',
        registered: { $sum: 1 },
        ready: {
          $sum: {
            $cond: [
              { $or: [{ $eq: ['$lastDonation', null] }, { $lte: ['$lastDonation', cutoff] }] },
              1,
              0,
            ],
          },
        },
      },
    },
  ])
  const groups = {}
  let total = 0
  let readyTotal = 0
  for (const g of GROUPS) groups[g] = { registered: 0, ready: 0 }
  for (const row of rows) {
    if (groups[row._id]) groups[row._id] = { registered: row.registered, ready: row.ready }
    total += row.registered
    readyTotal += row.ready
  }
  return res.json({
    city: city || 'all',
    groups,
    total,
    readyTotal,
    generatedAt: new Date().toISOString(),
  })
}))

export default router
