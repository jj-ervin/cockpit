const { app, BrowserWindow } = require('electron');
const http = require('http');
const path = require('path');

let localServer;

function exposeDesktopDependenciesToHost() {
  // host-web is deliberately shipped as a resource so the same host-agnostic
  // bundle can also be used by its standalone Node host. In a packaged
  // Electron app its `require('express')` must resolve from this app's
  // production dependencies, not from a development checkout beside it.
  const desktopNodeModules = path.join(__dirname, 'node_modules');
  const entries = (process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean);
  if (!entries.includes(desktopNodeModules)) {
    process.env.NODE_PATH = [desktopNodeModules, ...entries].join(path.delimiter);
    require('module').Module._initPaths();
  }
}

function workspaceFromArgs(argv) {
  const index = argv.indexOf('--workspace');
  return index >= 0 && argv[index + 1] ? path.resolve(argv[index + 1]) : process.cwd();
}

function bridgePath() {
  if (!app.isPackaged) return process.env.COCKPIT_BRIDGE || null;
  return path.join(process.resourcesPath, 'bridge', 'cockpit-bridge.exe');
}

async function startHost() {
  exposeDesktopDependenciesToHost();
  const hostRoot = app.isPackaged
    ? path.join(process.resourcesPath, 'host-web')
    : path.join(__dirname, '..', 'host-web');
  const { createApp } = require(path.join(hostRoot, 'server.js'));
  const expressApp = createApp({
    workspaceRoot: workspaceFromArgs(process.argv),
    pythonExecutable: process.env.COCKPIT_PYTHON || 'python',
    bridgeExecutable: bridgePath(),
  });
  localServer = http.createServer(expressApp);
  await new Promise((resolve, reject) => {
    localServer.once('error', reject);
    localServer.listen(0, '127.0.0.1', resolve);
  });
  return `http://127.0.0.1:${localServer.address().port}`;
}

async function createWindow() {
  const url = await startHost();
  const window = new BrowserWindow({
    width: 1440, height: 960, minWidth: 980, minHeight: 680,
    title: 'Cockpit',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  await window.loadURL(url);
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { if (localServer) localServer.close(); });
