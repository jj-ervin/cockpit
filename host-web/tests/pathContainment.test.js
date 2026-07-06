'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const { resolveContainedPath } = require('../pathContainment');

test('resolveContainedPath accepts a relative path inside the workspace', () => {
  const root = path.resolve('C:/fake/workspace');
  const resolved = resolveContainedPath(root, '.eco/policy.json');
  assert.equal(resolved, path.join(root, '.eco', 'policy.json'));
});

test('resolveContainedPath rejects a path that escapes the workspace via ..', () => {
  const root = path.resolve('C:/fake/workspace');
  assert.throws(() => resolveContainedPath(root, '../../etc/passwd'), /outside the active workspace/);
});

test('resolveContainedPath rejects an absolute path outside the workspace', () => {
  const root = path.resolve('C:/fake/workspace');
  assert.throws(() => resolveContainedPath(root, 'C:/other/place/file.txt'), /outside the active workspace/);
});
