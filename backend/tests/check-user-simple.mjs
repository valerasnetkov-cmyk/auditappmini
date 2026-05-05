import initSqlJs from 'sql.js';
import fs from 'fs';

const SQL = await initSqlJs();
const db = new SQL.Database(fs.readFileSync('./src/database.sqlite'));

// Check without bind
const stmt = db.prepare('SELECT * FROM users WHERE email = "admin@example.com"');
if (stmt.step()) {
  console.log('User found:', stmt.getAsObject());
} else {
  console.log('User NOT found');
}
stmt.free();

db.close();