import http from 'http';

const makeRequest = (options, data) => new Promise((resolve, reject) => {
  const req = http.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => resolve({ status: res.statusCode, body: body ? JSON.parse(body) : {} }));
  });
  req.on('error', reject);
  if (data) req.write(data);
  req.end();
});

async function main() {
  // Login
  const loginRes = await makeRequest({
    hostname: '127.0.0.1', port: 3001, path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({ email: 'admin@example.com', password: 'admin123' }));

  const token = loginRes.body.token;
  console.log('Token obtained');

  // Seed vehicles
  const seedRes = await makeRequest({
    hostname: '127.0.0.1', port: 3001, path: '/api/seed', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
  }, JSON.stringify({ vehicles: 5, inspections: 0 }));

  console.log('Seed result:', seedRes.body);
}

main().catch(console.error);