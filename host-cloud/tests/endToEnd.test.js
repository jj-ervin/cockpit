'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const { createApp } = require('../server');
const { createTenantRegistry } = require('../tenantRegistry');
const { createProcessManager } = require('../processManager');
const session = require('../session');

const HOST_WEB_ENTRY = path.join(__dirname, '..', '..', 'host-web', 'index.js');
const VENV_PYTHON = path.join(__dirname, '..', '..', '.venv', 'Scripts', 'python.exe');

const SECRET = 'e2e-test-secret';

/**
 * Real end-to-end proof, not mocked: spawns an actual host-web (CKP.11.00)
 * child process against a real (empty, no .eco/) tenant workspace, using
 * this repo's own .venv (which has the cockpit Python package installed),
 * and drives a request through the full host-cloud stack - auth session,
 * processManager (the Docker stand-in this machine's platform forced, see
 * processManager.js), and the real HTTP proxy to that child - exactly as a
 * live deployment would, minus Docker itself and GitHub OAuth (session is
 * signed directly rather than obtained via a real OAuth round trip).
 */
test('a real request round-trips through host-cloud to a real spawned host-web instance and back', async (t) => {
  if (!fs.existsSync(VENV_PYTHON)) {
    t.skip('cockpit .venv not present in this checkout - skipping the real end-to-end test');
    return;
  }

  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cockpit-cloud-e2e-'));
  const registry = createTenantRegistry({ dataDir });
  const tenant = registry.createTenant({ githubId: 999, login: 'e2e-tenant' });

  const processManager = createProcessManager({
    hostWebEntry: HOST_WEB_ENTRY,
    pythonExecutable: VENV_PYTHON,
    readyTimeoutMs: 20000,
  });

  const app = createApp({ tenantRegistry: registry, sessionSecret: SECRET, github: {}, processManager });
  const httpServer = http.createServer(app);
  await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const { port } = httpServer.address();
  const base = `http://127.0.0.1:${port}`;

  try {
    const token = session.sign({ tenantId: tenant.id, secret: SECRET });
    const res = await fetch(`${base}/api/bridge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `cockpit_session=${token}` },
      body: JSON.stringify({ type: 'eco.cockpit.ready' }),
    });
    assert.equal(res.status, 200);
    const messages = await res.json();
    assert.equal(messages[0].type, 'eco.cockpit.state');
    // The real host-web instance was spawned with WORKSPACE_ROOT set to
    // this tenant's own registry-derived workspace path, not anything a
    // client could have supplied.
    assert.equal(messages[0].payload.state.workspaceRoot, tenant.workspacePath);

    // A second request reuses the already-running child (no second spawn),
    // proving ensureRunning's dedup path works against a real process too.
    const res2 = await fetch(`${base}/api/bridge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `cockpit_session=${token}` },
      body: JSON.stringify({ type: 'eco.cockpit.refresh' }),
    });
    assert.equal(res2.status, 200);
    assert.equal(processManager.listRunning().length, 1);
  } finally {
    processManager.stopAll();
    await new Promise((resolve) => httpServer.close(resolve));
  }
});
