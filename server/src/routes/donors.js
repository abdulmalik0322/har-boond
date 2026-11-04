import { Router } from 'express'
import Donor from '../models/Donor.js'
import { donorReady } from '../lib/ready.js'

const router = Router()
const phoneOk = (p) => /^03\d{9}$/.test((p || '').replace(/[\s-]/g, ''))

// POST /api/donors — naya donor register
router.post('/', async (req, res) => {
  try {
    const { name, phone, group, city, lastDonation, nightAvailable } = req.body || {}
    if (!name || name.trim().length < 3) return res.status(400).json({ error: 'Poora naam zaroori hai' })
    if (!phoneOk(phone)) return res.status(400).json({ error: 'Sahi WhatsApp number zaroori hai (03 se shuru, 11 number)' })
    const donor = await Donor.create({
      name: name.trim(), phone: phone.replace(/[\s-]/g, ''),
      group, city, lastDonation: lastDonation || null,
      nightAvailable: nightAvailable !== false,
    })
    res.status(201).json({ id: donor._id, ready: donorReady(donor) })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

// GET /api/donors/counts?city=Hangu — board ke liye sirf numbers (kisi ka number/name nahi jata)
router.get('/counts', async (req, res) => {
  const { city } = req.query
  const donors = await Donor.find({ banned: false, ...(city ? { city } : {}) }).lean()
  const out = {}
  for (const g of ['A+','A-','B+','B-','AB+','AB-','O+','O-']) {
    const inGroup = donors.filter((d) => d.group === g)
    out[g] = { registered: inGroup.length, ready: inGroup.filter((d) => donorReady(d)).length }
  }
  res.json({ city: city || 'all', groups: out, total: donors.length, readyTotal: donors.filter((d) => donorReady(d)).length })
})

export default router
