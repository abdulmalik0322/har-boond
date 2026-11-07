import crypto from 'node:crypto'

// Asal token sirf ek dafa client ko milta hai; DB me sirf hash rehta hai.
export function genToken() {
  return crypto.randomBytes(32).toString('hex')
}

export function hashToken(token) {
  if (token === null || token === undefined) return ''
  return crypto.createHash('sha256').update(String(token)).digest('hex')
}

// Confirmation code ko reqId ke sath hash karte hain taake code dusri
// request par replay na ho sake.
export function hashCode(reqId, code) {
  if (code === null || code === undefined) return ''
  return crypto.createHash('sha256').update(`${reqId}:${code}`).digest('hex')
}

// Timing-safe muqabla — length mukhtalif ho to pehle hi false.
export function secureEqual(a, b) {
  if (a === null || a === undefined || b === null || b === undefined) return false
  const ba = Buffer.from(String(a))
  const bb = Buffer.from(String(b))
  if (ba.length !== bb.length) return false
  return crypto.timingSafeEqual(ba, bb)
}

export function genConfirmCode() {
  return String(crypto.randomInt(1000, 10000))
}
