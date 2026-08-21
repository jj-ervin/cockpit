'use strict';

const path = require('path');

const { callBridge, DEFAULT_TIMEOUT_MS } = require('./bridgeClient');
const { buildSnapshot } = require('./snapshotBuilder');
const osOpen = require('./osOpen');
const { resolveContainedPath } = require('./pathContainment');

// marlin.doctor.agents.run.execute can spawn a real agent subprocess for up
// to marlin-dxp's DEFAULT_AGENT_RUN_TIMEOUT_MS (10 minutes) plus its own
// kill-grace period before the provider process returns. bridgeClient's flat
// DEFAULT_TIMEOUT_MS (30s) would abort the round trip long before that,
// severing the connection to a run that is still legitimately in progress.
const LONG_RUNNING_PROVIDER_COMMAND_TIMEOUT_MS = {
  'marlin.doctor.agents.run.execute': 11 * 60 * 1000,
  // Mirrors host_bridge.py's _PROVIDER_COMMAND_TIMEOUT_SECONDS entry for
  // the same command -- sealdex.schema.propose calls out to an LLM and can
  // take up to ~300s on local CPU-only Ollama.
  'sealdex.schema.propose': 6 * 60 * 1000,
};

function timeoutMsForProviderCommand(commandId) {
  return LONG_RUNNING_PROVIDER_COMMAND_TIMEOUT_MS[commandId] || DEFAULT_TIMEOUT_MS;
}

/**
 * Dispatches one eco.cockpit.* message to its handler, returning an ARRAY of
 * messages to relay back to the bundle, in order, via window.postMessage.
 * Mirrors eco-vscode/src/webviewHost.ts's handleWebviewMessage switch - same
 * message shapes in, same result-message shapes out - so web/cockpit.js
 * needs zero changes to work against this host. Most actions produce one
 * message; deleteArtifact produces two in sequence (artifactDeleted, then
 * actionResult), matching webviewHost.ts's own two-postMessage-call shape
 * exactly.
 *
 * Three actions have no clean web equivalent and are deliberately
 * downgraded rather than faked (documented in DEV-PATH.md):
 *   - copyRunJson: logs JSON to the server console instead of writing to
 *     a clipboard (no host-side clipboard API without a browser-side
 *     script change, which is out of scope - zero bundle changes).
 *   - openArtifact/openPolicy: opens the file with the OS default app
 *     instead of a VS Code editor tab (there's no in-bundle slot to render
 *     file content inline without a bundle change).
 *   - marlinInstallPackage: invokes the provider only when the bundle sends
 *     the literal boolean confirmation required by the protocol.
 */
