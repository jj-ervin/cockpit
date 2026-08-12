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
    audit: {
      target: '',
      activeCommand: '',
      error: '',
      approval: null,
      results: { validate: null, preview: null, apply: null, verify: null },
    },
    doctor: {
      target: '',
      activeCommand: '',
      error: '',
      lastResult: null,
      operations: [],
    },
    hygiene: {
      activeCommand: '',
      error: '',
      approval: null,
      results: {
        syncPreview: null, syncApply: null,
        unignorePreview: null, unignoreApply: null,
        visibilityList: null, visibilitySet: null,
      },
    },
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
        const readiness = snapshot.development && snapshot.development.installReadiness;
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
    providersStatus: byId('providers-status'),
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
    diagIntegrationEco: byId('diag-integration-eco'),
    diagIntegrationMarlin: byId('diag-integration-marlin'),
    diagIntegrationNiji: byId('diag-integration-niji'),
    diagEnvPythonVersion: byId('diag-env-python-version'),
    diagEnvCockpitVersion: byId('diag-env-cockpit-version'),
    diagEnvNodeVersion: byId('diag-env-node-version'),
    diagEnvNodeAvailable: byId('diag-env-node-available'),
    diagPipelineStatus: byId('diag-pipeline-status'),
    diagPipelineTable: byId('diag-pipeline-table'),
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
    auditRepository: byId('audit-repository'),
    auditDiscoverStatus: byId('audit-discover-status'),
    auditValidateStatus: byId('audit-validate-status'),
    auditPreviewStatus: byId('audit-preview-status'),
    auditApprovalStatus: byId('audit-approval-status'),
    auditApplyStatus: byId('audit-apply-status'),
    auditVerifyStatus: byId('audit-verify-status'),
    auditEvidenceStatus: byId('audit-evidence-status'),
    auditValidate: byId('audit-validate'),
    auditPreview: byId('audit-preview'),
    auditRequestApproval: byId('audit-request-approval'),
    auditExportEvidence: byId('audit-export-evidence'),
    auditFindingsCount: byId('audit-findings-count'),
    auditValidationResult: byId('audit-validation-result'),
    auditPreviewResult: byId('audit-preview-result'),
    auditApplyResult: byId('audit-apply-result'),
    auditVerifyResult: byId('audit-verify-result'),
    auditPreviewOperation: byId('audit-preview-operation'),
    auditApplyOperation: byId('audit-apply-operation'),
    auditVerifyOperation: byId('audit-verify-operation'),
    auditApprovalDialog: byId('audit-approval-dialog'),
    auditApprovalScope: byId('audit-approval-scope'),
    auditApprovalCheck: byId('audit-approval-check'),
    auditCancelApproval: byId('audit-cancel-approval'),
    auditConfirmApproval: byId('audit-confirm-approval'),
    doctorRepository: byId('doctor-repository'),
    doctorRefresh: byId('doctor-refresh'),
    doctorOperationCount: byId('doctor-operation-count'),
    doctorOperationTable: byId('doctor-operation-table'),
    doctorRegistryStatus: byId('doctor-registry-status'),
    doctorAddForm: byId('doctor-add-form'),
    doctorOperationId: byId('doctor-operation-id'),
    doctorOperationTitle: byId('doctor-operation-title'),
    doctorCommandJson: byId('doctor-command-json'),
    doctorOperationCwd: byId('doctor-operation-cwd'),
    doctorOperationOutput: byId('doctor-operation-output'),
    doctorOperationMutates: byId('doctor-operation-mutates'),
    doctorOperationPreview: byId('doctor-operation-preview'),
    doctorLastResult: byId('doctor-last-result'),
    hygieneSyncStatus: byId('hygiene-sync-status'),
    hygieneSyncPreview: byId('hygiene-sync-preview'),
    hygieneSyncApply: byId('hygiene-sync-apply'),
    hygieneSyncResult: byId('hygiene-sync-result'),
    hygieneUnignoreStatus: byId('hygiene-unignore-status'),
    hygieneUnignorePreview: byId('hygiene-unignore-preview'),
    hygieneUnignoreApply: byId('hygiene-unignore-apply'),
    hygieneUnignoreResult: byId('hygiene-unignore-result'),
    hygieneVisibilityStatus: byId('hygiene-visibility-status'),
    hygieneVisibilityList: byId('hygiene-visibility-list'),
    hygieneVisibilityListResult: byId('hygiene-visibility-list-result'),
    hygieneVisibilityRepo: byId('hygiene-visibility-repo'),
    hygieneVisibilityValue: byId('hygiene-visibility-value'),
    hygieneVisibilitySet: byId('hygiene-visibility-set'),
    hygieneVisibilitySetResult: byId('hygiene-visibility-set-result'),
    hygieneApprovalDialog: byId('hygiene-approval-dialog'),
    hygieneApprovalScope: byId('hygiene-approval-scope'),
    hygieneApprovalCheck: byId('hygiene-approval-check'),
    hygieneCancelApproval: byId('hygiene-cancel-approval'),
    hygieneConfirmApproval: byId('hygiene-confirm-approval'),
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

  elements.auditRepository.addEventListener('change', function () {
    state.audit.target = elements.auditRepository.value;
    resetAuditResults();
    renderAuditWorkflow();
  });

  elements.auditValidate.addEventListener('click', function () { runAuditCommand('validate'); });
  elements.auditPreview.addEventListener('click', function () { runAuditCommand('preview'); });
  elements.auditRequestApproval.addEventListener('click', openAuditApproval);
  elements.auditExportEvidence.addEventListener('click', exportAuditEvidence);
  elements.auditApprovalCheck.addEventListener('change', function () {
    elements.auditConfirmApproval.disabled = !elements.auditApprovalCheck.checked;
  });
  elements.auditCancelApproval.addEventListener('click', closeAuditApproval);
  elements.auditConfirmApproval.addEventListener('click', confirmAuditApproval);

  elements.doctorRepository.addEventListener('change', function () {
    state.doctor.target = elements.doctorRepository.value;
    state.doctor.operations = [];
    state.doctor.lastResult = null;
    renderDoctorWorkflow();
  });
  elements.doctorRefresh.addEventListener('click', function () { runDoctorCommand('list', {}); });
  elements.doctorAddForm.addEventListener('submit', function (event) {
    event.preventDefault();
    registerDoctorOperationFromForm();
  });

  elements.hygieneSyncPreview.addEventListener('click', function () { runHygieneCommand('syncPreview', {}); });
  elements.hygieneSyncApply.addEventListener('click', function () { openHygieneApproval('syncApply', {}); });
  elements.hygieneUnignorePreview.addEventListener('click', function () { runHygieneCommand('unignorePreview', {}); });
  elements.hygieneUnignoreApply.addEventListener('click', function () { openHygieneApproval('unignoreApply', {}); });
  elements.hygieneVisibilityList.addEventListener('click', function () { runHygieneCommand('visibilityList', {}); });
  elements.hygieneVisibilitySet.addEventListener('click', function () {
    openHygieneApproval('visibilitySet', {
      repo: elements.hygieneVisibilityRepo.value.trim(),
      visibility: elements.hygieneVisibilityValue.value,
    });
  });
  elements.hygieneVisibilityRepo.addEventListener('input', renderHygieneWorkflow);
  elements.hygieneVisibilityValue.addEventListener('change', renderHygieneWorkflow);
  elements.hygieneApprovalCheck.addEventListener('change', function () {
    elements.hygieneConfirmApproval.disabled = !elements.hygieneApprovalCheck.checked;
  });
  elements.hygieneCancelApproval.addEventListener('click', closeHygieneApproval);
  elements.hygieneConfirmApproval.addEventListener('click', confirmHygieneApproval);

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
      if (state.audit.activeCommand && payload.ok === false) {
        state.audit.error = payload.message || 'Provider command failed.';
        state.audit.activeCommand = '';
        renderAuditWorkflow();
      }
      if (state.doctor.activeCommand && payload.ok === false) {
        state.doctor.error = payload.message || 'Provider command failed.';
        state.doctor.activeCommand = '';
        renderDoctorWorkflow();
      }
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
    if (message.type === 'eco.cockpit.providerCommandResult') {
      handleAuditProviderResult(message.payload || {});
      handleDoctorProviderResult(message.payload || {});
      handleHygieneProviderResult(message.payload || {});
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

    renderDevelopmentReadiness(state.snapshot.development || {});
    syncRunFilterOptions(records.runs);
    renderRuns();
    renderEscalations();
    renderArtifacts();
    renderPolicy();
    renderGovernance(state.snapshot.governance);
    renderDiagnostics(state.snapshot.diagnostics);
    renderHelmMode(state.snapshot.mode);
    renderEditorPlaneBar(records.runs, state.snapshot.governance, state.snapshot.mode);
    renderWizard();
    renderWorkspaceExplorer(state.snapshot.workspace || {});
    renderWorkspaceRepos(state.snapshot.workspace || {});
    renderNiji(state.snapshot.niji || {});
    syncAuditRepositories();
    syncDoctorRepositories();
    renderAuditWorkflow();
    renderDoctorWorkflow();
    renderHygieneWorkflow();
    renderProviderSummary(state.snapshot.marlin || {}, state.snapshot.niji || {});

    if (workspace.bridgeError) {
      elements.footer.textContent = workspace.bridgeError;
    } else if (workspace.workspaceRoot) {
      elements.footer.textContent = workspace.workspaceRoot + ' | refreshed ' + workspace.refreshedAt;
    } else {
      elements.footer.textContent = 'Open a workspace folder to load Cockpit. Eco-specific tabs (Runs, ' +
        'Escalations, Artifacts, Policy, Governance) need a .eco workspace; Marlin, Niji, Workspace, and ' +
        'Mode work in any folder.';
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

  function renderDevelopmentReadiness(development) {
    const readiness = development.installReadiness;
    if (!readiness) {
      elements.marlinStatus.textContent = 'Unavailable';
      elements.marlinApplyCommand.textContent = development.error || 'Install readiness is not available.';
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

  function statusLabel(health) {
    if (!health) {
      return '-';
    }
    if (health.status) {
      return String(health.status);
    }
    return health.reachable ? 'reachable' : 'unreachable';
  }

  function renderDiagnostics(diagnostics) {
    const diag = diagnostics || {};
    const integrations = diag.integrations || {};
    elements.diagIntegrationEco.textContent = statusLabel(integrations.eco);
    elements.diagIntegrationMarlin.textContent = statusLabel(integrations.marlin);
    elements.diagIntegrationNiji.textContent = statusLabel(integrations.niji);

    const env = diag.environment || {};
    const py = env.python || {};
    const node = env.node || {};
    elements.diagEnvPythonVersion.textContent = py.version || '-';
    elements.diagEnvCockpitVersion.textContent = py.cockpit_version || '-';
    elements.diagEnvNodeVersion.textContent = node.version || '-';
    elements.diagEnvNodeAvailable.textContent = node.available === true ? 'yes' : node.available === false ? 'no' : '-';

    const pipeline = diag.agentPipeline || {};
    const agents = Array.isArray(pipeline.agents) ? pipeline.agents : [];
    elements.diagPipelineStatus.textContent = pipeline.source_present
      ? String(pipeline.total_entries || 0) + ' entries'
      : 'No PLAY.jsonl found for this workspace';

    clear(elements.diagPipelineTable);
    if (!agents.length) {
      elements.diagPipelineTable.appendChild(emptyTableRow(5, 'No agent pipeline activity found.'));
      return;
    }
    agents.forEach(function (agent) {
      const row = document.createElement('tr');
      row.appendChild(cell(agent.agent || '-'));
      row.appendChild(cell(String(agent.pass_count || 0)));
      row.appendChild(cell(agent.last_play_id || '-'));
      row.appendChild(cell(agent.last_status || '-'));
      row.appendChild(cell(formatTimeLoc(agent.last_declared_at) || agent.last_declared_at || '-'));
      elements.diagPipelineTable.appendChild(row);
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

  function renderProviderSummary(marlin, niji) {
    const providers = [
      { name: 'Marlin', ok: !marlin.error },
      { name: 'Niji', ok: !niji.error },
    ];
    const okCount = providers.filter(function (p) { return p.ok; }).length;
    elements.providersStatus.textContent = okCount + '/' + providers.length + ' ok';
    elements.providersStatus.title = providers.map(function (p) {
      return p.name + ': ' + (p.ok ? 'ok' : 'unavailable');
    }).join(', ');
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

  function formatTimeLoc(timeLoc) {
    if (!timeLoc) {
      return '';
    }
    if (typeof timeLoc === 'string') {
      return timeLoc;
    }
    return timeLoc['stamp.utc'] || '';
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
        detail: formatTimeLoc(entry.time_loc),
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
    const development = snapshot.development || {};
    const readiness = development.installReadiness;

    if (!readiness) {
      const note = document.createElement('p');
      note.className = 'panel-note';
      note.textContent = development.error || 'Install readiness is not available.';
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

  const AUDIT_COMMANDS = {
    validate: 'marlin.audit.validate',
    preview: 'marlin.audit.normalize.preview',
    apply: 'marlin.audit.normalize.apply',
    verify: 'marlin.audit.verify',
  };

  function syncAuditRepositories() {
    const workspace = state.snapshot.workspace || {};
    const repos = Array.isArray(workspace.repoStatus) ? workspace.repoStatus : [];
    const workspaceRoot = String((state.snapshot.state || {}).workspaceRoot || '');
    const choices = repos.filter(function (repo) {
      return repo && typeof repo.absolute_path === 'string' && repo.absolute_path;
    }).map(function (repo) {
      return { label: String(repo.name || repo.path || repo.absolute_path), value: repo.absolute_path };
    });
    if (workspaceRoot && !choices.some(function (choice) { return choice.value === workspaceRoot; })) {
      choices.unshift({ label: 'Connected workspace', value: workspaceRoot });
    }

    const previous = state.audit.target;
    clear(elements.auditRepository);
    if (!choices.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No repository discovered';
      elements.auditRepository.appendChild(option);
      state.audit.target = '';
      return;
    }
    choices.forEach(function (choice) {
      const option = document.createElement('option');
      option.value = choice.value;
      option.textContent = choice.label + ' — ' + choice.value;
      elements.auditRepository.appendChild(option);
    });
    state.audit.target = choices.some(function (choice) { return choice.value === previous; })
      ? previous
      : choices[0].value;
    elements.auditRepository.value = state.audit.target;
  }

  function resetAuditResults() {
    state.audit.activeCommand = '';
    state.audit.error = '';
    state.audit.approval = null;
    state.audit.results = { validate: null, preview: null, apply: null, verify: null };
    closeAuditApproval();
  }

  function runAuditCommand(stage, approval) {
    const commandId = AUDIT_COMMANDS[stage];
    if (!commandId || !state.audit.target || state.audit.activeCommand) {
      return;
    }
    state.audit.error = '';
    state.audit.activeCommand = commandId;
    renderAuditWorkflow();
    post({
      type: 'eco.cockpit.invokeProviderCommand',
      providerId: 'marlin',
      commandId: commandId,
      input: { target: state.audit.target },
      confirm: stage === 'apply',
      approval: approval || undefined,
    });
  }

  function handleAuditProviderResult(result) {
    if (result.provider_id !== 'marlin') {
      return;
    }
    const stage = Object.keys(AUDIT_COMMANDS).find(function (key) {
      return AUDIT_COMMANDS[key] === result.command_id;
    });
    if (!stage) {
      return;
    }
    state.audit.results[stage] = result;
    state.audit.activeCommand = '';
    state.audit.error = '';
    renderAuditWorkflow();
    if (stage === 'apply' && result.status === 'succeeded') {
      runAuditCommand('verify');
    }
  }

  function openAuditApproval() {
    const preview = state.audit.results.preview;
    if (!preview || preview.status !== 'succeeded' || !state.audit.target) {
      return;
    }
    const input = { target: state.audit.target };
    state.audit.approval = {
      providerId: 'marlin',
      commandId: AUDIT_COMMANDS.apply,
      input: input,
      previewOperationId: preview.operation_id,
      token: approvalToken(),
      scope: approvalScope('marlin', AUDIT_COMMANDS.apply, input),
    };
    clear(elements.auditApprovalScope);
    [
      ['Provider', state.audit.approval.providerId],
      ['Command', state.audit.approval.commandId],
      ['Repository', state.audit.target],
      ['Preview operation', state.audit.approval.previewOperationId],
    ].forEach(function (entry) {
      const dt = document.createElement('dt');
      const dd = document.createElement('dd');
      dt.textContent = entry[0];
      dd.textContent = entry[1];
      elements.auditApprovalScope.appendChild(dt);
      elements.auditApprovalScope.appendChild(dd);
    });
    elements.auditApprovalCheck.checked = false;
    elements.auditConfirmApproval.disabled = true;
    elements.auditApprovalDialog.hidden = false;
    elements.auditApprovalCheck.focus();
    renderAuditWorkflow();
  }

  function closeAuditApproval() {
    elements.auditApprovalDialog.hidden = true;
    elements.auditApprovalCheck.checked = false;
    elements.auditConfirmApproval.disabled = true;
  }

  function confirmAuditApproval() {
    const approval = state.audit.approval;
    const preview = state.audit.results.preview;
    if (!elements.auditApprovalCheck.checked || !approval || !preview ||
        approval.previewOperationId !== preview.operation_id ||
        approval.input.target !== state.audit.target) {
      state.audit.error = 'Approval expired because the preview or repository changed.';
      closeAuditApproval();
      renderAuditWorkflow();
      return;
    }
    closeAuditApproval();
    runAuditCommand('apply', { token: approval.token, scope: approval.scope });
  }

  function approvalScope(providerId, commandId, input) {
    return canonicalStringify({ provider_id: providerId, command_id: commandId, input: input });
  }

  function canonicalStringify(value) {
    if (Array.isArray(value)) {
      return '[' + value.map(canonicalStringify).join(',') + ']';
    }
    if (value && typeof value === 'object') {
      return '{' + Object.keys(value).sort().map(function (key) {
        return JSON.stringify(key) + ':' + canonicalStringify(value[key]);
      }).join(',') + '}';
    }
    return JSON.stringify(value);
  }

  function approvalToken() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return 'cockpit-approval-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  }

  const DOCTOR_COMMANDS = {
    list: 'marlin.doctor.operations.list',
    register: 'marlin.doctor.operations.register',
    unregister: 'marlin.doctor.operations.unregister',
  };

  function syncDoctorRepositories() {
    const workspace = state.snapshot.workspace || {};
    const repos = Array.isArray(workspace.repoStatus) ? workspace.repoStatus : [];
    const workspaceRoot = String((state.snapshot.state || {}).workspaceRoot || '');
    const choices = repos.filter(function (repo) {
      return repo && typeof repo.absolute_path === 'string' && repo.absolute_path;
    }).map(function (repo) {
      return { label: String(repo.name || repo.path || repo.absolute_path), value: repo.absolute_path };
    });
    if (workspaceRoot && !choices.some(function (choice) { return choice.value === workspaceRoot; })) {
      choices.unshift({ label: 'Connected workspace', value: workspaceRoot });
    }

    const previous = state.doctor.target;
    clear(elements.doctorRepository);
    if (!choices.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No repository discovered';
      elements.doctorRepository.appendChild(option);
      state.doctor.target = '';
      return;
    }
    choices.forEach(function (choice) {
      const option = document.createElement('option');
      option.value = choice.value;
      option.textContent = choice.label + ' — ' + choice.value;
      elements.doctorRepository.appendChild(option);
    });
    state.doctor.target = choices.some(function (choice) { return choice.value === previous; })
      ? previous
      : choices[0].value;
    elements.doctorRepository.value = state.doctor.target;
  }

  function runDoctorCommand(stage, input) {
    const commandId = DOCTOR_COMMANDS[stage];
    if (!commandId || !state.doctor.target || state.doctor.activeCommand) {
      return;
    }
    const payload = Object.assign({ target: state.doctor.target }, input || {});
    const mutates = stage === 'register' || stage === 'unregister';
    state.doctor.error = '';
    state.doctor.activeCommand = commandId;
    renderDoctorWorkflow();
    post({
      type: 'eco.cockpit.invokeProviderCommand',
      providerId: 'marlin',
      commandId: commandId,
      input: payload,
      confirm: mutates,
      approval: mutates ? { token: approvalToken(), scope: approvalScope('marlin', commandId, payload) } : undefined,
    });
  }

  function registerDoctorOperationFromForm() {
    let command;
    try {
      command = JSON.parse(elements.doctorCommandJson.value || '[]');
    } catch (error) {
      showNotice(error instanceof Error ? error.message : String(error), true);
      return;
    }
    const id = elements.doctorOperationId.value.trim();
    const title = elements.doctorOperationTitle.value.trim();
    if (!id || !title || !Array.isArray(command)) {
      showNotice('Doctor operation id, title, and command JSON array are required.', true);
      return;
    }
    const operation = {
      id: id,
      title: title,
      command: command,
      mutates: elements.doctorOperationMutates.checked,
      requires_confirmation: elements.doctorOperationMutates.checked,
      supports_preview: elements.doctorOperationPreview.checked,
      output: elements.doctorOperationOutput.value || 'auto',
    };
    const cwd = elements.doctorOperationCwd.value.trim();
    if (cwd) {
      operation.cwd = cwd;
    }
    runDoctorCommand('register', { operation: operation, replace: true });
  }

  function handleDoctorProviderResult(result) {
    if (result.provider_id !== 'marlin') {
      return;
    }
    const stage = Object.keys(DOCTOR_COMMANDS).find(function (key) {
      return DOCTOR_COMMANDS[key] === result.command_id;
    });
    if (!stage) {
      return;
    }
    state.doctor.lastResult = result;
    state.doctor.activeCommand = '';
    if (result.status === 'succeeded' && result.data && Array.isArray(result.data.operations)) {
      state.doctor.operations = result.data.operations;
    }
    if (result.status !== 'succeeded') {
      state.doctor.error = (result.error && result.error.message) || 'Doctor provider command failed.';
    }
    renderDoctorWorkflow();
  }

  function renderDoctorWorkflow() {
    const busy = Boolean(state.doctor.activeCommand);
    elements.doctorRepository.disabled = busy;
    elements.doctorRefresh.disabled = busy || !state.doctor.target;
    elements.doctorAddForm.querySelectorAll('input, select, textarea, button').forEach(function (control) {
      control.disabled = busy || !state.doctor.target;
    });
    elements.doctorRegistryStatus.textContent = busy
      ? 'Running'
      : state.doctor.lastResult
        ? state.doctor.lastResult.status
        : 'Not loaded';
    elements.doctorOperationCount.textContent = String(state.doctor.operations.length) + ' operations';
    renderDoctorOperationsTable();
    elements.doctorLastResult.textContent = state.doctor.lastResult
      ? JSON.stringify({
          command_id: state.doctor.lastResult.command_id,
          status: state.doctor.lastResult.status,
          data: state.doctor.lastResult.data,
          error: state.doctor.lastResult.error,
        }, null, 2)
      : '';
    if (state.doctor.error) {
      showNotice(state.doctor.error, true);
      state.doctor.error = '';
    }
  }

  function renderDoctorOperationsTable() {
    clear(elements.doctorOperationTable);
    if (!state.doctor.operations.length) {
      elements.doctorOperationTable.appendChild(emptyTableRow(4, 'No Doctor operations registered.'));
      return;
    }
    state.doctor.operations.forEach(function (operation) {
      const row = document.createElement('tr');
      const id = document.createElement('td');
      const mode = document.createElement('td');
      const command = document.createElement('td');
      const actions = document.createElement('td');
      const remove = document.createElement('button');
      id.textContent = operation.id || '-';
      mode.textContent = (operation.enabled === false ? 'disabled' : 'enabled') + ' / ' + (operation.mutates ? 'mutates' : 'read');
      command.textContent = Array.isArray(operation.command) ? operation.command.join(' ') : '-';
      remove.type = 'button';
      remove.textContent = 'Remove';
      remove.addEventListener('click', function () {
        runDoctorCommand('unregister', { operation_id: operation.id });
      });
      actions.appendChild(remove);
      row.appendChild(id);
      row.appendChild(mode);
      row.appendChild(command);
      row.appendChild(actions);
      elements.doctorOperationTable.appendChild(row);
    });
  }

  const HYGIENE_COMMANDS = {
    syncPreview: 'hygiene.sync-dev-docs.preview',
    syncApply: 'hygiene.sync-dev-docs.apply',
    unignorePreview: 'hygiene.unignore-dev-docs.preview',
    unignoreApply: 'hygiene.unignore-dev-docs.apply',
    visibilityList: 'hygiene.repo-visibility.list',
    visibilitySet: 'hygiene.repo-visibility.set',
  };

  const HYGIENE_MUTATING_STAGES = { syncApply: true, unignoreApply: true, visibilitySet: true };

  function runHygieneCommand(stage, input, approval) {
    const commandId = HYGIENE_COMMANDS[stage];
    if (!commandId || state.hygiene.activeCommand) {
      return;
    }
    state.hygiene.error = '';
    state.hygiene.activeCommand = commandId;
    renderHygieneWorkflow();
    post({
      type: 'eco.cockpit.invokeProviderCommand',
      providerId: 'hygiene',
      commandId: commandId,
      input: input || {},
      confirm: Boolean(HYGIENE_MUTATING_STAGES[stage]),
      approval: approval || undefined,
    });
  }

  function handleHygieneProviderResult(result) {
    if (result.provider_id !== 'hygiene') {
      return;
    }
    const stage = Object.keys(HYGIENE_COMMANDS).find(function (key) {
      return HYGIENE_COMMANDS[key] === result.command_id;
    });
    if (!stage) {
      return;
    }
    state.hygiene.results[stage] = result;
    state.hygiene.activeCommand = '';
    renderHygieneWorkflow();
  }

  function openHygieneApproval(stage, input) {
    const commandId = HYGIENE_COMMANDS[stage];
    if (!commandId || !HYGIENE_MUTATING_STAGES[stage]) {
      return;
    }
    state.hygiene.approval = {
      stage: stage,
      commandId: commandId,
      input: input,
      token: approvalToken(),
      scope: approvalScope('hygiene', commandId, input),
    };
    clear(elements.hygieneApprovalScope);
    [
      ['Provider', 'hygiene'],
      ['Command', commandId],
      ['Input', JSON.stringify(input)],
    ].forEach(function (entry) {
      const dt = document.createElement('dt');
      const dd = document.createElement('dd');
      dt.textContent = entry[0];
      dd.textContent = entry[1];
      elements.hygieneApprovalScope.appendChild(dt);
      elements.hygieneApprovalScope.appendChild(dd);
    });
    elements.hygieneApprovalCheck.checked = false;
    elements.hygieneConfirmApproval.disabled = true;
    elements.hygieneApprovalDialog.hidden = false;
    elements.hygieneApprovalCheck.focus();
  }

  function closeHygieneApproval() {
    elements.hygieneApprovalDialog.hidden = true;
    elements.hygieneApprovalCheck.checked = false;
    elements.hygieneConfirmApproval.disabled = true;
  }

  function confirmHygieneApproval() {
    const approval = state.hygiene.approval;
    if (!elements.hygieneApprovalCheck.checked || !approval) {
      state.hygiene.error = 'Approval was not confirmed.';
      closeHygieneApproval();
      renderHygieneWorkflow();
      return;
    }
    closeHygieneApproval();
    runHygieneCommand(approval.stage, approval.input, { token: approval.token, scope: approval.scope });
  }

  function renderHygieneOutput(result) {
    if (!result) {
      return '';
    }
    if (result.data && typeof result.data.output === 'string' && result.data.output.trim()) {
      return result.data.output.trim();
    }
    if (result.error && result.error.message) {
      return result.error.message;
    }
    return JSON.stringify(result.data || {}, null, 2);
  }

  function renderHygieneWorkflow() {
    const results = state.hygiene.results;
    const busy = Boolean(state.hygiene.activeCommand);

    function statusFor(previewKey, applyKey) {
      if (state.hygiene.activeCommand === HYGIENE_COMMANDS[previewKey] || state.hygiene.activeCommand === HYGIENE_COMMANDS[applyKey]) {
        return 'Running…';
      }
      const latest = (applyKey && results[applyKey]) || results[previewKey];
      return latest ? latest.status : 'Not run';
    }

    elements.hygieneSyncStatus.textContent = statusFor('syncPreview', 'syncApply');
    elements.hygieneSyncResult.textContent = renderHygieneOutput(results.syncApply || results.syncPreview);
    elements.hygieneSyncPreview.disabled = busy;
    elements.hygieneSyncApply.disabled = busy || !results.syncPreview || results.syncPreview.status !== 'succeeded';

    elements.hygieneUnignoreStatus.textContent = statusFor('unignorePreview', 'unignoreApply');
    elements.hygieneUnignoreResult.textContent = renderHygieneOutput(results.unignoreApply || results.unignorePreview);
    elements.hygieneUnignorePreview.disabled = busy;
    elements.hygieneUnignoreApply.disabled = busy || !results.unignorePreview || results.unignorePreview.status !== 'succeeded';

    elements.hygieneVisibilityStatus.textContent = statusFor('visibilityList', 'visibilitySet');
    elements.hygieneVisibilityListResult.textContent = renderHygieneOutput(results.visibilityList);
    elements.hygieneVisibilitySetResult.textContent = renderHygieneOutput(results.visibilitySet);
    elements.hygieneVisibilityList.disabled = busy;
    const repoFilled = Boolean(elements.hygieneVisibilityRepo.value.trim() && elements.hygieneVisibilityValue.value);
    elements.hygieneVisibilitySet.disabled = busy || !repoFilled;

    if (state.hygiene.error) {
      showNotice(state.hygiene.error, true, false);
      state.hygiene.error = '';
    }
  }

  function renderAuditWorkflow() {
    const results = state.audit.results;
    const active = state.audit.activeCommand;
    const verifyBundle = evidenceBundle(results.verify);
    elements.auditDiscoverStatus.textContent = state.audit.target || 'Choose a repository';
    elements.auditValidateStatus.textContent = auditStageLabel('validate');
    elements.auditPreviewStatus.textContent = auditStageLabel('preview');
    elements.auditApprovalStatus.textContent = state.audit.approval ? 'Bound to preview ' + state.audit.approval.previewOperationId : 'Not requested';
    elements.auditApplyStatus.textContent = auditStageLabel('apply');
    elements.auditVerifyStatus.textContent = auditStageLabel('verify');
    elements.auditEvidenceStatus.textContent = verifyBundle ? 'Ready to export' : 'Not available';

    elements.auditRepository.disabled = Boolean(active);
    elements.auditValidate.disabled = !state.audit.target || Boolean(active);
    elements.auditPreview.disabled = !results.validate || Boolean(active);
    elements.auditRequestApproval.disabled = !results.preview || results.preview.status !== 'succeeded' || Boolean(active);
    elements.auditExportEvidence.disabled = !verifyBundle || Boolean(active);

    renderAuditResult(elements.auditValidationResult, results.validate, 'Run validation to load findings.');
    renderAuditResult(elements.auditPreviewResult, results.preview, 'Preview has not run.');
    renderAuditResult(elements.auditApplyResult, results.apply, state.audit.error || 'No remediation has executed.');
    renderAuditResult(elements.auditVerifyResult, results.verify, 'Verification has not run.');
    elements.auditFindingsCount.textContent = String(auditFindings(results.validate).length) + ' findings';
    elements.auditPreviewOperation.textContent = results.preview ? results.preview.operation_id : '-';
    elements.auditApplyOperation.textContent = results.apply ? results.apply.operation_id : '-';
    elements.auditVerifyOperation.textContent = results.verify ? results.verify.operation_id : '-';
  }

  function auditStageLabel(stage) {
    if (state.audit.activeCommand === AUDIT_COMMANDS[stage]) return 'Running';
    const result = state.audit.results[stage];
    return result ? result.status : 'Not run';
  }

  function renderAuditResult(container, result, emptyText) {
    clear(container);
    if (!result) {
      const empty = document.createElement('div');
      empty.className = 'item';
      empty.textContent = emptyText;
      container.appendChild(empty);
      return;
    }
    const summary = document.createElement('div');
    summary.className = 'item audit-result-summary';
    const title = document.createElement('strong');
    const detail = document.createElement('span');
    title.textContent = result.status + ' — ' + (result.command_id || 'provider command');
    detail.textContent = String((result.data && result.data.message) || (result.error && result.error.message) || 'Structured provider result received.');
    summary.appendChild(title);
    summary.appendChild(detail);
    container.appendChild(summary);

    auditFindings(result).forEach(function (finding) {
      const row = document.createElement('div');
      const findingTitle = document.createElement('strong');
      const findingDetail = document.createElement('span');
      row.className = 'item audit-finding' + (finding.severity === 'error' ? ' is-error' : '');
      findingTitle.textContent = String(finding.severity || 'finding') + ' — ' + String(finding.id || finding.rule || 'GC-AUDIT');
      findingDetail.textContent = String(finding.description || '') + (finding.remediation ? ' Remediation: ' + finding.remediation : '');
      row.appendChild(findingTitle);
      row.appendChild(findingDetail);
      container.appendChild(row);
    });

    (Array.isArray(result.evidence) ? result.evidence : []).forEach(function (evidence) {
      const row = document.createElement('div');
      row.className = 'item audit-evidence-ref';
      row.textContent = String(evidence.kind || 'evidence') + ': ' + String(evidence.ref || '') + (evidence.digest ? ' (' + evidence.digest + ')' : '');
      container.appendChild(row);
    });
  }

  function evidenceBundle(result) {
    return result && result.data && result.data.evidence_bundle ? result.data.evidence_bundle : null;
  }

  function auditFindings(result) {
    const bundle = evidenceBundle(result);
    return bundle && Array.isArray(bundle.findings) ? bundle.findings : [];
  }

  function exportAuditEvidence() {
    const bundle = evidenceBundle(state.audit.results.verify);
    if (!bundle) return;
    const blob = new Blob([JSON.stringify(bundle, null, 2) + '\n'], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = String(bundle.bundle_id || 'marlin-verify-evidence') + '.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 0);
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

  function renderWorkspaceExplorer(workspace) {
    const tree = workspace.workspaceTree;
    clear(elements.workspaceTree);
    clear(elements.workspaceMetadata);
    if (!tree || !Array.isArray(tree.nodes)) {
      elements.workspaceTreeStatus.textContent = workspace.error || 'Workspace tree not loaded.';
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
        renderWorkspaceExplorer(workspace);
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

  function renderWorkspaceRepos(workspace) {
    const repos = Array.isArray(workspace.repoStatus) ? workspace.repoStatus : [];
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
      development: snapshot.development || {},
      workspace: snapshot.workspace || {},
      marlin: snapshot.marlin || {},
      records: Object.assign(emptyRecords(), snapshot.records || {}),
      governance: snapshot.governance || null,
      mode: snapshot.mode || null,
      niji: snapshot.niji || {},
      diagnostics: snapshot.diagnostics || {},
    };
  }

  function emptySnapshot() {
    return {
      state: {},
      health: {},
      development: {},
      workspace: {},
      marlin: {},
      records: emptyRecords(),
      governance: null,
      mode: null,
      niji: {},
      diagnostics: {},
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
