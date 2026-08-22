'use strict';

/**
 * Server-level proof of the constrained install-mode surface: GET /install
 * serves web/install.html (not web/cockpit.html), with the target package
 * name baked in as window.__installIntent rather than left for a snapshot
 * round trip. Browser-level behavior (auto-resolve, approval fields,
 * Install -> confirm:true, success state, no full-shell DOM) is covered
 * separately in webInstallMode.test.js.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { createApp } = require('../server');

function startServer(installIntent) {
  const app = createApp({ workspaceRoot: process.cwd(), installIntent });
  const server = http.createServer(app);
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function get(server, urlPath) {
  const { port } = server.address();
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}${urlPath}`, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });
}

test('GET /install serves the minimal install page, not the full shell', async () => {
  const server = await startServer('sealdex');
  try {
    const { status, body } = await get(server, '/install');
    assert.equal(status, 200);
    assert.match(body, /<title>Install<\/title>/);
    assert.match(body, /id="install-actions"/);
    assert.doesNotMatch(body, /data-tab="wizard"/, 'install page must never contain full-shell tab markup');
    assert.doesNotMatch(body, /data-tab="dashboard"/);
  } finally {
    server.close();
  }
});

test('GET /install bakes the install intent directly into the page', async () => {
  const server = await startServer('sealdex');
  try {
    const { body } = await get(server, '/install');
    assert.match(body, /window\.__installIntent = "sealdex";/);
  } finally {
    server.close();
  }
});

test('GET /install with no install intent renders an empty target rather than throwing', async () => {
  const server = await startServer(null);
  try {
    const { status, body } = await get(server, '/install');
    assert.equal(status, 200);
    assert.match(body, /window\.__installIntent = "";/);
  } finally {
    server.close();
  }
});

test('GET / still serves the full shell, unaffected by the /install route', async () => {
  const server = await startServer('sealdex');
  try {
    const { status, body } = await get(server, '/');
    assert.equal(status, 200);
    assert.match(body, /data-tab="wizard"/);
  } finally {
    server.close();
  }
});
