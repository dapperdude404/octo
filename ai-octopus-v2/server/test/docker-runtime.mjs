import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import test, { before } from 'node:test';

const base = new URL(`http://127.0.0.1:${Number(process.env.OCTO_TEST_PORT || 3000)}`);
const webOrigin = 'https://dapperdude404.github.io';

function request(path, { method = 'GET', data, token, headers = {} } = {}) {
  const options = new Headers(headers);
  if (token) options.set('Authorization', `Bearer ${token}`);
  if (data) options.set('Content-Type', 'application/json');
  return fetch(new URL(path, base), {
    method, headers: options, redirect: 'error', signal: AbortSignal.timeout(4000),
    body: data ? JSON.stringify(data) : undefined
  });
}

async function json(path, status, options) {
  const response = await request(path, options);
  assert.equal(response.status, status, `${path} HTTP status`);
  assert.match(response.headers.get('content-type') ?? '', /^application\/json\b/);
  return response.json();
}

before(async () => {
  const deadline = Date.now() + 60_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const health = await json('/api/health', 200);
      assert.equal(health.service, 'octo-ai-api');
      return;
    } catch (error) {
      lastError = error;
      await delay(1000);
    }
  }
  throw new Error('The packaged Octo API did not start in 60 seconds.', { cause: lastError });
});

test('serves Studio and provides JSON for API routes', async () => {
  const app = await request('/');
  assert.equal(app.status, 200);
  assert.match(await app.text(), /<title>Octo AI Studio<\/title>/);
  assert.equal((await request('/assets/octo-logo.png')).status, 200);
  await json('/api/missing-release-check-route', 404);
  assert.deepEqual(await json('/api/auth/oauth/status', 200), { google: false, github: false });
  assert.deepEqual(await json('/api/scans/status', 200), {
    providers: { gptzero: false, winston: false, copyleaks: false }
  });
  assert.deepEqual(await json('/api/assistant/status', 200), {
    configured: false, requiresAccount: true
  });
});

test('allows sign-in requests from the web and packaged app origins', async () => {
  for (const origin of [webOrigin, 'https://localhost', 'octo://studio']) {
    const response = await request('/api/auth/login', {
      method: 'OPTIONS',
      headers: {
        Origin: origin, 'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,authorization'
      }
    });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-origin'), origin);
  }
});

test('accounts can sign in and see their own persisted scan results', async () => {
  const email = `release-${randomUUID()}@example.test`;
  const password = 'integration-test-password';
  const registration = await json('/api/auth/register', 201, { method: 'POST', data: { email, password } });
  await json('/api/auth/login', 401, { method: 'POST', data: { email, password: 'incorrect' } });
  const session = await json('/api/auth/login', 200, { method: 'POST', data: { email, password } });
  assert.equal(session.user.id, registration.user.id);
  const { token } = session;
  const account = await json('/api/auth/me', 200, { token });
  assert.equal(account.user.email, email);
  assert.equal(account.user.passwordHash, undefined);
  await json('/api/scans', 401);
  assert.deepEqual((await json('/api/scans', 200, { token })).scans, []);
  await json('/api/assistant', 503, { method: 'POST', data: { message: 'Test' }, token });

  const scan = await json('/api/scans', 201, {
    method: 'POST', token,
    data: {
      title: 'Release integration test', providers: ['gptzero'],
      text: 'This synthetic draft checks that the packaged API records a provider error and shows it in the correct account history.'
    }
  });
  const result = scan.results[0];
  assert.equal(result.provider, 'gptzero');
  assert.equal(result.status, 'error');
  const history = await json('/api/scans', 200, { token });
  assert.deepEqual(history.scans.map(record => record.id), [result.id]);

  const other = await json('/api/auth/register', 201, {
    method: 'POST', data: { email: `release-${randomUUID()}@example.test`, password }
  });
  assert.deepEqual((await json('/api/scans', 200, { token: other.token })).scans, []);
  await json(`/api/scans/${result.id}`, 404, { token: other.token });
});
