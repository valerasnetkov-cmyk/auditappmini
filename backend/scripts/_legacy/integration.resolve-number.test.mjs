import http from 'http';

const BASE_URL = 'http://127.0.0.1:3001';
let token = '';
let passed = 0;
let failed = 0;

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: body ? JSON.parse(body) : {} }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function test(name, input, expectedFound, expectedNormalized) {
  const data = JSON.stringify({ number: input });
  const res = await request({
    hostname: '127.0.0.1', port: 3001, path: '/api/vehicles/resolve-number', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), 'Authorization': `Bearer ${token}` }
  }, data);

  const found = res.body.found;
  const normalized = res.body.normalized_number;

  if (found === expectedFound && normalized === expectedNormalized) {
    console.log(`✅ ${name}: "${input}" → found=${found}, normalized="${normalized}"`);
    passed++;
  } else {
    console.log(`❌ ${name}: "${input}" → found=${found} (ожидалось ${expectedFound}), normalized="${normalized}" (ожидалось "${expectedNormalized}")`);
    failed++;
  }
}

async function main() {
  console.log('=== Интеграционные тесты: /api/vehicles/resolve-number ===\n');

  // Login
  const loginData = JSON.stringify({ email: 'admin@example.com', password: 'admin123' });
  const loginRes = await request({
    hostname: '127.0.0.1', port: 3001, path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(loginData) }
  }, loginData);

  if (!loginRes.body.token) {
    console.log('❌ Login failed:', loginRes.body);
    process.exit(1);
  }
  token = loginRes.body.token;
  console.log('✅ Login successful\n');

  // Seed data (short)
  const seedData = JSON.stringify({ vehicles: 10, inspections: 20 });
  await request({
    hostname: '127.0.0.1', port: 3001, path: '/api/seed', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(seedData), 'Authorization': `Bearer ${token}` }
  }, seedData);
  console.log('✅ Seed data created\n');

  // Get a real vehicle number from DB
  const vehiclesRes = await request({
    hostname: '127.0.0.1', port: 3001, path: '/api/vehicles?limit=1', method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!vehiclesRes.body.data || vehiclesRes.body.data.length === 0) {
    console.log('❌ No vehicles found');
    process.exit(1);
  }
  const realNumber = vehiclesRes.body.data[0].number; // e.g. "M128OH31"
  console.log(`Using real number: ${realNumber}\n`);

  // Convert to Cyrillic version for testing
  const latinToCyrillic = { A:'А', B:'В', E:'Е', K:'К', M:'М', H:'Н', O:'О', P:'Р', C:'С', T:'Т', Y:'У', X:'Х' };
  let cyrillicNumber = '';
  for (const ch of realNumber) {
    cyrillicNumber += latinToCyrillic[ch] || ch;
  }

  // Tests
  await test('Latin exact', realNumber, true, realNumber);
  await test('Cyrillic exact', cyrillicNumber, true, realNumber);
  await test('Mixed garbage', '!!!', false, '!!!');
  await test('Random Cyrillic', 'А999ОН99', false, 'A999OH99');
  await test('Random Latin', 'B888EK77', false, 'B888EK77');

  console.log(`\n=== Итоги: ${passed} пройдено, ${failed} провалено ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('Fatal:', e.message); process.exit(1); });
