import express from 'express'
import cors from 'cors'
import http from 'http'

const app = express()
const PORT = 3001

app.use(cors())
app.use(express.json())

app.get('/api/test', (req, res) => {
  res.json({ status: 'ok', message: 'Express working!' })
})

app.post('/api/auth/login', (req, res) => {
  console.log('Login request:', req.body)
  res.json({ success: true, token: 'test-token' })
})

const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`Server running on http://127.0.0.1:${PORT}`)
})

setTimeout(() => {
  const req = http.request({
    hostname: '127.0.0.1',
    port: PORT,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, (res) => {
    console.log('Status:', res.statusCode)
    let data = ''
    res.on('data', chunk => data += chunk)
    res.on('end', () => {
      console.log('Body:', data)
      server.close()
    })
  })
  req.on('error', e => console.log('Error:', e.message))
  req.write(JSON.stringify({ email: 'test@test.com', password: '123' }))
  req.end()
}, 2000)