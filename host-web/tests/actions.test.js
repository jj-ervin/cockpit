'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { dispatch } = require('../actions');

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
    { artifactPath: '.eco\\artifacts\\a.json' },
    { workspaceRoot: WORKSPACE, deps },
  );
  assert.ok(openedPath.startsWith(WORKSPACE));
  assert.equal(messages[0].payload.ok, true);
});

test('openArtifact rejects a path that escapes the workspace root', async () => {
  const deps = makeDeps();
  const messages = await dispatch(
    'eco.cockpit.openArtifact',
    { artifactPath: '..\\..\\etc\\passwd' },
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
  const deps = makeDeps({ callBridge: async (request) => { captured = request; return { data: { query: request.input.query, packages: ['x'] } }; } });
  const messages = await dispatch(
    'eco.cockpit.marlinSearchPackages',
    { query: 'foo' },
    { workspaceRoot: WORKSPACE, deps },
  );
  assert.equal(messages[0].type, 'eco.cockpit.marlinPackageSearchResult');
  assert.deepEqual(messages[0].payload, { query: 'foo', packages: ['x'] });
  assert.equal(captured.operation, 'invoke_provider_command');
  assert.equal(captured.command_id, 'marlin.package.search');
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

test('invokeProviderCommand maps providerId/commandId/input/confirm onto the bridge request', async () => {
  let captured;
  const deps = makeDeps({ callBridge: async (req) => { captured = req; return { status: 'succeeded' }; } });
  const messages = await dispatch(
    'eco.cockpit.invokeProviderCommand',
    { providerId: 'marlin', commandId: 'marlin.audit.validate', input: { project: 'cockpit' }, confirm: true },
    { workspaceRoot: WORKSPACE, deps },
  );
  assert.equal(captured.backend, 'marlin');
  assert.equal(captured.workspace_id, WORKSPACE);
  assert.equal(captured.operation, 'invoke_provider_command');
  assert.equal(captured.command_id, 'marlin.audit.validate');
  assert.deepEqual(captured.input, { project: 'cockpit' });
  assert.equal(captured.confirm, true);
  assert.equal(messages[0].type, 'eco.cockpit.providerCommandResult');
  assert.equal(messages[0].payload.status, 'succeeded');
});

test('invokeProviderCommand coerces a non-boolean confirm to false, not truthy', () => {
  // Same real bug class this closure fixed at the Python layer — the
  // strict `=== true` check must survive the HTTP boundary too.
  const capturedValues = [];
  const deps = makeDeps({ callBridge: async (req) => { capturedValues.push(req.confirm); return {}; } });
  return Promise.all([
    dispatch('eco.cockpit.invokeProviderCommand', { providerId: 'p', commandId: 'c', confirm: 'false' }, { workspaceRoot: WORKSPACE, deps }),
    dispatch('eco.cockpit.invokeProviderCommand', { providerId: 'p', commandId: 'c', confirm: 1 }, { workspaceRoot: WORKSPACE, deps }),
    dispatch('eco.cockpit.invokeProviderCommand', { providerId: 'p', commandId: 'c' }, { workspaceRoot: WORKSPACE, deps }),
  ]).then(() => {
    assert.deepEqual(capturedValues, [false, false, false]);
  });
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
