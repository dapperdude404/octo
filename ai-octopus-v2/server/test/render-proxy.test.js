import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import rateLimit from 'express-rate-limit';

// Isolated integration test for the same proxy and rate-limiter configuration
// used by the Render service; no database or external providers are required.
test('one trusted proxy hop honors forwarded client IP for rate limiting', async () => {
  const app = express();
  app.set('trust proxy', 1);
  app.use('/api', rateLimit({
    windowMs: 60_000, limit: 1, standardHeaders: 'draft-8',
    legacyHeaders: false,
  }));
  app.get('/api/ping', (req, res) => res.json({ ip: req.ip }));
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/ping`;
    const get = (ip) => fetch(base, { headers: { 'X-Forwarded-For': ip } });
    const first = await get('198.51.100.10');
    assert.equal(first.status, 200);
    assert.equal((await first.json()).ip, '198.51.100.10');
    const second = await get('198.51.100.10');
    assert.equal(second.status, 429);
    const other = await get('198.51.100.11');
    assert.equal(other.status, 200);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  }
});
