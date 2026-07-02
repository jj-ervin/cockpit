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

  const state = {
    snapshot: emptySnapshot(),
    selectedRunId: '',
    runFilter: 'all',
    policyOriginal: '{}',
    lastDeletedArtifact: null,
  };

  const elements = {
    refresh: byId('refresh'),
    status: byId('status'),
    totalRuns: byId('total-runs'),
    escalations: byId('escalations'),
    artifacts: byId('artifacts'),
    health: byId('health'),
    ecoRoot: byId('eco-root'),
    backend: byId('backend'),
    workspace: byId('workspace'),
    tabs: Array.from(document.querySelectorAll('.tab')),
    panels: Array.from(document.querySelectorAll('.tab-panel')),
    runCounts: byId('run-counts'),
    runStateCount: byId('run-state-count'),
    records: byId('records'),
    marlinStatus: byId('marlin-status'),
    marlinSteps: byId('marlin-steps'),
    marlinApplyCommand: byId('marlin-apply-command'),
    marlinApply: byId('marlin-apply'),
    marlinApproval: byId('marlin-approval'),
    runFilter: byId('run-filter'),
    runTable: byId('run-table'),
    runDetailTitle: byId('run-detail-title'),
    copyRun: byId('copy-run'),
    rerunRecord: byId('rerun-record'),
    runJson: byId('run-json'),
    escalationCount: byId('escalation-count'),
    escalationList: byId('escalation-list'),
    artifactCount: byId('artifact-count'),
    artifactTable: byId('artifact-table'),
    undoDeleteArtifact: byId('undo-delete-artifact'),
    launcherForm: byId('launcher-form'),
    launcherPass: byId('launcher-pass'),
    launcherArtifactType: byId('launcher-artifact-type'),
    launcherObjective: byId('launcher-objective'),
    validatePolicy: byId('validate-policy'),
    savePolicy: byId('save-policy'),
    revertPolicy: byId('revert-policy'),
    openPolicy: byId('open-policy'),
    policyEditor: byId('policy-editor'),
    notice: byId('notice'),
    footer: byId('footer'),
  };

  elements.refresh.addEventListener('click', function () {
    post({ type: 'eco.cockpit.refresh' });
  });

  elements.tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      setActiveTab(tab.dataset.tab);
    });
  });

  elements.runFilter.addEventListener('change', function () {
    state.runFilter = elements.runFilter.value;
    renderRuns();
  });

  elements.copyRun.addEventListener('click', function () {
    if (state.selectedRunId) {
      post({ type: 'eco.cockpit.copyRunJson', runId: state.selectedRunId });
    }
  });

  elements.rerunRecord.addEventListener('click', function () {
    if (state.selectedRunId) {
      post({ type: 'eco.cockpit.rerunRecord', runId: state.selectedRunId });
    }
  });

  elements.launcherForm.addEventListener('submit', function (event) {
    event.preventDefault();
    post({
      type: 'eco.cockpit.submitRun',
      payload: {
        pass_name_or_id: elements.launcherPass.value.trim(),
        artifact_type: elements.launcherArtifactType.value.trim(),
        objective: elements.launcherObjective.value.trim(),
      },
    });
  });

  elements.validatePolicy.addEventListener('click', function () {
    parsePolicy();
  });

  elements.savePolicy.addEventListener('click', function () {
    const parsed = parsePolicy();
    if (parsed.ok) {
      post({ type: 'eco.cockpit.savePolicy', payload: parsed.value });
    }
  });

  elements.revertPolicy.addEventListener('click', function () {
    elements.policyEditor.value = state.policyOriginal;
    showNotice('Policy editor reverted to the latest loaded snapshot.', false);
  });

  elements.openPolicy.addEventListener('click', function () {
    post({ type: 'eco.cockpit.openPolicy' });
  });

  elements.undoDeleteArtifact.addEventListener('click', function () {
    if (!state.lastDeletedArtifact) {
      return;
    }
    post({
      type: 'eco.cockpit.undoDeleteArtifact',
      originalPath: state.lastDeletedArtifact.original_path,
      trashPath: state.lastDeletedArtifact.trash_path,
    });
    state.lastDeletedArtifact = null;
    elements.undoDeleteArtifact.disabled = true;
  });

  window.addEventListener('message', function (event) {
    const message = event.data;
    if (!message || !message.type) {
      return;
    }
    if (message.type === 'eco.cockpit.state') {
      renderSnapshot(message.payload);
      return;
    }
    if (message.type === 'eco.cockpit.actionResult') {
      const payload = message.payload || {};
      showNotice(payload.message || 'Action completed.', payload.ok === false);
      if (payload.refresh !== false) {
        post({ type: 'eco.cockpit.refresh' });
      }
      return;
    }
    if (message.type === 'eco.cockpit.artifactDeleted') {
      state.lastDeletedArtifact = message.payload || null;
      elements.undoDeleteArtifact.disabled = !state.lastDeletedArtifact;
      return;
    }
    if (message.type === 'eco.cockpit.error') {
      const payload = message.payload || {};
      showNotice(payload.message || 'Cockpit host error.', true);
    }
  });

  post({ type: 'eco.cockpit.ready' });

  function renderSnapshot(payload) {
    state.snapshot = normalizeSnapshot(payload);
    const workspace = state.snapshot.state || {};
    const backendState = workspace.backendState || {};
    const health = state.snapshot.health || {};
    const records = state.snapshot.records || emptyRecords();
    const runCounts = backendState.run_counts || {};

    elements.status.textContent = workspace.detected ? 'Detected' : 'Not detected';
    elements.totalRuns.textContent = String(backendState.total_runs || records.runs.length || 0);
    elements.escalations.textContent = String(backendState.escalation_queue_depth || records.escalations.length || 0);
    elements.artifacts.textContent = String(records.artifacts.length || 0);
    elements.health.textContent = health.status || '-';
    elements.ecoRoot.textContent = yesNo(health.eco_root_present);
    elements.backend.textContent = workspace.adapter ? workspace.adapter.backend : '-';
    elements.workspace.textContent = workspace.adapter && workspace.adapter.workspaceId
      ? workspace.adapter.workspaceId
      : '-';

    const runCountRows = Object.keys(runCounts).sort().map(function (key) {
      return {
        title: key,
        detail: String(runCounts[key]),
      };
    });
    elements.runStateCount.textContent = String(runCountRows.length) + ' states';
    renderList(elements.runCounts, runCountRows);

    renderList(elements.records, [
      { title: 'Runs', detail: String(records.runs.length) },
      { title: 'Escalations', detail: String(records.escalations.length) },
      { title: 'Artifacts', detail: String(records.artifacts.length) },
      { title: 'Policies', detail: String(records.policies.length) },
    ]);

    renderMarlinReadiness(state.snapshot.marlin || {});
    syncRunFilterOptions(records.runs);
    renderRuns();
    renderEscalations();
    renderArtifacts();
    renderPolicy();

    if (workspace.bridgeError) {
      elements.footer.textContent = workspace.bridgeError;
    } else if (workspace.workspaceRoot) {
      elements.footer.textContent = workspace.workspaceRoot + ' | refreshed ' + workspace.refreshedAt;
    } else {
      elements.footer.textContent = 'Open an eco-governed workspace to load Cockpit state.';
    }
  }

  function renderRuns() {
    const runs = filteredRuns();
    clear(elements.runTable);
    if (!runs.length) {
      elements.runTable.appendChild(emptyTableRow(4, 'No run records found.'));
      renderSelectedRun(null);
      return;
    }

    if (!state.selectedRunId || !runs.some(function (run) { return recordId(run) === state.selectedRunId; })) {
      state.selectedRunId = recordId(runs[0]);
    }

    runs.forEach(function (run) {
      const id = recordId(run);
      const row = document.createElement('tr');
      row.className = id === state.selectedRunId ? 'is-selected' : '';
      row.tabIndex = 0;
      row.appendChild(cell(id));
      row.appendChild(cell(run.state || run.status || '-'));
      row.appendChild(cell(run.updated_at || run.completed_at || run.started_at || '-'));
      row.appendChild(cell(run.pass_name_or_id || run.pass_id || run.pass || '-'));
      row.addEventListener('click', function () {
        state.selectedRunId = id;
        renderRuns();
      });
      row.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          state.selectedRunId = id;
          renderRuns();
        }
      });
      elements.runTable.appendChild(row);
    });

    renderSelectedRun(runs.find(function (run) { return recordId(run) === state.selectedRunId; }) || runs[0]);
  }

  function renderSelectedRun(run) {
    if (!run) {
      state.selectedRunId = '';
      elements.runDetailTitle.textContent = 'Run Detail';
      elements.runJson.textContent = '{}';
      elements.copyRun.disabled = true;
      elements.rerunRecord.disabled = true;
      return;
    }

    elements.runDetailTitle.textContent = recordId(run);
    elements.runJson.textContent = JSON.stringify(run, null, 2);
    elements.copyRun.disabled = false;
    elements.rerunRecord.disabled = false;
  }

  function renderEscalations() {
    const escalations = state.snapshot.records.escalations || [];
    elements.escalationCount.textContent = String(escalations.length) + ' open';
    clear(elements.escalationList);
    if (!escalations.length) {
      renderList(elements.escalationList, []);
      return;
    }

    escalations.forEach(function (item) {
      const id = recordId(item);
      const row = document.createElement('div');
      const title = document.createElement('strong');
      const detail = document.createElement('span');
      const reason = document.createElement('input');
      const actions = document.createElement('div');
      const approve = document.createElement('button');
      const deny = document.createElement('button');

      row.className = 'item action-item';
      title.textContent = id;
      detail.textContent = item.reason || item.message || item.state || 'Escalation requires operator decision.';
      reason.type = 'text';
      reason.placeholder = 'Decision reason';
      actions.className = 'button-row';
      approve.type = 'button';
      approve.textContent = 'Approve';
      deny.type = 'button';
      deny.textContent = 'Deny';
      approve.addEventListener('click', function () {
        post({ type: 'eco.cockpit.approveEscalation', runId: id, decision: 'approved', reason: reason.value.trim() });
      });
      deny.addEventListener('click', function () {
        post({ type: 'eco.cockpit.approveEscalation', runId: id, decision: 'denied', reason: reason.value.trim() });
      });

      actions.appendChild(approve);
      actions.appendChild(deny);
      row.appendChild(title);
      row.appendChild(detail);
      row.appendChild(reason);
      row.appendChild(actions);
      elements.escalationList.appendChild(row);
    });
  }

  function renderArtifacts() {
    const artifacts = state.snapshot.records.artifacts || [];
    elements.artifactCount.textContent = String(artifacts.length) + ' artifacts';
    clear(elements.artifactTable);
    if (!artifacts.length) {
      elements.artifactTable.appendChild(emptyTableRow(4, 'No artifacts found.'));
      return;
    }

    artifacts.forEach(function (artifact) {
      const artifactPath = artifact.artifact_path || artifact.path || artifact.file || artifact.uri || artifact.id || '';
      const row = document.createElement('tr');
      const actionCell = document.createElement('td');
      const open = document.createElement('button');
      const del = document.createElement('button');
      row.appendChild(cell(artifactPath || '-'));
      row.appendChild(cell(artifact.type || artifact.kind || '-'));
      row.appendChild(cell(artifact.updated_at || artifact.created_at || '-'));
      open.type = 'button';
      open.textContent = 'Open';
      open.disabled = !artifactPath;
      open.addEventListener('click', function () {
        post({ type: 'eco.cockpit.openArtifact', artifactPath: artifactPath });
      });
      del.type = 'button';
      del.textContent = 'Delete';
      del.disabled = !artifactPath;
      del.addEventListener('click', function () {
        post({ type: 'eco.cockpit.deleteArtifact', artifactPath: artifactPath });
      });
      actionCell.appendChild(open);
      actionCell.appendChild(del);
      row.appendChild(actionCell);
      elements.artifactTable.appendChild(row);
    });
  }

  function renderPolicy() {
    const policies = state.snapshot.records.policies || [];
    const policy = policies[0] || {};
    const nextValue = JSON.stringify(policy, null, 2);
    state.policyOriginal = nextValue;
    if (!elements.policyEditor.matches(':focus')) {
      elements.policyEditor.value = nextValue;
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

  function syncRunFilterOptions(runs) {
    const states = Array.from(new Set(runs.map(function (run) {
      return run.state || run.status || '';
    }).filter(Boolean))).sort();
    const current = state.runFilter;
    clear(elements.runFilter);
    elements.runFilter.appendChild(option('all', 'All'));
    states.forEach(function (item) {
      elements.runFilter.appendChild(option(item, item));
    });
    state.runFilter = states.indexOf(current) >= 0 ? current : 'all';
    elements.runFilter.value = state.runFilter;
  }

  function filteredRuns() {
    const runs = state.snapshot.records.runs || [];
    if (state.runFilter === 'all') {
      return runs;
    }
    return runs.filter(function (run) {
      return (run.state || run.status || '') === state.runFilter;
    });
  }

  function parsePolicy() {
    try {
      const value = JSON.parse(elements.policyEditor.value || '{}');
      showNotice('Policy JSON is valid.', false);
      return { ok: true, value: value };
    } catch (error) {
      showNotice(error instanceof Error ? error.message : String(error), true);
      return { ok: false, value: null };
    }
  }

  function setActiveTab(id) {
    elements.tabs.forEach(function (tab) {
      tab.classList.toggle('is-active', tab.dataset.tab === id);
    });
    elements.panels.forEach(function (panel) {
      panel.classList.toggle('is-active', panel.id === id);
    });
  }

  function renderList(container, items) {
    clear(container);
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

  function showNotice(message, isError) {
    elements.notice.textContent = message;
    elements.notice.classList.toggle('is-error', Boolean(isError));
  }

  function post(message) {
    host.postMessage(message);
  }

  function normalizeSnapshot(payload) {
    const snapshot = payload || {};
    return {
      state: snapshot.state || {},
      health: snapshot.health || {},
      marlin: snapshot.marlin || {},
      records: Object.assign(emptyRecords(), snapshot.records || {}),
    };
  }

  function emptySnapshot() {
    return {
      state: {},
      health: {},
      marlin: {},
      records: emptyRecords(),
    };
  }

  function emptyRecords() {
    return {
      runs: [],
      escalations: [],
      artifacts: [],
      policies: [],
    };
  }

  function recordId(record) {
    if (!record) {
      return '';
    }
    return String(record.id || record.run_id || record.record_id || record.path || record.file || 'record');
  }

  function emptyTableRow(colspan, text) {
    const row = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = colspan;
    td.textContent = text;
    row.appendChild(td);
    return row;
  }

  function cell(text) {
    const td = document.createElement('td');
    td.textContent = String(text);
    return td;
  }

  function option(value, text) {
    const item = document.createElement('option');
    item.value = value;
    item.textContent = text;
    return item;
  }

  function clear(element) {
    element.textContent = '';
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function yesNo(value) {
    return value ? 'yes' : 'no';
  }
}());
