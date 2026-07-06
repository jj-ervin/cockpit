'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const { createApp, serializeCookie } = require('../server');
const { createTenantRegistry } = require('../tenantRegistry');

function makeTmpDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cockpit-cloud-server-test-'));
}

async function withServer(app, fn) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function extractCookie(res, name) {
  const setCookie = res.headers.get('set-cookie') || '';
  const match = setCookie.match(new RegExp(`${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

const SECRET = 'test-session-secret';

test('serializeCookie marks auth cookies Secure by default', () => {
  const cookie = serializeCookie('cockpit_session', 'abc123', { maxAgeSeconds: 3600 });
  assert.match(cookie, /; HttpOnly/);
  assert.match(cookie, /; SameSite=Lax/);
  assert.match(cookie, /; Secure/);
});

test('serializeCookie can omit Secure only when explicitly requested', () => {
  const cookie = serializeCookie('cockpit_session', 'abc123', { maxAgeSeconds: 3600, secure: false });
  assert.doesNotMatch(cookie, /; Secure/);
});

test('OAuth state and session cookies are Secure when set by the auth flow', async () => {
  const registry = createTenantRegistry({ dataDir: makeTmpDataDir() });
  const fetchFn = async (url) => {
    if (String(url).includes('access_token')) {
      return { json: async () => ({ access_token: 'github-token' }) };
    }
    return { json: async () => ({ id: 42, login: 'alice' }) };
  };
  const app = createApp({
    tenantRegistry: registry,
    sessionSecret: SECRET,
    github: { clientId: 'cid', clientSecret: 'secret', redirectUri: 'https://example.test/callback' },
    deps: { fetchFn, stateFn: () => 'fixed-state' },
  });

  await withServer(app, async (base) => {
    const loginRes = await fetch(`${base}/auth/github/login`, { redirect: 'manual' });
    const stateCookie = loginRes.headers.get('set-cookie') || '';
    assert.match(stateCookie, /oauth_state=fixed-state/);
    assert.match(stateCookie, /; Secure/);

    const callbackRes = await fetch(`${base}/auth/github/callback?code=c1&state=fixed-state`, {
      redirect: 'manual',
      headers: { Cookie: 'oauth_state=fixed-state' },
    });
    const sessionCookie = callbackRes.headers.get('set-cookie') || '';
    assert.match(sessionCookie, /cockpit_session=/);
    assert.match(sessionCookie, /; Secure/);
  });
});

test('POST /api/whoami without a session returns 401', async () => {
  const registry = createTenantRegistry({ dataDir: makeTmpDataDir() });
  const app = createApp({ tenantRegistry: registry, sessionSecret: SECRET, github: {} });
  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/whoami`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(res.status, 401);
  });
});

test('two distinct tenants resolve to two distinct workspaceRoot values via the same running server', async () => {
  const registry = createTenantRegistry({ dataDir: makeTmpDataDir() });
  const alice = registry.createTenant({ githubId: 1, login: 'alice' });
  const bob = registry.createTenant({ githubId: 2, login: 'bob' });
  const app = createApp({ tenantRegistry: registry, sessionSecret: SECRET, github: {} });

  const session = require('../session');
  const aliceToken = session.sign({ tenantId: alice.id, secret: SECRET });
  const bobToken = session.sign({ tenantId: bob.id, secret: SECRET });

  await withServer(app, async (base) => {
    const aliceRes = await fetch(`${base}/api/whoami`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `cockpit_session=${aliceToken}` },
      body: '{}',
    });
    const bobRes = await fetch(`${base}/api/whoami`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `cockpit_session=${bobToken}` },
      body: '{}',
    });
    const aliceBody = await aliceRes.json();
    const bobBody = await bobRes.json();
    assert.equal(aliceBody.workspaceRoot, alice.workspacePath);
    assert.equal(bobBody.workspaceRoot, bob.workspacePath);
    assert.notEqual(aliceBody.workspaceRoot, bobBody.workspaceRoot);
  });
});

test('a request cannot override its resolved workspaceRoot/tenant via the request body', async () => {
  const registry = createTenantRegistry({ dataDir: makeTmpDataDir() });
  const alice = registry.createTenant({ githubId: 1, login: 'alice' });
  const app = createApp({ tenantRegistry: registry, sessionSecret: SECRET, github: {} });

  const session = require('../session');
  const aliceToken = session.sign({ tenantId: alice.id, secret: SECRET });

  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/whoami`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `cockpit_session=${aliceToken}` },
      // An attacker-controlled body trying to redirect to another tenant's
      // workspace or claim a different tenantId entirely.
      body: JSON.stringify({ workspaceRoot: '/etc', tenantId: 'someone-elses-tenant-id' }),
    });
    const body = await res.json();
    assert.equal(body.workspaceRoot, alice.workspacePath);
    assert.equal(body.tenantId, alice.id);
  });
});

test('a session token for an unknown/deleted tenant is rejected', async () => {
  const registry = createTenantRegistry({ dataDir: makeTmpDataDir() });
  const app = createApp({ tenantRegistry: registry, sessionSecret: SECRET, github: {} });
  const session = require('../session');
  const ghostToken = session.sign({ tenantId: 'never-existed', secret: SECRET });

  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/whoami`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `cockpit_session=${ghostToken}` },
      body: '{}',
    });
    assert.equal(res.status, 401);
  });
});

