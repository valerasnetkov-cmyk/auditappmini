import express from 'express'
import cors from 'cors'

const app = express()
const PORT = 3001

app.use(cors({
  origin: '*',
  credentials: true
}))
app.use(express.json())

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`)
  next()
})

app.get('/api/test', (req, res) => {
  res.json({ status: 'ok', message: 'Express working!' })
})

app.post('/api/auth/login', (req, res) => {
  console.log('Login body:', req.body)
  res.json({ success: true, token: 'test-token' })
})

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Server running on http://127.0.0.1:${PORT}`)
  console.log(`Test with: curl -X POST http://127.0.0.1:${PORT}/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"test\"}"`)
})