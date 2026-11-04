// ASAL RULE — frontend (src/store.js) ke sath bilkul aik jesa:
// donor ready hai agar us ne pichle 90 din me khoon nahi diya
const DAY = 24 * 60 * 60 * 1000
export function donorReady(donor, now = new Date()) {
  if (!donor.lastDonation) return true
  return now - new Date(donor.lastDonation) >= 90 * DAY
}
