'use strict';

const { callBridge } = require('./bridgeClient');

/**
 * Assembles one combined snapshot matching the exact shape
 * eco-vscode/src/webviewHost.ts's buildCockpitSnapshot() produces, so the
 * unmodified web/cockpit.js bundle (normalizeSnapshot/emptySnapshot) renders
 * it identically regardless of which host built it.
 */
async function buildSnapshot(workspaceRoot, { pythonExecutable } = {}) {
  const opts = { pythonExecutable };
  const eco = (operation, extra = {}) => callBridge({ backend: 'eco', workspace_id: workspaceRoot, operation, ...extra }, opts);
  const marlin = (operation, extra = {}) => callBridge({ backend: 'marlin', workspace_id: '', operation, ...extra }, opts);
  const niji = (operation, extra = {}) => callBridge({ backend: 'niji', workspace_id: '', operation, ...extra }, opts);

  try {
    const [
      state,
      health,
      runs,
      escalations,
      artifacts,
      policies,
      governance,
      mode,
      marlinReadiness,
      marlinTree,
      marlinRepoStatus,
      nijiHealth,
      nijiState,
      nijiPalette,
    ] = await Promise.all([
      eco('get_state'),
      eco('health'),
      eco('list_records', { record_type: 'run' }),
      eco('list_records', { record_type: 'escalation' }),
      eco('list_records', { record_type: 'artifact' }),
      eco('list_records', { record_type: 'policy' }),
      eco('get_record', { record_type: 'governance', record_id: 'diagnostics' }),
      eco('get_record', { record_type: 'mode', record_id: 'current' }),
      marlin('list_records', { record_type: 'install-readiness', filters: { workspace: workspaceRoot } }),
      marlin('list_records', { record_type: 'workspace-tree', filters: { workspace_root: workspaceRoot, max_depth: 3, max_items: 500 } }),
      marlin('list_records', { record_type: 'repo-status', filters: { workspace_root: workspaceRoot, max_items: 200 } }),
      niji('health'),
      niji('get_state'),
      niji('get_record', { record_type: 'palette-preview', record_id: 'sample' }),
    ]);

    return {
      state: {
        workspaceRoot,
        detected: true,
        refreshedAt: state.origin.timestamp,
        adapter: { backend: state.origin.backend, workspaceId: state.origin.workspace_id, nodeId: state.origin.node_id },
        backendState: state.data,
      },
      health: health.data,
      marlin: {
        installReadiness: (marlinReadiness.data && marlinReadiness.data[0]) || null,
        workspaceTree: (marlinTree.data && marlinTree.data[0]) || null,
        repoStatus: marlinRepoStatus.data || [],
      },
      records: {
        runs: runs.data,
        escalations: escalations.data,
        artifacts: artifacts.data,
        policies: policies.data,
      },
      governance: governance.data,
      mode: mode.data,
      niji: {
        health: nijiHealth.data,
        state: nijiState.data,
        palettePreview: nijiPalette.data,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      state: {
        workspaceRoot,
        detected: false,
        refreshedAt: new Date().toISOString(),
        adapter: { backend: 'eco', workspaceId: workspaceRoot, nodeId: null },
        backendState: {},
        bridgeError: message,
      },
      health: { reachable: false, status: 'degraded' },
      marlin: { installReadiness: null, workspaceTree: null, repoStatus: [], error: message },
      records: { runs: [], escalations: [], artifacts: [], policies: [] },
      governance: null,
      mode: null,
      niji: { health: null, state: null, palettePreview: null, error: message },
    };
  }
}

module.exports = { buildSnapshot };
