const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'pastes.db'), (err) => {
  if (err) {
    console.error('Could not connect to DB', err);
  } else {
    console.log('Connected to SQLite DB');
  }
});

db.run(`
  CREATE TABLE IF NOT EXISTS pastes (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    expires_at INTEGER,
    max_views INTEGER,
    remaining_views INTEGER,
    created_at INTEGER NOT NULL
  )
`);

module.exports = db;
