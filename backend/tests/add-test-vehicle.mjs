import initSqlJs from 'sql.js';
import fs from 'fs';

const SQL = await initSqlJs();
const db = new SQL.Database(fs.readFileSync('./src/database.sqlite'));

// Add a test vehicle that matches user input
// User types: К569МХ28 (plate with X)
// Transliterates to: K569MX28  
// Let's add this
db.run(`INSERT INTO vehicles (id, number, name, status, qr_code, region, company_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ['test-k569mx28', 'K569MX28', 'Test Car', 'active', 'Test', 'Moscow', 'default', new Date().toISOString()]);

fs.writeFileSync('./src/database.sqlite', db.export());
const v = db.exec('SELECT number FROM vehicles');
console.log('Vehicles:', v[0]?.values?.map(r => r[0]));
db.close();