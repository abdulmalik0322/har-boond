import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import donorsRouter from './routes/donors.js'
import requestsRouter from './routes/requests.js'
import adminRouter from './routes/admin.js'

const app = express()
app.use(cors())
app.use(express.json())

app.get('/api/health', (req, res) => res.json({ ok: true, app: 'Har Boond' }))
app.use('/api/donors', donorsRouter)
app.use('/api/requests', requestsRouter)
app.use('/api/admin', adminRouter)

const PORT = process.env.PORT || 5000
if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI missing hai — .env file banao (.env.example dekho)')
  process.exit(1)
}
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB Atlas se connect ho gaya')
    app.listen(PORT, () => console.log(`Har Boond server chal raha hai: http://localhost:${PORT}`))
  })
  .catch((e) => { console.error('MongoDB connection fail:', e.message); process.exit(1) })
