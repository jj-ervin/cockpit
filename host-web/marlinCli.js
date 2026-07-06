'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const DEFAULT_TIMEOUT_MS = 60000;

/**
 * Resolves the real `marlin` CLI: prefer a sibling checkout's built CLI
 * (matching the exact convention eco-vscode's resolveMarlinCommand uses -
 * repos as siblings under the same parent directory). `needsShell` is only
 * true for the .cmd PATH fallback, never for the sibling-checkout path
 * (process.execPath is a real .exe, no shell interpretation involved at all
 * there) - see the note on `search()` for why this distinction matters.
 */
function resolveMarlinCommand() {
  const siblingMarlin = path.resolve(__dirname, '..', '..', 'marlin');
  const localCli = path.join(siblingMarlin, 'apps', 'cli', 'dist', 'index.js');
  if (fs.existsSync(localCli)) {
    return { executable: process.execPath, prefixArgs: [localCli], cwd: siblingMarlin, needsShell: false };
  }
  return {
    executable: process.platform === 'win32' ? 'marlin.cmd' : 'marlin',
    prefixArgs: [],
    cwd: __dirname,
    needsShell: process.platform === 'win32',
  };
}

/**
 * Runs `marlin search <query> --json` and parses the JSON result.
 *
 * Unlike claude/codex (spawnAgent.js), the query here goes into `args`, not
 * stdin - `marlin search <query>` is a positional-arg CLI, not a
 * stdin-reading agent, and there's no evidence it accepts stdin input
 * instead. That's safe ONLY when the target is invoked without a shell
 * (the sibling-checkout path: process.execPath is a real .exe). It would
 * NOT be safe for the .cmd PATH fallback, which requires shell:true on
 * Windows (same EINVAL issue spawnAgent.js hit) and would expose the same
 * shell-injection class fixed there. Rather than silently accept that risk
 * for the fallback path, this fails closed: if no sibling checkout is
 * found, search() refuses to run rather than falling back to an unsafe
 * shell invocation with unescaped query content.
 *
 * spawnFn is injectable for tests.
 */
function search(query, { timeoutMs = DEFAULT_TIMEOUT_MS, spawnFn = spawn } = {}) {
  const command = resolveMarlinCommand();
  if (command.needsShell) {
    return Promise.reject(new Error(
      'No sibling marlin checkout found (expected ../marlin/apps/cli/dist/index.js). ' +
      'The PATH-based marlin.cmd fallback is not supported by the standalone web host, ' +
      'since it would require passing untrusted search text through a shell.'
    ));
  }
  return runJson(command, ['search', query, '--json'], { timeoutMs, spawnFn });
}

function runJson(command, args, { timeoutMs, spawnFn }) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let child;
    try {
      child = spawnFn(command.executable, [...command.prefixArgs, ...args], {
        cwd: command.cwd,
        shell: false,
        windowsHide: true,
      });
    } catch (err) {
      reject(err);
      return;
    }

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      if (settled) return;
      child.kill();
      finishReject(new Error(`Timed out after ${timeoutMs}ms waiting for marlin CLI`));
    }, timeoutMs);

    function finishResolve(v) { if (settled) return; settled = true; clearTimeout(timer); resolve(v); }
    function finishReject(e) { if (settled) return; settled = true; clearTimeout(timer); reject(e); }

    child.stdout && child.stdout.on('data', (c) => { stdout += c.toString('utf-8'); });
    child.stderr && child.stderr.on('data', (c) => { stderr += c.toString('utf-8'); });
    child.on('error', (err) => {
      if (err && err.code === 'ENOENT') {
        finishReject(new Error('marlin CLI not found on PATH and no sibling checkout build was found.'));
        return;
      }
      finishReject(err);
    });
    child.on('close', (code) => {
      if (code !== 0) {
        finishReject(new Error(stderr.trim() || `marlin exited with code ${code}`));
        return;
      }
      try {
        finishResolve(JSON.parse(stdout));
      } catch (err) {
        finishReject(new Error(`marlin returned invalid JSON: ${stdout}`));
      }
    });
  });
}

module.exports = { search, resolveMarlinCommand };
