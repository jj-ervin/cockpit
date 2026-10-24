'use strict';

// Real, non-mocked integration test: this is the "real host/UI wiring"
// surface the invoke_provider_command bridge operation was missing —
// everything else proved the Python bridge mechanics directly
// (`python -m cockpit.host_bridge`), but nothing exercised the actual HTTP
// path a browser-based Cockpit UI calls. This starts the real Express app,
// makes a real HTTP POST to /api/bridge, which spawns the real
// `python -m cockpit.host_bridge` process, which discovers and spawns a
// real (fixture) provider — the same chain a stranger's browser would
// drive, not an in-process stand-in for any piece of it.

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const { createApp } = require('../server');

const COCKPIT_ROOT = path.join(__dirname, '..', '..');
const COCKPIT_PYTHON = path.join(COCKPIT_ROOT, '.venv', 'Scripts', 'python.exe');

function installFakeProvider(marlinHome) {
  const versionDir = path.join(marlinHome, 'providers', 'fake', '1.0.0');
  fs.mkdirSync(versionDir, { recursive: true });

  const scriptPath = path.join(versionDir, 'fake_provider.py');
  fs.writeFileSync(
    scriptPath,
    [
      'import json, sys',
      'req = json.loads(sys.stdin.read())',
      'print(json.dumps({',
      "    'schema_version': 'cockpit-operation-result-v1',",
      "    'operation_id': req['operation_id'],",
      "    'provider_id': req['provider_id'],",
      "    'command_id': req['command_id'],",
      "    'status': 'succeeded',",
      "    'timestamp': '2026-08-05T00:00:00Z',",
      "    'data': {'echo': req['input']},",
      "    'evidence': [],",
      '}))',
    ].join('\n'),
    'utf-8',
  );

  const manifest = {
    schema_version: 'cockpit-provider-v1',
    id: 'fake',
    name: 'Fake',
    version: '1.0.0',
    transport: { kind: 'stdio-json', protocol: 'cockpit-provider-v1' },
    commands: [
      { id: 'fake.read', title: 'Read', action: 'read', mutation: false, placements: ['command-palette'] },
    ],
    views: [],
    capabilities: ['read'],
    permissions: [],
  };
  const manifestPath = path.join(versionDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest), 'utf-8');
  const manifestDigest = `sha256:${crypto.createHash('sha256').update(fs.readFileSync(manifestPath)).digest('hex')}`;

  const attestation = {
    schema_version: 'cockpit-provider-attestation-v1',
    provider_id: 'fake',
    provider_version: '1.0.0',
    manifest_digest: manifestDigest,
    package_digest: null,
    executable: COCKPIT_PYTHON,
    executable_digest: `sha256:${crypto.createHash('sha256').update(fs.readFileSync(scriptPath)).digest('hex')}`,
    executable_digest_target: scriptPath,
    args: [scriptPath],
    installed_at: '2026-08-05T00:00:00Z',
    installed_by: 'marlin',
    signature: null,
  };
  fs.writeFileSync(path.join(versionDir, 'attestation.json'), JSON.stringify(attestation), 'utf-8');
}

test(
  'POST /api/bridge invokeProviderCommand — real HTTP through a real spawned host_bridge to a real spawned provider',
  async (t) => {
    if (!fs.existsSync(COCKPIT_PYTHON)) {
      t.skip(`cockpit .venv not present at ${COCKPIT_PYTHON} — build it first`);
      return;
    }

    const marlinHome = fs.mkdtempSync(path.join(os.tmpdir(), 'cockpit-hostweb-provider-'));
    installFakeProvider(marlinHome);

    const app = createApp({ workspaceRoot: process.cwd(), pythonExecutable: COCKPIT_PYTHON });
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();

    const originalMarlinHome = process.env.COCKPIT_MARLIN_HOME;
    process.env.COCKPIT_MARLIN_HOME = marlinHome;

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/bridge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'eco.cockpit.invokeProviderCommand',
          providerId: 'fake',
          commandId: 'fake.read',
          input: { hello: 'world' },
          confirm: false,
        }),
      });
      const messages = await response.json();
      assert.equal(messages.length, 1);
      assert.equal(messages[0].type, 'eco.cockpit.providerCommandResult');
      assert.equal(messages[0].payload.status, 'succeeded');
      assert.deepEqual(messages[0].payload.data.echo, { hello: 'world' });
    } finally {
      if (originalMarlinHome === undefined) delete process.env.COCKPIT_MARLIN_HOME;
      else process.env.COCKPIT_MARLIN_HOME = originalMarlinHome;
      fs.rmSync(marlinHome, { recursive: true, force: true });
      await new Promise((resolve) => server.close(resolve));
    }
  },
);

test(
  'POST /api/bridge invokeProviderCommand — a mutating command without confirm is rejected end to end',
  async (t) => {
    if (!fs.existsSync(COCKPIT_PYTHON)) {
      t.skip(`cockpit .venv not present at ${COCKPIT_PYTHON} — build it first`);
      return;
    }

    const marlinHome = fs.mkdtempSync(path.join(os.tmpdir(), 'cockpit-hostweb-provider-mutate-'));
    const versionDir = path.join(marlinHome, 'providers', 'fake', '1.0.0');
    fs.mkdirSync(versionDir, { recursive: true });
    installFakeProvider(marlinHome);
    // Overwrite the manifest with a mutating, confirmation-gated command.
    const manifestPath = path.join(versionDir, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    manifest.commands.push({
      id: 'fake.mutate',
      title: 'Mutate',
      action: 'mutate',
      mutation: true,
      requires_confirmation: true,
      placements: ['command-palette'],
    });
    fs.writeFileSync(manifestPath, JSON.stringify(manifest), 'utf-8');
    const manifestDigest = `sha256:${crypto.createHash('sha256').update(fs.readFileSync(manifestPath)).digest('hex')}`;
    const attestationPath = path.join(versionDir, 'attestation.json');
    const attestation = JSON.parse(fs.readFileSync(attestationPath, 'utf-8'));
    attestation.manifest_digest = manifestDigest;
    fs.writeFileSync(attestationPath, JSON.stringify(attestation), 'utf-8');

    const app = createApp({ workspaceRoot: process.cwd(), pythonExecutable: COCKPIT_PYTHON });
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();

    const originalMarlinHome = process.env.COCKPIT_MARLIN_HOME;
    process.env.COCKPIT_MARLIN_HOME = marlinHome;

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/bridge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'eco.cockpit.invokeProviderCommand',
          providerId: 'fake',
          commandId: 'fake.mutate',
          input: {},
          confirm: 'false', // string, not boolean — the exact real bug this closure fixed
        }),
      });
      const messages = await response.json();
      // dispatch() catches bridge errors and reports actionResult(false, ...)
      assert.equal(messages[0].type, 'eco.cockpit.actionResult');
      assert.equal(messages[0].payload.ok, false);
      assert.match(messages[0].payload.message, /confirm must be a boolean/);
    } finally {
      if (originalMarlinHome === undefined) delete process.env.COCKPIT_MARLIN_HOME;
      else process.env.COCKPIT_MARLIN_HOME = originalMarlinHome;
      fs.rmSync(marlinHome, { recursive: true, force: true });
      await new Promise((resolve) => server.close(resolve));
    }
  },
);
