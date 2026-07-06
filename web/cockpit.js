(function () {
  // Host-agnostic bundle. Any host (VS Code, Electron, browser) must set
  // `window.cockpitHost = { postMessage(msg) {...} }` before this script runs,
  // and deliver host->bundle messages via `window.postMessage(data, "*")` so
  // this bundle's own `window.addEventListener('message', ...)` picks them up.
  // See docs/specifications/CKP.08-host-loader-contract.md for the full
  // contract. VS Code's loader wraps `acquireVsCodeApi()`; that call and any
  // other host-specific API must never appear in this file.
  const hasRealHost = Boolean(window.cockpitHost && typeof window.cockpitHost.postMessage === 'function');
  const host = hasRealHost
    ? window.cockpitHost
    : {
        postMessage: function (message) {
          window.__posted = Array.isArray(window.__posted) ? window.__posted : [];
          window.__posted.push(message);
          if (message.type === 'eco.cockpit.ready' || message.type === 'eco.cockpit.refresh') {
            window.postMessage({
              type: 'eco.cockpit.state',
              payload: staticPreviewSnapshot(),
            }, '*');
          }
          if (window.console && typeof window.console.info === 'function') {
            window.console.info('Cockpit static preview host message', message);
          }
        },
      };

  const state = {
    snapshot: emptySnapshot(),
    selectedRunId: '',
    runFilter: 'all',
    policyOriginal: '{}',
    lastDeletedArtifact: null,
    wizardStep: 0,
    marlinSearchResults: [],
    marlinInstallResult: null,
    selectedWorkspacePath: '',
    noticeTimer: null,
  };

  // CKP.09.04 - environment setup wizard shell. Steps are generic (id, title,
  // render, isComplete); today only one real step exists (Marlin install
  // readiness, per CKP.07). Future wizard steps (environment verification,
  // other provider setup flows) plug in here without changing the shell.
  const WIZARD_STEPS = [
    {
      id: 'marlin-install',
      title: 'Marlin Environment Setup',
      render: renderWizardMarlinStep,
      isComplete: function (snapshot) {
        const readiness = snapshot.marlin && snapshot.marlin.installReadiness;
        return Boolean(readiness && (readiness.status === 'ready' || readiness.mode === 'preview'));
      },
    },
  ];

  const elements = {
    refresh: byId('refresh'),
    connectionBadge: byId('connection-badge'),
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
    governanceStatus: byId('governance-status'),
    govMode: byId('gov-mode'),
    govHealth: byId('gov-health'),
    govHashMatch: byId('gov-hash-match'),
    govIssueCount: byId('gov-issue-count'),
    govIssueTable: byId('governance-issue-table'),
    epActivePass: byId('ep-active-pass'),
    epRunState: byId('ep-run-state'),
    epGovState: byId('ep-gov-state'),
    epModeState: byId('ep-mode-state'),
    modeSelect: byId('mode-select'),
    modeActivate: byId('mode-activate'),
    modeCurrent: byId('mode-current'),
    modeHistory: byId('mode-history'),
    wizardStepLabel: byId('wizard-step-label'),
    wizardStepIndicator: byId('wizard-step-indicator'),
    wizardContent: byId('wizard-content'),
    wizardBack: byId('wizard-back'),
    wizardNext: byId('wizard-next'),
    workspaceTreeStatus: byId('workspace-tree-status'),
    workspaceTree: byId('workspace-tree'),
    workspaceSelectedTitle: byId('workspace-selected-title'),
    workspaceReveal: byId('workspace-reveal'),
    workspaceStatusAction: byId('workspace-status-action'),
    workspaceMetadata: byId('workspace-metadata'),
    workspaceRepos: byId('workspace-repos'),
    nijiStatus: byId('niji-status'),
    nijiApi: byId('niji-api'),
    nijiSchemes: byId('niji-schemes'),
    nijiBase: byId('niji-base'),
    nijiScheme: byId('niji-scheme'),
    nijiSwatches: byId('niji-swatches'),
    lassoMode: byId('lasso-mode'),
    lassoPrompt: byId('lasso-prompt'),
    lassoUseCodex: byId('lasso-use-codex'),
    lassoUseClaude: byId('lasso-use-claude'),
    lassoUseReviewer: byId('lasso-use-reviewer'),
    lassoCodex: byId('lasso-codex'),
    lassoClaude: byId('lasso-claude'),
    lassoReviewer: byId('lasso-reviewer'),
    lassoMerge: byId('lasso-merge'),
    lassoClear: byId('lasso-clear'),
    lassoOutput: byId('lasso-output'),
  };

  elements.refresh.addEventListener('click', function () {
    post({ type: 'eco.cockpit.refresh' });
  });

  elements.tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      setActiveTab(tab.dataset.tab);
      clearNotice();
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

  elements.modeActivate.addEventListener('click', function () {
    if (elements.modeSelect.value) {
      post({ type: 'eco.cockpit.setHelmMode', mode: elements.modeSelect.value });
    }
  });

  elements.wizardBack.addEventListener('click', function () {
    if (state.wizardStep > 0) {
      state.wizardStep -= 1;
      renderWizard();
    }
  });

  elements.wizardNext.addEventListener('click', function () {
    if (state.wizardStep < WIZARD_STEPS.length - 1) {
      state.wizardStep += 1;
      renderWizard();
    }
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

  elements.workspaceReveal.addEventListener('click', function () {
    if (state.selectedWorkspacePath) {
      post({
        type: 'eco.cockpit.workspaceReveal',
        workspaceId: workspaceId(),
        path: state.selectedWorkspacePath,
      });
    }
  });

  elements.workspaceStatusAction.addEventListener('click', function () {
    if (state.selectedWorkspacePath) {
      post({
        type: 'eco.cockpit.workspaceStatus',
        workspaceId: workspaceId(),
        path: state.selectedWorkspacePath,
      });
    }
  });

  elements.lassoMerge.addEventListener('click', function () {
    mergeLassoLanes();
  });

  elements.lassoClear.addEventListener('click', function () {
    elements.lassoPrompt.value = '';
    elements.lassoCodex.value = '';
    elements.lassoClaude.value = '';
    elements.lassoReviewer.value = '';
    elements.lassoOutput.value = '';
    showNotice('Lasso workspace cleared.', false);
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
      showNotice(payload.message || 'Action completed.', payload.ok === false, payload.persist === true);
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
    if (message.type === 'eco.cockpit.marlinPackageSearchResult') {
      const payload = message.payload || {};
      state.marlinSearchResults = Array.isArray(payload.packages) ? payload.packages : [];
      showNotice('Marlin package search returned ' + state.marlinSearchResults.length + ' result(s).', false);
      renderWizard();
      return;
    }
    if (message.type === 'eco.cockpit.marlinInstallResult') {
      state.marlinInstallResult = message.payload || {};
      showNotice(state.marlinInstallResult.ok === false ? 'Marlin install failed.' : 'Marlin install completed.', state.marlinInstallResult.ok === false);
      renderWizard();
      post({ type: 'eco.cockpit.refresh' });
      return;
    }
    if (message.type === 'eco.cockpit.setHelmModeResult') {
      const payload = message.payload || {};
      showNotice(payload.ok === false ? (payload.error || 'Mode change failed.') : 'Operator mode updated.', payload.ok === false);
      post({ type: 'eco.cockpit.refresh' });
      return;
    }
    if (message.type === 'eco.cockpit.error') {
      const payload = message.payload || {};
      showNotice(payload.message || 'Cockpit host error.', true, true);
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

    elements.status.textContent = workspace.statusLabel || (workspace.detected ? 'Detected' : 'Not detected');
    elements.connectionBadge.textContent = hasRealHost ? 'Host connected' : 'Preview mode';
    elements.connectionBadge.classList.toggle('is-live', hasRealHost);
    elements.connectionBadge.classList.toggle('is-preview', !hasRealHost);
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
    renderGovernance(state.snapshot.governance);
    renderHelmMode(state.snapshot.mode);
    renderEditorPlaneBar(records.runs, state.snapshot.governance, state.snapshot.mode);
    renderWizard();
    renderWorkspaceExplorer(state.snapshot.marlin || {});
    renderWorkspaceRepos(state.snapshot.marlin || {});
    renderNiji(state.snapshot.niji || {});

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

  function renderGovernance(governance) {
    const gov = governance || {};
    const issues = Array.isArray(gov.issues) ? gov.issues : [];

    elements.governanceStatus.textContent = gov.diagnostics_present ? 'Loaded' : 'No diagnostics found';
    elements.govMode.textContent = gov.governance_mode || '-';
    elements.govHealth.textContent = typeof gov.health_score === 'number' ? String(gov.health_score) : '-';
    elements.govHashMatch.textContent = gov.hash_match === true ? 'yes' : gov.hash_match === false ? 'no' : '-';
    elements.govIssueCount.textContent = String(issues.length);

    clear(elements.govIssueTable);
    if (!issues.length) {
      elements.govIssueTable.appendChild(emptyTableRow(4, 'No governance issues found.'));
      return;
    }
    issues.forEach(function (issue) {
      const row = document.createElement('tr');
      row.appendChild(cell(issue.severity || '-'));
      row.appendChild(cell(issue.rule || '-'));
      row.appendChild(cell(issue.message || '-'));
      row.appendChild(cell(issue.file || '-'));
      elements.govIssueTable.appendChild(row);
    });
  }

  function computeGovernanceState(governance) {
    const gov = governance || {};
    if (!gov.diagnostics_present) {
      return 'unknown';
    }
    const issues = Array.isArray(gov.issues) ? gov.issues : [];
    const errors = issues.filter(function (issue) { return issue.severity === 'ERROR'; });
    if (!errors.length) {
      return 'clean';
    }
    const contained = errors.some(function (issue) {
      return typeof issue.rule === 'string' && issue.rule.indexOf('containment') === 0;
    });
    return contained ? 'contained' : 'violation';
  }

  function renderEditorPlaneBar(runs, governance, mode) {
    const latest = (runs && runs[0]) || null;
    elements.epActivePass.textContent = latest
      ? (latest.pass_name_or_id || latest.pass_id || latest.pass || '-')
      : '-';
    elements.epRunState.textContent = latest ? (latest.state || latest.status || '-') : '-';
    elements.epGovState.textContent = computeGovernanceState(governance);
    elements.epModeState.textContent = (mode && mode.current_mode) || '-';
  }

  function renderHelmMode(mode) {
    const helm = mode || {};
    const availableModes = Array.isArray(helm.available_modes) ? helm.available_modes : [];
    const history = Array.isArray(helm.history) ? helm.history : [];

    if (elements.modeSelect.options.length !== availableModes.length) {
      clear(elements.modeSelect);
      availableModes.forEach(function (name) {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        elements.modeSelect.appendChild(option);
      });
    }
    if (helm.current_mode && elements.modeSelect.value !== helm.current_mode) {
      elements.modeSelect.value = helm.current_mode;
    }

    elements.modeCurrent.textContent = helm.current_mode || '-';

    renderList(elements.modeHistory, history.slice().reverse().map(function (entry) {
      return {
        title: (entry.previous_mode || '-') + ' → ' + (entry.current_mode || '-'),
        detail: entry.time_loc || '',
      };
    }));
  }

  function renderWizard() {
    if (state.wizardStep >= WIZARD_STEPS.length) {
      state.wizardStep = WIZARD_STEPS.length - 1;
    }
    if (state.wizardStep < 0) {
      state.wizardStep = 0;
    }

    elements.wizardStepLabel.textContent = 'Step ' + (state.wizardStep + 1) + ' of ' + WIZARD_STEPS.length;

    clear(elements.wizardStepIndicator);
    WIZARD_STEPS.forEach(function (step, index) {
      const li = document.createElement('li');
      li.textContent = (index + 1) + '. ' + step.title;
      if (index === state.wizardStep) {
        li.classList.add('is-active');
      }
      if (step.isComplete(state.snapshot)) {
        li.classList.add('is-complete');
      }
      elements.wizardStepIndicator.appendChild(li);
    });

    const current = WIZARD_STEPS[state.wizardStep];
    clear(elements.wizardContent);
    current.render(elements.wizardContent, state.snapshot);

    elements.wizardBack.disabled = state.wizardStep === 0;
    elements.wizardNext.disabled = state.wizardStep === WIZARD_STEPS.length - 1;
  }

  function renderWizardMarlinStep(container, snapshot) {
    const marlin = snapshot.marlin || {};
    const readiness = marlin.installReadiness;

    if (!readiness) {
      const note = document.createElement('p');
      note.className = 'panel-note';
      note.textContent = marlin.error || 'Install readiness is not available.';
      container.appendChild(note);
      return;
    }

    const status = document.createElement('p');
    status.textContent = 'Status: ' + (readiness.status || readiness.mode || 'preview');
    container.appendChild(status);

    const stepsHost = document.createElement('div');
    stepsHost.className = 'list';
    container.appendChild(stepsHost);
    const previewSteps = Array.isArray(readiness.preview_steps) ? readiness.preview_steps : [];
    renderList(stepsHost, previewSteps.map(function (step) {
      return {
        title: step.name || 'step',
        detail: Array.isArray(step.command) ? step.command.join(' ') : '',
      };
    }));

    const approval = document.createElement('p');
    approval.className = 'panel-note';
    approval.textContent = readiness.requires_human_apply
      ? 'Ready to preview. Apply remains disabled until an approval execution path is implemented.'
      : 'Readiness did not declare human approval; apply is blocked.';
    container.appendChild(approval);

    const applyCommand = document.createElement('code');
    applyCommand.textContent = Array.isArray(readiness.apply_command)
      ? readiness.apply_command.join(' ')
      : 'No apply command returned.';
    container.appendChild(applyCommand);

    const providerPanel = document.createElement('div');
    const heading = document.createElement('h2');
    const form = document.createElement('form');
    const label = document.createElement('label');
    const input = document.createElement('input');
    const submit = document.createElement('button');
    const results = document.createElement('div');

    providerPanel.className = 'wizard-provider-panel';
    heading.textContent = 'Marlin Package Search';
    form.className = 'wizard-search';
    label.textContent = 'Package';
    input.type = 'text';
    input.value = 'niji';
    input.autocomplete = 'off';
    submit.type = 'submit';
    submit.textContent = 'Search';
    results.className = 'list';

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      const query = input.value.trim();
      if (query) {
        post({ type: 'eco.cockpit.marlinSearchPackages', query: query });
      }
    });

    label.appendChild(input);
    form.appendChild(label);
    form.appendChild(submit);
    providerPanel.appendChild(heading);
    providerPanel.appendChild(form);
    providerPanel.appendChild(results);
    container.appendChild(providerPanel);

    renderMarlinPackageResults(results);
    renderMarlinInstallResult(container);
  }

  function renderMarlinPackageResults(container) {
    clear(container);
    if (!state.marlinSearchResults.length) {
      const note = document.createElement('div');
      note.className = 'item';
      note.textContent = 'No package search results loaded.';
      container.appendChild(note);
      return;
    }

    state.marlinSearchResults.forEach(function (pkg) {
      const row = document.createElement('div');
      const title = document.createElement('strong');
      const detail = document.createElement('span');
      const action = document.createElement('button');
      row.className = 'item action-item';
      title.textContent = String(pkg.name || '-') + '@' + String(pkg.version || '-');
      detail.textContent = String(pkg.description || '') + (pkg.source ? ' [' + pkg.source + ']' : '');
      action.type = 'button';
      action.textContent = 'Install';
      action.addEventListener('click', function () {
        if (pkg.name) {
          post({ type: 'eco.cockpit.marlinInstallPackage', packageName: pkg.name });
        }
      });
      row.appendChild(title);
      row.appendChild(detail);
      row.appendChild(action);
      container.appendChild(row);
    });
  }

  function renderMarlinInstallResult(container) {
    if (!state.marlinInstallResult) {
      return;
    }
    const block = document.createElement('pre');
    block.className = 'wizard-result';
    block.textContent = JSON.stringify(state.marlinInstallResult, null, 2);
    container.appendChild(block);
  }

  function renderNiji(niji) {
    const health = niji.health || {};
    const providerState = niji.state || {};
    const preview = niji.palettePreview || {};
    elements.nijiStatus.textContent = health.status || (niji.error ? 'degraded' : '-');
    elements.nijiApi.textContent = health.api_version || providerState.api_version || '-';
    elements.nijiSchemes.textContent = String(providerState.scheme_count || 0);
    elements.nijiBase.textContent = preview.base_hex || providerState.default_base_hex || '-';
    elements.nijiScheme.textContent = preview.scheme || providerState.default_scheme || '-';
    clear(elements.nijiSwatches);

    const swatches = Array.isArray(preview.swatches) ? preview.swatches : [];
    if (!swatches.length) {
      const note = document.createElement('div');
      note.className = 'item';
      note.textContent = niji.error || 'No Niji palette preview available.';
      elements.nijiSwatches.appendChild(note);
      return;
    }

    swatches.forEach(function (swatch) {
      const tile = document.createElement('div');
      const chip = document.createElement('span');
      const label = document.createElement('strong');
      const detail = document.createElement('span');
      tile.className = 'swatch';
      chip.className = 'swatch-chip';
      chip.style.background = swatch.hex || '#000000';
      label.textContent = swatch.name || swatch.role || 'swatch';
      detail.textContent = (swatch.role || '-') + ' ' + (swatch.hex || '');
      tile.appendChild(chip);
      tile.appendChild(label);
      tile.appendChild(detail);
      elements.nijiSwatches.appendChild(tile);
    });
  }

  function renderWorkspaceExplorer(marlin) {
    const tree = marlin.workspaceTree;
    clear(elements.workspaceTree);
    clear(elements.workspaceMetadata);
    if (!tree || !Array.isArray(tree.nodes)) {
      elements.workspaceTreeStatus.textContent = marlin.error || 'Workspace tree not loaded.';
      elements.workspaceTree.appendChild(emptyDiv('No workspace tree available from the host yet.'));
      renderWorkspaceSelection(null);
      return;
    }

    elements.workspaceTreeStatus.textContent = tree.truncated ? 'Read-only, truncated' : 'Read-only';
    if (!tree.nodes.length) {
      elements.workspaceTree.appendChild(emptyDiv('No workspace entries found.'));
      renderWorkspaceSelection(null);
      return;
    }

    if (!state.selectedWorkspacePath || !tree.nodes.some(function (node) { return node.path === state.selectedWorkspacePath; })) {
      state.selectedWorkspacePath = tree.nodes[0].path || '.';
    }

    tree.nodes.forEach(function (node) {
      const button = document.createElement('button');
      const icon = node.kind === 'directory' ? '[] ' : '- ';
      button.type = 'button';
      button.className = 'workspace-node';
      button.classList.toggle('is-selected', node.path === state.selectedWorkspacePath);
      button.classList.toggle('is-skipped', Boolean(node.skipped));
      button.style.paddingLeft = String(8 + ((node.depth || 0) * 16)) + 'px';
      button.textContent = icon + (node.name || node.path || '.');
      button.addEventListener('click', function () {
        state.selectedWorkspacePath = node.path || '.';
        renderWorkspaceExplorer(marlin);
      });
      elements.workspaceTree.appendChild(button);
    });

    renderWorkspaceSelection(tree.nodes.find(function (node) {
      return node.path === state.selectedWorkspacePath;
    }) || tree.nodes[0]);
  }

  function renderWorkspaceSelection(node) {
    clear(elements.workspaceMetadata);
    if (!node) {
      elements.workspaceSelectedTitle.textContent = 'Selection';
      elements.workspaceReveal.disabled = true;
      elements.workspaceStatusAction.disabled = true;
      elements.workspaceMetadata.appendChild(emptyMetadata('Status', 'No workspace item selected.'));
      return;
    }

    elements.workspaceSelectedTitle.textContent = node.name || node.path || 'Selection';
    elements.workspaceReveal.disabled = false;
    elements.workspaceStatusAction.disabled = node.kind !== 'directory';
    [
      ['Path', node.path || '.'],
      ['Kind', node.kind || '-'],
      ['Depth', String(node.depth || 0)],
      ['Skipped', node.skipped ? 'yes' : 'no'],
    ].forEach(function (item) {
      elements.workspaceMetadata.appendChild(metadataRow(item[0], item[1]));
    });
  }

  function renderWorkspaceRepos(marlin) {
    const repos = Array.isArray(marlin.repoStatus) ? marlin.repoStatus : [];
    clear(elements.workspaceRepos);
    if (!repos.length) {
      elements.workspaceRepos.appendChild(emptyDiv('No repository status records available.'));
      return;
    }

    repos.forEach(function (repo) {
      const item = document.createElement('article');
      const title = document.createElement('strong');
      const path = document.createElement('span');
      const detail = document.createElement('span');
      item.className = 'repo-item';
      title.textContent = repo.name || repo.path || 'repository';
      path.className = 'repo-meta';
      path.textContent = repo.path || '-';
      detail.className = 'repo-meta';
      detail.textContent = [
        'git: ' + (repo.git || repo.git_status || '-'),
        'registered: ' + yesNo(Boolean(repo.registered)),
      ].join(' | ');
      item.appendChild(title);
      item.appendChild(path);
      item.appendChild(detail);
      elements.workspaceRepos.appendChild(item);
    });
  }

  function mergeLassoLanes() {
    const lanes = [
      { name: 'Codex', enabled: elements.lassoUseCodex.checked, value: elements.lassoCodex.value.trim() },
      { name: 'Claude', enabled: elements.lassoUseClaude.checked, value: elements.lassoClaude.value.trim() },
      { name: 'Reviewer', enabled: elements.lassoUseReviewer.checked, value: elements.lassoReviewer.value.trim() },
    ].filter(function (lane) {
      return lane.enabled && lane.value;
    });

    const prompt = elements.lassoPrompt.value.trim();
    const mode = elements.lassoMode.value;
    const parts = ['# Lasso Session', '', 'Mode: ' + mode];

    if (prompt) {
      parts.push('', '## Shared Input', prompt);
    }

    if (!lanes.length) {
      showNotice('Select at least one populated Lasso lane.', true);
      return;
    }

    lanes.forEach(function (lane) {
      parts.push('', '## ' + lane.name, lane.value);
    });

    elements.lassoOutput.value = parts.join('\n');
    showNotice('Lasso selected lanes merged into composed output.', false);
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

  function showNotice(message, isError, persist) {
    elements.notice.textContent = message;
    elements.notice.classList.toggle('is-error', Boolean(isError));
    if (state.noticeTimer) {
      window.clearTimeout(state.noticeTimer);
      state.noticeTimer = null;
    }
    if (!persist) {
      state.noticeTimer = window.setTimeout(clearNotice, 5000);
    }
  }

  function clearNotice() {
    if (state.noticeTimer) {
      window.clearTimeout(state.noticeTimer);
      state.noticeTimer = null;
    }
    elements.notice.textContent = '';
    elements.notice.classList.remove('is-error');
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
      governance: snapshot.governance || null,
      mode: snapshot.mode || null,
      niji: snapshot.niji || {},
    };
  }

  function emptySnapshot() {
    return {
      state: {},
      health: {},
      marlin: {},
      records: emptyRecords(),
      governance: null,
      mode: null,
      niji: {},
    };
  }

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
      marlin: {
        installReadiness: {
          id: 'install-readiness',
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
          { previous_mode: null, current_mode: 'Navigator', time_loc: '2026-07-05T20:00:00Z' },
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

  function emptyDiv(text) {
    const div = document.createElement('div');
    div.className = 'item';
    div.textContent = text;
    return div;
  }

  function emptyMetadata(label, text) {
    return metadataRow(label, text);
  }

  function metadataRow(label, value) {
    const row = document.createElement('div');
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = label;
    dd.textContent = String(value);
    row.appendChild(dt);
    row.appendChild(dd);
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

  function workspaceId() {
    const workspace = state.snapshot.state || {};
    return workspace.adapter && workspace.adapter.workspaceId
      ? workspace.adapter.workspaceId
      : '';
  }

  function yesNo(value) {
    return value ? 'yes' : 'no';
  }
}());
