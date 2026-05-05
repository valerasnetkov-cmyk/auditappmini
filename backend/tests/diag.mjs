import 'dotenv/config';
import { initDatabase } from '../src/db.js';

await initDatabase();

const { getDb } = await import('../src/db.js');
const db = getDb();

const users = db.prepare('SELECT * FROM users').all();
console.log('All users:', JSON.stringify(users, null, 2));

const count = db.prepare('SELECT count(*) as cnt FROM users').get();
console.log('Count:', count);