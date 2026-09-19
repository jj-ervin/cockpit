const test = require('node:test');
const assert = require('node:assert/strict');

function loadState() {
  delete global.window;
  global.window = {};
  delete require.cache[require.resolve('../cockpitState.js')];
  require('../cockpitState.js');
  return global.window.CockpitState;
}

test('creates a versioned operational state envelope', () => {
  const CockpitState = loadState();
  const store = CockpitState.create({ snapshot: { status: 'ready' } });
  assert.deepEqual(store.get(), {
    schema_version: 'cockpit-state-v1',
    revision: 0,
    snapshot: { status: 'ready' },
    ui: { selectedRunId: '', runFilter: 'all', wizardStep: 0 },
  });
});

test('updates operational UI state through the store and increments revision', () => {
  const CockpitState = loadState();
  const store = CockpitState.create();
  store.setUi({ selectedRunId: 'run-42', wizardStep: 1 });

  assert.equal(store.get().revision, 1);
  assert.equal(store.get().ui.selectedRunId, 'run-42');
  assert.equal(store.get().ui.runFilter, 'all');
  assert.equal(store.get().ui.wizardStep, 1);
});

test('publishes immutable snapshots to subscribers', () => {
  const CockpitState = loadState();
  const store = CockpitState.create();
  let received = null;
  const unsubscribe = store.subscribe((snapshot) => {
    received = snapshot;
  });

  store.setUi({ runFilter: 'failed' });
  received.ui.runFilter = 'mutated-outside-store';

  assert.equal(store.get().ui.runFilter, 'failed');
  unsubscribe();
});

test('replaceSnapshot preserves UI state while advancing revision', () => {
  const CockpitState = loadState();
  const store = CockpitState.create();
  store.setUi({ selectedRunId: 'run-7' });
  store.replaceSnapshot({ status: 'healthy' });

  assert.equal(store.get().revision, 2);
  assert.equal(store.get().ui.selectedRunId, 'run-7');
  assert.deepEqual(store.get().snapshot, { status: 'healthy' });
});
