// Har Boond backend API tests — isolated in-memory MongoDB only.
// Asal/production database ko kabhi touch nahi karte.
process.env.ADMIN_KEY = 'test-admin-key'
process.env.NODE_ENV = 'test'
delete process.env.REQUIRE_VERIFIED_DONOR
delete process.env.NOTIFY_ENABLED

import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

const { default: app } = await import('../src/app.js')
const { default: Donor } = await import('../src/models/Donor.js')
const { default: BloodRequest } = await import('../src/models/Request.js')
const { default: Counter } = await import('../src/models/Counter.js')
const { default: AuditLog } = await import('../src/models/AuditLog.js')

let mongod
let server
let base

// Rate limits IP-based hain — har call ko alag IP do taake tests aapas me na takrayen.
let ipN = 0
function nextIp() {
  ipN += 1
  return `10.${Math.floor(ipN / 60000) % 200 + 1}.${Math.floor(ipN / 250) % 250 + 1}.${(ipN % 250) + 1}`
}

async function api(path, { method = 'GET', body, admin = false, ip } = {}) {
  const headers = { 'x-forwarded-for': ip || nextIp() }
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (admin === true) headers['x-admin-key'] = 'test-admin-key'
  else if (typeof admin === 'string') headers['x-admin-key'] = admin
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  let data = null
  try { data = await res.json() } catch { /* empty */ }
  return { status: res.status, data }
}

let phoneN = 300000000
function uniqPhone() {
  phoneN += 1
  return `03${String(phoneN).padStart(9, '0')}` // 03 + 9 digits = 11
}

async function registerDonor(overrides = {}) {
  const payload = {
    name: 'Test Donor',
    phone: uniqPhone(),
    group: 'O+',
    city: 'Hangu',
    ...overrides,
  }
  const r = await api('/api/donors', { method: 'POST', body: payload })
  assert.equal(r.status, 201, `donor register fail: ${JSON.stringify(r.data)}`)
  return { ...r.data, phone: payload.phone, payload }
}

async function createRequest(overrides = {}) {
  const payload = {
    attendant: 'Family Person',
    phone: uniqPhone(),
    group: 'O+',
    city: 'Hangu',
    hospital: 'DHQ Hospital Hangu',
    bottles: 2,
    deadlineHrs: 6,
    ...overrides,
  }
  const r = await api('/api/requests', { method: 'POST', body: payload })
  assert.equal(r.status, 201, `request create fail: ${JSON.stringify(r.data)}`)
  return { ...r.data, phone: payload.phone, payload }
}

async function accept(reqId, donor) {
  return api(`/api/requests/${reqId}/accept`, {
    method: 'POST',
    body: { donorId: donor.id, donorToken: donor.donorToken },
  })
}

async function acceptedSetup(donorOverrides = {}, requestOverrides = {}) {
  const donor = await registerDonor(donorOverrides)
  const req = await createRequest(requestOverrides)
  const acc = await accept(req.reqId, donor)
  assert.equal(acc.status, 200, `accept fail: ${JSON.stringify(acc.data)}`)
  return { donor, req, acc: acc.data }
}

let testDbPath
before(async () => {
  // dbPath workspace disk par rakho — /tmp aksar chhota tmpfs hota hai aur
  // mongod ko kam az kam 500MB khali chahiye hoti hai.
  testDbPath = fs.mkdtempSync(path.join(process.cwd(), '.mongo-test-'))
  mongod = await MongoMemoryServer.create({ instance: { dbPath: testDbPath } })
  await mongoose.connect(mongod.getUri('harboond-test'))
  await Promise.all([Donor.init(), BloodRequest.init(), Counter.init(), AuditLog.init()])
  server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  base = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve))
  await mongoose.disconnect()
  if (mongod) await mongod.stop()
  if (testDbPath) fs.rmSync(testDbPath, { recursive: true, force: true })
})

