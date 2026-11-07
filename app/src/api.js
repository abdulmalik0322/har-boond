// Har Boond — backend API layer (v2)
// Saara asal data server (MongoDB) se ata hai. Koi seed/fake data nahi:
// server na mile to UI khamoshi se ghalat numbers nahi dikhata, error batata hai.
//
// v2 tabdeeliyan:
// - Har call par 15 second ka timeout (AbortController) — latka hua server
//   user ko latka nahi rakhta.
// - GET (counts/requests) par controlled retry: server sota ho (Render free
//   tier) to 2.5s aur 6s ke waqfe se dobara koshish. POST kabhi auto-retry
//   nahi hota (duplicate registration/request ka khatra).
// - Naya contract: requests list {items,...}; accept ke liye donorId+donorToken;
//   confirm ke liye code+requestToken.
const API = (import.meta.env.VITE_API_URL || 'https://har-boond-api.onrender.com').replace(/\/$/, '')

const WAKE_MSG = 'Server jawab nahi de raha — server jag raha hoga (pehli dafa 30–50 second lag sakte hain). Thodi dair baad dobara try karo.'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function rawCall(path, opts = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 15000)
  let res
  try {
    res = await fetch(`${API}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...opts,
      signal: ctrl.signal,
    })
  } catch {
    const e = new Error(WAKE_MSG)
    e.isNetwork = true
    throw e
  } finally {
    clearTimeout(timer)
  }
  let body = null
  try { body = await res.json() } catch { /* empty body */ }
  if (!res.ok) {
    const e = new Error((body && body.error) || `Server error (${res.status})`)
    e.status = res.status
    if (body && typeof body.attemptsLeft === 'number') e.attemptsLeft = body.attemptsLeft
    if (body && body.code) e.code = body.code
    throw e
  }
  return body
}

// GET: network error / 5xx par 2 dafa aur try (2.5s, phir 6s). 4xx par nahi.
async function getWithRetry(path) {
  const delays = [2500, 6000]
  for (let attempt = 0; ; attempt++) {
    try {
      return await rawCall(path)
    } catch (e) {
      const retriable = e.isNetwork || (e.status >= 500 && e.status !== 503)
      if (!retriable || attempt >= delays.length) throw e
      await sleep(delays[attempt])
    }
  }
}

const post = (path, data) => rawCall(path, { method: 'POST', body: JSON.stringify(data || {}) })

// Lifeline Board ke numbers — dono sheher alag alag (koi personal data nahi ata)
export async function fetchCounts() {
  const [hangu, kohat] = await Promise.all([
    getWithRetry('/api/donors/counts?city=Hangu'),
    getWithRetry('/api/donors/counts?city=Kohat'),
  ])
  return { Hangu: hangu, Kohat: kohat }
}

// Public requests — phones kabhi nahi ate; sirf naam/status/waqt
export async function fetchRequests() {
  const body = await getWithRetry('/api/requests?limit=50')
  const list = Array.isArray(body) ? body : (body.items || [])
  return list.map((r) => ({
    id: r.reqId,
    group: r.group, city: r.city, hospital: r.hospital,
    bottles: r.bottles, deadlineHrs: r.deadlineHrs, status: r.status,
    attendant: r.attendant || '',
    donorName: r.donorName || null,
    postedAt: r.createdAt ? Date.parse(r.createdAt) : Date.now(),
    expiresAt: r.expiresAt ? Date.parse(r.expiresAt) : null,
    code: null,
  }))
}

export function registerDonor(payload) {
  return post('/api/donors', payload) // -> { id, ready, verified, donorToken }
}

export function createBloodRequest(payload) {
  return post('/api/requests', payload) // -> { reqId, status, requestToken, expiresAt }
}

export function acceptBloodRequest(reqId, payload) {
  return post(`/api/requests/${reqId}/accept`, payload) // { donorId, donorToken } -> { reqId, status, code, attendantPhone, codeExpiresAt }
}

export function confirmBloodRequest(reqId, payload) {
  return post(`/api/requests/${reqId}/confirm`, payload) // { code, requestToken } -> { reqId, status, confirmationType }
}

/* ================= Admin =================
   Admin key sirf is browser ki session me rehti hai (sessionStorage) —
   page band karne par khud saaf. Baghair sahi key ke server data nahi deta. */
const adminKey = () => sessionStorage.getItem('hb_admin_key') || ''
export function setAdminKey(k) {
  if (k) sessionStorage.setItem('hb_admin_key', k)
  else sessionStorage.removeItem('hb_admin_key')
}
export function hasAdminKey() { return !!adminKey() }

async function adminCall(path, opts = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 20000)
  let res
  try {
    res = await fetch(`${API}${path}`, {
      headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey() },
      ...opts,
      signal: ctrl.signal,
    })
  } catch {
    throw new Error(WAKE_MSG)
  } finally {
    clearTimeout(timer)
  }
  let body = null
  try { body = await res.json() } catch { /* empty body */ }
  if (!res.ok) throw new Error((body && body.error) || `Server error (${res.status})`)
  return body
}

// Admin lists v2 me paginated {items,...} bhi ho sakti hain — dono shape sambhalo
const asList = (body) => (Array.isArray(body) ? body : (body.items || body.donors || body.requests || []))

export const adminOverview = () => adminCall('/api/admin/overview')
export const adminDonors = async () => asList(await adminCall('/api/admin/donors?limit=200'))
export const adminRequests = async () => asList(await adminCall('/api/admin/requests?limit=200'))
export const adminAudit = async () => asList(await adminCall('/api/admin/audit'))
export const adminPatchDonor = (id, patch) =>
  adminCall(`/api/admin/donors/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
export const adminDeleteDonor = (id) =>
  adminCall(`/api/admin/donors/${id}`, { method: 'DELETE' })
export const adminReissueToken = (id) =>
  adminCall(`/api/admin/donors/${id}/reissue-token`, { method: 'POST', body: '{}' }) // -> { donorToken } sirf aik dafa
export const adminPatchRequest = (id, patch) =>
  adminCall(`/api/admin/requests/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
export const adminDeleteRequest = (id) =>
  adminCall(`/api/admin/requests/${id}`, { method: 'DELETE' })
