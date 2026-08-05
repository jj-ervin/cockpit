'use strict';

const { callBridge } = require('./bridgeClient');

/**
 * Assembles one combined snapshot matching the exact shape
 * eco-vscode/src/webviewHost.ts's buildCockpitSnapshot() produces, so the
 * unmodified web/cockpit.js bundle (normalizeSnapshot/emptySnapshot) renders
 * it identically regardless of which host built it.
 */
async function buildSnapshot(workspaceRoot, { pythonExecutable, bridgeExecutable, bridge = callBridge } = {}) {
  const opts = { pythonExecutable, bridgeExecutable };
  const eco = (operation, extra = {}) => ({ backend: 'eco', workspace_id: workspaceRoot, operation, ...extra });
  const cockpit = (operation, extra = {}) => ({ backend: 'cockpit', workspace_id: '', operation, ...extra });
  const workspace = (operation, extra = {}) => ({ backend: 'workspace', workspace_id: workspaceRoot, operation, ...extra });
  const niji = (operation, extra = {}) => ({ backend: 'niji', workspace_id: '', operation, ...extra });
  const system = (operation, extra = {}) => ({ backend: 'system', operation, ...extra });

  try {
    const requests = [
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
      { backend: 'marlin', workspace_id: workspaceRoot, operation: 'invoke_provider_command', command_id: 'marlin.package.list', input: {}, confirm: false },
      niji('health'),
      niji('get_state'),
      niji('get_record', { record_type: 'palette-preview', record_id: 'sample' }),
      system('get_record', { record_type: 'environment', record_id: 'current' }),
    ];
    const batch = await bridge({ operation: 'batch', requests }, opts);
    if (!batch || !Array.isArray(batch.results) || batch.results.length !== requests.length) {
      throw new Error('cockpit.host_bridge returned an invalid batch result');
    }
    const required = (index) => {
      const entry = batch.results[index];
      if (!entry || entry.ok !== true) throw new Error((entry && entry.error && entry.error.message) || `bridge batch item ${index} failed`);
      return entry.result;
    };
    const optional = (index, data) => {
      const entry = batch.results[index];
      return entry && entry.ok === true
        ? entry.result
        : { data, error: { message: (entry && entry.error && entry.error.message) || `bridge batch item ${index} failed` } };
    };
    const state = required(0);
    const health = required(1);
    const runs = required(2);
    const escalations = required(3);
    const artifacts = required(4);
    const policies = required(5);
    const governance = required(6);
    const mode = required(7);
    const agentPipeline = required(8);
    const marlinReadiness = required(9);
    const marlinTree = required(10);
    const marlinRepoStatus = required(11);
    const marlinPackages = optional(12, {});
    const nijiHealth = optional(13, { reachable: false, status: 'degraded' });
    const nijiState = optional(14, {});
    const nijiPalette = optional(15, null);
    const systemEnvironment = required(16);

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
        error: (nijiHealth.error || nijiState.error || nijiPalette.error || {}).message || null,
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
