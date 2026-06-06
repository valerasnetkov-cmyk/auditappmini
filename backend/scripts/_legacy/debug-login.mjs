import http from 'http';

const req = http.request({
  hostname: '127.0.0.1',
  port: 3001,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': 52
  }
}, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    try {
      console.log('Status:', res.statusCode);
      console.log('Body:', JSON.parse(body));
    } catch(e) {
      console.log('Raw:', body.substring(0, 500));
    }
  });
});

req.on('error', console.error);
req.write(JSON.stringify({ email: 'admin@example.com', password: 'admin123' }));
req.end();