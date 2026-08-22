const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const http = require('http');
const path = require('path');

let localServer;
let hostUrlPromise = null;
let installWindow = null;

function windowIconPath() {
  return path.join(__dirname, 'assets', 'cockpit-icon-pack', 'cockpit.ico');
}

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

function workspaceFromArgs(argv, env = process.env) {
  if (env.COCKPIT_WORKSPACE) return path.resolve(env.COCKPIT_WORKSPACE);
  const index = argv.indexOf('--workspace');
  return index >= 0 && argv[index + 1] ? path.resolve(argv[index + 1]) : process.cwd();
}

function argumentValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 && argv[index + 1] ? path.resolve(argv[index + 1]) : null;
}

function isSmokeTest(argv, env = process.env) {
  return env.COCKPIT_SMOKE_TEST === '1' || argv.includes('--smoke-test');
}

const smokeUserData = process.env.COCKPIT_SMOKE_USER_DATA || argumentValue(process.argv, '--smoke-user-data');
if (smokeUserData) app.setPath('userData', smokeUserData);

function bridgePath() {
  if (!app.isPackaged) return process.env.COCKPIT_BRIDGE || null;
  return path.join(process.resourcesPath, 'bridge', 'cockpit-bridge.exe');
}

/**
 * Idempotent: install-mode and the full shell can both need the host in
 * the same process lifetime (e.g. clicking "Open Cockpit" after an
 * install-mode install), and must share the one already-listening server
 * rather than each starting a competing loopback listener.
 */
function startHost() {
  if (hostUrlPromise) return hostUrlPromise;
  hostUrlPromise = (async () => {
    exposeDesktopDependenciesToHost();
    const hostRoot = app.isPackaged
      ? path.join(process.resourcesPath, 'host-web')
      : path.join(__dirname, '..', 'host-web');
    const { createApp } = require(path.join(hostRoot, 'server.js'));
    const expressApp = createApp({
      workspaceRoot: workspaceFromArgs(process.argv),
      pythonExecutable: process.env.COCKPIT_PYTHON || 'python',
      bridgeExecutable: bridgePath(),
      installIntent: process.env.COCKPIT_INSTALL_INTENT || null,
    });
    localServer = http.createServer(expressApp);
    await new Promise((resolve, reject) => {
      localServer.once('error', reject);
      localServer.listen(0, '127.0.0.1', resolve);
    });
    return `http://127.0.0.1:${localServer.address().port}`;
  })();
  return hostUrlPromise;
}

function isInstallMode(env = process.env) {
  return Boolean(env.COCKPIT_INSTALL_INTENT);
}

function installWindowTitle(env = process.env) {
  const intent = env.COCKPIT_INSTALL_INTENT || '';
  return 'Install ' + (intent ? intent.charAt(0).toUpperCase() + intent.slice(1) : 'Package');
}

/**
 * The constrained install-mode window (see the install-mode design note in
 * DEV-PLAN.md): package name/version/source/checksum and Install/Cancel
 * only, never the full shell's nav/tabs/wizard. Loads /install instead of
 * /, from a small fixed-purpose BrowserWindow with its own narrowly-scoped
 * preload (installPreload.cjs) instead of the shell's no-bridge preload.
 */
async function createInstallWindow() {
  const url = await startHost();
  const window = new BrowserWindow({
    width: 480, height: 480, minWidth: 420, minHeight: 420,
    title: installWindowTitle(), icon: windowIconPath(),
    webPreferences: { preload: path.join(__dirname, 'installPreload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  installWindow = window;
  window.on('closed', () => { installWindow = null; });
  await window.loadURL(`${url}/install`);
}

ipcMain.on('cockpit-install:close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.close();
});

ipcMain.on('cockpit-install:open-cockpit', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  await createWindow();
  if (win) win.close();
});

async function createWindow() {
  const smokeTest = isSmokeTest(process.argv);
  const workspaceRoot = workspaceFromArgs(process.argv);
  const url = await startHost();
  const window = new BrowserWindow({
    width: 1440, height: 960, minWidth: 980, minHeight: 680,
    title: 'Cockpit', icon: windowIconPath(), show: !smokeTest,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  await window.loadURL(url);
  if (smokeTest) {
    const ui = await waitForShell(window);
    if (!ui.auditTab || ui.tabCount < 5 || !ui.footer.includes(workspaceRoot)) {
      throw new Error(`Packaged shell did not load the selected workspace: ${JSON.stringify(ui)}`);
    }
    const result = {
      status: 'passed',
      packaged: app.isPackaged,
      workspace_root: workspaceRoot,
      resources_path: process.resourcesPath,
      bridge_path: bridgePath(),
      ui,
    };
    const resultPath = process.env.COCKPIT_SMOKE_RESULT || argumentValue(process.argv, '--smoke-result');
    if (resultPath) fs.writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(result));
    window.destroy();
    app.quit();
  }
}

async function waitForShell(window) {
  return window.webContents.executeJavaScript(`new Promise((resolve, reject) => {
    const deadline = Date.now() + 30000;
    function inspect() {
      const footer = document.getElementById('footer');
      if (footer && footer.textContent && footer.textContent !== 'Loading Cockpit state...') {
        resolve({
          title: document.title,
          footer: footer.textContent,
          tabCount: document.querySelectorAll('.tab').length,
          auditTab: Boolean(document.querySelector('.tab[data-tab="marlin-audit"]')),
        });
        return;
      }
      if (Date.now() >= deadline) {
        reject(new Error('Timed out waiting for Cockpit state'));
        return;
      }
      setTimeout(inspect, 100);
    }
    inspect();
  })`);
}

function recordStartupFailure(error) {
  const message = error instanceof Error ? (error.stack || error.message) : String(error);
  const resultPath = process.env.COCKPIT_SMOKE_RESULT || argumentValue(process.argv, '--smoke-result');
  if (resultPath) {
    fs.writeFileSync(resultPath, `${JSON.stringify({ status: 'failed', error: message }, null, 2)}\n`, 'utf8');
  }
  console.error(message);
  process.exitCode = 1;
  app.quit();
}

app.whenReady().then(() => (isInstallMode() ? createInstallWindow() : createWindow())).catch(recordStartupFailure);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { if (localServer) localServer.close(); });

module.exports = { argumentValue, isSmokeTest, workspaceFromArgs, waitForShell, isInstallMode, installWindowTitle };
