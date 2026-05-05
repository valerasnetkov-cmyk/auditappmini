import initSqlJs from 'sql.js';
import fs from 'fs';

const SQL = await initSqlJs();
const db = new SQL.Database(fs.readFileSync('./src/database.sqlite'));

const stmt = db.prepare('SELECT company_id FROM users WHERE email = ?');
stmt.bind(['admin@example.com']);
if (stmt.step()) {
  console.log('User:', stmt.getAsObject());
}
stmt.free();

db.close();