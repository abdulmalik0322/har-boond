// Har Boond — device-local cheezein
// Asal data (donors, requests, counts) backend se ata hai (api.js).
// Yahan sirf is device ki apni cheezein save hoti hain:
//  - myDonors: is device se register hue donors (naam/number sirf apne liye)
//  - myAccepts: jin requests par is device se "Me Araha Hon" bola — unke code
//    (code server dobara nahi deta, is liye donor ke apne phone par mehfooz rakha jata hai)
const KEY = 'harboond_device_v1'
const DAY = 24 * 60 * 60 * 1000

export function loadDevice() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY))
    if (s && Array.isArray(s.myDonors) && s.myAccepts) return s
  } catch { /* ignore */ }
  return { myDonors: [], myAccepts: {} }
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
