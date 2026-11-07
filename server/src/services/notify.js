import Donor from '../models/Donor.js'
import { donorReady } from '../lib/ready.js'
import { canDonateTo } from '../lib/compat.js'

// Notification ARCHITECTURE sirf — koi asal SMS/WhatsApp nahi bheja jata.
// Provider configure na ho to har entry 'not-sent-provider-not-configured' rehti hai.

// Safa (pure) plan: sirf woh donors jo razamand hon, banned na hon, ready hon,
// sheher match kare aur khoon compatible ho. Phone number plan me KABHI nahi ata.
export function buildNotificationPlan(request, eligibleDonors = []) {
  const now = new Date()
  return (eligibleDonors || [])
    .filter((d) => d && d.notifyConsent === true)
    .filter((d) => !d.banned)
    .filter((d) => donorReady(d, now))
    .filter((d) => d.city === request.city)
    .filter((d) => canDonateTo(d.group, request.group))
    .map((d) => ({
      donorId: d._id,
      channel: 'whatsapp',
      status: 'planned',
      at: now,
    }))
}

function providerConfigured() {
  return process.env.NOTIFY_ENABLED === 'true' && Boolean(process.env.NOTIFY_API_KEY)
}

// Plan bana kar status tay karo. NOTIFY_ENABLED + provider key ho tab bhi
// asal message nahi jata — entry 'queued-stub' rehti hai (provider integration baqi hai).
export async function dispatchNotifications(request, donors = null) {
  let candidates = donors
  if (!candidates) {
    candidates = await Donor.find({ city: request.city, banned: false, notifyConsent: true }).lean()
  }
  const status = providerConfigured() ? 'queued-stub' : 'not-sent-provider-not-configured'
  return buildNotificationPlan(request, candidates).map((e) => ({ ...e, status }))
}
