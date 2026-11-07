// Security middleware — helmet/CORS/rate-limit ka halka, dependency-free version.

// --- Security headers (helmet-equivalent bunyadi headers) ---
export function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
  res.setHeader('X-DNS-Prefetch-Control', 'off')
  res.removeHeader('X-Powered-By')
  next()
}

// --- CORS whitelist ---
// ALLOWED_ORIGINS env (comma-separated) se; default live frontend + local dev.
function allowedOrigins() {
  const raw = process.env.ALLOWED_ORIGINS
  if (raw && raw.trim()) return raw.split(',').map((s) => s.trim()).filter(Boolean)
  return ['https://abdulmalik0322.github.io', 'http://localhost:5173', 'http://localhost:4173']
}

export function corsWhitelist(req, res, next) {
  const origin = req.get('origin')
  // Origin header hi nahi (curl / same-origin / server-to-server) — guzarne do.
  if (!origin) return next()
  if (allowedOrigins().includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key')
    res.setHeader('Access-Control-Max-Age', '86400')
    if (req.method === 'OPTIONS') return res.status(204).end()
  } else if (req.method === 'OPTIONS') {
    // Ghalat origin ka preflight — koi CORS header nahi, bas khatam.
    return res.status(204).end()
  }
  return next()
}

// --- In-memory rate limit factory ---
// key: (req) => string custom key function bhi ho sakti hai; default req.ip
export function rateLimit({ windowMs = 60 * 1000, max = 60, key } = {}) {
  const hits = new Map() // key -> { count, resetAt }
  return function rateLimiter(req, res, next) {
    const now = Date.now()
    const k = typeof key === 'function' ? key(req) : (key || req.ip || 'unknown')
    let entry = hits.get(k)
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs }
      hits.set(k, entry)
    }
    entry.count += 1
    // Kabhi kabhi purani entries saaf karo taake map phool na jaye.
    if (hits.size > 5000) {
      for (const [hk, hv] of hits) if (hv.resetAt <= now) hits.delete(hk)
    }
    if (entry.count > max) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000))
      res.setHeader('Retry-After', String(retryAfter))
      return res.status(429).json({ error: 'Bohat zyada koshishein — thodi der baad dobara try karo' })
    }
    return next()
  }
}

// --- async route wrapper (Express 4 me rejected promise khud catch nahi hoti) ---
export function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

// --- 404 ---
export function notFound(req, res) {
  res.status(404).json({ error: 'Route nahi mila' })
}

// --- Central error handler: stack/internal detail production me kabhi nahi ---
export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  let status = err.status || err.statusCode || 500
  let message = 'Server par masla hai — thodi der baad dobara try karo'
  if (err.type === 'entity.too.large') {
    status = 413; message = 'Data bohat bara hai'
  } else if (err.type === 'entity.parse.failed' || (err instanceof SyntaxError && 'body' in err)) {
    status = 400; message = 'JSON ghalat hai'
  } else if (err.name === 'CastError') {
    status = 400; message = 'ID ghalat hai'
  } else if (err.name === 'ValidationError') {
    status = 400; message = 'Data ghalat hai'
  } else if (status < 500 && err.message) {
    message = err.message
  }
  const body = { error: message }
  if (process.env.NODE_ENV !== 'production' && status >= 500 && err.stack) body.stack = err.stack
  if (status >= 500) console.error('Server error:', err.message)
  res.status(status).json(body)
}
