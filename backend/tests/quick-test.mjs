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
  const loginRes = await makeRequest({
    hostname: '127.0.0.1', port: 3001, path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({ email: 'admin@example.com', password: 'admin123' }));

  if (!loginRes.body.token) {
    console.log('Login failed:', loginRes.body);
    return;
  }
  const token = loginRes.body.token;
  console.log('Logged in');

  const vehiclesRes = await makeRequest({
    hostname: '127.0.0.1', port: 3001, path: '/api/vehicles?limit=3', method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  console.log('Vehicles:', vehiclesRes.body.data?.map(v => v.number) || 'none');

  if (vehiclesRes.body.data?.length > 0) {
    const num = vehiclesRes.body.data[0].number;
    console.log(`\nTesting: ${num}`);

    const resolveRes = await makeRequest({
      hostname: '127.0.0.1', port: 3001, path: '/api/vehicles/resolve-number', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    }, JSON.stringify({ number: num }));

    console.log('Result:', JSON.stringify(resolveRes.body));
  }
}

main().catch(console.error);