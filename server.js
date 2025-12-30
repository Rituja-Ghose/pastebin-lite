const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { kv } = require('@vercel/kv');

const app = express();

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
app.get('/api/healthz', async (req, res) => {
  try {
    // Simple KV operation instead of ping (more reliable)
    await kv.set('healthcheck', 'ok', { ex: 5 });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
});

// Create a paste
app.post('/api/pastes', async (req, res) => {
  try {
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

    const pasteData = {
      content,
      expires_at: expires_at ? String(expires_at) : '',
      remaining_views: max_views !== undefined ? String(max_views) : '',
      created_at: String(now),
    };

    await kv.hset(`paste:${id}`, pasteData);

    if (ttl_seconds) {
      await kv.expire(`paste:${id}`, ttl_seconds);
    }

    res.json({
      id,
      url: `${req.protocol}://${req.get('host')}/p/${id}`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fetch paste (API)
app.get('/api/pastes/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const now = getNow(req);

    const paste = await kv.hgetall(`paste:${id}`);
    if (!paste || !paste.content) {
      return res.status(404).json({ error: 'Paste not found' });
    }

    const expiresAt = paste.expires_at ? Number(paste.expires_at) : null;
    const remainingViews =
      paste.remaining_views !== '' ? Number(paste.remaining_views) : null;

    if (
      (expiresAt && now > expiresAt) ||
      (remainingViews !== null && remainingViews <= 0)
    ) {
      return res.status(404).json({ error: 'Paste unavailable' });
    }

    if (remainingViews !== null) {
      await kv.hincrby(`paste:${id}`, 'remaining_views', -1);
    }

    res.json({
      content: paste.content,
      remaining_views:
        remainingViews !== null ? remainingViews - 1 : null,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// View paste (HTML)
app.get('/p/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const now = getNow(req);

    const paste = await kv.hgetall(`paste:${id}`);
    if (!paste || !paste.content) {
      return res.status(404).send('Paste not found');
    }

    const expiresAt = paste.expires_at ? Number(paste.expires_at) : null;
    const remainingViews =
      paste.remaining_views !== '' ? Number(paste.remaining_views) : null;

    if (
      (expiresAt && now > expiresAt) ||
      (remainingViews !== null && remainingViews <= 0)
    ) {
      return res.status(404).send('Paste unavailable');
    }

    if (remainingViews !== null) {
      await kv.hincrby(`paste:${id}`, 'remaining_views', -1);
    }

    res.render('paste', { content: paste.content });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// IMPORTANT: export app for Vercel (NO app.listen)
module.exports = app;