async function dispatch(type, message, { workspaceRoot, pythonExecutable, bridgeExecutable, deps } = {}) {
  const bridge = (deps && deps.callBridge) || callBridge;
  const snapshot = (deps && deps.buildSnapshot) || buildSnapshot;
  const osOps = (deps && deps.osOpen) || osOpen;
  const opts = { pythonExecutable, bridgeExecutable };

  const eco = (operation, extra = {}) => bridge({ backend: 'eco', workspace_id: workspaceRoot, operation, ...extra }, opts);

  // setHelmMode has its own dedicated result type on failure (matching
  // eco-vscode), so it catches separately; every other action's errors are
  // caught once below and reported as a generic actionResult(false, ...).
  if (type === 'eco.cockpit.setHelmMode') {
    try {
      const result = await eco('submit', { record_type: 'mode', payload: { mode: require1(message.mode, 'mode') } });
      return [{ type: 'eco.cockpit.setHelmModeResult', payload: { ok: true, ...result.data } }];
    } catch (err) {
      return [{ type: 'eco.cockpit.setHelmModeResult', payload: { ok: false, error: errorMessage(err) } }];
    }
  }

  try {
    switch (type) {
      case 'eco.cockpit.ready':
      case 'eco.cockpit.refresh': {
        const payload = await snapshot(workspaceRoot, opts);
        return [{ type: 'eco.cockpit.state', payload }];
      }

      case 'eco.cockpit.copyRunJson': {
        const run = await eco('get_record', { record_type: 'run', record_id: require1(message.runId, 'runId') });
        console.log('[cockpit] Run JSON (copy manually, no clipboard access in the standalone web host):');
        console.log(JSON.stringify(run.data, null, 2));
        return [actionResult(true, 'Run JSON logged to the server console (no clipboard access in the standalone web host).', false)];
      }

      case 'eco.cockpit.rerunRecord': {
        const run = await eco('get_record', { record_type: 'run', record_id: require1(message.runId, 'runId') });
        const payload = rerunPayloadFromRecord(run.data);
        await eco('submit', { record_type: 'run', payload });
        return [actionResult(true, 'Run submitted.')];
      }

      case 'eco.cockpit.approveEscalation': {
        await eco('approve', {
          record_id: require1(message.runId, 'runId'),
          decision: requireDecision(message.decision),
          reason: typeof message.reason === 'string' ? message.reason : undefined,
        });
        return [actionResult(true, `Escalation ${message.decision}.`)];
      }

      case 'eco.cockpit.submitRun': {
        await eco('submit', { record_type: 'run', payload: requirePayload(message.payload) });
        return [actionResult(true, 'Run submitted.')];
      }

      case 'eco.cockpit.savePolicy': {
        await eco('update_record', { record_type: 'policy', record_id: 'policy', payload: requirePayload(message.payload) });
        return [actionResult(true, 'Policy saved.')];
      }

      case 'eco.cockpit.deleteArtifact': {
        const result = await eco('delete_record', { record_type: 'artifact', record_id: require1(message.artifactPath, 'artifactPath') });
        return [
          { type: 'eco.cockpit.artifactDeleted', payload: result.data },
          actionResult(true, 'Artifact moved to trash. Undo is available until the next delete.'),
        ];
      }

      case 'eco.cockpit.undoDeleteArtifact': {
        await eco('restore_record', {
          record_type: 'artifact',
          record_id: require1(message.originalPath, 'originalPath'),
          trash_ref: require1(message.trashPath, 'trashPath'),
        });
        return [actionResult(true, 'Artifact restored.')];
      }

      case 'eco.cockpit.openArtifact': {
        const resolved = resolveContainedPath(workspaceRoot, require1(message.artifactPath, 'artifactPath'));
        await osOps.openWithDefaultApp(resolved);
        return [actionResult(true, 'Artifact opened with your OS default application.', false)];
      }

      case 'eco.cockpit.openPolicy': {
        const resolved = resolveContainedPath(workspaceRoot, path.join('.eco', 'policy.json'));
        await osOps.openWithDefaultApp(resolved);
        return [actionResult(true, 'Policy opened with your OS default application.', false)];
      }

      case 'eco.cockpit.workspaceReveal': {
        const resolved = resolveContainedPath(workspaceRoot, require1(message.path, 'path'));
        await osOps.revealInFileManager(resolved);
        return [actionResult(true, 'Workspace path revealed.', false)];
      }

      case 'eco.cockpit.workspaceStatus': {
        const requestedPath = require1(message.path, 'path');
        resolveContainedPath(workspaceRoot, requestedPath); // containment check only
        const statuses = await bridge({ backend: 'workspace', workspace_id: workspaceRoot, operation: 'list_records', record_type: 'repo-status', filters: { max_items: 200 } }, opts);
        const match = (statuses.data || []).find((item) => item && item.path === requestedPath);
        return [actionResult(true, match ? JSON.stringify(match, null, 2) : 'No repo status found for this selection.', false)];
      }

      case 'eco.cockpit.marlinSearchPackages': {
        const result = await bridge({
          backend: 'marlin', workspace_id: workspaceRoot,
          operation: 'invoke_provider_command', command_id: 'marlin.package.search',
          input: { query: require1(message.query, 'query') }, confirm: false,
        }, opts);
        return [{ type: 'eco.cockpit.marlinPackageSearchResult', payload: result.data }];
      }

      case 'eco.cockpit.invokeProviderCommand': {
        const commandId = require1(message.commandId, 'commandId');
        const result = await bridge({
          backend: require1(message.providerId, 'providerId'),
          workspace_id: workspaceRoot,
          operation: 'invoke_provider_command',
          command_id: commandId,
          input: (message.input && typeof message.input === 'object') ? message.input : {},
          confirm: message.confirm === true,
          approval: message.approval,
        }, { ...opts, timeoutMs: timeoutMsForProviderCommand(commandId) });
        return [{ type: 'eco.cockpit.providerCommandResult', payload: result }];
      }

      case 'eco.cockpit.marlinInstallPackage': {
        if (message.confirm !== true) {
          return [{
            type: 'eco.cockpit.marlinInstallResult',
            payload: { ok: false, error: 'Package install requires literal boolean confirmation.' },
          }];
        }
        const installInput = { package_name: require1(message.packageName, 'packageName') };
        const result = await bridge({
          backend: 'marlin', workspace_id: workspaceRoot,
          operation: 'invoke_provider_command', command_id: 'marlin.package.install',
          input: installInput, confirm: true,
          approval: boundApproval('marlin', 'marlin.package.install', installInput),
        }, opts);
        return [{
          type: 'eco.cockpit.marlinInstallResult',
          payload: { ok: result.status === 'succeeded', ...result.data },
        }];
      }

      default:
        return [{ type: 'eco.cockpit.error', payload: { message: `Unhandled message type: ${type}` } }];
    }
  } catch (err) {
    return [actionResult(false, errorMessage(err))];
  }
}

function actionResult(ok, message, refresh = true) {
  return { type: 'eco.cockpit.actionResult', payload: { ok, message, refresh } };
}

function require1(value, key) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${key} is required`);
  }
  return value;
}

function requirePayload(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('payload is required');
  }
  return value;
}

function requireDecision(value) {
  if (value !== 'approved' && value !== 'denied') {
    throw new Error("decision must be 'approved' or 'denied'");
  }
  return value;
}

function rerunPayloadFromRecord(record) {
  const item = requirePayload(record);
  const request = (item.request && typeof item.request === 'object') ? item.request : item;
  const payload = {
    pass_name_or_id: stringFrom(request.pass_name_or_id ?? request.pass_id ?? request.pass),
    artifact_type: stringFrom(request.artifact_type ?? request.artifactType),
    objective: stringFrom(request.objective ?? item.objective ?? item.summary),
  };
  if (!payload.pass_name_or_id || !payload.artifact_type || !payload.objective) {
    throw new Error('Run record does not contain enough request fields to re-run.');
  }
  return payload;
}

function stringFrom(value) {
  return typeof value === 'string' ? value : '';
}

function errorMessage(err) {
  return err instanceof Error ? err.message : String(err);
}

function boundApproval(providerId, commandId, input) {
  return {
    token: `host-web-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    scope: canonicalStringify({ provider_id: providerId, command_id: commandId, input }),
  };
}

function canonicalStringify(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

module.exports = { dispatch, actionResult, boundApproval, timeoutMsForProviderCommand };
