import initSqlJs from 'sql.js';
import fs from 'fs';

const SQL = await initSqlJs();
const db = new SQL.Database(fs.readFileSync('./src/database.sqlite'));

console.log('=== Direct query ===');
const users = db.exec('SELECT * FROM users');
console.log('Total users:', users[0]?.values?.length || 0);

if (users[0]?.values?.length > 0) {
  console.log('User columns:', users[0].columns);
  console.log('First user:', users[0].values[0]);
}

db.close();