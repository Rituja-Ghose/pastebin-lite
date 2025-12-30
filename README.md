# Pastebin-Lite

A lightweight Pastebin clone built with Node.js and SQLite.

## Features
- Create and share text pastes.
- Optional TTL and view-limit constraints.
- Deterministic testing mode via `TEST_MODE=1`.

## Tech Stack
- Node.js + Express
- SQLite
- EJS for HTML rendering

## Running Locally
1. Clone repo
2. Install dependencies: `npm install`
3. Start server: `node server.js`
4. Open `http://localhost:3000`

## Persistence
- SQLite database `pastes.db`.
- TTL and view-limits enforced in API logic.

## Notes
- Paste content safely escaped in HTML view.
- Deterministic time testing supported via `x-test-now-ms` header.
