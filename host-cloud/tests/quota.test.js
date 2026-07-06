'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { directorySizeBytes, withinQuota } = require('../quota');

function makeWorkspace() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cockpit-cloud-quota-'));
}

test('directorySizeBytes sums nested file sizes', () => {
  const root = makeWorkspace();
  fs.writeFileSync(path.join(root, 'a.txt'), 'x'.repeat(100));
  fs.mkdirSync(path.join(root, 'sub'));
  fs.writeFileSync(path.join(root, 'sub', 'b.txt'), 'y'.repeat(50));
  assert.equal(directorySizeBytes(root), 150);
});

test('withinQuota returns true when usage is under the limit', () => {
  const root = makeWorkspace();
  fs.writeFileSync(path.join(root, 'a.txt'), 'x'.repeat(10));
  assert.equal(withinQuota(root, 100), true);
});

test('withinQuota returns false when usage exceeds the limit', () => {
  const root = makeWorkspace();
  fs.writeFileSync(path.join(root, 'a.txt'), 'x'.repeat(200));
  assert.equal(withinQuota(root, 100), false);
});

test('withinQuota treats a zero/undefined limit as disabled (always true)', () => {
  const root = makeWorkspace();
  fs.writeFileSync(path.join(root, 'a.txt'), 'x'.repeat(10000));
  assert.equal(withinQuota(root, 0), true);
  assert.equal(withinQuota(root, undefined), true);
});
