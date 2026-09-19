'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { dispatch, timeoutMsForProviderCommand } = require('../actions');
const { DEFAULT_TIMEOUT_MS } = require('../bridgeClient');

const WORKSPACE = 'C:\\fake\\workspace';

function makeDeps(overrides = {}) {
  return {
    callBridge: overrides.callBridge || (async () => ({ data: {}, origin: {} })),
    buildSnapshot: overrides.buildSnapshot || (async () => ({ snapshot: true })),
    osOpen: overrides.osOpen || { openWithDefaultApp: async () => {}, revealInFileManager: async () => {} },
  };
}

test('ready/refresh return one eco.cockpit.state message with the built snapshot', async () => {
  const deps = makeDeps({ buildSnapshot: async (root) => ({ workspaceRoot: root }) });
  const messages = await dispatch('eco.cockpit.ready', {}, { workspaceRoot: WORKSPACE, deps });
  assert.equal(messages.length, 1);
  assert.equal(messages[0].type, 'eco.cockpit.state');
  assert.equal(messages[0].payload.workspaceRoot, WORKSPACE);
  assert.equal('installIntent' in messages[0].payload, false, 'no installIntent key when none was configured');
});

test('ready/refresh include installIntent in the payload when the host was launched with one', async () => {
  const deps = makeDeps({ buildSnapshot: async (root) => ({ workspaceRoot: root }) });
  const messages = await dispatch('eco.cockpit.ready', {}, { workspaceRoot: WORKSPACE, installIntent: 'sealdex', deps });
  assert.equal(messages[0].payload.installIntent, 'sealdex');
});

test('refresh includes installIntent on every response, not just the first (one-shot consumption is the bundle\'s job, not the host\'s)', async () => {
  const deps = makeDeps({ buildSnapshot: async (root) => ({ workspaceRoot: root }) });
  const messages = await dispatch('eco.cockpit.refresh', {}, { workspaceRoot: WORKSPACE, installIntent: 'sealdex', deps });
  assert.equal(messages[0].payload.installIntent, 'sealdex');
});

test('listProviderCommands relays the discovered provider command catalog', async () => {
  let captured;
  const catalog = {
    schema_version: 'cockpit-provider-command-catalog-v1',
    providers: [{
      id: 'fake',
      name: 'Fake',
      version: '1.0.0',
      commands: [{ id: 'fake.read', title: 'Read', action: 'read', mutation: false }],
    }],
  };
  const deps = makeDeps({ callBridge: async (request) => { captured = request; return { data: catalog }; } });
  const messages = await dispatch('eco.cockpit.listProviderCommands', {}, { workspaceRoot: WORKSPACE, deps });
  assert.deepEqual(captured, {
    backend: 'cockpit',
    workspace_id: WORKSPACE,
    operation: 'list_provider_commands',
  });
  assert.equal(messages[0].type, 'eco.cockpit.providerCommandCatalog');
  assert.deepEqual(messages[0].payload, catalog);
});


test('approveEscalation calls bridge approve and returns an actionResult', async () => {
  let captured;
  const deps = makeDeps({ callBridge: async (req) => { captured = req; return { data: {} }; } });
  const messages = await dispatch(
    'eco.cockpit.approveEscalation',
    { runId: 'r1', decision: 'approved', reason: 'looks fine' },
    { workspaceRoot: WORKSPACE, deps },
  );
  assert.equal(captured.operation, 'approve');
  assert.equal(captured.record_id, 'r1');
  assert.equal(captured.decision, 'approved');
  assert.equal(captured.reason, 'looks fine');
  assert.equal(messages[0].type, 'eco.cockpit.actionResult');
  assert.equal(messages[0].payload.ok, true);
});

test('approveEscalation with an invalid decision returns a failed actionResult, not a thrown error', async () => {
  const deps = makeDeps();
  const messages = await dispatch(
    'eco.cockpit.approveEscalation',
    { runId: 'r1', decision: 'maybe' },
    { workspaceRoot: WORKSPACE, deps },
  );
  assert.equal(messages[0].type, 'eco.cockpit.actionResult');
  assert.equal(messages[0].payload.ok, false);
  assert.match(messages[0].payload.message, /decision must be/);
});

