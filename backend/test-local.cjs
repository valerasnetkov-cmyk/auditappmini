const http = require('http')

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ status: 'ok', time: new Date().toISOString() }))
})

server.listen(3001, '127.0.0.1', () => {
  console.log('Server started on http://127.0.0.1:3001')
  
  setTimeout(() => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3001,
      path: '/',
      method: 'GET'
    }, (res) => {
      console.log('Response status:', res.statusCode)
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        console.log('Response body:', data)
        server.close()
        process.exit(0)
      })
    })
    req.on('error', (e) => {
      console.log('Request error:', e.message)
      server.close()
      process.exit(1)
    })
    req.end()
  }, 1000)
})