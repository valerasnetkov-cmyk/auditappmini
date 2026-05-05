import initSqlJs from 'sql.js';
import fs from 'fs';
import bcrypt from 'bcryptjs';

const SQL = await initSqlJs();
const db = new SQL.Database(fs.readFileSync('./src/database.sqlite'));

const stmt = db.prepare("SELECT * FROM users WHERE email = 'admin@example.com'");
if (stmt.step()) {
  const user = stmt.getAsObject();
  console.log("User:", user.email);
  console.log("Hash:", user.password?.substring(0, 20));
  console.log("Verify admin123:", bcrypt.compareSync("admin123", user.password));
}
stmt.free();

db.close();