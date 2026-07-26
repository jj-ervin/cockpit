'use strict';

const { createApp } = require('./server');

function parseWorkspaceArg(argv) {
  const flagIndex = argv.indexOf('--workspace');
  if (flagIndex !== -1 && argv[flagIndex + 1]) {
    return argv[flagIndex + 1];
  }
  return null;
}

/**
 * Defaults to loopback-only so a locally-run `npm start` isn't reachable
 * from other machines on the network by default - host-web has no auth, so
 * binding all interfaces would expose every eco.cockpit.* action to anyone
 * who can reach the host. Set COCKPIT_HOST to opt into wider binding (e.g.
 * for deliberate local multi-device testing).
 */
function resolveHost(env) {
  return env.COCKPIT_HOST || '127.0.0.1';
}

if (require.main === module) {
  const workspaceRoot = parseWorkspaceArg(process.argv) || process.env.WORKSPACE_ROOT || process.cwd();
  const port = process.env.PORT ? Number(process.env.PORT) : 4174;
  const pythonExecutable = process.env.COCKPIT_PYTHON || 'python';
  const bridgeExecutable = process.env.COCKPIT_BRIDGE || null;
  const host = resolveHost(process.env);

  const app = createApp({ workspaceRoot, pythonExecutable, bridgeExecutable });
  app.listen(port, host, () => {
    console.log(`Cockpit (standalone web host) listening on http://${host}:${port}`);
    console.log(`Workspace: ${workspaceRoot}`);
    console.log(`Python interpreter: ${pythonExecutable} (set COCKPIT_PYTHON to override)`);
    if (bridgeExecutable) console.log(`Bridge executable: ${bridgeExecutable}`);
  });
}

module.exports = { parseWorkspaceArg, resolveHost };
