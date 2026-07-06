'use strict';

const { createApp } = require('./server');

function parseWorkspaceArg(argv) {
  const flagIndex = argv.indexOf('--workspace');
  if (flagIndex !== -1 && argv[flagIndex + 1]) {
    return argv[flagIndex + 1];
  }
  return null;
}

const workspaceRoot = parseWorkspaceArg(process.argv) || process.env.WORKSPACE_ROOT || process.cwd();
const port = process.env.PORT ? Number(process.env.PORT) : 4174;
const pythonExecutable = process.env.COCKPIT_PYTHON || 'python';

const app = createApp({ workspaceRoot, pythonExecutable });
app.listen(port, () => {
  console.log(`Cockpit (standalone web host) listening on http://localhost:${port}`);
  console.log(`Workspace: ${workspaceRoot}`);
  console.log(`Python interpreter: ${pythonExecutable} (set COCKPIT_PYTHON to override)`);
});
