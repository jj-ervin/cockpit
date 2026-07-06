'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const { createApp } = require('../server');
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
