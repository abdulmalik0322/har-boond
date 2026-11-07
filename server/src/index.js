import 'dotenv/config'
import mongoose from 'mongoose'
import app from './app.js'

// Sirf entry point: mongoose connect karo, phir listen.
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