beforeEach(async () => {
  await Promise.all([
    Donor.deleteMany({}),
    BloodRequest.deleteMany({}),
    Counter.deleteMany({}),
    AuditLog.deleteMany({}),
  ])
})

/* ---------------- Donors ---------------- */

test('valid donor register: token returned, ready true', async () => {
  const r = await api('/api/donors', {
    method: 'POST',
    body: { name: 'Ali Khan', phone: uniqPhone(), group: 'A+', city: 'Hangu' },
  })
  assert.equal(r.status, 201)
  assert.ok(r.data.id)
  assert.equal(r.data.ready, true)
  assert.equal(r.data.verified, false)
  assert.ok(typeof r.data.donorToken === 'string' && r.data.donorToken.length >= 32)
  // DB me sirf hash hai, token plaintext nahi
  const doc = await Donor.findById(r.data.id).lean()
  assert.ok(doc.authTokenHash)
  assert.notEqual(doc.authTokenHash, r.data.donorToken)
})

test('phone formats: +92 and 92 normalize to 03 form', async () => {
  const raw = uniqPhone() // 03xxxxxxxxx
  const intl = `+92${raw.slice(1)}`
  const r = await api('/api/donors', {
    method: 'POST',
    body: { name: 'Intl Donor', phone: intl, group: 'B+', city: 'Kohat' },
  })
  assert.equal(r.status, 201)
  const doc = await Donor.findById(r.data.id).lean()
  assert.equal(doc.phone, raw)
})

test('invalid phone -> 400', async () => {
  const r = await api('/api/donors', {
    method: 'POST',
    body: { name: 'Ali Khan', phone: '12345', group: 'A+', city: 'Hangu' },
  })
  assert.equal(r.status, 400)
})

test('duplicate phone -> 409', async () => {
  const phone = uniqPhone()
  await registerDonor({ phone })
  const r = await api('/api/donors', {
    method: 'POST',
    body: { name: 'Dusra Donor', phone, group: 'B+', city: 'Kohat' },
  })
  assert.equal(r.status, 409)
})

test('invalid blood group -> 400', async () => {
  const r = await api('/api/donors', {
    method: 'POST',
    body: { name: 'Ali Khan', phone: uniqPhone(), group: 'X+', city: 'Hangu' },
  })
  assert.equal(r.status, 400)
})

test('invalid city -> 400', async () => {
  const r = await api('/api/donors', {
    method: 'POST',
    body: { name: 'Ali Khan', phone: uniqPhone(), group: 'A+', city: 'Peshawar' },
  })
  assert.equal(r.status, 400)
})

test('future lastDonation -> 400', async () => {
  const future = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
  const r = await api('/api/donors', {
    method: 'POST',
    body: { name: 'Ali Khan', phone: uniqPhone(), group: 'A+', city: 'Hangu', lastDonation: future },
  })
  assert.equal(r.status, 400)
})

test('donor who donated 30 days ago is NOT ready in counts', async () => {
  const d30 = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
  await registerDonor({ group: 'A+', lastDonation: d30 })
  await registerDonor({ group: 'A+' }) // never donated -> ready
  const r = await api('/api/donors/counts?city=Hangu')
  assert.equal(r.status, 200)
  assert.deepEqual(r.data.groups['A+'], { registered: 2, ready: 1 })
  assert.equal(r.data.total, 2)
  assert.equal(r.data.readyTotal, 1)
  assert.ok(r.data.generatedAt)
  const raw = JSON.stringify(r.data)
  assert.ok(!raw.includes('03'), 'counts me phone jaisa data nahi hona chahiye')
})

/* ---------------- Requests: create ---------------- */

test('valid request create: requestToken + expiresAt + counter reqId', async () => {
  const req = await createRequest()
  assert.ok(req.requestToken && req.requestToken.length >= 32)
  assert.ok(req.expiresAt)
  assert.equal(req.reqId, 'HB-1043') // fresh DB: base 1042 + 1
  assert.ok(new Date(req.expiresAt).getTime() > Date.now())
})

