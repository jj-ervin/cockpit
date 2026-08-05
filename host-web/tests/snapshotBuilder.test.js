'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSnapshot } = require('../snapshotBuilder');

test('workspace and Cockpit readiness remain available when the Marlin provider is missing', async () => {
  const bridge = async (request) => {
    if (request.operation === 'invoke_provider_command') throw new Error('provider not installed: marlin');
    const origin = { backend: request.backend, workspace_id: request.workspace_id || '', node_id: null, timestamp: '2026-08-05T00:00:00Z' };
    if (request.backend === 'workspace' && request.record_type === 'workspace-tree') return { data: [{ id: 'root' }], origin };
    if (request.backend === 'workspace' && request.record_type === 'repo-status') return { data: [{ path: 'cockpit' }], origin };
    if (request.backend === 'cockpit') return { data: [{ id: 'phase1', panel: 'cockpit-development' }], origin };
    if (request.operation === 'list_records') return { data: [], origin };
    if (request.operation === 'get_state') return { data: {}, origin };
    if (request.operation === 'health') return { data: { reachable: true, status: 'ok' }, origin };
    return { data: {}, origin };
  };
  const snapshot = await buildSnapshot('C:/workspace', { bridge });
  assert.equal(snapshot.state.detected, true);
  assert.equal(snapshot.development.installReadiness.panel, 'cockpit-development');
  assert.equal(snapshot.workspace.workspaceTree.id, 'root');
  assert.equal(snapshot.workspace.repoStatus[0].path, 'cockpit');
  assert.equal(snapshot.marlin.health.reachable, false);
  assert.match(snapshot.marlin.health.error, /provider not installed/);
});
