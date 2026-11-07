import express from 'express'
import mongoose from 'mongoose'
import donorsRouter from './routes/donors.js'
import requestsRouter from './routes/requests.js'
import adminRouter from './routes/admin.js'
import { securityHeaders, corsWhitelist, notFound, errorHandler } from './middleware/security.js'

// Express app — yahan mongoose connect NAHI hota (index.js ka kaam hai),
// taake tests app ko apni test DB ke sath istemal kar saken.
const app = express()
app.disable('x-powered-by')
app.set('trust proxy', 1)

app.use(securityHeaders)
app.use(corsWhitelist)
app.use(express.json({ limit: '16kb' }))

app.get('/api/health', (req, res) => {
  const connected = mongoose.connection.readyState === 1
  const body = { ok: true, app: 'Har Boond', db: connected ? 'connected' : 'disconnected' }
  if (!connected) return res.status(503).json(body)
  return res.json(body)
})

app.use('/api/donors', donorsRouter)
app.use('/api/requests', requestsRouter)
app.use('/api/admin', adminRouter)

app.use(notFound)
app.use(errorHandler)

export default app
