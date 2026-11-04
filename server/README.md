# Har Boond — Backend (Express + MongoDB)

## Chalane ka tareeka
1. `cd server`
2. `npm install` (sirf pehli dafa)
3. `.env.example` ko copy karke `.env` banao aur us me apni MongoDB Atlas wali `MONGODB_URI` khud dalo
4. `npm start` — terminal me "MongoDB Atlas se connect ho gaya" ayega

## API
- `POST /api/donors` — donor register
- `GET /api/donors/counts?city=Hangu` — Lifeline Board ke numbers (koi personal data nahi)
- `GET /api/requests?city=Kohat` — public requests (phone kabhi public nahi)
- `POST /api/requests` — nayi request
- `POST /api/requests/:reqId/accept` — donor "Me Araha Hon" (code sirf donor ko wapas milta hai)
- `POST /api/requests/:reqId/confirm` — family code se tasdeeq (donor ka record khud update hota hai)
- `GET /api/health` — server zinda hai ya nahi
