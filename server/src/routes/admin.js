import { Router } from 'express'
import Donor from '../models/Donor.js'
import BloodRequest from '../models/Request.js'
import { donorReady } from '../lib/ready.js'

const router = Router()

// Admin auth — header `x-admin-key` lazmi ADMIN_KEY env var se match kare.
// ADMIN_KEY set hi na ho to panel band rehta hai (503), kabhi khula nahi chhorta.
router.use((req, res, next) => {
  const key = process.env.ADMIN_KEY
  if (!key) return res.status(503).json({ error: 'Admin panel band hai — server par ADMIN_KEY set nahi' })
  if (req.get('x-admin-key') !== key) return res.status(401).json({ error: 'Admin key ghalat hai' })
  next()
})

// GET /api/admin/overview — dashboard ke numbers
router.get('/overview', async (req, res) => {
  const [donors, requests] = await Promise.all([
    Donor.find({}).lean(),
    BloodRequest.find({}).lean(),
  ])
  const active = donors.filter((d) => !d.banned)
  res.json({
    donors: {
      total: donors.length,
      ready: active.filter((d) => donorReady(d)).length,
      verified: donors.filter((d) => d.verified).length,
      banned: donors.filter((d) => d.banned).length,
      totalDonations: donors.reduce((s, d) => s + (d.donations || 0), 0),
      hangu: active.filter((d) => d.city === 'Hangu').length,
      kohat: active.filter((d) => d.city === 'Kohat').length,
    },
    requests: {
      total: requests.length,
      searching: requests.filter((r) => r.status === 'searching').length,
      donorFound: requests.filter((r) => r.status === 'donor-found').length,
      completed: requests.filter((r) => r.status === 'completed').length,
    },
  })
})

// GET /api/admin/donors — saare donors (phones sirf admin ko — ye route key ke baghair band hai)
router.get('/donors', async (req, res) => {
  const list = await Donor.find({}).sort({ createdAt: -1 }).lean()
  res.json(list.map((d) => ({ ...d, ready: donorReady(d) })))
})

// PATCH /api/admin/donors/:id — { banned } ya { verified } toggle
router.patch('/donors/:id', async (req, res) => {
  const { banned, verified } = req.body || {}
  const patch = {}
  if (typeof banned === 'boolean') patch.banned = banned
  if (typeof verified === 'boolean') patch.verified = verified
  if (!Object.keys(patch).length) return res.status(400).json({ error: 'Kuch badalna nahi bheja gaya' })
  const d = await Donor.findByIdAndUpdate(req.params.id, patch, { new: true }).lean()
  if (!d) return res.status(404).json({ error: 'Donor nahi mila' })
  res.json({ ...d, ready: donorReady(d) })
})

// DELETE /api/admin/donors/:id — fake/spam donor hatana
router.delete('/donors/:id', async (req, res) => {
  const d = await Donor.findByIdAndDelete(req.params.id)
  if (!d) return res.status(404).json({ error: 'Donor nahi mila' })
  res.json({ ok: true })
})

// GET /api/admin/requests — saari requests, phones ke sath (admin only)
router.get('/requests', async (req, res) => {
  const list = await BloodRequest.find({}).sort({ createdAt: -1 }).limit(200).lean()
  res.json(list)
})

// PATCH /api/admin/requests/:id — { status }
// 'searching' par wapas bhejne se donor/code saaf ho jata hai (phansi hui request azad)
router.patch('/requests/:id', async (req, res) => {
  const { status } = req.body || {}
  if (!['searching', 'donor-found', 'completed'].includes(status)) {
    return res.status(400).json({ error: 'Status ghalat hai' })
  }
  const r = await BloodRequest.findById(req.params.id)
  if (!r) return res.status(404).json({ error: 'Request nahi mili' })
  r.status = status
  if (status === 'searching') { r.donorName = null; r.donorPhone = null; r.code = null }
  await r.save()
  res.json(r)
})

// DELETE /api/admin/requests/:id — fake/spam request hatana
router.delete('/requests/:id', async (req, res) => {
  const r = await BloodRequest.findByIdAndDelete(req.params.id)
  if (!r) return res.status(404).json({ error: 'Request nahi mili' })
  res.json({ ok: true })
})

export default router
