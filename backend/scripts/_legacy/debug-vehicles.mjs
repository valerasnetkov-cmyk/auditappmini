import initSqlJs from 'sql.js';
import fs from 'fs';

const SQL = await initSqlJs();
const db = new SQL.Database(fs.readFileSync('./src/database.sqlite'));

// Debug via exact SQL
const stmt = db.prepare("SELECT number, company_id FROM vehicles");
console.log('All vehicles:');
while (stmt.step()) {
  console.log(' -', stmt.getAsObject());
}
stmt.free();

db.close();