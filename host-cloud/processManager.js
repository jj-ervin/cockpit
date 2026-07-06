'use strict';

const net = require('net');
const { spawn } = require('child_process');

const DEFAULT_READY_TIMEOUT_MS = 15000;

/**
 * Stand-in for CKP.12.00's per-tenant container model: this machine's
 * Docker Desktop cannot run (ARM64 + Windows build 26200, WSL2 --mount
 * requires build 27653+ - confirmed via a real launch attempt, not assumed).
 * Rather than write untestable container-orchestration code, this spawns
 * one unmodified host-web (CKP.11.00) child process per tenant instead -
 * real OS-process isolation (separate PID, separate loopback port, separate
 * Express instance) with a narrower blast-radius than a container (no
 * cgroup/seccomp/filesystem-namespace boundary). ensureRunning/stop/
 * sweepIdle's shapes are deliberately container-manager-shaped so a real
 * Docker (or other container runtime) backing can be swapped in later
 * without changing server.js's calling code.
 *
 * spawnFn/portFinder are injectable for tests, matching the spawnFn pattern
 * already used in host-web/bridgeClient.js.
 */
function createProcessManager({
  hostWebEntry,
  pythonExecutable,
  maxConcurrentTenants = 10,
  readyTimeoutMs = DEFAULT_READY_TIMEOUT_MS,
  spawnFn = spawn,
  portFinder = findFreePort,
  nowFn = () => Date.now(),
} = {}) {
  const running = new Map(); // tenantId -> { child, port, lastActiveAt }

  async function ensureRunning(tenant) {
    const existing = running.get(tenant.id);
    if (existing) {
      existing.lastActiveAt = nowFn();
      return { port: existing.port };
    }

    if (running.size >= maxConcurrentTenants) {
      throw new Error(`Capacity reached: ${maxConcurrentTenants} concurrent tenant processes already running.`);
    }

    const port = await portFinder();
    const child = spawnFn(process.execPath, [hostWebEntry], {
      env: {
        ...process.env,
        WORKSPACE_ROOT: tenant.workspaceRoot,
        PORT: String(port),
        COCKPIT_HOST: '127.0.0.1',
        COCKPIT_PYTHON: pythonExecutable,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    await waitForReady(child, readyTimeoutMs);

    running.set(tenant.id, { child, port, lastActiveAt: nowFn() });
    child.on('exit', () => {
      const entry = running.get(tenant.id);
      if (entry && entry.child === child) {
        running.delete(tenant.id);
      }
    });
    return { port };
  }

  function touch(tenantId) {
    const entry = running.get(tenantId);
    if (entry) {
      entry.lastActiveAt = nowFn();
    }
  }

  function stop(tenantId) {
    const entry = running.get(tenantId);
    if (!entry) {
      return false;
    }
    entry.child.kill();
    running.delete(tenantId);
    return true;
  }

  function sweepIdle(idleTimeoutMs) {
    const now = nowFn();
    const stopped = [];
    for (const [tenantId, entry] of running.entries()) {
      if (now - entry.lastActiveAt > idleTimeoutMs) {
        entry.child.kill();
        running.delete(tenantId);
        stopped.push(tenantId);
      }
    }
    return stopped;
  }

  function listRunning() {
    return Array.from(running.entries()).map(([tenantId, entry]) => ({
      tenantId, port: entry.port, lastActiveAt: entry.lastActiveAt,
    }));
  }

  function stopAll() {
    for (const tenantId of Array.from(running.keys())) {
      stop(tenantId);
    }
  }

  return { ensureRunning, touch, stop, sweepIdle, listRunning, stopAll };
}

function waitForReady(child, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let buffer = '';

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error(`host-web child process did not become ready within ${timeoutMs}ms`));
    }, timeoutMs);

    function onData(chunk) {
      if (settled) return;
      buffer += chunk.toString('utf-8');
      if (buffer.includes('listening on')) {
        settled = true;
        clearTimeout(timer);
        child.stdout && child.stdout.removeListener('data', onData);
        resolve();
      }
    }

    child.stdout && child.stdout.on('data', onData);
    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
    child.on('exit', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`host-web child process exited before becoming ready (code ${code})`));
    });
  });
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

module.exports = { createProcessManager, findFreePort };
