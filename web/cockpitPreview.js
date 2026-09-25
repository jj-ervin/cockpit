(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory;
  } else {
    root.CockpitPreview = factory();
  }
}(typeof window !== 'undefined' ? window : globalThis, function createCockpitPreview() {
  function staticPreviewSnapshot() {
    return {
      state: {
        detected: false,
        statusLabel: 'Preview',
        workspaceRoot: '',
        refreshedAt: new Date().toISOString(),
        backendState: {
          total_runs: 3,
          escalation_queue_depth: 1,
          run_counts: {
            queued: 1,
            running: 1,
            closed: 1,
          },
        },
        bridgeError: 'Static preview mode - no Cockpit host connected.',
        adapter: {
          backend: 'static',
          workspaceId: 'static-preview',
          nodeId: null,
        },
      },
      health: {
        status: 'preview',
        eco_root_present: false,
      },
      development: {
        installReadiness: {
          id: 'development-readiness',
          status: 'ready',
          mode: 'preview',
          requires_human_apply: true,
          preview_steps: [
            { name: 'Cockpit Python package', command: ['python', '-m', 'pip', 'install', '-e', 'C:\\dev\\cockpit'] },
            { name: 'Host bridge smoke', command: ['python', '-m', 'cockpit.host_bridge'] },
            { name: 'Explicit apply approval', command: ['python', '-m', 'cockpit.install_phase1', '--workspace', 'C:\\dev\\eco', '--apply'] },
          ],
          apply_command: ['python', '-m', 'cockpit.install_phase1', '--workspace', 'C:\\dev\\eco', '--apply'],
        },
      },
      workspace: {
        workspaceTree: {
          id: 'static-root',
          root: 'C:/dev',
          truncated: false,
          nodes: [
            { id: '.', name: 'dev', path: '.', kind: 'directory', depth: 0, skipped: false },
            { id: 'cockpit', name: 'cockpit', path: 'cockpit', kind: 'directory', depth: 1, skipped: false },
            { id: 'cockpit/web', name: 'web', path: 'cockpit/web', kind: 'directory', depth: 2, skipped: false },
            { id: 'cockpit/web/cockpit.html', name: 'cockpit.html', path: 'cockpit/web/cockpit.html', kind: 'file', depth: 3, skipped: false },
            { id: 'marlin', name: 'marlin', path: 'marlin', kind: 'directory', depth: 1, skipped: false },
            { id: 'eco-vscode', name: 'eco-vscode', path: 'eco-vscode', kind: 'directory', depth: 1, skipped: false },
            { id: 'node_modules', name: 'node_modules', path: 'node_modules', kind: 'directory', depth: 1, skipped: true },
          ],
        },
        repoStatus: [
          { name: 'cockpit', path: 'cockpit', git: 'clean', registered: true },
          { name: 'marlin', path: 'marlin', git: 'clean', registered: true },
          { name: 'eco-vscode', path: 'eco-vscode', git: 'clean', registered: true },
        ],
        error: null,
      },
      marlin: {
        health: { reachable: true, status: 'preview', provider_id: 'marlin' },
        error: null,
      },
      records: {
        runs: [
          { id: 'preview-run-1', state: 'running', updated_at: '2026-07-05T20:55:00Z', pass_name_or_id: 'CKP.09.05' },
          { id: 'preview-run-2', state: 'queued', updated_at: '2026-07-05T20:45:00Z', pass_name_or_id: 'CKP.09.06' },
          { id: 'preview-run-3', state: 'closed', updated_at: '2026-07-05T20:20:00Z', pass_name_or_id: 'CKP.08.09' },
        ],
        escalations: [
          { id: 'preview-escalation-1', reason: 'Confirm Marlin install before package mutation.' },
        ],
        artifacts: [
          { artifact_path: 'C:/dev/cockpit/.eco/artifacts/preview-readiness.json', kind: 'readiness', updated_at: '2026-07-05T20:55:00Z' },
        ],
        policies: [
          { id: 'preview-policy', mode: 'read-only-preview', rules: ['host-mediated-writes', 'path-containment'] },
        ],
      },
      governance: {
        diagnostics_present: true,
        governance_mode: 'preview',
        health_score: 0,
        hash_match: null,
        issues: [
          { severity: 'INFO', rule: 'preview-mode', message: 'Static browser preview is read-only.', file: 'cockpit/web/cockpit.html' },
        ],
      },
      mode: {
        current_mode: 'Navigator',
        available_modes: ['Navigator', 'Builder', 'Analyst', 'Historian', 'Operator'],
        history: [
          {
            previous_mode: null,
            current_mode: 'Navigator',
            time_loc: { version: 'time.loc/1.2', 'stamp.utc': '2026-07-05T20:00:00Z', 'geo.source': 'unavailable', sig: 'unsigned' },
          },
        ],
      },
      niji: {
        health: { status: 'preview' },
        state: { scheme_count: 3, default_base_hex: '#2f7d68' },
        palettePreview: {
          scheme: 'triadic',
          swatches: [
            { name: 'Base', role: 'primary', hex: '#2f7d68' },
            { name: 'Signal', role: 'accent', hex: '#b85c38' },
            { name: 'Focus', role: 'support', hex: '#5b6fb8' },
          ],
        },
        error: null,
      },
      diagnostics: {
        integrations: {
          eco: { status: 'preview', reachable: false },
          marlin: { status: 'ok', reachable: true },
          niji: { status: 'preview', reachable: true },
        },
        environment: {
          python: { version: '3.14.3', cockpit_version: '0.1.0' },
          node: { available: true, version: 'v24.14.1' },
        },
        agentPipeline: {
          source_present: true,
          total_entries: 2,
          agents: [
            { agent: 'claude', pass_count: 1, last_play_id: 'ckp-play-preview-001', last_status: 'closed', last_declared_at: '2026-07-05T20:55:00Z' },
            { agent: 'codex', pass_count: 1, last_play_id: 'ckp-play-preview-002', last_status: 'closed', last_declared_at: '2026-07-05T20:45:00Z' },
          ],
        },
      },
    };
  }

  return Object.freeze({
    staticSnapshot: staticPreviewSnapshot,
  });
}));
