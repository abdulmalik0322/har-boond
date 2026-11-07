// Server-side strict validation — frontend par bharosa nahi.
// Har function ya to { error, field } deta hai ya saaf (cleaned) values.

export const GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
export const CITIES = ['Hangu', 'Kohat']

// 03XXXXXXXXX, 923XXXXXXXXX, +923XXXXXXXXX — teeno ko 03 wale form me lao.
export function normalizePhone(input) {
  if (input === null || input === undefined) return null
  let p = String(input).replace(/[\s-]/g, '')
  if (/^03\d{9}$/.test(p)) return p
  if (/^\+923\d{9}$/.test(p)) return `0${p.slice(3)}`
  if (/^923\d{9}$/.test(p)) return `0${p.slice(2)}`
  return null
}

// Naam: 3-60 characters, unicode letters (Urdu samet), spaces, . ' -
export function validName(input) {
  if (typeof input !== 'string') return false
  const t = input.trim()
  if (t.length < 3 || t.length > 60) return false
  return /^[\p{L} .'-]+$/u.test(t)
}

function parseLastDonation(value) {
  if (value === null || value === undefined || value === '') return { date: null }
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return { error: 'Last donation ki date ghalat hai', field: 'lastDonation' }
  if (d.getTime() > Date.now()) return { error: 'Last donation ki date future ki nahi ho sakti', field: 'lastDonation' }
  if (d.getTime() < new Date('1950-01-01T00:00:00Z').getTime()) {
    return { error: 'Last donation ki date ghalat hai', field: 'lastDonation' }
  }
  return { date: d }
}

function asInt(value) {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) return Number(value)
  return NaN
}

export function validateDonorPayload(body = {}) {
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!validName(body.name)) return { error: 'Poora naam zaroori hai (3-60 characters)', field: 'name' }
  const phone = normalizePhone(body.phone)
  if (!phone) return { error: 'Sahi Pakistani number zaroori hai (03 se shuru, 11 number)', field: 'phone' }
  if (!GROUPS.includes(body.group)) return { error: 'Blood group ghalat hai', field: 'group' }
  if (!CITIES.includes(body.city)) return { error: 'City sirf Hangu ya Kohat ho sakti hai', field: 'city' }
  const ld = parseLastDonation(body.lastDonation)
  if (ld.error) return ld
  return {
    value: {
      name,
      phone,
      group: body.group,
      city: body.city,
      lastDonation: ld.date,
      nightAvailable: body.nightAvailable !== false,
      notifyConsent: body.notifyConsent === true,
    },
  }
}

export function validateRequestPayload(body = {}) {
  const attendant = typeof body.attendant === 'string' ? body.attendant.trim() : ''
  if (!validName(body.attendant)) return { error: 'Rabta karne wale ka naam zaroori hai (3-60 characters)', field: 'attendant' }
  const phone = normalizePhone(body.phone)
  if (!phone) return { error: 'Sahi Pakistani number zaroori hai (03 se shuru, 11 number)', field: 'phone' }
  if (!GROUPS.includes(body.group)) return { error: 'Blood group ghalat hai', field: 'group' }
  if (!CITIES.includes(body.city)) return { error: 'City sirf Hangu ya Kohat ho sakti hai', field: 'city' }
  const hospital = typeof body.hospital === 'string' ? body.hospital.trim() : ''
  if (hospital.length < 3 || hospital.length > 80) return { error: 'Hospital ka naam zaroori hai (3-80 characters)', field: 'hospital' }
  const bottles = asInt(body.bottles)
  if (!Number.isInteger(bottles) || bottles < 1 || bottles > 6) {
    return { error: 'Bottles 1 se 6 ke darmiyan honi chahiye', field: 'bottles' }
  }
  const deadlineHrs = asInt(body.deadlineHrs)
  if (!Number.isInteger(deadlineHrs) || deadlineHrs < 1 || deadlineHrs > 48) {
    return { error: 'Deadline 1 se 48 ghante ke darmiyan honi chahiye', field: 'deadlineHrs' }
  }
  return {
    value: { attendant, phone, group: body.group, city: body.city, hospital, bottles, deadlineHrs },
  }
}