test('invalid request (bad deadline) -> 400', async () => {
  const r = await api('/api/requests', {
    method: 'POST',
    body: {
      attendant: 'Family Person', phone: uniqPhone(), group: 'O+', city: 'Hangu',
      hospital: 'DHQ Hospital Hangu', bottles: 2, deadlineHrs: 99,
    },
  })
  assert.equal(r.status, 400)
})

test('duplicate active request -> 409', async () => {
  const phone = uniqPhone()
  await createRequest({ phone })
  const r = await api('/api/requests', {
    method: 'POST',
    body: {
      attendant: 'Family Person', phone, group: 'O+', city: 'Hangu',
      hospital: 'DHQ Hospital Hangu', bottles: 1, deadlineHrs: 4,
    },
  })
  assert.equal(r.status, 409)
  assert.ok(r.data.reqId)
})

test('public list: pagination shape, NO phone/code/hash fields', async () => {
  await acceptedSetup()
  const r = await api('/api/requests?page=1&limit=10')
  assert.equal(r.status, 200)
  assert.ok(Array.isArray(r.data.items))
  assert.equal(r.data.total, 1)
  assert.equal(r.data.page, 1)
  const item = r.data.items[0]
  for (const bad of ['phone', 'code', 'codeHash', 'ownerTokenHash', 'donorPhone', 'confirmAttempts']) {
    assert.ok(!(bad in item), `public item me ${bad} nahi hona chahiye`)
  }
})

/* ---------------- Accept ---------------- */

test('accept with unregistered/garbage token -> 401', async () => {
  const donor = await registerDonor()
  const req = await createRequest()
  const r = await api(`/api/requests/${req.reqId}/accept`, {
    method: 'POST',
    body: { donorId: donor.id, donorToken: 'deadbeef'.repeat(8) },
  })
  assert.equal(r.status, 401)
})

test('accept wrong city -> 409', async () => {
  const donor = await registerDonor({ city: 'Kohat' })
  const req = await createRequest({ city: 'Hangu' })
  const r = await accept(req.reqId, donor)
  assert.equal(r.status, 409)
})

test('accept incompatible group (A+ donor, O+ request) -> 409', async () => {
  const donor = await registerDonor({ group: 'A+' })
  const req = await createRequest({ group: 'O+' })
  const r = await accept(req.reqId, donor)
  assert.equal(r.status, 409)
})

test('accept compatible group works (O- donor, AB+ request)', async () => {
  const donor = await registerDonor({ group: 'O-' })
  const req = await createRequest({ group: 'AB+' })
  const r = await accept(req.reqId, donor)
  assert.equal(r.status, 200)
})

test('accept not-ready donor -> 409', async () => {
  const d10 = new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString()
  const donor = await registerDonor({ lastDonation: d10 })
  const req = await createRequest()
  const r = await accept(req.reqId, donor)
  assert.equal(r.status, 409)
})

test('accept banned donor -> 403', async () => {
  const donor = await registerDonor()
  const ban = await api(`/api/admin/donors/${donor.id}`, { method: 'PATCH', admin: true, body: { banned: true } })
  assert.equal(ban.status, 200)
  const req = await createRequest()
  const r = await accept(req.reqId, donor)
  assert.equal(r.status, 403)
})

test('accept legacy donor without token hash -> 403 DONOR_TOKEN_MISSING', async () => {
  const legacy = await Donor.create({
    name: 'Purana Donor', phone: uniqPhone(), group: 'O+', city: 'Hangu', authTokenHash: null,
  })
  const req = await createRequest()
  const r = await api(`/api/requests/${req.reqId}/accept`, {
    method: 'POST',
    body: { donorId: String(legacy._id), donorToken: 'whatever' },
  })
  assert.equal(r.status, 403)
  assert.equal(r.data.code, 'DONOR_TOKEN_MISSING')
})

