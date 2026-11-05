// Har Boond — backend API layer
// Saara asal data server (MongoDB) se ata hai. Koi seed/fake data nahi:
// server na mile to UI khamoshi se ghalat numbers nahi dikhata, error batata hai.
const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

async function call(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  })
  let body = null
  try { body = await res.json() } catch { /* empty body */ }
  if (!res.ok) throw new Error((body && body.error) || `Server error (${res.status})`)
  return body
}

const get = (path) => call(path)
const post = (path, data) => call(path, { method: 'POST', body: JSON.stringify(data || {}) })

// Lifeline Board ke numbers — dono sheher alag alag (koi personal data nahi ata)
export async function fetchCounts() {
  const [hangu, kohat] = await Promise.all([
    get('/api/donors/counts?city=Hangu'),
    get('/api/donors/counts?city=Kohat'),
  ])
  return { Hangu: hangu, Kohat: kohat }
}

// Public requests — phones kabhi nahi ate; sirf naam/status/waqt
export async function fetchRequests() {
  const list = await get('/api/requests')
  return list.map((r) => ({
    id: r.reqId,
    group: r.group, city: r.city, hospital: r.hospital,
    bottles: r.bottles, deadlineHrs: r.deadlineHrs, status: r.status,
    attendant: r.attendant || '',
    donorName: r.donorName || null,
    postedAt: r.createdAt ? Date.parse(r.createdAt) : Date.now(),
    code: null,
  }))
}

export function registerDonor(payload) {
  return post('/api/donors', payload) // -> { id, ready }
}

export function createBloodRequest(payload) {
  return post('/api/requests', payload) // -> { reqId, status }
}

export function acceptBloodRequest(reqId, payload) {
  return post(`/api/requests/${reqId}/accept`, payload) // -> { reqId, status, code, attendantPhone }
}

export function confirmBloodRequest(reqId, code) {
  return post(`/api/requests/${reqId}/confirm`, { code }) // -> { reqId, status }
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
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey() },
    ...opts,
  })
  let body = null
  try { body = await res.json() } catch { /* empty body */ }
  if (!res.ok) throw new Error((body && body.error) || `Server error (${res.status})`)
  return body
}

export const adminOverview = () => adminCall('/api/admin/overview')
export const adminDonors = () => adminCall('/api/admin/donors')
export const adminRequests = () => adminCall('/api/admin/requests')
export const adminPatchDonor = (id, patch) =>
  adminCall(`/api/admin/donors/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
export const adminDeleteDonor = (id) =>
  adminCall(`/api/admin/donors/${id}`, { method: 'DELETE' })
export const adminPatchRequest = (id, patch) =>
  adminCall(`/api/admin/requests/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
export const adminDeleteRequest = (id) =>
  adminCall(`/api/admin/requests/${id}`, { method: 'DELETE' })
