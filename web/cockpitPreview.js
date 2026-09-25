'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const createCockpitPreview = require('../cockpitPreview.js');

test('CockpitPreview exposes the static snapshot contract', () => {
  const preview = createCockpitPreview();
  assert.equal(typeof preview.staticSnapshot, 'function');
  const snapshot = preview.staticSnapshot();
  assert.deepEqual(Object.keys(snapshot).sort(), [
    'development', 'diagnostics', 'governance', 'health', 'installIntent',
    'marlin', 'mode', 'niji', 'records', 'state', 'workspace',
  ].sort());
  assert.equal(snapshot.state.statusLabel, 'Preview');
  assert.equal(snapshot.records.runs.length, 3);
  assert.equal(snapshot.mode.current_mode, 'Navigator');
});
