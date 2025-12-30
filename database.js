const sqlite3 = require('sqlite3').verbose();

const dbPath =
  process.env.VERCEL === '1'
    ? '/tmp/pastes.db'
    : './pastes.db';

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('SQLite error:', err);
  } else {
    console.log('Connected to SQLite:', dbPath);
  }
});

module.exports = db;
