import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../src/database.sqlite');
const SQL = await initSqlJs();

console.log('Reading:', DB_PATH);
console.log('Exists:', fs.existsSync(DB_PATH));

const data = fs.readFileSync(DB_PATH);
console.log('Size:', data.length);

const db = new SQL.Database(data);

console.log('--- SQL ---');
const sql = db.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'");
console.log('Create users:', sql[0]?.values?.[0]?.[0] || 'none');

const rows = db.exec("SELECT count(*) FROM users");
console.log('Total users:', rows[0]?.values?.[0]?.[0]);

db.close();