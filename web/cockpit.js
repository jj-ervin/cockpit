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

  // Operational state is authoritative in CockpitState. The proxy below preserves
  // the recovered GUI's existing `state.foo.bar` programming model while routing
  // every read/write through the versioned state contract. This is intentionally a
  // compatibility facade: GUI behavior stays intact while the store becomes the
  // single authority.
  const cockpitState = window.CockpitState.create({
    snapshot: emptySnapshot(),
    ui: {
      selectedRunId: '',
      runFilter: 'all',
      wizardStep: 0,
    },
  });

  // Feature-owned workflow state deliberately does not enter CockpitState.
  // These objects contain transient provider/workflow details rather than
  // Cockpit-wide operational state.
  const providerCommandCatalog = {
    schema_version: 'cockpit-provider-command-catalog-v1',
    providers: [],
  };

  function findProviderCommand(providerId, commandId) {
    const provider = providerCommandCatalog.providers.find(function (item) { return item && item.id === providerId; });
    if (!provider || !Array.isArray(provider.commands)) return null;
    return provider.commands.find(function (command) { return command && command.id === commandId; }) || null;
  }

  function providerCommandTitle(providerId, commandId, fallback) {
    const command = findProviderCommand(providerId, commandId);
    return command && command.title ? command.title : fallback || commandId;
  }

  function providerCommandInputSummary(command) {
    if (!Object.prototype.hasOwnProperty.call(command || {}, 'input')) {
      return 'Input: unavailable (v1 catalog)';
    }
    const input = command.input;
    if (!input || input.mode === 'none') return 'Input: none';
    if (input.mode !== 'object' || !Array.isArray(input.fields)) {
      return 'Input: unavailable (invalid metadata)';
    }
    return 'Input: ' + input.fields.length + ' field' + (input.fields.length === 1 ? '' : 's');
  }

  function providerCommandRequiresConfirmation(providerId, commandId, fallback) {
    const command = findProviderCommand(providerId, commandId);
    if (!command) return Boolean(fallback);
    return command.requires_confirmation === true || command.mutation === true || Boolean(fallback);
  }

  function renderCommandPalette() {
    const query = String(elements.commandPaletteFilter.value || '').trim().toLowerCase();
    const commands = [];
    providerCommandCatalog.providers.forEach(function (provider) {
      (Array.isArray(provider.commands) ? provider.commands : []).forEach(function (command) {
        const haystack = [
          provider.id,
          provider.name,
          command.id,
          command.title,
          command.action,
        ].join(' ').toLowerCase();
        if (!query || haystack.indexOf(query) !== -1) {
          commands.push({ provider: provider, command: command });
        }
      });
    });

    clear(elements.commandPaletteList);
    if (!commands.length) {
      elements.commandPaletteList.appendChild(emptyDiv(
        providerCommandCatalog.providers.length
          ? 'No discovered commands match the filter.'
          : 'No provider commands have been discovered yet.'
      ));
      elements.commandPaletteNote.textContent = providerCommandCatalog.providers.length
        ? 'Command metadata is live from the provider catalog. Input schemas are not currently part of the provider contract, so commands are not invoked blindly from this palette.'
        : 'Waiting for the host to return the discovered provider command catalog.';
      return;
    }

    commands.forEach(function (entry) {
      const item = document.createElement('article');
      const title = document.createElement('strong');
      const commandId = document.createElement('code');
      const action = document.createElement('small');
      const badge = document.createElement('span');
      item.className = 'command-palette-item';
      title.textContent = entry.provider.name + ' — ' + entry.command.title;
      commandId.textContent = entry.command.id;
      action.textContent = 'Action: ' + entry.command.action;
      input.textContent = providerCommandInputSummary(entry.command);
      badge.className = 'command-palette-badge';
      badge.textContent = providerCommandRequiresConfirmation(
        entry.provider.id,
        entry.command.id,
        false
      ) ? 'Approval required' : 'Read-only';
      item.appendChild(title);
      item.appendChild(commandId);
      item.appendChild(action);
      item.appendChild(input);
      item.appendChild(badge);
      elements.commandPaletteList.appendChild(item);
    });

    elements.commandPaletteNote.textContent =
      commands.length + ' discovered command' + (commands.length === 1 ? '' : 's') +
      '. The palette is a discovery surface; provider workflows supply command-specific input and execution approval.';
  }

  const featureState = {
    marlin: {
      searchResults: [],
      searchError: '',
      installResult: null,
      packageApproval: { packageName: '', status: 'idle', resolved: null, error: '' },
    },
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
      assessment: null,
      operations: [],
      operationInputs: {},
      registryDigest: '',
      approval: null,
    },
    agents: {
      activeCommand: '',
      error: '',
      lastResult: null,
      templates: [],
      detections: {},
      rosterDigest: '',
      approval: null,
    },
    nijiProof: {
      activeCommand: '',
      error: '',
      lastResult: null,
    },
    sealdex: {
      plan: { activeCommand: '', error: '', proposeResult: null },
      entry: { activeCommand: '', error: '', tables: {}, selectedTable: '', lastResult: '' },
      pendingApproval: null,
    },
  };

  // Presentation-only state: timers and editor/undo baselines are not
  // operational state and must not become CockpitState fields.
  let policyOriginal = '{}';
  let lastDeletedArtifact = null;
  let selectedWorkspacePath = '';
  let noticeTimer = null;

  const STATE_UI_KEYS = new Set(['selectedRunId', 'runFilter', 'wizardStep']);
  const STATE_SNAPSHOT_KEY = 'snapshot';

  function cloneStateValue(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
  }

  function setSnapshotPath(path, value) {
    if (path.length === 1 && path[0] === STATE_SNAPSHOT_KEY) {
      cockpitState.replaceSnapshot({});
      return;
    }
    const effectivePath = path[0] === STATE_SNAPSHOT_KEY ? path.slice(1) : path;
    const snapshot = cloneStateValue(cockpitState.get().snapshot || {});
    let target = snapshot;
    for (let i = 0; i < effectivePath.length - 1; i += 1) {
      const key = effectivePath[i];
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      target = target[key];
    }
    target[effectivePath[effectivePath.length - 1]] = cloneStateValue(value);
    cockpitState.replaceSnapshot(snapshot);
  }

  function readRawStatePath(path) {
    if (!path.length) return cockpitState.get().snapshot;
    const rootKey = path[0];
    if (STATE_UI_KEYS.has(rootKey)) {
      const ui = cockpitState.get().ui || {};
      return path.length === 1 ? ui[rootKey] : undefined;
    }
    let value = cockpitState.get().snapshot;
    const effectivePath = rootKey === STATE_SNAPSHOT_KEY ? path.slice(1) : path;
    for (let i = 0; i < effectivePath.length; i += 1) {
      if (value == null) return undefined;
      value = value[effectivePath[i]];
    }
    return value;
  }

  function makeStateProxy(path) {
    const rawValue = readRawStatePath(path);
    const target = Array.isArray(rawValue) ? rawValue.slice() : (rawValue && typeof rawValue === 'object' ? Object.assign({}, rawValue) : {});
    return new Proxy(target, {
      get: function (_target, property) {
        if (property === Symbol.toStringTag) return Array.isArray(readRawStatePath(path)) ? 'Array' : 'CockpitState';
        if (property === 'toJSON') return function () { return cloneStateValue(readRawStatePath(path)); };
        return readStatePath(path.concat(property));
      },
      set: function (_target, property, value) {
        writeStatePath(path.concat(property), value);
        return true;
      },
      deleteProperty: function (_target, property) {
        deleteStatePath(path.concat(property));
        return true;
      },
      ownKeys: function () {
        const value = readRawStatePath(path);
        return value && typeof value === 'object' ? Reflect.ownKeys(value) : [];
      },
      getOwnPropertyDescriptor: function (_target, property) {
        const value = readRawStatePath(path);
        if (value && Object.prototype.hasOwnProperty.call(value, property)) {
          return { enumerable: true, configurable: true };
        }
        return undefined;
      },
    });
  }

  const proxyCache = new Map();

  function readStatePath(path) {
    const value = readRawStatePath(path);
    if (value && typeof value === 'object') {
      const key = path.join('.');
      if (!proxyCache.has(key)) proxyCache.set(key, makeStateProxy(path));
      return proxyCache.get(key);
    }
    return value;
  }

  function writeStatePath(path, value) {
    if (path.length === 1 && STATE_UI_KEYS.has(path[0])) {
      cockpitState.setUi({ [path[0]]: value });
      return;
    }
    if (path.length === 1 && path[0] === STATE_SNAPSHOT_KEY) {
      cockpitState.replaceSnapshot(value || {});
      return;
    }
    setSnapshotPath(path[0] === STATE_SNAPSHOT_KEY ? path.slice(1) : path, value);
  }

  function deleteStatePath(path) {
    if (path.length === 1 && STATE_UI_KEYS.has(path[0])) {
      cockpitState.setUi({ [path[0]]: undefined });
      return;
    }
    const snapshot = cloneStateValue(cockpitState.get().snapshot || {});
    const effectivePath = path[0] === STATE_SNAPSHOT_KEY ? path.slice(1) : path;
    let target = snapshot;
    for (let i = 0; i < effectivePath.length - 1; i += 1) {
      if (!target || typeof target !== 'object') return;
      target = target[effectivePath[i]];
    }
    if (target && typeof target === 'object' && effectivePath.length) {
      delete target[effectivePath[effectivePath.length - 1]];
    }
    cockpitState.replaceSnapshot(snapshot);
  }

  const state = makeStateProxy([]);

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
    commandPaletteToggle: byId('command-palette-toggle'),
    commandPalette: byId('command-palette'),
    commandPaletteClose: byId('command-palette-close'),
    commandPaletteFilter: byId('command-palette-filter'),
    commandPaletteList: byId('command-palette-list'),
    commandPaletteNote: byId('command-palette-note'),
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
    nijiProofRun: byId('niji-proof-run'),
    nijiProofStatus: byId('niji-proof-status'),
    nijiProofSwatches: byId('niji-proof-swatches'),
    sealdexPlanNeed: byId('sealdex-plan-need'),
    sealdexPlanPropose: byId('sealdex-plan-propose'),
    sealdexPlanApprove: byId('sealdex-plan-approve'),
    sealdexPlanDiscard: byId('sealdex-plan-discard'),
    sealdexPlanStatus: byId('sealdex-plan-status'),
    sealdexPlanSummary: byId('sealdex-plan-summary'),
    sealdexPlanChecks: byId('sealdex-plan-checks'),
    sealdexEntryStatus: byId('sealdex-entry-status'),
    sealdexEntryTable: byId('sealdex-entry-table'),
    sealdexEntryRefreshTables: byId('sealdex-entry-refresh-tables'),
    sealdexEntryFields: byId('sealdex-entry-fields'),
    sealdexEntryAdd: byId('sealdex-entry-add'),
    sealdexEntryCsv: byId('sealdex-entry-csv'),
    sealdexEntryImport: byId('sealdex-entry-import'),
    sealdexEntryResult: byId('sealdex-entry-result'),
    sealdexApprovalDialog: byId('sealdex-approval-dialog'),
    sealdexApprovalScope: byId('sealdex-approval-scope'),
    sealdexApprovalCheck: byId('sealdex-approval-check'),
    sealdexCancelApproval: byId('sealdex-cancel-approval'),
    sealdexConfirmApproval: byId('sealdex-confirm-approval'),
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
    doctorHealthRefresh: byId('doctor-health-refresh'),
    doctorHealthStatus: byId('doctor-health-status'),
    doctorHealthProject: byId('doctor-health-project'),
    doctorHealthGit: byId('doctor-health-git'),
    doctorHealthGovernance: byId('doctor-health-governance'),
    doctorHealthTests: byId('doctor-health-tests'),
    doctorHealthFlags: byId('doctor-health-flags'),
    doctorHealthDetails: byId('doctor-health-details'),
    doctorRefresh: byId('doctor-refresh'),
    doctorOperationCount: byId('doctor-operation-count'),
    doctorOperationTable: byId('doctor-operation-table'),
    doctorRegistryStatus: byId('doctor-registry-status'),
    doctorAddForm: byId('doctor-add-form'),
    doctorOperationId: byId('doctor-operation-id'),
    doctorOperationTitle: byId('doctor-operation-title'),
    doctorCommandJson: byId('doctor-command-json'),
    doctorPreviewCommandJson: byId('doctor-preview-command-json'),
    doctorOperationCwd: byId('doctor-operation-cwd'),
    doctorOperationOutput: byId('doctor-operation-output'),
    doctorOperationInputsJson: byId('doctor-operation-inputs-json'),
    doctorOperationMutates: byId('doctor-operation-mutates'),
    doctorOperationPreview: byId('doctor-operation-preview'),
    doctorLastResult: byId('doctor-last-result'),
    doctorApprovalDialog: byId('doctor-approval-dialog'),
    doctorApprovalScope: byId('doctor-approval-scope'),
    doctorApprovalCheck: byId('doctor-approval-check'),
    doctorCancelApproval: byId('doctor-cancel-approval'),
    doctorConfirmApproval: byId('doctor-confirm-approval'),
    agentRosterList: byId('agent-roster-list'),
    agentRosterDetect: byId('agent-roster-detect'),
    agentRosterCount: byId('agent-roster-count'),
    agentRosterTable: byId('agent-roster-table'),
    agentRosterStatus: byId('agent-roster-status'),
    agentRosterAddForm: byId('agent-roster-add-form'),
    agentTemplateId: byId('agent-template-id'),
    agentTemplateName: byId('agent-template-name'),
    agentDetectCommandJson: byId('agent-detect-command-json'),
    agentRunCommandJson: byId('agent-run-command-json'),
    agentTemplateCapabilities: byId('agent-template-capabilities'),
    agentTemplateMutates: byId('agent-template-mutates'),
    agentTemplatePromptFile: byId('agent-template-prompt-file'),
    agentTemplateTargetPath: byId('agent-template-target-path'),
    agentRosterLastResult: byId('agent-roster-last-result'),
    agentApprovalDialog: byId('agent-approval-dialog'),
    agentApprovalScope: byId('agent-approval-scope'),
    agentApprovalCheck: byId('agent-approval-check'),
    agentCancelApproval: byId('agent-cancel-approval'),
    agentConfirmApproval: byId('agent-confirm-approval'),
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

  elements.commandPaletteToggle.addEventListener('click', function () {
    elements.commandPalette.hidden = !elements.commandPalette.hidden;
    if (!elements.commandPalette.hidden) {
      renderCommandPalette();
      elements.commandPaletteFilter.focus();
    }
  });

  elements.commandPaletteClose.addEventListener('click', function () {
    elements.commandPalette.hidden = true;
  });

  elements.commandPaletteFilter.addEventListener('input', renderCommandPalette);

  elements.tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      window.AppShell.setActiveTab(elements.tabs, elements.panels, tab.dataset.tab);
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
    elements.policyEditor.value = policyOriginal;
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
    if (!lastDeletedArtifact) {
      return;
    }
    post({
      type: 'eco.cockpit.undoDeleteArtifact',
      originalPath: lastDeletedArtifact.original_path,
      trashPath: lastDeletedArtifact.trash_path,
    });
    lastDeletedArtifact = null;
    elements.undoDeleteArtifact.disabled = true;
  });

  elements.nijiProofRun.addEventListener('click', function () {
    if (featureState.nijiProof.activeCommand) {
      return;
    }
    featureState.nijiProof.error = '';
    featureState.nijiProof.activeCommand = 'niji.palette.preview';
    renderNijiProof();
    invokeProviderCommand(
      'niji',
      'niji.palette.preview',
      { base_hex: '#3366CC', scheme_key: 'complementary', naming_mode: 'natural', swatch_count: 5 },
      false
    );
  });

  elements.sealdexPlanPropose.addEventListener('click', function () {
    if (featureState.sealdex.plan.activeCommand) {
      return;
    }
    const need = elements.sealdexPlanNeed.value.trim();
    if (!need) {
      return;
    }
    featureState.sealdex.plan.error = '';
    featureState.sealdex.plan.activeCommand = 'sealdex.schema.propose';
    renderSealdexPlan();
    runSealdexCommand('sealdex.schema.propose', { need: need }, false, undefined);
  });

  elements.sealdexPlanApprove.addEventListener('click', function () {
    const result = featureState.sealdex.plan.proposeResult;
    if (!result || result.status !== 'pending-approval' || !result.data || !result.data.plan) {
      return;
    }
    // checks is the exact pre-write check list shown to the human at
    // propose time -- provider.py rejects apply as stale if a fresh
    // recomputation differs, so the approval must carry the same list
    // that was actually reviewed, not just the plan.
    openSealdexApproval('sealdex.schema.apply', { plan: result.data.plan, checks: result.data.checks || [] });
  });

  elements.sealdexPlanDiscard.addEventListener('click', function () {
    featureState.sealdex.plan.proposeResult = null;
    featureState.sealdex.plan.error = '';
    renderSealdexPlan();
  });

  elements.sealdexEntryRefreshTables.addEventListener('click', function () {
    if (featureState.sealdex.entry.activeCommand) {
      return;
    }
    featureState.sealdex.entry.error = '';
    featureState.sealdex.entry.activeCommand = 'sealdex.entry.tables';
    renderSealdexEntry();
    runSealdexCommand('sealdex.entry.tables', {}, false, undefined);
  });

  elements.sealdexEntryTable.addEventListener('change', function () {
    featureState.sealdex.entry.selectedTable = elements.sealdexEntryTable.value;
    renderSealdexEntryFields();
  });

  elements.sealdexEntryAdd.addEventListener('click', function () {
    const table = featureState.sealdex.entry.selectedTable;
    if (!table) {
      return;
    }
    const fields = collectSealdexEntryFields();
    if (!fields) {
      return;
    }
    openSealdexApproval('sealdex.entry.add', { table: table, fields: fields });
  });

  elements.sealdexEntryImport.addEventListener('click', function () {
    const table = featureState.sealdex.entry.selectedTable;
    const csvText = elements.sealdexEntryCsv.value;
    if (!table || !csvText.trim()) {
      return;
    }
    openSealdexApproval('sealdex.entry.import', { table: table, csv_text: csvText });
  });

  elements.sealdexApprovalCheck.addEventListener('change', function () {
    elements.sealdexConfirmApproval.disabled = !elements.sealdexApprovalCheck.checked;
  });

  elements.sealdexCancelApproval.addEventListener('click', function () {
    closeSealdexApproval();
  });

  elements.sealdexConfirmApproval.addEventListener('click', function () {
    const approval = featureState.sealdex.pendingApproval;
    if (!elements.sealdexApprovalCheck.checked || !approval) {
      closeSealdexApproval();
      return;
    }
    const commandId = approval.commandId;
    const input = approval.input;
    const bound = { token: approval.token, scope: approval.scope };
    closeSealdexApproval();
    if (commandId === 'sealdex.schema.apply') {
      featureState.sealdex.plan.activeCommand = commandId;
      renderSealdexPlan();
    } else {
      featureState.sealdex.entry.activeCommand = commandId;
      renderSealdexEntry();
    }
    runSealdexCommand(commandId, input, true, bound);
  });

  elements.workspaceReveal.addEventListener('click', function () {
    if (selectedWorkspacePath) {
      post({
        type: 'eco.cockpit.workspaceReveal',
        workspaceId: workspaceId(),
        path: selectedWorkspacePath,
      });
    }
  });

  elements.workspaceStatusAction.addEventListener('click', function () {
    if (selectedWorkspacePath) {
      post({
        type: 'eco.cockpit.workspaceStatus',
        workspaceId: workspaceId(),
        path: selectedWorkspacePath,
      });
    }
  });

  elements.auditRepository.addEventListener('change', function () {
    featureState.audit.target = elements.auditRepository.value;
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
    featureState.doctor.target = elements.doctorRepository.value;
    featureState.doctor.operations = [];
    featureState.doctor.operationInputs = {};
    featureState.doctor.registryDigest = '';
    featureState.doctor.lastResult = null;
    featureState.doctor.assessment = null;
    closeDoctorApproval();
    renderDoctorWorkflow();
  });
  elements.doctorRefresh.addEventListener('click', function () { runDoctorCommand('list', {}); });
  elements.doctorHealthRefresh.addEventListener('click', function () {
    runDoctorCommand('health', {
      agent_detections: Object.keys(featureState.agents.detections).map(function (id) { return featureState.agents.detections[id]; }),
    });
  });
  elements.doctorAddForm.addEventListener('submit', function (event) {
    event.preventDefault();
    registerDoctorOperationFromForm();
  });
  elements.doctorApprovalCheck.addEventListener('change', function () {
    elements.doctorConfirmApproval.disabled = !elements.doctorApprovalCheck.checked;
  });
  elements.doctorCancelApproval.addEventListener('click', closeDoctorApproval);
  elements.doctorConfirmApproval.addEventListener('click', confirmDoctorApproval);

  elements.agentRosterList.addEventListener('click', function () { runAgentCommand('list', {}); });
  elements.agentRosterDetect.addEventListener('click', function () {
    openAgentApproval('detect', { roster_digest: featureState.agents.rosterDigest });
  });
  elements.agentRosterAddForm.addEventListener('submit', function (event) {
    event.preventDefault();
    registerAgentTemplateFromForm();
  });
  elements.agentApprovalCheck.addEventListener('change', function () {
    elements.agentConfirmApproval.disabled = !elements.agentApprovalCheck.checked;
  });
  elements.agentCancelApproval.addEventListener('click', closeAgentApproval);
  elements.agentConfirmApproval.addEventListener('click', confirmAgentApproval);


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
    if (message.type === 'eco.cockpit.providerCommandCatalog') {
      const payload = message.payload || {};
      if ((payload.schema_version === 'cockpit-provider-command-catalog-v1' || payload.schema_version === 'cockpit-provider-command-catalog-v1.1') && Array.isArray(payload.providers)) {
        providerCommandCatalog.schema_version = payload.schema_version;
        providerCommandCatalog.providers = payload.providers;
        renderCommandPalette();
        renderNijiProof();
      }
      return;
    }
    if (message.type === 'eco.cockpit.actionResult') {
      const payload = message.payload || {};
      if (featureState.audit.activeCommand && payload.ok === false) {
        featureState.audit.error = payload.message || 'Provider command failed.';
        featureState.audit.activeCommand = '';
        renderAuditWorkflow();
      }
      if (featureState.doctor.activeCommand && payload.ok === false) {
        featureState.doctor.error = payload.message || 'Provider command failed.';
        featureState.doctor.activeCommand = '';
        renderDoctorWorkflow();
      }
      if (featureState.nijiProof.activeCommand && payload.ok === false) {
        featureState.nijiProof.error = payload.message || 'Provider command failed.';
        featureState.nijiProof.activeCommand = '';
        renderNijiProof();
      }
      if (featureState.sealdex.plan.activeCommand && payload.ok === false) {
        featureState.sealdex.plan.error = payload.message || 'Provider command failed.';
        featureState.sealdex.plan.activeCommand = '';
        renderSealdexPlan();
      }
      if (featureState.sealdex.entry.activeCommand && payload.ok === false) {
        featureState.sealdex.entry.error = payload.message || 'Provider command failed.';
        featureState.sealdex.entry.activeCommand = '';
        renderSealdexEntry();
      }
      showNotice(payload.message || 'Action completed.', payload.ok === false, payload.persist === true);
      if (payload.refresh !== false) {
        post({ type: 'eco.cockpit.refresh' });
      }
      return;
    }
    if (message.type === 'eco.cockpit.artifactDeleted') {
      lastDeletedArtifact = message.payload || null;
      elements.undoDeleteArtifact.disabled = !lastDeletedArtifact;
      return;
    }
    if (message.type === 'eco.cockpit.marlinPackageSearchResult') {
      const payload = message.payload || {};
      if (payload.ok === false) {
        featureState.marlin.searchResults = [];
        featureState.marlin.searchError = payload.error || 'Marlin package search failed.';
        showNotice(featureState.marlin.searchError, true);
      } else {
        featureState.marlin.searchResults = Array.isArray(payload.packages) ? payload.packages : [];
        featureState.marlin.searchError = '';
        showNotice('Marlin package search returned ' + featureState.marlin.searchResults.length + ' result(s).', false);
      }
      renderWizard();
      return;
    }
    if (message.type === 'eco.cockpit.marlinPackageResolveResult') {
      const payload = message.payload || {};
      const packageName = featureState.marlin.packageApproval.packageName;
      if (payload.ok === false) {
        featureState.marlin.packageApproval = { packageName: packageName, status: 'error', resolved: null, error: payload.error || 'Resolve failed.' };
      } else {
        featureState.marlin.packageApproval = { packageName: packageName, status: 'ready', resolved: payload, error: '' };
      }
      renderWizard();
      return;
    }
    if (message.type === 'eco.cockpit.marlinInstallResult') {
      featureState.marlin.installResult = message.payload || {};
      featureState.marlin.packageApproval = { packageName: '', status: 'idle', resolved: null, error: '' };
      const failed = featureState.marlin.installResult.ok === false;
      showNotice(failed ? (featureState.marlin.installResult.error || 'Marlin install failed.') : 'Marlin install completed.', failed);
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
      handleAgentProviderResult(message.payload || {});
      handleNijiProofProviderResult(message.payload || {});
      handleSealdexPlanProviderResult(message.payload || {});
      handleSealdexEntryProviderResult(message.payload || {});
      return;
    }
    if (message.type === 'eco.cockpit.error') {
      const payload = message.payload || {};
      showNotice(payload.message || 'Cockpit host error.', true, true);
    }
  });

  post({ type: 'eco.cockpit.ready' });
  post({ type: 'eco.cockpit.listProviderCommands' });
  renderNijiProof();
  renderSealdexPlan();
  renderSealdexEntry();

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
    renderAgentRosterWorkflow();
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
    policyOriginal = nextValue;
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
    const approvalHost = document.createElement('div');

    providerPanel.className = 'wizard-provider-panel';
    heading.textContent = 'Marlin Package Search';
    form.className = 'wizard-search';
    label.textContent = 'Package';
    input.type = 'text';
    input.value = state.snapshot.installIntent || 'niji';
    input.autocomplete = 'off';
    submit.type = 'submit';
    submit.textContent = 'Search';
    results.className = 'list';
    approvalHost.className = 'wizard-approval';

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
    providerPanel.appendChild(approvalHost);
    container.appendChild(providerPanel);

    renderMarlinPackageResults(results);
    renderMarlinPackageApproval(approvalHost);
    renderMarlinInstallResult(container);
  }

  function renderMarlinPackageResults(container) {
    clear(container);
    if (featureState.marlin.searchError) {
      const note = document.createElement('div');
      note.className = 'item is-error';
      note.textContent = 'Search failed: ' + featureState.marlin.searchError;
      container.appendChild(note);
      return;
    }
    if (!featureState.marlin.searchResults.length) {
      const note = document.createElement('div');
      note.className = 'item';
      note.textContent = 'No package search results loaded.';
      container.appendChild(note);
      return;
    }

    const approvalPending = featureState.marlin.packageApproval.status !== 'idle' && featureState.marlin.packageApproval.status !== 'error';

    featureState.marlin.searchResults.forEach(function (pkg) {
      const row = document.createElement('div');
      const title = document.createElement('strong');
      const detail = document.createElement('span');
      const action = document.createElement('button');
      row.className = 'item action-item';
      title.textContent = String(pkg.name || '-') + '@' + String(pkg.version || '-');
      detail.textContent = String(pkg.description || '') + (pkg.source ? ' [' + pkg.source + ']' : '');
      action.type = 'button';
      action.textContent = 'Install';
      action.disabled = approvalPending;
      action.addEventListener('click', function () {
        if (pkg.name) {
          featureState.marlin.packageApproval = { packageName: pkg.name, status: 'resolving', resolved: null, error: '' };
          renderWizard();
          post({ type: 'eco.cockpit.marlinResolvePackage', packageName: pkg.name });
        }
      });
      row.appendChild(title);
      row.appendChild(detail);
      row.appendChild(action);
      container.appendChild(row);
    });
  }

  /**
   * The approval step between "Install" and an actual mutating
   * marlin.package.install call (INIT.19.06). marlinResolvePackage is
   * read-only, so 'resolving'/'ready'/'error' never touch the machine;
   * only clicking Confirm Install here ever sends confirm:true.
   */
  function renderMarlinPackageApproval(container) {
    clear(container);
    const approval = featureState.marlin.packageApproval;
    if (approval.status === 'idle') {
      return;
    }

    if (approval.status === 'resolving') {
      const note = document.createElement('p');
      note.className = 'panel-note';
      note.textContent = 'Resolving ' + approval.packageName + '…';
      container.appendChild(note);
      return;
    }

    if (approval.status === 'installing') {
      const note = document.createElement('p');
      note.className = 'panel-note';
      note.textContent = 'Installing ' + approval.packageName + '…';
      container.appendChild(note);
      return;
    }

    if (approval.status === 'error') {
      const note = document.createElement('p');
      note.className = 'panel-note is-error';
      note.textContent = 'Could not resolve ' + approval.packageName + ': ' + approval.error;
      container.appendChild(note);
      const dismiss = document.createElement('button');
      dismiss.type = 'button';
      dismiss.textContent = 'Dismiss';
      dismiss.addEventListener('click', function () {
        featureState.marlin.packageApproval = { packageName: '', status: 'idle', resolved: null, error: '' };
        renderWizard();
      });
      container.appendChild(dismiss);
      return;
    }

    // status === 'ready': render the real resolved metadata for the human
    // to approve before any install call is made.
    const resolved = approval.resolved || {};
    const box = document.createElement('div');
    box.className = 'wizard-approval-box';

    const title = document.createElement('h3');
    title.textContent = 'Approve install: ' + String(resolved.name || approval.packageName) + '@' + String(resolved.version || '-');
    box.appendChild(title);

    const dl = document.createElement('dl');
    dl.appendChild(metadataRow('Source', resolved.source || 'unknown'));
    if (resolved.source === 'bundled-fallback' && resolved.fallback_reason) {
      dl.appendChild(metadataRow('Fallback reason', resolved.fallback_reason));
    }
    const checksum = resolved.checksum;
    dl.appendChild(metadataRow(
      'Checksum',
      checksum && checksum.value ? (checksum.algorithm || 'sha256') + ':' + checksum.value : 'not declared',
    ));
    dl.appendChild(metadataRow('Cockpit provider', resolved.has_provider ? 'yes' : 'no'));
    box.appendChild(dl);

    if (resolved.source === 'bundled-fallback') {
      const warn = document.createElement('p');
      warn.className = 'panel-note is-error';
      warn.textContent = 'Hosted registry was not used for this resolution — this package/version may be stale.';
      box.appendChild(warn);
    }

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.textContent = 'Confirm Install';
    confirmBtn.addEventListener('click', function () {
      const packageName = approval.packageName;
      featureState.marlin.packageApproval = { packageName: packageName, status: 'installing', resolved: approval.resolved, error: '' };
      renderWizard();
      post({ type: 'eco.cockpit.marlinInstallPackage', packageName: packageName, confirm: true });
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', function () {
      featureState.marlin.packageApproval = { packageName: '', status: 'idle', resolved: null, error: '' };
      renderWizard();
    });

    box.appendChild(confirmBtn);
    box.appendChild(cancelBtn);
    container.appendChild(box);
  }

  function renderMarlinInstallResult(container) {
    if (!featureState.marlin.installResult) {
      return;
    }
    const block = document.createElement('pre');
    block.className = 'wizard-result';
    block.textContent = JSON.stringify(featureState.marlin.installResult, null, 2);
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

    const previous = featureState.audit.target;
    clear(elements.auditRepository);
    if (!choices.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No repository discovered';
      elements.auditRepository.appendChild(option);
      featureState.audit.target = '';
      return;
    }
    choices.forEach(function (choice) {
      const option = document.createElement('option');
      option.value = choice.value;
      option.textContent = choice.label + ' — ' + choice.value;
      elements.auditRepository.appendChild(option);
    });
    featureState.audit.target = choices.some(function (choice) { return choice.value === previous; })
      ? previous
      : choices[0].value;
    elements.auditRepository.value = featureState.audit.target;
  }

  function resetAuditResults() {
    featureState.audit.activeCommand = '';
    featureState.audit.error = '';
    featureState.audit.approval = null;
    featureState.audit.results = { validate: null, preview: null, apply: null, verify: null };
    closeAuditApproval();
  }

  function runAuditCommand(stage, approval) {
    const commandId = AUDIT_COMMANDS[stage];
    if (!commandId || !featureState.audit.target || featureState.audit.activeCommand) {
      return;
    }
    featureState.audit.error = '';
    featureState.audit.activeCommand = commandId;
    renderAuditWorkflow();
    invokeProviderCommand(
      'marlin',
      commandId,
      { target: featureState.audit.target },
      providerCommandRequiresConfirmation('marlin', commandId, stage === 'apply'),
      approval
    );
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
    featureState.audit.results[stage] = result;
    featureState.audit.activeCommand = '';
    featureState.audit.error = '';
    renderAuditWorkflow();
    if (stage === 'apply' && result.status === 'succeeded') {
      runAuditCommand('verify');
    }
  }

  function openAuditApproval() {
    const preview = featureState.audit.results.preview;
    if (!preview || preview.status !== 'succeeded' || !featureState.audit.target) {
      return;
    }
    const input = { target: featureState.audit.target };
    featureState.audit.approval = {
      providerId: 'marlin',
      commandId: AUDIT_COMMANDS.apply,
      input: input,
      previewOperationId: preview.operation_id,
      token: approvalToken(),
      scope: approvalScope('marlin', AUDIT_COMMANDS.apply, input),
    };
    clear(elements.auditApprovalScope);
    [
      ['Provider', featureState.audit.approval.providerId],
      ['Command', featureState.audit.approval.commandId],
      ['Repository', featureState.audit.target],
      ['Preview operation', featureState.audit.approval.previewOperationId],
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
    const approval = featureState.audit.approval;
    const preview = featureState.audit.results.preview;
    if (!elements.auditApprovalCheck.checked || !approval || !preview ||
        approval.previewOperationId !== preview.operation_id ||
        approval.input.target !== featureState.audit.target) {
      featureState.audit.error = 'Approval expired because the preview or repository changed.';
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
    discover: 'marlin.doctor.discover',
    health: 'marlin.doctor.health',
    list: 'marlin.doctor.operations.list',
    register: 'marlin.doctor.operations.register',
    unregister: 'marlin.doctor.operations.unregister',
    preview: 'marlin.doctor.operations.preview',
    apply: 'marlin.doctor.operations.apply',
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

    const previous = featureState.doctor.target;
    clear(elements.doctorRepository);
    if (!choices.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No repository discovered';
      elements.doctorRepository.appendChild(option);
      featureState.doctor.target = '';
      return;
    }
    choices.forEach(function (choice) {
      const option = document.createElement('option');
      option.value = choice.value;
      option.textContent = choice.label + ' — ' + choice.value;
      elements.doctorRepository.appendChild(option);
    });
    featureState.doctor.target = choices.some(function (choice) { return choice.value === previous; })
      ? previous
      : choices[0].value;
    elements.doctorRepository.value = featureState.doctor.target;
  }

  // Every target-defined command requires approval, even when the registry
  // labels it read-only or preview. A repository can edit its own registry.
  const DOCTOR_MUTATING_STAGES = { register: true, unregister: true, preview: true, apply: true };

  function runDoctorCommand(stage, input, approval) {
    const commandId = DOCTOR_COMMANDS[stage];
    if (!commandId || !featureState.doctor.target || featureState.doctor.activeCommand) {
      return;
    }
    const payload = Object.assign({ target: featureState.doctor.target }, input || {});
    const mutates = providerCommandRequiresConfirmation('marlin', commandId, DOCTOR_MUTATING_STAGES[stage]);
    if (mutates && !approval) {
      // Mutating stages must go through openDoctorApproval -> confirmDoctorApproval
      // first; this function only sends the request once a human has approved it.
      return;
    }
    featureState.doctor.error = '';
    featureState.doctor.activeCommand = commandId;
    renderDoctorWorkflow();
    invokeProviderCommand(
      'marlin',
      commandId,
      payload,
      mutates,
      mutates ? { token: approval.token, scope: approval.scope } : undefined
    );
  }

  function openDoctorApproval(stage, input) {
    const commandId = DOCTOR_COMMANDS[stage];
    if (!commandId || !DOCTOR_MUTATING_STAGES[stage] || !featureState.doctor.target) {
      return;
    }
    const payload = Object.assign({ target: featureState.doctor.target }, input || {});
    featureState.doctor.approval = {
      stage: stage,
      commandId: commandId,
      input: payload,
      token: approvalToken(),
      scope: approvalScope('marlin', commandId, payload),
    };
    clear(elements.doctorApprovalScope);
    const operationId = (payload.operation && payload.operation.id) || payload.operation_id || '-';
    [
      ['Provider', 'marlin'],
      ['Command', commandId],
      ['Target', payload.target],
      ['Operation', operationId],
      ['Mode', stage === 'preview' || stage === 'apply' ? stage : 'registry change'],
      ['Registry digest', payload.registry_digest || '-'],
      ['Operation input', payload.operation_input ? JSON.stringify(payload.operation_input) : '-'],
    ].forEach(function (entry) {
      const dt = document.createElement('dt');
      const dd = document.createElement('dd');
      dt.textContent = entry[0];
      dd.textContent = entry[1];
      elements.doctorApprovalScope.appendChild(dt);
      elements.doctorApprovalScope.appendChild(dd);
    });
    elements.doctorApprovalCheck.checked = false;
    elements.doctorConfirmApproval.disabled = true;
    elements.doctorApprovalDialog.hidden = false;
    elements.doctorApprovalCheck.focus();
  }

  function closeDoctorApproval() {
    elements.doctorApprovalDialog.hidden = true;
    elements.doctorApprovalCheck.checked = false;
    elements.doctorConfirmApproval.disabled = true;
  }

  function confirmDoctorApproval() {
    const approval = featureState.doctor.approval;
    if (!elements.doctorApprovalCheck.checked || !approval || approval.input.target !== featureState.doctor.target) {
      featureState.doctor.error = 'Approval expired because the target repository changed.';
      closeDoctorApproval();
      renderDoctorWorkflow();
      return;
    }
    closeDoctorApproval();
    runDoctorCommand(approval.stage, approval.input, { token: approval.token, scope: approval.scope });
  }

  function registerDoctorOperationFromForm() {
    let command;
    let previewCommand;
    let inputs;
    try {
      command = JSON.parse(elements.doctorCommandJson.value || '[]');
      if (elements.doctorOperationPreview.checked) {
        previewCommand = JSON.parse(elements.doctorPreviewCommandJson.value || '[]');
      }
      if (elements.doctorOperationInputsJson.value.trim()) {
        inputs = JSON.parse(elements.doctorOperationInputsJson.value);
      }
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
    if (elements.doctorOperationPreview.checked && (!Array.isArray(previewCommand) || !previewCommand.length)) {
      showNotice('Preview support requires an explicit preview command JSON array.', true);
      return;
    }
    if (inputs !== undefined && !Array.isArray(inputs)) {
      showNotice('Doctor operation inputs JSON must be an array.', true);
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
    if (previewCommand) {
      operation.preview_command = previewCommand;
    }
    if (inputs) {
      operation.inputs = inputs;
    }
    const cwd = elements.doctorOperationCwd.value.trim();
    if (cwd) {
      operation.cwd = cwd;
    }
    openDoctorApproval('register', { operation: operation, replace: true });
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
    featureState.doctor.lastResult = result;
    featureState.doctor.activeCommand = '';
    if (result.status === 'succeeded' && result.data && Array.isArray(result.data.operations)) {
      featureState.doctor.operations = result.data.operations;
    }
    if (result.status === 'succeeded' && result.data && result.data.assessment) {
      featureState.doctor.assessment = result.data.assessment;
    }
    if (result.data && typeof result.data.registry_digest === 'string') {
      featureState.doctor.registryDigest = result.data.registry_digest;
    }
    if (result.status !== 'succeeded') {
      featureState.doctor.error = (result.error && result.error.message) || 'Doctor provider command failed.';
    }
    renderDoctorWorkflow();
  }

  function renderDoctorWorkflow() {
    const busy = Boolean(featureState.doctor.activeCommand);
    elements.doctorRepository.disabled = busy;
    elements.doctorHealthRefresh.disabled = busy || !featureState.doctor.target;
    elements.doctorRefresh.disabled = busy || !featureState.doctor.target;
    elements.doctorAddForm.querySelectorAll('input, select, textarea, button').forEach(function (control) {
      control.disabled = busy || !featureState.doctor.target;
    });
    elements.doctorRegistryStatus.textContent = busy
      ? 'Running'
      : featureState.doctor.lastResult
        ? featureState.doctor.lastResult.status
        : 'Not loaded';
    elements.doctorOperationCount.textContent = String(featureState.doctor.operations.length) + ' operations';
    renderDoctorHealth();
    renderDoctorOperationsTable();
    elements.doctorLastResult.textContent = featureState.doctor.lastResult
      ? JSON.stringify({
          command_id: featureState.doctor.lastResult.command_id,
          status: featureState.doctor.lastResult.status,
          data: featureState.doctor.lastResult.data,
          error: featureState.doctor.lastResult.error,
        }, null, 2)
      : '';
    if (featureState.doctor.error) {
      showNotice(featureState.doctor.error, true);
      featureState.doctor.error = '';
    }
  }

  function renderDoctorHealth() {
    const assessment = featureState.doctor.assessment;
    elements.doctorHealthFlags.replaceChildren();
    elements.doctorHealthDetails.replaceChildren();
    if (!assessment) {
      elements.doctorHealthStatus.textContent = 'Not assessed';
      elements.doctorHealthProject.textContent = '-';
      elements.doctorHealthGit.textContent = '-';
      elements.doctorHealthGovernance.textContent = '-';
      elements.doctorHealthTests.textContent = '-';
      return;
    }

    const discovery = assessment.discovery || {};
    const tests = assessment.tests || {};
    const operations = assessment.operations || {};
    const docs = assessment.docs || {};
    const agents = assessment.agents || {};
    const flags = assessment.summary && Array.isArray(assessment.summary.flags) ? assessment.summary.flags : [];
    elements.doctorHealthStatus.textContent = assessment.summary && assessment.summary.health === 'clear' ? 'Clear' : 'Attention needed';
    elements.doctorHealthProject.textContent = discovery.project_kind || 'unknown';
    elements.doctorHealthGit.textContent = discovery.is_git_repo
      ? (discovery.dirty === true ? 'Dirty' : discovery.dirty === false ? 'Clean' : 'Unknown')
      : 'Not a Git repo';
    elements.doctorHealthGovernance.textContent = discovery.gc_governed ? 'GC governed' : 'Not detected';
    elements.doctorHealthTests.textContent = tests.last_known_status || 'unknown';
    (flags.length ? flags : ['no-flags']).forEach(function (flag) {
      const chip = document.createElement('span');
      chip.className = 'health-flag';
      chip.textContent = flag;
      elements.doctorHealthFlags.appendChild(chip);
    });
    [
      ['Package manager', discovery.package_manager || '-'],
      ['Branch', discovery.default_branch || '-'],
      ['Policy pack', discovery.policy_pack_path || '-'],
      ['Operations', String(operations.enabled_count || 0) + ' enabled / ' + String(operations.registered_count || 0) + ' registered'],
      ['Registry digest', operations.registry_digest || '-'],
      ['DEV docs', docs.dev_path_exists && docs.dev_plan_exists ? (docs.stale === true ? 'stale signal' : 'present') : 'incomplete'],
      ['Detected agents', agents.detected_count === null || agents.detected_count === undefined ? 'not supplied' : agents.detected_count],
      ['Assessed', assessment.assessed_at || '-'],
    ].forEach(function (entry) {
      elements.doctorHealthDetails.appendChild(metadataRow(entry[0], entry[1]));
    });
  }

  function renderDoctorOperationsTable() {
    clear(elements.doctorOperationTable);
    if (!featureState.doctor.operations.length) {
      elements.doctorOperationTable.appendChild(emptyTableRow(4, 'No Doctor operations registered.'));
      return;
    }
    featureState.doctor.operations.forEach(function (operation) {
      const row = document.createElement('tr');
      const id = document.createElement('td');
      const mode = document.createElement('td');
      const command = document.createElement('td');
      const actions = document.createElement('td');
      actions.className = 'doctor-operation-actions';
      const remove = document.createElement('button');
      const execute = document.createElement('button');
      const operationInput = Object.assign({}, featureState.doctor.operationInputs[operation.id] || {});
      id.textContent = operation.id || '-';
      mode.textContent = (operation.enabled === false ? 'disabled' : 'enabled') + ' / ' + (operation.mutates ? 'mutates' : 'read');
      command.textContent = Array.isArray(operation.command) ? operation.command.join(' ') : '-';
      remove.type = 'button';
      remove.textContent = 'Remove';
      remove.addEventListener('click', function () {
        openDoctorApproval('unregister', { operation_id: operation.id });
      });
      execute.type = 'button';
      execute.textContent = operation.mutates ? 'Apply' : 'Run';
      const inputControls = [];
      (operation.inputs || []).forEach(function (inputSpec) {
        const label = document.createElement('label');
        label.className = 'doctor-operation-input';
        label.textContent = inputSpec.label || inputSpec.id;
        let control;
        if (inputSpec.type === 'choice') {
          control = document.createElement('select');
          (inputSpec.choices || []).forEach(function (choice) {
            const option = document.createElement('option');
            option.value = choice;
            option.textContent = choice;
            control.appendChild(option);
          });
        } else {
          control = document.createElement('input');
          control.type = 'text';
          control.autocomplete = 'off';
        }
        control.dataset.doctorInput = inputSpec.id;
        if (operationInput[inputSpec.id] !== undefined) control.value = operationInput[inputSpec.id];
        control.addEventListener('input', updateExecutionButtons);
        control.addEventListener('change', updateExecutionButtons);
        label.appendChild(control);
        actions.appendChild(label);
        inputControls.push({ spec: inputSpec, control: control });
      });
      function collectOperationInput() {
        inputControls.forEach(function (entry) {
          operationInput[entry.spec.id] = entry.control.value;
        });
        featureState.doctor.operationInputs[operation.id] = Object.assign({}, operationInput);
        return operationInput;
      }
      function inputsComplete() {
        return inputControls.every(function (entry) {
          return entry.spec.required !== true || Boolean(entry.control.value.trim());
        });
      }
      function updateExecutionButtons() {
        const disabled = operation.enabled === false || !featureState.doctor.registryDigest || !inputsComplete();
        execute.disabled = disabled;
        if (previewButton) previewButton.disabled = disabled;
      }
      let previewButton = null;
      execute.addEventListener('click', function () {
        const payload = {
          operation_id: operation.id,
          registry_digest: featureState.doctor.registryDigest,
        };
        if (inputControls.length) payload.operation_input = collectOperationInput();
        openDoctorApproval('apply', payload);
      });
      if (operation.supports_preview && Array.isArray(operation.preview_command)) {
        const preview = document.createElement('button');
        previewButton = preview;
        preview.type = 'button';
        preview.textContent = 'Preview';
        preview.addEventListener('click', function () {
          const payload = {
            operation_id: operation.id,
            registry_digest: featureState.doctor.registryDigest,
          };
          if (inputControls.length) payload.operation_input = collectOperationInput();
          openDoctorApproval('preview', payload);
        });
        actions.appendChild(preview);
      }
      actions.appendChild(execute);
      actions.appendChild(remove);
      updateExecutionButtons();
      row.appendChild(id);
      row.appendChild(mode);
      row.appendChild(command);
      row.appendChild(actions);
      elements.doctorOperationTable.appendChild(row);
    });
  }

  const AGENT_COMMANDS = {
    list: 'marlin.doctor.agents.list',
    detect: 'marlin.doctor.agents.detect',
    register: 'marlin.doctor.agents.register',
    unregister: 'marlin.doctor.agents.unregister',
  };

  // Every agent roster command requires approval, including list-adjacent
  // detect -- detect spawns a real process per template (bounded, version-
  // only, but a process nonetheless), and the roster (including custom
  // detect commands) is registry-editable, matching Doctor's own
  // established rule that registry-editable data is never authority to
  // bypass human consent. Only `list` (pure metadata read, no process
  // spawned) is exempt.
  const AGENT_MUTATING_STAGES = { detect: true, register: true, unregister: true };

  function runAgentCommand(stage, input, approval) {
    const commandId = AGENT_COMMANDS[stage];
    if (!commandId || featureState.agents.activeCommand) {
      return;
    }
    const payload = input || {};
    const mutates = providerCommandRequiresConfirmation('marlin', commandId, AGENT_MUTATING_STAGES[stage]);
    if (mutates && !approval) {
      return;
    }
    featureState.agents.error = '';
    featureState.agents.activeCommand = commandId;
    renderAgentRosterWorkflow();
    invokeProviderCommand(
      'marlin',
      commandId,
      payload,
      mutates,
      mutates ? { token: approval.token, scope: approval.scope } : undefined
    );
  }

  function openAgentApproval(stage, input) {
    const commandId = AGENT_COMMANDS[stage];
    if (!commandId || !AGENT_MUTATING_STAGES[stage]) {
      return;
    }
    const payload = input || {};
    featureState.agents.approval = {
      stage: stage,
      commandId: commandId,
      input: payload,
      token: approvalToken(),
      scope: approvalScope('marlin', commandId, payload),
    };
    clear(elements.agentApprovalScope);
    const entries = [['Provider', 'marlin'], ['Command', commandId]];
    if (stage === 'detect') {
      // Detect runs a real, approval-editable process per template -- not
      // a read. Show exactly which commands are about to run, not a vague
      // "all known templates" placeholder, so approval means something.
      entries.push(['Roster digest', payload.roster_digest || '-']);
      featureState.agents.templates.forEach(function (template) {
        const command = Array.isArray(template.detect && template.detect.command)
          ? template.detect.command.join(' ')
          : '-';
        entries.push([template.id, command]);
      });
    } else {
      const templateId = (payload.template && payload.template.id) || payload.template_id || '-';
      entries.push(['Template', templateId]);
      if (payload.template && Array.isArray(payload.template.detect && payload.template.detect.command)) {
        entries.push(['Detect command', payload.template.detect.command.join(' ')]);
      }
    }
    entries.forEach(function (entry) {
      const dt = document.createElement('dt');
      const dd = document.createElement('dd');
      dt.textContent = entry[0];
      dd.textContent = entry[1];
      elements.agentApprovalScope.appendChild(dt);
      elements.agentApprovalScope.appendChild(dd);
    });
    elements.agentApprovalCheck.checked = false;
    elements.agentConfirmApproval.disabled = true;
    elements.agentApprovalDialog.hidden = false;
    elements.agentApprovalCheck.focus();
  }

  function closeAgentApproval() {
    elements.agentApprovalDialog.hidden = true;
    elements.agentApprovalCheck.checked = false;
    elements.agentConfirmApproval.disabled = true;
  }

  function confirmAgentApproval() {
    const approval = featureState.agents.approval;
    if (!elements.agentApprovalCheck.checked || !approval) {
      featureState.agents.error = 'Approval was not confirmed.';
      closeAgentApproval();
      renderAgentRosterWorkflow();
      return;
    }
    closeAgentApproval();
    runAgentCommand(approval.stage, approval.input, { token: approval.token, scope: approval.scope });
  }

  function registerAgentTemplateFromForm() {
    let detectCommand;
    let runCommand;
    try {
      detectCommand = JSON.parse(elements.agentDetectCommandJson.value || '[]');
      runCommand = JSON.parse(elements.agentRunCommandJson.value || '[]');
    } catch (error) {
      showNotice(error instanceof Error ? error.message : String(error), true);
      return;
    }
    const id = elements.agentTemplateId.value.trim();
    const name = elements.agentTemplateName.value.trim();
    if (!id || !name || !Array.isArray(detectCommand) || !Array.isArray(runCommand)) {
      showNotice('Agent template id, name, detect command, and run command are required.', true);
      return;
    }
    const capabilities = elements.agentTemplateCapabilities.value
      .split(',')
      .map(function (c) { return c.trim(); })
      .filter(Boolean);
    const template = {
      id: id,
      name: name,
      kind: 'cli-agent',
      detect: { command: detectCommand },
      run: { command: runCommand },
      capabilities: capabilities,
      mutates_files: elements.agentTemplateMutates.checked,
      requires_confirmation: elements.agentTemplateMutates.checked,
      context: {
        accepts_prompt_file: elements.agentTemplatePromptFile.checked,
        accepts_target_path: elements.agentTemplateTargetPath.checked,
      },
    };
    openAgentApproval('register', { template: template, replace: true });
  }

  function handleAgentProviderResult(result) {
    if (result.provider_id !== 'marlin') {
      return;
    }
    const stage = Object.keys(AGENT_COMMANDS).find(function (key) {
      return AGENT_COMMANDS[key] === result.command_id;
    });
    if (!stage) {
      return;
    }
    featureState.agents.lastResult = result;
    featureState.agents.activeCommand = '';
    if (result.status === 'succeeded' && result.data) {
      if (Array.isArray(result.data.templates)) {
        featureState.agents.templates = result.data.templates;
      }
      if (Array.isArray(result.data.results)) {
        const next = {};
        result.data.results.forEach(function (item) { next[item.id] = item; });
        featureState.agents.detections = next;
      }
      if (typeof result.data.roster_digest === 'string') {
        featureState.agents.rosterDigest = result.data.roster_digest;
      }
    }
    if (result.status !== 'succeeded') {
      featureState.agents.error = (result.error && result.error.message) || 'Agent roster provider command failed.';
    }
    renderAgentRosterWorkflow();
  }

  function renderAgentRosterWorkflow() {
    const busy = Boolean(featureState.agents.activeCommand);
    elements.agentRosterList.disabled = busy;
    // Detect binds its approval to the roster digest returned by list/
    // register/unregister; without one yet there is nothing to bind to.
    elements.agentRosterDetect.disabled = busy || !featureState.agents.rosterDigest;
    elements.agentRosterAddForm.querySelectorAll('input, textarea, button').forEach(function (control) {
      control.disabled = busy;
    });
    elements.agentRosterStatus.textContent = busy
      ? 'Running'
      : featureState.agents.lastResult
        ? featureState.agents.lastResult.status
        : 'Not loaded';
    elements.agentRosterCount.textContent = String(featureState.agents.templates.length) + ' templates';
    renderAgentRosterTable();
    elements.agentRosterLastResult.textContent = featureState.agents.lastResult
      ? JSON.stringify({
          command_id: featureState.agents.lastResult.command_id,
          status: featureState.agents.lastResult.status,
          data: featureState.agents.lastResult.data,
          error: featureState.agents.lastResult.error,
        }, null, 2)
      : '';
    if (featureState.agents.error) {
      showNotice(featureState.agents.error, true);
      featureState.agents.error = '';
    }
  }

  function renderAgentRosterTable() {
    clear(elements.agentRosterTable);
    if (!featureState.agents.templates.length) {
      elements.agentRosterTable.appendChild(emptyTableRow(5, 'No agent templates loaded -- click "List templates".'));
      return;
    }
    featureState.agents.templates.forEach(function (template) {
      const row = document.createElement('tr');
      const id = document.createElement('td');
      const name = document.createElement('td');
      const capabilities = document.createElement('td');
      const status = document.createElement('td');
      const actions = document.createElement('td');
      id.textContent = template.id || '-';
      name.textContent = template.name || '-';
      capabilities.textContent = Array.isArray(template.capabilities) ? template.capabilities.join(', ') : '-';
      const detection = featureState.agents.detections[template.id];
      status.textContent = !detection
        ? 'not checked'
        : detection.detected
          ? 'detected' + (detection.version_output ? ' (' + detection.version_output + ')' : '')
          : 'not detected';
      const isBuiltin = template.builtin === true;
      if (!isBuiltin) {
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = 'Remove';
        remove.addEventListener('click', function () {
          openAgentApproval('unregister', { template_id: template.id });
        });
        actions.appendChild(remove);
      }
      row.appendChild(id);
      row.appendChild(name);
      row.appendChild(capabilities);
      row.appendChild(status);
      row.appendChild(actions);
      elements.agentRosterTable.appendChild(row);
    });
  }

  function renderAuditWorkflow() {
    const results = featureState.audit.results;
    const active = featureState.audit.activeCommand;
    const verifyBundle = evidenceBundle(results.verify);
    elements.auditDiscoverStatus.textContent = featureState.audit.target || 'Choose a repository';
    elements.auditValidateStatus.textContent = auditStageLabel('validate');
    elements.auditPreviewStatus.textContent = auditStageLabel('preview');
    elements.auditApprovalStatus.textContent = featureState.audit.approval ? 'Bound to preview ' + featureState.audit.approval.previewOperationId : 'Not requested';
    elements.auditApplyStatus.textContent = auditStageLabel('apply');
    elements.auditVerifyStatus.textContent = auditStageLabel('verify');
    elements.auditEvidenceStatus.textContent = verifyBundle ? 'Ready to export' : 'Not available';

    elements.auditRepository.disabled = Boolean(active);
    elements.auditValidate.disabled = !featureState.audit.target || Boolean(active);
    elements.auditPreview.disabled = !results.validate || Boolean(active);
    elements.auditRequestApproval.disabled = !results.preview || results.preview.status !== 'succeeded' || Boolean(active);
    elements.auditExportEvidence.disabled = !verifyBundle || Boolean(active);

    renderAuditResult(elements.auditValidationResult, results.validate, 'Run validation to load findings.');
    renderAuditResult(elements.auditPreviewResult, results.preview, 'Preview has not run.');
    renderAuditResult(elements.auditApplyResult, results.apply, featureState.audit.error || 'No remediation has executed.');
    renderAuditResult(elements.auditVerifyResult, results.verify, 'Verification has not run.');
    elements.auditFindingsCount.textContent = String(auditFindings(results.validate).length) + ' findings';
    elements.auditPreviewOperation.textContent = results.preview ? results.preview.operation_id : '-';
    elements.auditApplyOperation.textContent = results.apply ? results.apply.operation_id : '-';
    elements.auditVerifyOperation.textContent = results.verify ? results.verify.operation_id : '-';
  }

  function auditStageLabel(stage) {
    if (featureState.audit.activeCommand === AUDIT_COMMANDS[stage]) return 'Running';
    const result = featureState.audit.results[stage];
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
    const bundle = evidenceBundle(featureState.audit.results.verify);
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

  function handleNijiProofProviderResult(result) {
    if (result.provider_id !== 'niji' || result.command_id !== 'niji.palette.preview') {
      return;
    }
    featureState.nijiProof.lastResult = result;
    featureState.nijiProof.activeCommand = '';
    featureState.nijiProof.error = result.status === 'failed'
      ? ((result.error && result.error.message) || 'Provider reported failure.')
      : '';
    renderNijiProof();
  }

  function renderNijiProof() {
    const running = Boolean(featureState.nijiProof.activeCommand);
    elements.nijiProofRun.disabled = running;
    elements.nijiProofRun.textContent = running ? 'Running...' : providerCommandTitle('niji', 'niji.palette.preview', 'Run niji.palette.preview');

    const result = featureState.nijiProof.lastResult;
    if (running) {
      elements.nijiProofStatus.textContent = 'Running...';
    } else if (featureState.nijiProof.error) {
      elements.nijiProofStatus.textContent = 'Failed: ' + featureState.nijiProof.error;
    } else if (result) {
      elements.nijiProofStatus.textContent = result.status || 'unknown';
    } else {
      elements.nijiProofStatus.textContent = 'Not run';
    }

    clear(elements.nijiProofSwatches);
    const palette = result && result.data && result.data.palette;
    const swatches = palette && Array.isArray(palette.swatches) ? palette.swatches : [];
    if (!swatches.length) {
      const note = document.createElement('div');
      note.className = 'item';
      note.textContent = featureState.nijiProof.error || 'No result yet - click Run to invoke the real discovered provider.';
      elements.nijiProofSwatches.appendChild(note);
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
      elements.nijiProofSwatches.appendChild(tile);
    });
  }

  function runSealdexCommand(commandId, input, confirm, approval) {
    invokeProviderCommand('sealdex', commandId, input, confirm, approval);
  }

  function openSealdexApproval(commandId, input) {
    const token = approvalToken();
    const scope = approvalScope('sealdex', commandId, input);
    featureState.sealdex.pendingApproval = { commandId: commandId, input: input, token: token, scope: scope };
    clear(elements.sealdexApprovalScope);
    [
      ['Provider', 'sealdex'],
      ['Command', commandId],
      ['Input', JSON.stringify(input)],
    ].forEach(function (entry) {
      const dt = document.createElement('dt');
      const dd = document.createElement('dd');
      dt.textContent = entry[0];
      dd.textContent = entry[1];
      elements.sealdexApprovalScope.appendChild(dt);
      elements.sealdexApprovalScope.appendChild(dd);
    });
    elements.sealdexApprovalCheck.checked = false;
    elements.sealdexConfirmApproval.disabled = true;
    elements.sealdexApprovalDialog.hidden = false;
    elements.sealdexApprovalCheck.focus();
  }

  function closeSealdexApproval() {
    elements.sealdexApprovalDialog.hidden = true;
    elements.sealdexApprovalCheck.checked = false;
    elements.sealdexConfirmApproval.disabled = true;
    featureState.sealdex.pendingApproval = null;
  }

  function handleSealdexPlanProviderResult(result) {
    if (result.provider_id !== 'sealdex') {
      return;
    }
    if (result.command_id !== 'sealdex.schema.propose' && result.command_id !== 'sealdex.schema.apply') {
      return;
    }
    featureState.sealdex.plan.activeCommand = '';
    if (result.command_id === 'sealdex.schema.propose') {
      featureState.sealdex.plan.proposeResult = result;
      featureState.sealdex.plan.error = result.status === 'failed'
        ? ((result.error && result.error.message) || 'Provider reported failure.')
        : '';
    } else {
      featureState.sealdex.plan.error = result.status === 'failed'
        ? ((result.error && result.error.message) || 'Apply failed.')
        : '';
      if (result.status === 'succeeded') {
        featureState.sealdex.plan.proposeResult = null;
        elements.sealdexPlanNeed.value = '';
      }
    }
    renderSealdexPlan();
  }

  function renderSealdexPlan() {
    const running = Boolean(featureState.sealdex.plan.activeCommand);
    elements.sealdexPlanPropose.disabled = running;

    const result = featureState.sealdex.plan.proposeResult;
    const hasPendingPlan = Boolean(result && result.status === 'pending-approval' && result.data && result.data.plan);
    elements.sealdexPlanApprove.disabled = running || !hasPendingPlan;
    elements.sealdexPlanDiscard.disabled = running || !hasPendingPlan;

    if (running) {
      elements.sealdexPlanStatus.textContent = featureState.sealdex.plan.activeCommand === 'sealdex.schema.apply' ? 'Applying...' : 'Proposing...';
    } else if (featureState.sealdex.plan.error) {
      elements.sealdexPlanStatus.textContent = 'Failed: ' + featureState.sealdex.plan.error;
    } else if (hasPendingPlan) {
      elements.sealdexPlanStatus.textContent = 'Pending approval';
    } else {
      elements.sealdexPlanStatus.textContent = 'Not run';
    }

    clear(elements.sealdexPlanSummary);
    clear(elements.sealdexPlanChecks);
    if (!hasPendingPlan) {
      return;
    }
    const plan = result.data.plan;
    [
      ['Kind', plan.kind || '-'],
      ['Table', plan.table || '-'],
      ['Columns', (plan.columns || []).map(function (c) { return c.name; }).join(', ') || '-'],
      ['Rationale', plan.rationale || '-'],
    ].forEach(function (entry) {
      const dt = document.createElement('dt');
      const dd = document.createElement('dd');
      dt.textContent = entry[0];
      dd.textContent = entry[1];
      elements.sealdexPlanSummary.appendChild(dt);
      elements.sealdexPlanSummary.appendChild(dd);
    });
    (result.data.checks || []).forEach(function (check) {
      const li = document.createElement('li');
      li.textContent = check;
      elements.sealdexPlanChecks.appendChild(li);
    });
  }

  function collectSealdexEntryFields() {
    const table = featureState.sealdex.entry.selectedTable;
    const columns = featureState.sealdex.entry.tables[table] || {};
    const fields = {};
    Object.keys(columns).forEach(function (name) {
      if (columns[name].pk) {
        return;
      }
      const input = elements.sealdexEntryFields.querySelector('[data-field="' + name + '"]');
      if (input && input.value !== '') {
        fields[name] = input.value;
      }
    });
    return Object.keys(fields).length ? fields : null;
  }

  function handleSealdexEntryProviderResult(result) {
    if (result.provider_id !== 'sealdex') {
      return;
    }
    if (result.command_id !== 'sealdex.entry.tables' && result.command_id !== 'sealdex.entry.add' && result.command_id !== 'sealdex.entry.import') {
      return;
    }
    featureState.sealdex.entry.activeCommand = '';
    featureState.sealdex.entry.error = result.status === 'failed'
      ? ((result.error && result.error.message) || 'Provider reported failure.')
      : '';
    if (result.command_id === 'sealdex.entry.tables' && result.status === 'succeeded') {
      featureState.sealdex.entry.tables = (result.data && result.data.tables) || {};
      if (!featureState.sealdex.entry.tables[featureState.sealdex.entry.selectedTable]) {
        featureState.sealdex.entry.selectedTable = Object.keys(featureState.sealdex.entry.tables)[0] || '';
      }
    }
    if (result.command_id === 'sealdex.entry.add' && result.status === 'succeeded') {
      featureState.sealdex.entry.lastResult = 'Inserted row id ' + (result.data && result.data.row_id) + ' into ' + (result.data && result.data.table) + '.';
    }
    if (result.command_id === 'sealdex.entry.import' && result.status === 'succeeded') {
      featureState.sealdex.entry.lastResult = 'Imported ' + (result.data && result.data.inserted) + ' row(s) into ' + (result.data && result.data.table) + '.';
      elements.sealdexEntryCsv.value = '';
    }
    renderSealdexEntry();
  }

  function renderSealdexEntry() {
    const running = Boolean(featureState.sealdex.entry.activeCommand);
    elements.sealdexEntryRefreshTables.disabled = running;
    const table = featureState.sealdex.entry.selectedTable;
    elements.sealdexEntryAdd.disabled = running || !table;
    elements.sealdexEntryImport.disabled = running || !table;

    if (running) {
      elements.sealdexEntryStatus.textContent = 'Working...';
    } else if (featureState.sealdex.entry.error) {
      elements.sealdexEntryStatus.textContent = 'Failed: ' + featureState.sealdex.entry.error;
    } else if (featureState.sealdex.entry.lastResult) {
      elements.sealdexEntryStatus.textContent = featureState.sealdex.entry.lastResult;
    } else {
      elements.sealdexEntryStatus.textContent = '-';
    }

    const tableNames = Object.keys(featureState.sealdex.entry.tables);
    clear(elements.sealdexEntryTable);
    tableNames.forEach(function (name) {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      elements.sealdexEntryTable.appendChild(option);
    });
    if (table && tableNames.indexOf(table) !== -1) {
      elements.sealdexEntryTable.value = table;
    }
    renderSealdexEntryFields();
  }

  function renderSealdexEntryFields() {
    clear(elements.sealdexEntryFields);
    const table = featureState.sealdex.entry.selectedTable;
    const columns = featureState.sealdex.entry.tables[table] || {};
    Object.keys(columns).forEach(function (name) {
      if (columns[name].pk) {
        return;
      }
      const label = document.createElement('label');
      label.textContent = name + ' (' + columns[name].type + ')';
      const input = document.createElement('input');
      input.type = 'text';
      input.dataset.field = name;
      label.appendChild(input);
      elements.sealdexEntryFields.appendChild(label);
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

    if (!selectedWorkspacePath || !tree.nodes.some(function (node) { return node.path === selectedWorkspacePath; })) {
      selectedWorkspacePath = tree.nodes[0].path || '.';
    }

    tree.nodes.forEach(function (node) {
      const button = document.createElement('button');
      const icon = node.kind === 'directory' ? '[] ' : '- ';
      button.type = 'button';
      button.className = 'workspace-node';
      button.classList.toggle('is-selected', node.path === selectedWorkspacePath);
      button.classList.toggle('is-skipped', Boolean(node.skipped));
      button.style.paddingLeft = String(8 + ((node.depth || 0) * 16)) + 'px';
      button.textContent = icon + (node.name || node.path || '.');
      button.addEventListener('click', function () {
        selectedWorkspacePath = node.path || '.';
        renderWorkspaceExplorer(workspace);
      });
      elements.workspaceTree.appendChild(button);
    });

    renderWorkspaceSelection(tree.nodes.find(function (node) {
      return node.path === selectedWorkspacePath;
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
    window.AppShell.showNotice(elements.notice, message, {
      kind: isError ? 'error' : 'info',
    });
    if (noticeTimer) {
      window.clearTimeout(noticeTimer);
      noticeTimer = null;
    }
    if (!persist) {
      noticeTimer = window.setTimeout(clearNotice, 5000);
    }
  }

  function clearNotice() {
    if (noticeTimer) {
      window.clearTimeout(noticeTimer);
      noticeTimer = null;
    }
    elements.notice.textContent = '';
    elements.notice.classList.remove('is-error');
  }

  function post(message) {
    host.postMessage(message);
  }

  // Provider command intent is the Cockpit operational boundary. GUI handlers
  // construct this neutral request; the host owns command discovery,
  // authorization, execution, and provider implementation.
  function invokeProviderCommand(providerId, commandId, input, confirm, approval) {
    const message = {
      type: 'eco.cockpit.invokeProviderCommand',
      providerId: providerId,
      commandId: commandId,
      input: input,
      confirm: Boolean(confirm),
    };
    if (approval !== undefined) {
      message.approval = approval;
    }
    post(message);
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
      installIntent: snapshot.installIntent || null,
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
      installIntent: null,
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
