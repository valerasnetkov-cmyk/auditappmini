import express from 'express'
import cors from 'cors'
import http from 'http'

const app = express()
app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
  res.json({ status: 'ok' })
})

const server = app.listen(3001, '0.0.0.0', () => {
  console.log('Server running on port 3001')
})

setTimeout(() => {
  const address = server.address()
  console.log('Address:', address)
  server.close()
}, 2000)