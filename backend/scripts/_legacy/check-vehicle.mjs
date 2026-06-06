import initSqlJs from 'sql.js';
import fs from 'fs';

const SQL = await initSqlJs();
const db = new SQL.Database(fs.readFileSync('./src/database.sqlite'));

const num = 'K569MH28';
const company = 'default';

const exact = db.exec(`SELECT number, company_id, id FROM vehicles WHERE number = '${num}'`);
console.log('Exact K569MH28:', JSON.stringify(exact));

const stmt = db.prepare(`SELECT * FROM vehicles WHERE number = ? AND company_id = ?`);
stmt.bind([num, company]);
console.log('Step:', stmt.step());
if (stmt.step()) {
  console.log('Row:', stmt.getAsObject());
}
stmt.free();

db.close();