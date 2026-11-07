// Har Boond — sirf constants.
// NOTE (v2): Is file se purana fake/seed data (DONORS / REQUESTS / STATS)
// hata diya gaya hai. Project me koi demo data nahi hai — saara asal data
// backend (MongoDB) se ata hai (dekho api.js).

export const GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
export const CITIES = ['Hangu', 'Kohat']

// Red-cell compatibility: donor group -> kin groups ko de sakta hai.
// Ye sirf matching ki pehli manzil hai — aakhri cross-match aur medical
// eligibility ka faisla hamesha hospital / blood bank karta hai.
export const COMPATIBILITY = {
  'O-': ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
  'O+': ['O+', 'A+', 'B+', 'AB+'],
  'A-': ['A-', 'A+', 'AB-', 'AB+'],
  'A+': ['A+', 'AB+'],
  'B-': ['B-', 'B+', 'AB-', 'AB+'],
  'B+': ['B+', 'AB+'],
  'AB-': ['AB-', 'AB+'],
  'AB+': ['AB+'],
}

export function canDonateTo(donorGroup, requestedGroup) {
  return (COMPATIBILITY[donorGroup] || []).includes(requestedGroup)
}
