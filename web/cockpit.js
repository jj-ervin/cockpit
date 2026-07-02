(function () {
  // Host-agnostic bundle. Any host (VS Code, Electron, browser) must set
  // `window.cockpitHost = { postMessage(msg) {...} }` before this script runs,
  // and deliver host->bundle messages via `window.postMessage(data, "*")` so
  // this bundle's own `window.addEventListener('message', ...)` picks them up.
  // See docs/specifications/CKP.08-host-loader-contract.md for the full
  // contract. VS Code's loader wraps `acquireVsCodeApi()`; that call and any
  // other host-specific API must never appear in this file.
  const host = window.cockpitHost;
  if (!host || typeof host.postMessage !== 'function') {
    throw new Error('cockpit.js requires window.cockpitHost.postMessage to be set by the host loader before this script runs');
  }

  const elements = {
    refresh: document.getElementById('refresh'),
    status: document.getElementById('status'),
    totalRuns: document.getElementById('total-runs'),
    escalations: document.getElementById('escalations'),
    artifacts: document.getElementById('artifacts'),
    health: document.getElementById('health'),
    ecoRoot: document.getElementById('eco-root'),
    backend: document.getElementById('backend'),
    workspace: document.getElementById('workspace'),
    runCounts: document.getElementById('run-counts'),
    runStateCount: document.getElementById('run-state-count'),
    records: document.getElementById('records'),
    marlinStatus: document.getElementById('marlin-status'),
    marlinSteps: document.getElementById('marlin-steps'),
    marlinApplyCommand: document.getElementById('marlin-apply-command'),
    marlinApply: document.getElementById('marlin-apply'),
    marlinApproval: document.getElementById('marlin-approval'),
    footer: document.getElementById('footer'),
  };

  elements.refresh.addEventListener('click', function () {
    host.postMessage({ type: 'eco.cockpit.refresh' });
  });

  window.addEventListener('message', function (event) {
    const message = event.data;
    if (!message || message.type !== 'eco.cockpit.state') {
      return;
    }
    renderSnapshot(message.payload);
  });

  host.postMessage({ type: 'eco.cockpit.ready' });

  function renderSnapshot(payload) {
    const state = payload && payload.state ? payload.state : {};
    const backendState = state.backendState || {};
    const health = payload && payload.health ? payload.health : {};
    const records = payload && payload.records ? payload.records : emptyRecords();
    const marlin = payload && payload.marlin ? payload.marlin : {};
    const runCounts = backendState.run_counts || {};

    elements.status.textContent = state.detected ? 'Detected' : 'Not detected';
    elements.totalRuns.textContent = String(backendState.total_runs || 0);
    elements.escalations.textContent = String(backendState.escalation_queue_depth || records.escalations.length || 0);
    elements.artifacts.textContent = String(records.artifacts.length || 0);
    elements.health.textContent = health.status || '-';
    elements.ecoRoot.textContent = yesNo(health.eco_root_present);
    elements.backend.textContent = state.adapter ? state.adapter.backend : '-';
    elements.workspace.textContent = state.adapter && state.adapter.workspaceId
      ? state.adapter.workspaceId
      : '-';

    const runCountRows = Object.keys(runCounts).sort().map(function (key) {
      return {
        title: key,
        detail: String(runCounts[key]),
      };
    });
    elements.runStateCount.textContent = String(runCountRows.length);
    renderList(elements.runCounts, runCountRows);

    renderList(elements.records, [
      {
        title: 'Runs',
        detail: String(records.runs.length),
      },
      {
        title: 'Escalations',
        detail: String(records.escalations.length),
      },
      {
        title: 'Artifacts',
        detail: String(records.artifacts.length),
      },
      {
        title: 'Policies',
        detail: String(records.policies.length),
      },
    ]);
    renderMarlinReadiness(marlin);

    if (state.bridgeError) {
      elements.footer.textContent = state.bridgeError;
    } else if (state.workspaceRoot) {
      elements.footer.textContent = state.workspaceRoot + ' | refreshed ' + state.refreshedAt;
    } else {
      elements.footer.textContent = 'Open an eco-governed workspace to load Cockpit state.';
    }
  }

  function renderMarlinReadiness(marlin) {
    const readiness = marlin.installReadiness;
    if (!readiness) {
      elements.marlinStatus.textContent = 'Unavailable';
      elements.marlinApplyCommand.textContent = marlin.error || 'Install readiness is not available.';
      elements.marlinApply.disabled = true;
      elements.marlinApproval.textContent = 'Package mutation requires explicit human approval.';
      renderList(elements.marlinSteps, []);
      return;
    }

    elements.marlinStatus.textContent = readiness.status || readiness.mode || 'preview';
    elements.marlinApply.disabled = true;
    elements.marlinApplyCommand.textContent = Array.isArray(readiness.apply_command)
      ? readiness.apply_command.join(' ')
      : 'No apply command returned.';
    elements.marlinApproval.textContent = readiness.requires_human_apply
      ? 'Ready to preview. Apply remains disabled until an approval execution path is implemented.'
      : 'Readiness did not declare human approval; apply is blocked.';

    const steps = Array.isArray(readiness.preview_steps) ? readiness.preview_steps : [];
    renderList(elements.marlinSteps, steps.map(function (step) {
      return {
        title: step.name || 'step',
        detail: Array.isArray(step.command) ? step.command.join(' ') : '',
      };
    }));
  }

  function renderList(container, items) {
    container.textContent = '';
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'item';
      empty.textContent = 'No records found.';
      container.appendChild(empty);
      return;
    }

    items.forEach(function (item) {
      const row = document.createElement('div');
      const title = document.createElement('strong');
      const detail = document.createElement('span');

      row.className = 'item';
      title.textContent = item.title;
      detail.textContent = item.detail;

      row.appendChild(title);
      if (item.detail) {
        row.appendChild(detail);
      }
      container.appendChild(row);
    });
  }

  function emptyRecords() {
    return {
      runs: [],
      escalations: [],
      artifacts: [],
      policies: [],
    };
  }

  function yesNo(value) {
    return value ? 'yes' : 'no';
  }
}());
