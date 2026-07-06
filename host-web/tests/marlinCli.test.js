'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('events');
const { PassThrough } = require('stream');

const { search } = require('../marlinCli');

function fakeChild() {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = () => { child.emit('close', 143); };
  return child;
}

test('search resolves parsed JSON on a clean exit', async () => {
  const spawnFn = () => {
    const child = fakeChild();
    setImmediate(() => {
      child.stdout.emit('data', Buffer.from(JSON.stringify({ ok: true, packages: [] })));
      child.emit('close', 0);
    });
    return child;
  };

  // This machine has a real sibling ../marlin checkout (verified during
  // planning), so search() takes the safe process.execPath path, not the
  // needsShell fallback that would reject.
  const result = await search('devxtoolkit', { spawnFn });
  assert.deepEqual(result, { ok: true, packages: [] });
});

test('search never puts the query where a shell could interpret it - shell is always false', async () => {
  let capturedOptions;
  const spawnFn = (executable, args, options) => {
    capturedOptions = options;
    const child = fakeChild();
    setImmediate(() => {
      child.stdout.emit('data', Buffer.from('{}'));
      child.emit('close', 0);
    });
    return child;
  };

  await search('say "hi" & echo INJECTED', { spawnFn });
  assert.equal(capturedOptions.shell, false);
});

test('search surfaces a clear error on non-zero exit', async () => {
  const spawnFn = () => {
    const child = fakeChild();
    setImmediate(() => {
      child.stderr.emit('data', Buffer.from('package not found'));
      child.emit('close', 1);
    });
    return child;
  };

  await assert.rejects(() => search('nonexistent', { spawnFn }), /package not found/);
});
