const express = require('express');
const bodyParser = require('body-parser');
const db = require('./database');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Helper: current time (supports TEST_MODE)
function getNow(req) {
  if (process.env.TEST_MODE === '1' && req.headers['x-test-now-ms']) {
    return parseInt(req.headers['x-test-now-ms'], 10);
  }
  return Date.now();
}

/* ====== ROUTES ====== */

// Health check
app.get('/api/healthz', (req, res) => {
  db.get('SELECT 1', (err) => {
    if (err) return res.status(500).json({ ok: false });
    res.json({ ok: true });
  });
});

// Create a paste
app.post('/api/pastes', (req, res) => {
  const { content, ttl_seconds, max_views } = req.body;

  if (!content || typeof content !== 'string') {
    return res.status(400).json({ error: 'Content is required' });
  }
  if (ttl_seconds && (!Number.isInteger(ttl_seconds) || ttl_seconds < 1)) {
    return res.status(400).json({ error: 'ttl_seconds must be >= 1' });
  }
  if (max_views && (!Number.isInteger(max_views) || max_views < 1)) {
    return res.status(400).json({ error: 'max_views must be >= 1' });
  }

  const id = uuidv4();
  const now = Date.now();
  const expires_at = ttl_seconds ? now + ttl_seconds * 1000 : null;
  const remaining_views = max_views || null;

  db.run(
    `INSERT INTO pastes (id, content, expires_at, max_views, remaining_views, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, content, expires_at, max_views, remaining_views, now],
    function (err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({
        id,
        url: `${req.protocol}://${req.get('host')}/p/${id}`,
      });
    }
  );
});

// Fetch paste (API)
app.get('/api/pastes/:id', (req, res) => {
  const id = req.params.id;
  const now = getNow(req);

  db.get('SELECT * FROM pastes WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!row) return res.status(404).json({ error: 'Paste not found' });

    if ((row.expires_at && now > row.expires_at) ||
        (row.remaining_views !== null && row.remaining_views <= 0)) {
      return res.status(404).json({ error: 'Paste unavailable' });
    }

    // Decrement remaining_views if limited
    if (row.remaining_views !== null) {
      db.run('UPDATE pastes SET remaining_views = remaining_views - 1 WHERE id = ?', [id]);
    }

    res.json({
      content: row.content,
      remaining_views: row.remaining_views !== null ? row.remaining_views - 1 : null,
      expires_at: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    });
  });
});

// View paste (HTML)
app.get('/p/:id', (req, res) => {
  const id = req.params.id;
  const now = getNow(req);

  db.get('SELECT * FROM pastes WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).send('Server error');
    if (!row) return res.status(404).send('Paste not found');

    if ((row.expires_at && now > row.expires_at) ||
        (row.remaining_views !== null && row.remaining_views <= 0)) {
      return res.status(404).send('Paste unavailable');
    }

    // Decrement remaining_views if limited
    if (row.remaining_views !== null) {
      db.run('UPDATE pastes SET remaining_views = remaining_views - 1 WHERE id = ?', [id]);
    }

    res.render('paste', { content: row.content });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