test('deleteArtifact returns two messages in order: artifactDeleted then actionResult', async () => {
  const deps = makeDeps({ callBridge: async () => ({ data: { original_path: 'a', trash_path: 'b' } }) });
  const messages = await dispatch(
    'eco.cockpit.deleteArtifact',
    { artifactPath: 'a.json' },
    { workspaceRoot: WORKSPACE, deps },
  );
  assert.equal(messages.length, 2);
  assert.equal(messages[0].type, 'eco.cockpit.artifactDeleted');
  assert.deepEqual(messages[0].payload, { original_path: 'a', trash_path: 'b' });
  assert.equal(messages[1].type, 'eco.cockpit.actionResult');
  assert.equal(messages[1].payload.ok, true);
});

test('openArtifact resolves a contained path and calls osOpen.openWithDefaultApp, not a bridge call', async () => {
  let openedPath;
  const deps = makeDeps({ osOpen: { openWithDefaultApp: async (p) => { openedPath = p; }, revealInFileManager: async () => {} } });
  const messages = await dispatch(
    'eco.cockpit.openArtifact',
    { artifactPath: require('path').join('.eco', 'artifacts', 'a.json') },
    { workspaceRoot: WORKSPACE, deps },
  );
  assert.ok(openedPath.startsWith(WORKSPACE));
  assert.equal(messages[0].payload.ok, true);
});

test('openArtifact rejects a path that escapes the workspace root', async () => {
  const deps = makeDeps();
  const messages = await dispatch(
    'eco.cockpit.openArtifact',
    { artifactPath: require('path').join('..', '..', 'etc', 'passwd') },
    { workspaceRoot: WORKSPACE, deps },
  );
  assert.equal(messages[0].payload.ok, false);
  assert.match(messages[0].payload.message, /outside the active workspace/);
});

test('marlinInstallPackage denies requests without literal confirmation', async () => {
  const deps = makeDeps();
  const messages = await dispatch(
    'eco.cockpit.marlinInstallPackage',
    { packageName: 'some-pkg' },
    { workspaceRoot: WORKSPACE, deps },
  );
  assert.equal(messages[0].type, 'eco.cockpit.marlinInstallResult');
  assert.equal(messages[0].payload.ok, false);
  assert.match(messages[0].payload.error, /literal boolean confirmation/);
});

test('marlinSearchPackages invokes the Marlin provider', async () => {
  let captured;
  const deps = makeDeps({ callBridge: async (request) => { captured = request; return { status: 'succeeded', data: { query: request.input.query, packages: ['x'] } }; } });
  const messages = await dispatch(
    'eco.cockpit.marlinSearchPackages',
    { query: 'foo' },
    { workspaceRoot: WORKSPACE, deps },
  );
  assert.equal(messages[0].type, 'eco.cockpit.marlinPackageSearchResult');
  assert.deepEqual(messages[0].payload, { ok: true, query: 'foo', packages: ['x'] });
  assert.equal(captured.operation, 'invoke_provider_command');
  assert.equal(captured.command_id, 'marlin.package.search');
});

test('marlinSearchPackages surfaces a provider error distinctly from an empty result', async () => {
  const deps = makeDeps({ callBridge: async () => ({ status: 'failed', data: {}, error: { code: 'hosted-unreachable', message: 'hosted registry unreachable' } }) });
  const messages = await dispatch(
    'eco.cockpit.marlinSearchPackages',
    { query: 'sealdex' },
    { workspaceRoot: WORKSPACE, deps },
  );
  assert.deepEqual(messages[0].payload, { ok: false, error: 'hosted registry unreachable' });
});

test('marlinResolvePackage invokes the read-only resolve command with confirm:false', async () => {
  let captured;
  const deps = makeDeps({
    callBridge: async (request) => {
      captured = request;
      return {
        status: 'succeeded',
        data: {
          name: 'sealdex',
          version: '0.2.0',
          source: 'hosted',
          checksum: { algorithm: 'sha256', value: '880f5006...' },
          has_provider: true,
        },
      };
    },
  });
  const messages = await dispatch(
    'eco.cockpit.marlinResolvePackage',
    { packageName: 'sealdex' },
    { workspaceRoot: WORKSPACE, deps },
  );
  assert.equal(captured.operation, 'invoke_provider_command');
  assert.equal(captured.command_id, 'marlin.package.resolve');
  assert.equal(captured.confirm, false);
  assert.deepEqual(captured.input, { package_name: 'sealdex' });
  assert.equal(messages[0].type, 'eco.cockpit.marlinPackageResolveResult');
  assert.deepEqual(messages[0].payload, {
    ok: true,
    name: 'sealdex',
    version: '0.2.0',
    source: 'hosted',
    checksum: { algorithm: 'sha256', value: '880f5006...' },
    has_provider: true,
  });
});

