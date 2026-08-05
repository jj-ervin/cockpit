'use strict';

const { callBridge } = require('./bridgeClient');

/**
 * Assembles one combined snapshot matching the exact shape
 * eco-vscode/src/webviewHost.ts's buildCockpitSnapshot() produces, so the
 * unmodified web/cockpit.js bundle (normalizeSnapshot/emptySnapshot) renders
 * it identically regardless of which host built it.
 */
async function buildSnapshot(workspaceRoot, { pythonExecutable, bridge = callBridge } = {}) {
  const opts = { pythonExecutable };
  const eco = (operation, extra = {}) => bridge({ backend: 'eco', workspace_id: workspaceRoot, operation, ...extra }, opts);
  const cockpit = (operation, extra = {}) => bridge({ backend: 'cockpit', workspace_id: '', operation, ...extra }, opts);
  const workspace = (operation, extra = {}) => bridge({ backend: 'workspace', workspace_id: workspaceRoot, operation, ...extra }, opts);
  const niji = (operation, extra = {}) => bridge({ backend: 'niji', workspace_id: '', operation, ...extra }, opts);
  const system = (operation, extra = {}) => bridge({ backend: 'system', operation, ...extra }, opts);

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
      agentPipeline,
      marlinReadiness,
      marlinTree,
      marlinRepoStatus,
      marlinPackages,
      nijiHealth,
      nijiState,
      nijiPalette,
      systemEnvironment,
    ] = await Promise.all([
      eco('get_state'),
      eco('health'),
      eco('list_records', { record_type: 'run' }),
      eco('list_records', { record_type: 'escalation' }),
      eco('list_records', { record_type: 'artifact' }),
      eco('list_records', { record_type: 'policy' }),
      eco('get_record', { record_type: 'governance', record_id: 'diagnostics' }),
      eco('get_record', { record_type: 'mode', record_id: 'current' }),
      eco('get_record', { record_type: 'agent-pipeline', record_id: 'current' }),
      cockpit('list_records', { record_type: 'development-readiness', filters: { workspace: workspaceRoot } }),
      workspace('list_records', { record_type: 'workspace-tree', filters: { max_depth: 3, max_items: 500 } }),
      workspace('list_records', { record_type: 'repo-status', filters: { max_items: 200 } }),
      bridge({ backend: 'marlin', workspace_id: workspaceRoot, operation: 'invoke_provider_command', command_id: 'marlin.package.list', input: {}, confirm: false }, opts)
        .catch((error) => ({ status: 'failed', error: { message: error instanceof Error ? error.message : String(error) }, data: {} })),
      niji('health'),
      niji('get_state'),
      niji('get_record', { record_type: 'palette-preview', record_id: 'sample' }),
      system('get_record', { record_type: 'environment', record_id: 'current' }),
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
      development: {
        installReadiness: (marlinReadiness.data && marlinReadiness.data[0]) || null,
      },
      workspace: {
        workspaceTree: (marlinTree.data && marlinTree.data[0]) || null,
        repoStatus: marlinRepoStatus.data || [],
      },
      marlin: {
        health: marlinPackages.status === 'succeeded'
          ? { reachable: true, status: 'ok', provider_id: 'marlin' }
          : { reachable: false, status: 'degraded', provider_id: 'marlin', error: marlinPackages.error && marlinPackages.error.message },
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
      diagnostics: {
        integrations: { eco: health.data, marlin: marlinPackages.status === 'succeeded' ? { reachable: true, status: 'ok' } : { reachable: false, status: 'degraded', error: marlinPackages.error && marlinPackages.error.message }, niji: nijiHealth.data },
        environment: systemEnvironment.data,
        agentPipeline: agentPipeline.data,
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
      development: { installReadiness: null, error: message },
      workspace: { workspaceTree: null, repoStatus: [], error: message },
      marlin: { health: null, error: message },
      records: { runs: [], escalations: [], artifacts: [], policies: [] },
      governance: null,
      mode: null,
      niji: { health: null, state: null, palettePreview: null, error: message },
      diagnostics: {
        integrations: { eco: { reachable: false, status: 'degraded' }, marlin: null, niji: null },
        environment: null,
        agentPipeline: null,
        error: message,
      },
    };
  }
}

module.exports = { buildSnapshot };