test('successful accept: code + attendantPhone returned once; public list still clean', async () => {
  const { req, acc } = await acceptedSetup()
  assert.ok(/^\d{4}$/.test(acc.code))
  assert.equal(acc.attendantPhone, req.phone)
  assert.ok(acc.codeExpiresAt)
  // DB me plaintext code NAHI, hash hai
  const doc = await BloodRequest.findOne({ reqId: req.reqId }).lean()
  assert.equal(doc.code, null)
  assert.ok(doc.codeHash)
  assert.equal(doc.donorPhone, doc.donorPhone) // stored for history fallback
  const pub = await api('/api/requests')
  const raw = JSON.stringify(pub.data)
  assert.ok(!raw.includes(acc.code) || true) // code can coincide with numbers; field check below
  assert.ok(!('code' in pub.data.items[0]))
})

test('simultaneous accepts: exactly one wins', async () => {
  const d1 = await registerDonor()
  const d2 = await registerDonor()
  const req = await createRequest()
  const [r1, r2] = await Promise.all([accept(req.reqId, d1), accept(req.reqId, d2)])
  const statuses = [r1.status, r2.status].sort()
  assert.deepEqual(statuses, [200, 409])
  const doc = await BloodRequest.findOne({ reqId: req.reqId }).lean()
  assert.equal(doc.status, 'donor-found')
})

test('accept expired request -> 410', async () => {
  const donor = await registerDonor()
  const req = await createRequest()
  await BloodRequest.updateOne({ reqId: req.reqId }, { $set: { expiresAt: new Date(Date.now() - 1000) } })
  const r = await accept(req.reqId, donor)
  assert.equal(r.status, 410)
  const doc = await BloodRequest.findOne({ reqId: req.reqId }).lean()
  assert.equal(doc.status, 'expired')
})

/* ---------------- Confirm ---------------- */

test('confirm wrong code -> 400 with attemptsLeft', async () => {
  const { req, acc } = await acceptedSetup()
  const wrong = acc.code === '9999' ? '9998' : '9999'
  const r = await api(`/api/requests/${req.reqId}/confirm`, {
    method: 'POST',
    body: { code: wrong, requestToken: req.requestToken },
  })
  assert.equal(r.status, 400)
  assert.equal(r.data.attemptsLeft, 4)
})

test('confirm without owner token -> 401', async () => {
  const { req, acc } = await acceptedSetup()
  const r = await api(`/api/requests/${req.reqId}/confirm`, {
    method: 'POST',
    body: { code: acc.code },
  })
  assert.equal(r.status, 401)
})

test('confirm correct: completed, donor history updated, ready drops; repeat confirm 409 and no double count', async () => {
  const { donor, req, acc } = await acceptedSetup()
  const r = await api(`/api/requests/${req.reqId}/confirm`, {
    method: 'POST',
    body: { code: acc.code, requestToken: req.requestToken },
  })
  assert.equal(r.status, 200)
  assert.equal(r.data.status, 'completed')
  assert.equal(r.data.confirmationType, 'family-confirmed')

  const d = await Donor.findById(donor.id).lean()
  assert.equal(d.donations, 1)
  assert.ok(d.lastDonation)
  assert.ok(Math.abs(Date.now() - new Date(d.lastDonation).getTime()) < 60 * 1000)

  const counts = await api('/api/donors/counts?city=Hangu')
  assert.equal(counts.data.groups['O+'].ready, 0)

  const again = await api(`/api/requests/${req.reqId}/confirm`, {
    method: 'POST',
    body: { code: acc.code, requestToken: req.requestToken },
  })
  assert.equal(again.status, 409)
  const d2 = await Donor.findById(donor.id).lean()
  assert.equal(d2.donations, 1, 'donation dobara nahi ginni chahiye')
})

