# Har Boond — Backend (Express + MongoDB)

## Chalane ka tareeka
1. `cd server`
2. `npm install` (sirf pehli dafa)
3. `.env.example` ko copy karke `.env` banao aur us me apni MongoDB Atlas wali `MONGODB_URI` aur `ADMIN_KEY` khud dalo
4. `npm start` — terminal me "MongoDB Atlas se connect ho gaya" ayega

## API
- `POST /api/donors` — donor register. Response me `donorToken` EK dafa milta hai; DB me sirf uska hash rehta hai. Wahi token baad me accept/opt-out ke liye lagega.
- `POST /api/donors/opt-out` — `{ donorId, donorToken }` se notification razamandi (notifyConsent) band karna
- `GET /api/donors/counts?city=Hangu` — Lifeline Board ke numbers (aggregation; koi personal data nahi)
- `GET /api/requests?city=Kohat&page=1&limit=50` — public requests `{ items, total, page, limit }` (phone/code kabhi public nahi). Deadline guzarne par searching request khud `expired` ho jati hai.
- `POST /api/requests` — nayi request. Response me `requestToken` (owner token) aur `expiresAt` milta hai (= ab + deadlineHrs). Confirm ke waqt owner token lazmi hai.
- `POST /api/requests/:reqId/accept` — donor `{ donorId, donorToken }` bhejta hai (naam/phone NAHI). Server eligibility check karta hai: banned, 90-day ready rule, city match, blood-group compatibility (standard red-cell matrix). Accept atomic hai — ek request par sirf ek donor. Code hashed store hota hai, 6 ghante valid, plaintext sirf accepting donor ko ek dafa.
- `POST /api/requests/:reqId/confirm` — family `{ code, requestToken }` bhejti hai. 5 ghalat koshishon par code lock ho jata hai. Completion ka matlab **family-confirmed** hai, hospital ki medical verification NAHI.
- `GET /api/health` — `{ ok, app, db }`; DB connected na ho to 503
- `/api/admin/*` — `x-admin-key` header lazmi (timing-safe check). Donor verify/ban, reissue-token (`POST /api/admin/donors/:id/reissue-token` — purane donor jin ke paas token nahi), request reset/complete/delete, `GET /api/admin/audit` (admin actions ka log). Jis donor ka donation record hai wo delete nahi hota (409 — ban karo); completed request delete/reset nahi hoti.

## Env vars
`MONGODB_URI`, `PORT`, `ADMIN_KEY`, `ALLOWED_ORIGINS` (CORS whitelist), `REQUIRE_VERIFIED_DONOR=true` ho to accept ke liye donor verified hona lazmi, `NOTIFY_ENABLED` + `NOTIFY_API_KEY` — notification sirf architecture hai, asal message nahi jata (plan entries `not-sent-provider-not-configured` / `queued-stub` rehti hain, aur sirf notifyConsent wale eligible donors ke liye, phone number plan me kabhi nahi).

## Tests
`npm test` — isolated in-memory MongoDB par chalte hain, asal database ko kabhi touch nahi karte.
