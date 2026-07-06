'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { resolveContainedPathStrict } = require('../pathContainment');

function makeWorkspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cockpit-cloud-containment-'));
  return root;
}

test('accepts a relative path inside the workspace', () => {
  const root = makeWorkspace();
  fs.writeFileSync(path.join(root, 'file.txt'), 'hi');
  const resolved = resolveContainedPathStrict(root, 'file.txt');
  assert.equal(fs.realpathSync(resolved), fs.realpathSync(path.join(root, 'file.txt')));
});

test('accepts a relative path to a not-yet-existing file inside the workspace', () => {
  const root = makeWorkspace();
  const resolved = resolveContainedPathStrict(root, 'new-file.txt');
  assert.equal(path.relative(fs.realpathSync(root), resolved), 'new-file.txt');
});

test('rejects a path that escapes the workspace via ..', () => {
  const root = makeWorkspace();
  assert.throws(() => resolveContainedPathStrict(root, '../escape.txt'));
});

test('rejects an absolute path outside the workspace', () => {
  const root = makeWorkspace();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'cockpit-cloud-outside-'));
  assert.throws(() => resolveContainedPathStrict(root, path.join(outside, 'secret.txt')));
});

test('rejects a symlink inside the workspace that points outside it', (t) => {
  const root = makeWorkspace();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'cockpit-cloud-outside-'));
  fs.writeFileSync(path.join(outside, 'secret.txt'), 'top secret');
  const linkPath = path.join(root, 'escape-link');
  try {
    fs.symlinkSync(path.join(outside, 'secret.txt'), linkPath, 'file');
  } catch (err) {
    // Creating symlinks on Windows requires admin rights or Developer Mode;
    // skip rather than fail the suite in environments without that.
    t.skip(`symlink creation not permitted in this environment: ${err.message}`);
    return;
  }
  assert.throws(() => resolveContainedPathStrict(root, 'escape-link'));
});
