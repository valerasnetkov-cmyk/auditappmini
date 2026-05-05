import initSqlJs from 'sql.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

const SQL = await initSqlJs();
const DB_PATH = path.resolve('./src/database.sqlite');

let db;
if (fs.existsSync(DB_PATH)) {
  db = new SQL.Database(fs.readFileSync(DB_PATH));
} else {
  db = new SQL.Database();
}

// Create tables if not exist
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    password_hash TEXT,
    name TEXT,
    role TEXT,
    company_id TEXT DEFAULT 'default',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS vehicles (
    id TEXT PRIMARY KEY,
    number TEXT,
    name TEXT,
    status TEXT,
    qr_code TEXT,
    region TEXT,
    company_id TEXT DEFAULT 'default',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_scheduled_inspection TEXT
  )
`);

// Create manager user directly
const managerId = uuidv4();
const passwordHash = '$2a$10$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYJrPE5Y/F6'; // admin123
try {
  db.run(`INSERT INTO users (id, email, password, name, role, company_id) VALUES (?, ?, ?, ?, ?, ?)`,
    [managerId, 'admin@example.com', passwordHash, 'Admin', 'manager', 'default']);
  console.log('Created manager user');
} catch(e) {
  console.log('User exists or error:', e.message);
}

// Seed vehicles with LATIN ONLY (NOT Cyrillic!)
const ALLOWED_LETTERS = 'ABEKMHOPCTYX';
const cars = ['ГАЗель Next', 'Соболь', 'Ford Transit', 'Mercedes Sprinter', 'Volkswagen Crafter'];

for (let i = 0; i < 5; i++) {
  const letter1 = ALLOWED_LETTERS[Math.floor(Math.random() * ALLOWED_LETTERS.length)];
  const num3 = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  const letter2 = ALLOWED_LETTERS[Math.floor(Math.random() * ALLOWED_LETTERS.length)];
  const letter3 = ALLOWED_LETTERS[Math.floor(Math.random() * ALLOWED_LETTERS.length)];
  const region = String(10 + Math.floor(Math.random() * 190)).padStart(2, '0');
  const num = `${letter1}${num3}${letter2}${letter3}${region}`;
  
  db.run(`INSERT INTO vehicles (id, number, name, status, qr_code, region, company_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuidv4(), num, cars[i % cars.length], 'active', cars[i % cars.length], 'Москва', 'default', new Date().toISOString()]);
}

// Save
fs.writeFileSync(DB_PATH, db.export());

const vehicles = db.exec(`SELECT number FROM vehicles LIMIT 5`);
console.log('Vehicles (LATIN):', vehicles[0]?.values?.map(r => r[0]) || []);

db.close();