function fakeProcessManager(portByTenant) {
  const calls = [];
  return {
    calls,
    ensureRunning: async (tenant) => { calls.push(tenant.id); return { port: portByTenant[tenant.id] }; },
    touch: () => {},
  };
}

test('POST /api/bridge proxies to the ensured tenant process and relays its messages', async () => {
  const registry = createTenantRegistry({ dataDir: makeTmpDataDir() });
  const alice = registry.createTenant({ githubId: 1, login: 'alice' });
  const processManager = fakeProcessManager({ [alice.id]: 9001 });
  let forwardedPort;
  const app = createApp({
    tenantRegistry: registry, sessionSecret: SECRET, github: {}, processManager,
    deps: { proxyForward: async ({ port }) => { forwardedPort = port; return [{ type: 'eco.cockpit.state', payload: {} }]; } },
  });
  const session = require('../session');
  const token = session.sign({ tenantId: alice.id, secret: SECRET });

  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/bridge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `cockpit_session=${token}` },
      body: JSON.stringify({ type: 'eco.cockpit.ready' }),
    });
    const body = await res.json();
    assert.equal(forwardedPort, 9001);
    assert.deepEqual(body, [{ type: 'eco.cockpit.state', payload: {} }]);
  });
});

test('POST /api/bridge rejects a write action from a read-only-scoped token with 403', async () => {
  const registry = createTenantRegistry({ dataDir: makeTmpDataDir() });
  const alice = registry.createTenant({ githubId: 1, login: 'alice' });
  const processManager = fakeProcessManager({ [alice.id]: 9002 });
  const app = createApp({
    tenantRegistry: registry, sessionSecret: SECRET, github: {}, processManager,
    deps: { proxyForward: async () => [{ type: 'eco.cockpit.actionResult', payload: { ok: true } }] },
  });
  const session = require('../session');
  const readOnlyToken = session.sign({ tenantId: alice.id, secret: SECRET, capabilities: ['read'] });

  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/bridge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `cockpit_session=${readOnlyToken}` },
      body: JSON.stringify({ type: 'eco.cockpit.submitRun', payload: {} }),
    });
    assert.equal(res.status, 403);
    assert.equal(processManager.calls.length, 0); // never even reached process spawn
  });
});

test('POST /api/bridge allows a read action from a read-only-scoped token', async () => {
  const registry = createTenantRegistry({ dataDir: makeTmpDataDir() });
  const alice = registry.createTenant({ githubId: 1, login: 'alice' });
  const processManager = fakeProcessManager({ [alice.id]: 9003 });
  const app = createApp({
    tenantRegistry: registry, sessionSecret: SECRET, github: {}, processManager,
    deps: { proxyForward: async () => [{ type: 'eco.cockpit.state', payload: {} }] },
  });
  const session = require('../session');
  const readOnlyToken = session.sign({ tenantId: alice.id, secret: SECRET, capabilities: ['read'] });

  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/bridge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `cockpit_session=${readOnlyToken}` },
      body: JSON.stringify({ type: 'eco.cockpit.ready' }),
    });
    assert.equal(res.status, 200);
  });
});

test('POST /api/bridge returns 429 once the rate limiter is exhausted', async () => {
  const registry = createTenantRegistry({ dataDir: makeTmpDataDir() });
  const alice = registry.createTenant({ githubId: 1, login: 'alice' });
  const processManager = fakeProcessManager({ [alice.id]: 9004 });
  const rateLimiter = { take: () => false };
  const app = createApp({
    tenantRegistry: registry, sessionSecret: SECRET, github: {}, processManager, rateLimiter,
    deps: { proxyForward: async () => [{ type: 'eco.cockpit.state', payload: {} }] },
  });
  const session = require('../session');
  const token = session.sign({ tenantId: alice.id, secret: SECRET });

  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/bridge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `cockpit_session=${token}` },
      body: JSON.stringify({ type: 'eco.cockpit.ready' }),
    });
    assert.equal(res.status, 429);
    assert.equal(processManager.calls.length, 0);
  });
});

