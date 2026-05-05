import http from 'http';

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjgyMTkzMWIzLWE4NDMtNGE5Ny04NTE0LWM0NmFhMGM3MjAwYiIsImVtYWlsIjoiYWRtaW5AZXhhbXBsZS5jb20iLCJyb2xlIjoibWFuYWdlciIsIm5hbWUiOiLQkNC00LzQuNC90LjRgdGC0YDQsNGC0L7RgCIsImNvbXBhbnlfaWQiOiJkZWZhdWx0LWNvbXBhbnkiLCJpYXQiOjE3Nzc4ODMzNzEsImV4cCI6MTc3ODQ4ODE3MX0.U9o_vFJ53Y8QPN34QbtarWcu1vU7ZYePUJALfVhnmkY';

function makeRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  // Test 1: Login
  console.log('=== Test 1: Login ===');
  const loginData = JSON.stringify({ email: 'admin@example.com', password: 'admin123' });
  const loginResult = await makeRequest({
    hostname: '127.0.0.1', port: 3001, path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': loginData.length }
  }, loginData);
  console.log('Login status:', loginResult.status);
  const loginBody = JSON.parse(loginResult.body);
  console.log('Token received:', !!loginBody.token);

  // Test 2: Seed data
  console.log('\n=== Test 2: Seed Data ===');
  const seedData = JSON.stringify({ vehicles: 5, inspections: 10 });
  const seedResult = await makeRequest({
    hostname: '127.0.0.1', port: 3001, path: '/api/seed', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': seedData.length, 'Authorization': `Bearer ${loginBody.token}` }
  }, seedData);
  console.log('Seed status:', seedResult.status);
  console.log('Seed result:', seedResult.body);

  // Test 3: Resolve with Latin
  console.log('\n=== Test 3: Resolve Latin A012XM63 ===');
  const latinData = JSON.stringify({ number: 'A012XM63' });
  const latinResult = await makeRequest({
    hostname: '127.0.0.1', port: 3001, path: '/api/vehicles/resolve-number', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': latinData.length, 'Authorization': `Bearer ${loginBody.token}` }
  }, latinData);
  console.log('Latin resolve:', latinResult.body);

  // Test 4: Resolve with Cyrillic (main test!)
  console.log('\n=== Test 4: Resolve Cyrillic А012ХМ63 ===');
  const cyrillicData = JSON.stringify({ number: 'А012ХМ63' });
  console.log('Sent data:', cyrillicData);
  const cyrillicResult = await makeRequest({
    hostname: '127.0.0.1', port: 3001, path: '/api/vehicles/resolve-number', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(cyrillicData), 'Authorization': `Bearer ${loginBody.token}` }
  }, cyrillicData);
  console.log('Cyrillic resolve:', cyrillicResult.body);
}

main().catch(console.error);
