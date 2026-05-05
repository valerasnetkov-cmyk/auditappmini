import http from 'http';

function login() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ email: 'admin@example.com', password: 'admin123' });
    const req = http.request({
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body).token); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function resolveNumber(token, number) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ number });
    const req = http.request({
      hostname: 'localhost',
      port: 3001,
      path: '/api/vehicles/resolve-number',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'Authorization': `Bearer ${token}`
      }
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

(async () => {
  try {
    console.log('Логин...');
    const token = await login();
    console.log('Тест кириллицы А012ХМ63...');
    const result = await resolveNumber(token, 'А012ХМ63');
    console.log('Результат:', result);
  } catch (e) {
    console.error('Ошибка:', e.message);
  }
})();
