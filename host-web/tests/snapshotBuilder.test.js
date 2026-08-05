'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSnapshot } = require('../snapshotBuilder');

test('workspace and Cockpit readiness remain available when optional providers are missing', async () => {
  const bridgeExecutable = 'C:/installed/Cockpit/resources/bridge/cockpit-bridge.exe';
  const seenOptions = [];
  const executeSingle = async (request) => {
    if (request.operation === 'invoke_provider_command') throw new Error('provider not installed: marlin');
    if (request.backend === 'niji') throw new Error('provider not installed: niji');
    const origin = { backend: request.backend, workspace_id: request.workspace_id || '', node_id: null, timestamp: '2026-08-05T00:00:00Z' };
    if (request.backend === 'workspace' && request.record_type === 'workspace-tree') return { data: [{ id: 'root' }], origin };
    if (request.backend === 'workspace' && request.record_type === 'repo-status') return { data: [{ path: 'cockpit' }], origin };
    if (request.backend === 'cockpit') return { data: [{ id: 'phase1', panel: 'cockpit-development' }], origin };
    if (request.operation === 'list_records') return { data: [], origin };
    if (request.operation === 'get_state') return { data: {}, origin };
    if (request.operation === 'health') return { data: { reachable: true, status: 'ok' }, origin };
    return { data: {}, origin };
  };
  const bridge = async (request, options) => {
    seenOptions.push(options);
    assert.equal(request.operation, 'batch');
    const results = [];
    for (const item of request.requests) {
      try {
        results.push({ ok: true, result: await executeSingle(item) });
      } catch (error) {
        results.push({ ok: false, error: { type: error.name, message: error.message } });
      }
    }
    return { results };
  };
  const snapshot = await buildSnapshot('C:/workspace', { bridge, bridgeExecutable });
  assert.equal(snapshot.state.detected, true);
  assert.equal(snapshot.development.installReadiness.panel, 'cockpit-development');
  assert.equal(snapshot.workspace.workspaceTree.id, 'root');
  assert.equal(snapshot.workspace.repoStatus[0].path, 'cockpit');
  assert.equal(snapshot.marlin.health.reachable, false);
  assert.match(snapshot.marlin.health.error, /provider not installed/);
  assert.equal(snapshot.niji.health.reachable, false);
  assert.match(snapshot.niji.error, /provider not installed/);
  assert.ok(seenOptions.length > 0);
  assert.ok(seenOptions.every((options) => options.bridgeExecutable === bridgeExecutable));
});