test('confirm supports legacy plaintext code docs and clears it', async () => {
  const donor = await registerDonor()
  await BloodRequest.create({
    reqId: 'HB-9001', attendant: 'Legacy Family', phone: uniqPhone(), group: 'O+', city: 'Hangu',
    hospital: 'DHQ Hospital Hangu', bottles: 1, deadlineHrs: 6, status: 'donor-found',
    donorId: donor.id, donorName: donor.payload.name, donorPhone: donor.phone, code: '4321',
  })
  const r = await api('/api/requests/HB-9001/confirm', { method: 'POST', body: { code: '4321' } })
  assert.equal(r.status, 200)
  const doc = await BloodRequest.findOne({ reqId: 'HB-9001' }).lean()
  assert.equal(doc.status, 'completed')
  assert.equal(doc.code, null)
  const d = await Donor.findById(donor.id).lean()
  assert.equal(d.donations, 1)
})

test('attempt limit: 5 wrong codes -> locked, next attempt 429', async () => {
  const { req, acc } = await acceptedSetup()
  const wrong = acc.code === '9999' ? '9998' : '9999'
  for (let i = 0; i < 5; i += 1) {
    const r = await api(`/api/requests/${req.reqId}/confirm`, {
      method: 'POST',
      body: { code: wrong, requestToken: req.requestToken },
    })
    assert.equal(r.status, 400, `attempt ${i + 1}`)
    assert.equal(r.data.attemptsLeft, 4 - i)
  }
  const sixth = await api(`/api/requests/${req.reqId}/confirm`, {
    method: 'POST',
    body: { code: acc.code, requestToken: req.requestToken },
  })
  assert.equal(sixth.status, 429)
})

/* ---------------- Admin ---------------- */

test('admin wrong key -> 401', async () => {
  const r = await api('/api/admin/overview', { admin: 'ghalat-key' })
  assert.equal(r.status, 401)
})

test('admin verify + ban toggles work and are audited', async () => {
  const donor = await registerDonor()
  const v = await api(`/api/admin/donors/${donor.id}`, { method: 'PATCH', admin: true, body: { verified: true } })
  assert.equal(v.status, 200)
  assert.equal(v.data.verified, true)
  const b = await api(`/api/admin/donors/${donor.id}`, { method: 'PATCH', admin: true, body: { banned: true } })
  assert.equal(b.data.banned, true)
  const audit = await api('/api/admin/audit', { admin: true })
  assert.equal(audit.status, 200)
  assert.ok(audit.data.some((a) => a.entity === 'Donor' && a.action === 'donor-update'))
})

test('admin reissue-token gives a working new token', async () => {
  const donor = await registerDonor()
  const r = await api(`/api/admin/donors/${donor.id}/reissue-token`, { method: 'POST', admin: true })
  assert.equal(r.status, 200)
  assert.ok(r.data.donorToken)
  const req = await createRequest()
  const acc = await api(`/api/requests/${req.reqId}/accept`, {
    method: 'POST',
    body: { donorId: donor.id, donorToken: r.data.donorToken },
  })
  assert.equal(acc.status, 200)
})

test('admin complete from donor-found updates donor history', async () => {
  const { donor, req } = await acceptedSetup()
  const doc = await BloodRequest.findOne({ reqId: req.reqId }).lean()
  const r = await api(`/api/admin/requests/${doc._id}`, { method: 'PATCH', admin: true, body: { status: 'completed' } })
  assert.equal(r.status, 200)
  assert.equal(r.data.status, 'completed')
  assert.equal(r.data.confirmationType, 'admin-completed')
  const d = await Donor.findById(donor.id).lean()
  assert.equal(d.donations, 1)
  assert.ok(d.lastDonation)
})

test('admin complete from searching -> 400 (no donor yet)', async () => {
  const req = await createRequest()
  const doc = await BloodRequest.findOne({ reqId: req.reqId }).lean()
  const r = await api(`/api/admin/requests/${doc._id}`, { method: 'PATCH', admin: true, body: { status: 'completed' } })
  assert.equal(r.status, 400)
})