test('POST /api/bridge returns 507 and skips the process/proxy call when a write action is over quota', async () => {
  const registry = createTenantRegistry({ dataDir: makeTmpDataDir() });
  const alice = registry.createTenant({ githubId: 1, login: 'alice' });
  fs.writeFileSync(path.join(alice.workspacePath, 'big.txt'), 'x'.repeat(1000));
  const processManager = fakeProcessManager({ [alice.id]: 9005 });
  const app = createApp({
    tenantRegistry: registry, sessionSecret: SECRET, github: {}, processManager,
    tenantDiskQuotaBytes: 100,
    deps: { proxyForward: async () => [{ type: 'eco.cockpit.actionResult', payload: { ok: true } }] },
  });
  const session = require('../session');
  const token = session.sign({ tenantId: alice.id, secret: SECRET });

  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/bridge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `cockpit_session=${token}` },
      body: JSON.stringify({ type: 'eco.cockpit.submitRun', payload: {} }),
    });
    assert.equal(res.status, 507);
    assert.equal(processManager.calls.length, 0);
  });
});

test('POST /api/tokens/readonly issues a token scoped to read only', async () => {
  const registry = createTenantRegistry({ dataDir: makeTmpDataDir() });
  const alice = registry.createTenant({ githubId: 1, login: 'alice' });
  const app = createApp({ tenantRegistry: registry, sessionSecret: SECRET, github: {} });
  const session = require('../session');
  const fullToken = session.sign({ tenantId: alice.id, secret: SECRET });

  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/tokens/readonly`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `cockpit_session=${fullToken}` },
      body: '{}',
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.capabilities, ['read']);
    const claims = session.verify(body.token, { secret: SECRET });
    assert.equal(claims.tenantId, alice.id);
    assert.deepEqual(claims.capabilities, ['read']);
  });
});

test('POST /api/tokens/readonly clamps an out-of-range ttlSeconds instead of honoring it verbatim', async () => {
  const registry = createTenantRegistry({ dataDir: makeTmpDataDir() });
  const alice = registry.createTenant({ githubId: 1, login: 'alice' });
  const app = createApp({ tenantRegistry: registry, sessionSecret: SECRET, github: {} });
  const session = require('../session');
  const fullToken = session.sign({ tenantId: alice.id, secret: SECRET });

  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/tokens/readonly`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `cockpit_session=${fullToken}` },
      body: JSON.stringify({ ttlSeconds: 999999999 }),
    });
    const body = await res.json();
    const claims = session.verify(body.token, { secret: SECRET, now: Date.now() });
    // Clamped to the 24h max, not the requested ~31.7 years.
    const expiresAt = new Date(body.expiresAt).getTime();
    assert.ok(expiresAt - Date.now() <= 24 * 60 * 60 * 1000 + 5000);
  });
});

test('POST /api/tokens/readonly requires an existing session', async () => {
  const registry = createTenantRegistry({ dataDir: makeTmpDataDir() });
  const app = createApp({ tenantRegistry: registry, sessionSecret: SECRET, github: {} });
  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/tokens/readonly`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    assert.equal(res.status, 401);
  });
});

test('a read-only token issued via /api/tokens/readonly can authenticate via Bearer header, no cookie needed', async () => {
  const registry = createTenantRegistry({ dataDir: makeTmpDataDir() });
  const alice = registry.createTenant({ githubId: 1, login: 'alice' });
  const app = createApp({ tenantRegistry: registry, sessionSecret: SECRET, github: {} });
  const session = require('../session');
  const fullToken = session.sign({ tenantId: alice.id, secret: SECRET });

  await withServer(app, async (base) => {
    const issueRes = await fetch(`${base}/api/tokens/readonly`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `cockpit_session=${fullToken}` },
      body: '{}',
    });
    const { token: readOnlyToken } = await issueRes.json();

    const whoamiRes = await fetch(`${base}/api/whoami`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${readOnlyToken}` },
      body: '{}',
    });
    assert.equal(whoamiRes.status, 200);
    const body = await whoamiRes.json();
    assert.equal(body.tenantId, alice.id);
  });
});

test('a read-only token used via Bearer still cannot invoke a write action', async () => {
  const registry = createTenantRegistry({ dataDir: makeTmpDataDir() });
  const alice = registry.createTenant({ githubId: 1, login: 'alice' });
  const processManager = fakeProcessManager({ [alice.id]: 9010 });
  const app = createApp({
    tenantRegistry: registry, sessionSecret: SECRET, github: {}, processManager,
    deps: { proxyForward: async () => [{ type: 'eco.cockpit.actionResult', payload: { ok: true } }] },
  });
  const session = require('../session');
  const readOnlyToken = session.sign({ tenantId: alice.id, secret: SECRET, capabilities: ['read'] });

  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/bridge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${readOnlyToken}` },
      body: JSON.stringify({ type: 'eco.cockpit.submitRun', payload: {} }),
    });
    assert.equal(res.status, 403);
  });
});
