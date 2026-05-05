import initSqlJs from 'sql.js';
import fs from 'fs';

const SQL = await initSqlJs();
const db = new SQL.Database(fs.readFileSync('./src/database.sqlite'));

// Correct: call step once
const stmt = db.prepare('SELECT * FROM vehicles WHERE number = ? AND company_id = ?');
stmt.bind(['K569MH28', 'default']);
const found = stmt.step();
console.log('Step (single call):', found);
if (found) {
  console.log('Row:', stmt.getAsObject());
} else {
  console.log('NOT found (array bind)');
}
stmt.free();

db.close();