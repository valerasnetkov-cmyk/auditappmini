import initSqlJs from 'sql.js';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const SQL = await initSqlJs();
const db = new SQL.Database();

// Recreate fresh tables and data
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    company_id TEXT DEFAULT 'default'
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS vehicles (
    id TEXT PRIMARY KEY,
    number TEXT,
    name TEXT,
    status TEXT,
    region TEXT,
    company_id TEXT DEFAULT 'default',
    created_at TEXT
  )
`);

// Create admin
const hash = bcrypt.hashSync('admin123', 10);
db.run(`INSERT INTO users VALUES (?, ?, ?, ?, ?, ?)`, [uuidv4(), 'admin@example.com', hash, 'Admin', 'manager', 'default']);

// Create test vehicle - Latin only!
db.run(`INSERT INTO vehicles VALUES (?, ?, ?, ?, ?, ?, ?)`, [uuidv4(), 'K569MH28', 'Соболь', 'repair', 'Московская обл.', 'default', new Date().toISOString()]);

// Save
fs.writeFileSync('./src/database.sqlite', db.export());

const users = db.exec('SELECT email FROM users');
const vehicles = db.exec('SELECT number FROM vehicles');
console.log('Users:', users[0]?.values?.flat());
console.log('Vehicles:', vehicles[0]?.values?.flat());

db.close();