test('marlinResolvePackage surfaces a not-found error', async () => {
  const deps = makeDeps({ callBridge: async () => ({ status: 'failed', data: {}, error: { code: 'package-not-found', message: 'package not found: nope' } }) });
  const messages = await dispatch(
    'eco.cockpit.marlinResolvePackage',
    { packageName: 'nope' },
    { workspaceRoot: WORKSPACE, deps },
  );
  assert.deepEqual(messages[0].payload, { ok: false, error: 'package not found: nope' });
});

test('marlinInstallPackage invokes the provider after literal confirmation', async () => {
  let captured;
  const deps = makeDeps({ callBridge: async (request) => { captured = request; return { status: 'succeeded', data: { package: { name: 'x' } } }; } });
  const messages = await dispatch(
    'eco.cockpit.marlinInstallPackage',
    { packageName: 'x', confirm: true },
    { workspaceRoot: WORKSPACE, deps },
  );
  assert.equal(captured.command_id, 'marlin.package.install');
  assert.equal(captured.confirm, true);
  assert.deepEqual(captured.input, { package_name: 'x' });
  assert.equal(messages[0].payload.ok, true);
});

test('setHelmMode returns ok:true with the bridge result merged in on success', async () => {
  const deps = makeDeps({ callBridge: async () => ({ data: { current_mode: 'Navigator', history: [] } }) });
  const messages = await dispatch('eco.cockpit.setHelmMode', { mode: 'Navigator' }, { workspaceRoot: WORKSPACE, deps });
  assert.equal(messages[0].type, 'eco.cockpit.setHelmModeResult');
  assert.equal(messages[0].payload.ok, true);
  assert.equal(messages[0].payload.current_mode, 'Navigator');
});

test('setHelmMode returns ok:false with an error message on bridge failure', async () => {
  const deps = makeDeps({ callBridge: async () => { throw new Error('mode must be one of [...]'); } });
  const messages = await dispatch('eco.cockpit.setHelmMode', { mode: 'Rogue' }, { workspaceRoot: WORKSPACE, deps });
  assert.equal(messages[0].type, 'eco.cockpit.setHelmModeResult');
  assert.equal(messages[0].payload.ok, false);
  assert.match(messages[0].payload.error, /mode must be one of/);
});

test('unhandled message types return an eco.cockpit.error message', async () => {
  const deps = makeDeps();
  const messages = await dispatch('eco.cockpit.somethingUnknown', {}, { workspaceRoot: WORKSPACE, deps });
  assert.equal(messages[0].type, 'eco.cockpit.error');
  assert.match(messages[0].payload.message, /Unhandled message type/);
});

test('invokeProviderCommand rejects a missing providerId before bridge execution', async () => {
  let called = false;
  const deps = makeDeps({ callBridge: async () => { called = true; } });
  const messages = await dispatch('eco.cockpit.invokeProviderCommand', {
    commandId: 'marlin.audit.validate', input: {}, confirm: false,
  }, { workspaceRoot: WORKSPACE, deps });
  assert.equal(called, false);
  assert.equal(messages[0].type, 'eco.cockpit.actionResult');
  assert.equal(messages[0].payload.ok, false);
  assert.match(messages[0].payload.message, /providerId/);
});

test('invokeProviderCommand rejects a non-boolean confirm before bridge execution', async () => {
  let called = false;
  const deps = makeDeps({ callBridge: async () => { called = true; } });
  const messages = await dispatch('eco.cockpit.invokeProviderCommand', {
    providerId: 'marlin', commandId: 'marlin.audit.validate', input: {}, confirm: 'false',
  }, { workspaceRoot: WORKSPACE, deps });
  assert.equal(called, false);
  assert.equal(messages[0].payload.ok, false);
  assert.match(messages[0].payload.message, /confirm must be a boolean/);
});

test('invokeProviderCommand rejects malformed approval before bridge execution', async () => {
  let called = false;
  const deps = makeDeps({ callBridge: async () => { called = true; } });
  const messages = await dispatch('eco.cockpit.invokeProviderCommand', {
    providerId: 'marlin', commandId: 'marlin.audit.apply', input: {}, confirm: true,
    approval: { token: 'a1' },
  }, { workspaceRoot: WORKSPACE, deps });
  assert.equal(called, false);
  assert.equal(messages[0].payload.ok, false);
  assert.match(messages[0].payload.message, /approval\.scope/);
});

