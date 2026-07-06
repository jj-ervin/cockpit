'use strict';

const path = require('path');
const { spawn } = require('child_process');

/**
 * Opens a file with the OS default application, or reveals its containing
 * folder in the platform file manager. Only ever called with a path that
 * has already passed resolveContainedPath (pathContainment.js) - never raw
 * text from the browser.
 *
 * Unlike claude/codex/marlin (npm-installed .cmd shims), cmd.exe/explorer.exe
 * /open/xdg-open are all real executables, not batch scripts - shell:false
 * works directly, no EINVAL, no shell-escaping surface at all here.
 *
 * spawnFn is injectable for tests.
 */
function openWithDefaultApp(filePath, { spawnFn = spawn } = {}) {
  if (process.platform === 'win32') {
    return spawnDetached(spawnFn, 'cmd.exe', ['/c', 'start', '', filePath]);
  }
  if (process.platform === 'darwin') {
    return spawnDetached(spawnFn, 'open', [filePath]);
  }
  return spawnDetached(spawnFn, 'xdg-open', [filePath]);
}

function revealInFileManager(filePath, { spawnFn = spawn } = {}) {
  if (process.platform === 'win32') {
    return spawnDetached(spawnFn, 'explorer.exe', [path.dirname(filePath)]);
  }
  if (process.platform === 'darwin') {
    return spawnDetached(spawnFn, 'open', ['-R', filePath]);
  }
  return spawnDetached(spawnFn, 'xdg-open', [path.dirname(filePath)]);
}

function spawnDetached(spawnFn, executable, args) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawnFn(executable, args, { shell: false, windowsHide: true, detached: true, stdio: 'ignore' });
    } catch (err) {
      reject(err);
      return;
    }
    child.on('error', (err) => {
      if (err && err.code === 'ENOENT') {
        reject(new Error(`${executable} not found on this system.`));
        return;
      }
      reject(err);
    });
    // These are fire-and-forget UI launches (open a viewer app / file manager),
    // not something we wait on - resolve once spawn succeeded without error.
    setImmediate(() => resolve());
    if (typeof child.unref === 'function') {
      child.unref();
    }
  });
}

module.exports = { openWithDefaultApp, revealInFileManager };
