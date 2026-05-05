import 'dotenv/config';
import initSqlJs from 'sql.js';
import fs from 'fs';

const SQL = await initSqlJs();
const db = new SQL.Database(fs.readFileSync('./src/database.sqlite'));

const SQL_WRAPPER = {
  run: (...params) => {
    console.log('run params:', params);
    if (params.length > 0) {
      db.run(...params)
    } else {
      db.run()
    }
  },
  get: (...params) => {
    console.log('get params:', params);
    const stmt = db.prepare()
    if (params.length > 0) stmt.bind(...params)
    console.log('Step after bind:', stmt.step());
    if (stmt.step()) {
      const row = stmt.getAsObject()
      stmt.free()
      return row
    }
    stmt.free()
    return undefined
  },
};

const q = db.prepare('SELECT * FROM vehicles WHERE number = ? AND company_id = ?');
q.bind('K569MH28', 'default');
console.log('Direct:', q.step() ? q.getAsObject() : 'none');
q.free();

const q2 = SQL_WRAPPER.get('SELECT * FROM vehicles WHERE number = ? AND company_id = ?', 'K569MH28', 'default');
console.log('Wrapper:', q2);

db.close();