test('invokeProviderCommand accepts a valid intent and forwards its approval unchanged', async () => {
  let captured;
  const deps = makeDeps({ callBridge: async (request) => { captured = request; return { status: 'succeeded' }; } });
  const messages = await dispatch('eco.cockpit.invokeProviderCommand', {
    providerId: 'marlin', commandId: 'marlin.audit.apply', input: { target: 'x' }, confirm: true,
    approval: { token: 'a1', scope: 'scope-1' },
  }, { workspaceRoot: WORKSPACE, deps });
  assert.equal(captured.backend, 'marlin');
  assert.deepEqual(captured.approval, { token: 'a1', scope: 'scope-1' });
  assert.equal(messages[0].payload.status, 'succeeded');
});

test('invokeProviderCommand maps providerId/commandId/input/confirm onto the bridge request', async () => {
  let captured;
  const deps = makeDeps({ callBridge: async (req) => { captured = req; return { status: 'succeeded' }; } });
  const messages = await dispatch(
    'eco.cockpit.invokeProviderCommand',
    { providerId: 'marlin', commandId: 'marlin.audit.validate', input: { project: 'cockpit' }, confirm: true, approval: { token: 'a1', scope: 'scope-1' } },
    { workspaceRoot: WORKSPACE, deps },
  );
  assert.equal(captured.backend, 'marlin');
  assert.equal(captured.workspace_id, WORKSPACE);
  assert.equal(captured.operation, 'invoke_provider_command');
  assert.equal(captured.command_id, 'marlin.audit.validate');
  assert.deepEqual(captured.input, { project: 'cockpit' });
  assert.equal(captured.confirm, true);
  assert.deepEqual(captured.approval, { token: 'a1', scope: 'scope-1' });
  assert.equal(messages[0].type, 'eco.cockpit.providerCommandResult');
  assert.equal(messages[0].payload.status, 'succeeded');
});

test('invokeProviderCommand rejects non-boolean confirmation values', async () => {
  const deps = makeDeps({ callBridge: async () => { throw new Error('bridge should not be called'); } });
  for (const confirm of ['false', 1, undefined]) {
    const message = { providerId: 'p', commandId: 'c' };
    if (confirm !== undefined) message.confirm = confirm;
    const messages = await dispatch('eco.cockpit.invokeProviderCommand', message, { workspaceRoot: WORKSPACE, deps });
    assert.equal(messages[0].type, 'eco.cockpit.actionResult');
    assert.equal(messages[0].payload.ok, false);
    assert.match(messages[0].payload.message, /confirm must be a boolean/);
  }
});

test('timeoutMsForProviderCommand gives agents.run.execute a much longer budget than the bridge default', () => {
  assert.equal(timeoutMsForProviderCommand('marlin.doctor.agents.run.execute'), 11 * 60 * 1000);
  assert.equal(timeoutMsForProviderCommand('marlin.audit.validate'), DEFAULT_TIMEOUT_MS);
});

test('invokeProviderCommand passes a long timeoutMs to the bridge for marlin.doctor.agents.run.execute', async () => {
  let capturedOpts;
  const deps = makeDeps({ callBridge: async (req, opts) => { capturedOpts = opts; return { status: 'succeeded' }; } });
  await dispatch(
    'eco.cockpit.invokeProviderCommand',
    { providerId: 'marlin', commandId: 'marlin.doctor.agents.run.execute', input: { run_id: 'r1', plan_digest: 'sha256:x' } },
    { workspaceRoot: WORKSPACE, deps },
  );
  assert.equal(capturedOpts.timeoutMs, 11 * 60 * 1000);
});

test('invokeProviderCommand keeps the bridge default timeout for ordinary commands', async () => {
  let capturedOpts;
  const deps = makeDeps({ callBridge: async (req, opts) => { capturedOpts = opts; return { status: 'succeeded' }; } });
  await dispatch(
    'eco.cockpit.invokeProviderCommand',
    { providerId: 'marlin', commandId: 'marlin.audit.validate', input: {} },
    { workspaceRoot: WORKSPACE, deps },
  );
  assert.equal(capturedOpts.timeoutMs, DEFAULT_TIMEOUT_MS);
});

test('invokeProviderCommand missing commandId returns a failed actionResult, not a thrown error', async () => {
  const deps = makeDeps();
  const messages = await dispatch(
    'eco.cockpit.invokeProviderCommand',
    { providerId: 'marlin' },
    { workspaceRoot: WORKSPACE, deps },
  );
  assert.equal(messages[0].type, 'eco.cockpit.actionResult');
  assert.equal(messages[0].payload.ok, false);
  assert.match(messages[0].payload.message, /commandId/);
});



