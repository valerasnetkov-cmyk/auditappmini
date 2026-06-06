import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';

const dbPath = './src/database.sqlite';

const SQL = await initSqlJs();
const data = fs.readFileSync(dbPath);
const db = new SQL.Database(data);

console.log('=== Users table check ===');
const users = db.exec('SELECT * FROM users');
console.log('Raw users result:', JSON.stringify(users));

console.log('\n=== Pragma table_info(users) ===');
const info = db.exec("PRAGMA table_info(users)");
console.log('Columns:', JSON.stringify(info));

console.log('\n=== Raw INSERT test ===');
const userId = 'test-' + Date.now();
db.run(`INSERT INTO users (id, email, password, name, role, company_id) VALUES ('${userId}', 'test@test.com', 'x', 'Test', 'manager', 'default')`);
fs.writeFileSync(dbPath, db.export());
console.log('Inserted');

const users2 = db.exec('SELECT * FROM users');
console.log('After insert:', JSON.stringify(users2));

db.close();