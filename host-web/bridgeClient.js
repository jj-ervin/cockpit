'use strict';

const { spawn } = require('child_process');

const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Spawns `python -m cockpit.host_bridge`, writes the JSON request to stdin,
 * parses the JSON response from stdout. Mirrors host_bridge.py's own
 * contract exactly (one JSON request in, one JSON AdapterResult envelope
 * out) - the same contract eco-vscode's PythonCockpitApi already uses, just
 * from Node instead of TypeScript.
 *
 * The request payload goes through stdin, never argv, following the same
 * safety pattern established in LASSO's spawnAgent.js: args stay fixed
 * (['-m', 'cockpit.host_bridge']), so there is no shell-injection surface
 * even though shell:true is used for Windows .cmd/.bat compatibility.
 *
 * spawnFn is injectable for tests (defaults to child_process.spawn).
 */
function callBridge(request, {
  pythonExecutable = process.env.COCKPIT_PYTHON || 'python',
  bridgeExecutable = process.env.COCKPIT_BRIDGE || null,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  spawnFn = spawn,
} = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let child;
    try {
      const executable = bridgeExecutable || pythonExecutable;
      child = spawnFn(executable, bridgeExecutable ? [] : ['-m', 'cockpit.host_bridge'], {
        shell: bridgeExecutable ? false : process.platform === 'win32',
        windowsHide: true,
      });
    } catch (err) {
      reject(wrapError(err, bridgeExecutable || pythonExecutable));
      return;
    }

    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      child.kill();
      finishReject(new Error(`Timed out after ${timeoutMs}ms waiting for cockpit.host_bridge`));
    }, timeoutMs);

    function finishResolve(value) {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(value);
    }

    function finishReject(err) {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      reject(err);
    }

    child.stdout && child.stdout.on('data', (chunk) => { stdout += chunk.toString('utf-8'); });
    child.stderr && child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf-8'); });
    child.on('error', (err) => {
      finishReject(wrapError(err, bridgeExecutable || pythonExecutable));
    });
    child.on('close', () => {
      let parsed;
      try {
        parsed = JSON.parse(stdout || '{}');
      } catch (err) {
        finishReject(new Error(`cockpit.host_bridge returned invalid JSON: ${stderr || stdout}`));
        return;
      }
      if (parsed && parsed.error) {
        finishReject(new Error(`${parsed.error.type}: ${parsed.error.message}`));
        return;
      }
      finishResolve(parsed);
    });

    if (child.stdin) {
      child.stdin.write(JSON.stringify(request));
      child.stdin.end();
    }
  });
}

function wrapError(err, executable) {
  if (err && err.code === 'ENOENT') {
    return new Error(
      `Python executable not found: ${executable}. Set COCKPIT_PYTHON to the interpreter ` +
      `that has the cockpit package installed (e.g. cockpit's own .venv).`
    );
  }
  return err instanceof Error ? err : new Error(String(err));
}

module.exports = { callBridge, DEFAULT_TIMEOUT_MS };
