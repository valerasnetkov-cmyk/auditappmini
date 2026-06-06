import initSqlJs from 'sql.js';
import fs from 'fs';
import bc from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const SQL = await initSqlJs();
const db = new SQL.Database(fs.readFileSync('./src/database.sqlite'));

// Add admin if not exists
const adminEmail = 'admin@example.com';
const existing = db.exec(`SELECT id FROM users WHERE email = '${adminEmail}'`);
if (!existing[0]?.values?.length) {
  const hash = bc.hashSync('admin123', 10);
  db.run(`INSERT INTO users (id, email, password, name, role, company_id) VALUES (?, ?, ?, ?, ?, ?)`,
    [uuidv4(), adminEmail, hash, 'Admin', 'manager', 'default']);
  console.log('Created admin');
}

// Ensure vehicles are Latin
const cars = ['ГАЗель Next', 'Соболь', 'Ford Transit', 'Mercedes Sprinter', 'Volkswagen Crafter'];
const existingVehicles = db.exec('SELECT COUNT(*) FROM vehicles')[0]?.values?.[0]?.[0] || 0;
if (existingVehicles < 5) {
  for (let i = 0; i < 5; i++) {
    const letter1 = 'ABEKMHOPCTYX'[Math.floor(Math.random() * 12)];
    const num3 = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
    const letter2 = 'ABEKMHOPCTYX'[Math.floor(Math.random() * 12)];
    const letter3 = 'ABEKMHOPCTYX'[Math.floor(Math.random() * 12)];
    const reg = String(Math.floor(Math.random() * 190) + 10).padStart(2, '0');
    const num = `${letter1}${num3}${letter2}${letter3}${reg}`;
    db.run(`INSERT INTO vehicles (id, number, name, status, region, company_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), num, cars[i % 5], 'active', 'Москва', 'default', new Date().toISOString()]);
  }
  console.log('Added vehicles');
}

const vehicles = db.exec('SELECT number FROM vehicles');
console.log('Vehicles (LATIN):', vehicles[0]?.values?.map(r => r[0]) || 'none');

fs.writeFileSync('./src/database.sqlite', db.export());
db.close();
