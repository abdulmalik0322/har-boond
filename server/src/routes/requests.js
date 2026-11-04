import { Router } from 'express'
import BloodRequest from '../models/Request.js'
import Donor from '../models/Donor.js'

const router = Router()
const phoneOk = (p) => /^03\d{9}$/.test((p || '').replace(/[\s-]/g, ''))

async function nextReqId() {
  const count = await BloodRequest.countDocuments()
  return `HB-${1043 + count}`
}

// GET /api/requests — public list (phone numbers kabhi public nahi)
router.get('/', async (req, res) => {
  const { city } = req.query
  const list = await BloodRequest.find(city ? { city } : {})
    .sort({ createdAt: -1 }).limit(50)
    .select('reqId group city hospital bottles deadlineHrs status donorName attendant createdAt')
    .lean()
  res.json(list)
})

// POST /api/requests — nayi request
router.post('/', async (req, res) => {
  try {
    const { attendant, phone, group, city, hospital, bottles, deadlineHrs } = req.body || {}
    if (!attendant || attendant.trim().length < 3) return res.status(400).json({ error: 'Rabta karne wale ka naam zaroori hai' })
    if (!phoneOk(phone)) return res.status(400).json({ error: 'Sahi number zaroori hai (03 se shuru, 11 number)' })
    const r = await BloodRequest.create({
      reqId: await nextReqId(),
      attendant: attendant.trim(), phone: phone.replace(/[\s-]/g, ''),
      group, city, hospital, bottles, deadlineHrs,
    })
    res.status(201).json({ reqId: r.reqId, status: r.status })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

// POST /api/requests/:reqId/accept — donor "Me Araha Hon" bolta hai, code sirf usi ko milta hai
router.post('/:reqId/accept', async (req, res) => {
  const { name, phone } = req.body || {}
  if (!name || name.trim().length < 3) return res.status(400).json({ error: 'Donor ka naam zaroori hai' })
  if (!phoneOk(phone)) return res.status(400).json({ error: 'Sahi number zaroori hai' })
  const r = await BloodRequest.findOne({ reqId: req.params.reqId })
  if (!r) return res.status(404).json({ error: 'Request nahi mili' })
  if (r.status !== 'searching') return res.status(409).json({ error: 'Is request par donor pehle hi mil chuka hai' })
  r.status = 'donor-found'
  r.donorName = name.trim()
  r.donorPhone = phone.replace(/[\s-]/g, '')
  r.code = String(Math.floor(1000 + Math.random() * 9000))
  await r.save()
  // Attendant ka number sirf is donor ko milta hai jis ne accept kiya —
  // taake wo call karke "me araha hon" keh sake. Public list me kabhi nahi jata.
  res.json({ reqId: r.reqId, status: r.status, code: r.code, attendantPhone: r.phone })
})

// POST /api/requests/:reqId/confirm — family code se tasdeeq karti hai
router.post('/:reqId/confirm', async (req, res) => {
  const { code } = req.body || {}
  const r = await BloodRequest.findOne({ reqId: req.params.reqId })
  if (!r) return res.status(404).json({ error: 'Request nahi mili' })
  if (r.status !== 'donor-found') return res.status(409).json({ error: 'Ye request is stage par nahi hai' })
  if (!code || String(code) !== r.code) return res.status(400).json({ error: 'Code ghalat hai' })
  r.status = 'completed'
  await r.save()
  // Agar donor register hai to uska record update: donations +1, lastDonation = aaj
  await Donor.findOneAndUpdate(
    { phone: r.donorPhone },
    { $inc: { donations: 1 }, $set: { lastDonation: new Date() } }
  )
  res.json({ reqId: r.reqId, status: r.status })
})

export default router
