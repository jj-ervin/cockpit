'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('events');
const { PassThrough } = require('stream');

const { callBridge } = require('../bridgeClient');

function fakeChild() {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.stdin = new PassThrough();
  child.kill = () => { child.emit('close', 143); };
  return child;
}

test('callBridge writes the request JSON to stdin and parses the stdout response', async () => {
  let capturedStdin = '';
  const spawnFn = () => {
    const child = fakeChild();
    child.stdin.on('data', (c) => { capturedStdin += c.toString('utf-8'); });
    setImmediate(() => {
      child.stdout.emit('data', Buffer.from(JSON.stringify({ data: { ok: true }, origin: {} })));
      child.emit('close', 0);
    });
    return child;
  };

  const result = await callBridge({ backend: 'eco', operation: 'health' }, { spawnFn });
  assert.deepEqual(JSON.parse(capturedStdin), { backend: 'eco', operation: 'health' });
  assert.deepEqual(result.data, { ok: true });
});

test('callBridge rejects when the bridge returns an error envelope', async () => {
  const spawnFn = () => {
    const child = fakeChild();
    setImmediate(() => {
      child.stdout.emit('data', Buffer.from(JSON.stringify({ error: { type: 'ValidationError', message: 'bad request' } })));
      child.emit('close', 1);
    });
    return child;
  };

  await assert.rejects(
    () => callBridge({ backend: 'eco', operation: 'health' }, { spawnFn }),
    /ValidationError: bad request/,
  );
});

test('callBridge reports a clear message when the python executable is missing', async () => {
  const spawnFn = () => {
    const child = fakeChild();
    setImmediate(() => {
      const err = new Error('spawn python ENOENT');
      err.code = 'ENOENT';
      child.emit('error', err);
    });
    return child;
  };

  await assert.rejects(
    () => callBridge({ backend: 'eco', operation: 'health' }, { spawnFn, pythonExecutable: 'python' }),
    /Python executable not found: python/,
  );
});

test('callBridge times out and kills the child if it never closes', async () => {
  let killed = false;
  const spawnFn = () => {
    const child = fakeChild();
    child.kill = () => { killed = true; };
    return child;
  };

  await assert.rejects(
    () => callBridge({ backend: 'eco', operation: 'health' }, { spawnFn, timeoutMs: 20 }),
    /Timed out/,
  );
  assert.equal(killed, true);
});
