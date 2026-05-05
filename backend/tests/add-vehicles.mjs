import initSqlJs from 'sql.js';
import fs from 'fs';
import bc from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const SQL = await initSqlJs();
const db = new SQL.Database(fs.readFileSync('./src/database.sqlite'));

// Add Latin vehicles
const cars = ['ГАЗель Next', 'Соболь', 'Ford Transit'];
for (let i = 0; i < 5; i++) {
  const letter1 = 'ABEKMHOPCTYX'[Math.floor(Math.random() * 12)];
  const num3 = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  const letter2 = 'ABEKMHOPCTYX'[Math.floor(Math.random() * 12)];
  const letter3 = 'ABEKMHOPCTYX'[Math.floor(Math.random() * 12)];
  const reg = String(Math.floor(Math.random() * 190) + 10).padStart(2, '0');
  const num = `${letter1}${num3}${letter2}${letter3}${reg}`;
  db.run(`INSERT INTO vehicles (id, number, name, status, qr_code, region, company_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuidv4(), num, cars[i % 3], 'active', cars[i % 3], 'Москва', 'default', new Date().toISOString()]);
}

fs.writeFileSync('./src/database.sqlite', db.export());
const vehicles = db.exec('SELECT number FROM vehicles');
console.log('Vehicles (LATIN):', vehicles[0]?.values?.map(r => r[0]));
db.close();