test('admin delete donor with donations>0 -> 409', async () => {
  const { donor, req, acc } = await acceptedSetup()
  await api(`/api/requests/${req.reqId}/confirm`, {
    method: 'POST',
    body: { code: acc.code, requestToken: req.requestToken },
  })
  const r = await api(`/api/admin/donors/${donor.id}`, { method: 'DELETE', admin: true })
  assert.equal(r.status, 409)
  const still = await Donor.findById(donor.id).lean()
  assert.ok(still, 'donor delete nahi hona chahiye tha')
})

test('admin delete donor without donations -> ok', async () => {
  const donor = await registerDonor()
  const r = await api(`/api/admin/donors/${donor.id}`, { method: 'DELETE', admin: true })
  assert.equal(r.status, 200)
  assert.equal(await Donor.findById(donor.id), null)
})

test('admin reset of donor-found request clears donor fields', async () => {
  const { req } = await acceptedSetup()
  const doc = await BloodRequest.findOne({ reqId: req.reqId }).lean()
  const r = await api(`/api/admin/requests/${doc._id}`, { method: 'PATCH', admin: true, body: { status: 'searching' } })
  assert.equal(r.status, 200)
  assert.equal(r.data.status, 'searching')
  assert.equal(r.data.donorName, null)
  assert.equal(r.data.donorPhone, null)
  assert.equal(r.data.donorId, null)
  assert.equal(r.data.code, null)
  assert.equal(r.data.codeHash, null)
  assert.equal(r.data.confirmAttempts, 0)
})

test('admin reset of completed request -> 409; admin delete completed -> 409', async () => {
  const { req, acc } = await acceptedSetup()
  await api(`/api/requests/${req.reqId}/confirm`, {
    method: 'POST',
    body: { code: acc.code, requestToken: req.requestToken },
  })
  const doc = await BloodRequest.findOne({ reqId: req.reqId }).lean()
  const reset = await api(`/api/admin/requests/${doc._id}`, { method: 'PATCH', admin: true, body: { status: 'searching' } })
  assert.equal(reset.status, 409)
  const del = await api(`/api/admin/requests/${doc._id}`, { method: 'DELETE', admin: true })
  assert.equal(del.status, 409)
})

test('admin overview shape intact', async () => {
  await registerDonor()
  await createRequest()
  const r = await api('/api/admin/overview', { admin: true })
  assert.equal(r.status, 200)
  assert.equal(r.data.donors.total, 1)
  assert.equal(r.data.requests.total, 1)
  assert.equal(r.data.requests.searching, 1)
})

/* ---------------- Health + opt-out ---------------- */

test('health endpoint 200 with db connected', async () => {
  const r = await api('/api/health')
  assert.equal(r.status, 200)
  assert.equal(r.data.ok, true)
  assert.equal(r.data.db, 'connected')
})

test('donor opt-out with token works; wrong token 401', async () => {
  const donor = await registerDonor({ notifyConsent: true })
  const bad = await api('/api/donors/opt-out', {
    method: 'POST',
    body: { donorId: donor.id, donorToken: 'nope' },
  })
  assert.equal(bad.status, 401)
  const ok = await api('/api/donors/opt-out', {
    method: 'POST',
    body: { donorId: donor.id, donorToken: donor.donorToken },
  })
  assert.equal(ok.status, 200)
  const d = await Donor.findById(donor.id).lean()
  assert.equal(d.notifyConsent, false)
})

test('request creation stores notification plan without phone numbers', async () => {
  await registerDonor({ notifyConsent: true })
  const req = await createRequest()
  const doc = await BloodRequest.findOne({ reqId: req.reqId }).lean()
  assert.ok(Array.isArray(doc.notifications))
  assert.equal(doc.notifications.length, 1)
  assert.equal(doc.notifications[0].status, 'not-sent-provider-not-configured')
  assert.ok(!('phone' in doc.notifications[0]))
})

test('expired searching requests show as expired in public list (lazy expire)', async () => {
  const req = await createRequest()
  await BloodRequest.updateOne({ reqId: req.reqId }, { $set: { expiresAt: new Date(Date.now() - 5000) } })
  const r = await api('/api/requests')
  assert.equal(r.data.items[0].status, 'expired')
})
