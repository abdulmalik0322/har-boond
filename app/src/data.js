// Har Boond — data layer
// Ye records backend (MongoDB) se anay walay donors ki shakal hain.
// Ready hona koi fixed number nahi — ye last donation ki date se LIVE calculate hota hai.

export const GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
export const CITIES = ['Hangu', 'Kohat']

// Har sheher / group me kitne donors register hain (launch target ke mutabiq)
const REGISTERED = {
  Hangu: { 'A+': 19, 'A-': 8, 'B+': 24, 'B-': 7, 'AB+': 9, 'AB-': 4, 'O+': 30, 'O-': 11 },
  Kohat: { 'A+': 24, 'A-': 10, 'B+': 31, 'B-': 8, 'AB+': 12, 'AB-': 5, 'O+': 38, 'O-': 14 },
}

const DAY = 24 * 60 * 60 * 1000

function daysAgo(n) {
  return new Date(Date.now() - n * DAY)
}

// Deterministic tareeqay se donor records banana —
// har donor ki lastDonation date alag hai, taake 3-mahine wala rule sach me calculate ho
export const DONORS = (() => {
  const list = []
  let id = 0
  for (const city of CITIES) {
    for (const group of GROUPS) {
      const total = REGISTERED[city][group]
      for (let i = 0; i < total; i++) {
        id++
        // Kuch donors ne kabhi nahi diya (null), kuch ne 15–260 din pehle diya
        const pattern = (id * 37 + i * 13) % 10
        const last =
          pattern === 0 ? null : daysAgo(15 + ((id * 53 + i * 29) % 246))
        list.push({
          id,
          group,
          city,
          lastDonation: last,
          nightAvailable: id % 3 !== 0,
          donations: (id * 7) % 6,
        })
      }
    }
  }
  return list
})()

// ASAL RULE: donor ready hai agar us ne pichle 90 din me khoon nahi diya
export function isReady(donor, now = new Date()) {
  if (!donor.lastDonation) return true
  return now - donor.lastDonation >= 90 * DAY
}

export function readyDonors(city, group, now = new Date()) {
  return DONORS.filter((d) => d.city === city && d.group === group && isReady(d, now))
}

export function registeredCount(city, group) {
  return DONORS.filter((d) => d.city === city && d.group === group).length
}

export const STATS = {
  totalDonors: DONORS.length,
  readyNow: DONORS.filter((d) => isReady(d)).length,
  cities: CITIES.length,
  groups: GROUPS.length,
}

// Live requests — ye backend se ayengi; abhi ke liye waqt asal ghari se calculate hota hai
export const REQUESTS = [
  { id: 'HB-1042', group: 'O-', city: 'Hangu', hospital: 'DHQ Hospital Hangu', bottles: 2, minsAgo: 12, deadlineHrs: 3, status: 'searching' },
  { id: 'HB-1041', group: 'B+', city: 'Kohat', hospital: 'Liaqat Memorial Hospital Kohat', bottles: 3, minsAgo: 38, deadlineHrs: 6, status: 'donor-found' },
  { id: 'HB-1039', group: 'A+', city: 'Hangu', hospital: 'DHQ Hospital Hangu', bottles: 1, minsAgo: 74, deadlineHrs: 8, status: 'searching' },
  { id: 'HB-1036', group: 'AB-', city: 'Kohat', hospital: 'KDA Hospital Kohat', bottles: 2, minsAgo: 160, deadlineHrs: 12, status: 'completed' },
]

export function timeAgo(mins) {
  if (mins < 60) return `${mins} minute pehle`
  const h = Math.floor(mins / 60)
  return `${h} ghante pehle`
}
