import initSqlJs from 'sql.js';
import fs from 'fs';

const SQL = await initSqlJs();
const db = new SQL.Database(fs.readFileSync('./src/database.sqlite'));

const users = db.exec('SELECT email, company_id FROM users');
console.log('Users:', users[0]?.values || 'none');

const vehicles = db.exec('SELECT number FROM vehicles');
console.log('Vehicles:', vehicles[0]?.values?.map(r => r[0]) || 'none');

db.close();