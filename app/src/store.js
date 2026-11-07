// Har Boond — device-local cheezein (v2)
// Asal data (donors, requests, counts) backend se ata hai (api.js).
// Yahan sirf is device ki apni cheezein save hoti hain:
//  - myDonors: is device se register hue donors — in me donorToken bhi hai
//    (token server dobara nahi deta; accept sirf isi token se hota hai)
//  - myAccepts: jin requests par is device se "Me Araha Hon" bola — unke code
//  - myRequests: is device se lagi hui requests ke owner tokens
//    (tasdeeq/confirm sirf request lagane wale ki device se hoti hai)
const KEY = 'harboond_device_v1'
const DAY = 24 * 60 * 60 * 1000

export function loadDevice() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY))
    if (s && Array.isArray(s.myDonors)) {
      return {
        myDonors: s.myDonors,
        myAccepts: s.myAccepts && typeof s.myAccepts === 'object' ? s.myAccepts : {},
        myRequests: s.myRequests && typeof s.myRequests === 'object' ? s.myRequests : {},
      }
    }
  } catch { /* ignore */ }
  return { myDonors: [], myAccepts: {}, myRequests: {} }
}

export function saveDevice(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* storage full/blocked */ }
}

// ASAL RULE (server ke sath bilkul aik jesa): pichle 90 din me khoon diya ho to ready nahi
export function donorIsReady(d, now = new Date()) {
  if (!d.lastDonation) return true
  return now - new Date(d.lastDonation) >= 90 * DAY
}

export function timeAgoFrom(ts) {
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000))
  if (mins < 1) return 'Abhi abhi'
  if (mins < 60) return `${mins} minute pehle`
  const h = Math.floor(mins / 60)
  if (h < 24) return `${h} ghante pehle`
  return `${Math.floor(h / 24)} din pehle`
}

export function timeLeftFrom(ts) {
  const ms = ts - Date.now()
  if (!Number.isFinite(ms)) return ''
  if (ms <= 0) return 'Waqt khatam ho gaya'
  const mins = Math.round(ms / 60000)
  if (mins < 60) return `${Math.max(1, mins)} minute baqi`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h} ghante ${m} minute baqi` : `${h} ghante baqi`
}
