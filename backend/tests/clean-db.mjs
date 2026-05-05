import initSqlJs from 'sql.js';
import fs from 'fs';

const SQL = await initSqlJs();
const db = new SQL.Database(fs.readFileSync('./src/database.sqlite'));

db.run(`DELETE FROM users WHERE email = 'test@test.com'`);
db.run(`DELETE FROM users WHERE email = 'admin@example.com'`);
db.run(`DELETE FROM vehicles`);

fs.writeFileSync('./src/database.sqlite', db.export());
console.log('Cleaned');

const count = db.exec(`SELECT count(*) FROM users`);
console.log('Users:', count[0]?.values?.[0]?.[0] || 0);

db.close();