'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('events');

const { createProcessManager } = require('../processManager');

function makeFakeChild() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = () => { child.emit('exit', 0); };
  return child;
}

function makeSpawnFn(children) {
  let i = 0;
  return () => children[i++];
}

/**
 * ensureRunning does `await portFinder()` before spawning and attaching its
 * stdout listener, so emitting the fake child's "ready" data synchronously
 * right after calling ensureRunning() races ahead of that listener attach
 * and is silently dropped (EventEmitter doesn't buffer). setImmediate is a
 * macrotask, so awaiting one flushes every pending microtask (portFinder's
 * resolution and ensureRunning's continuation) first, guaranteeing the
 * listener is attached by the time we emit.
 */
function flushMicrotasks() {
  return new Promise((resolve) => setImmediate(resolve));
}

test('ensureRunning spawns a child and resolves once it logs "listening on"', async () => {
  const child = makeFakeChild();
  const spawnFn = makeSpawnFn([child]);
  const pm = createProcessManager({
    hostWebEntry: 'fake-entry.js', pythonExecutable: 'python', spawnFn, portFinder: async () => 5000,
  });

  const promise = pm.ensureRunning({ id: 't1', workspaceRoot: '/ws/t1' });
  await flushMicrotasks();
  child.stdout.emit('data', Buffer.from('Cockpit (standalone web host) listening on http://127.0.0.1:5000\n'));
  const result = await promise;
  assert.equal(result.port, 5000);
});

test('ensureRunning returns the same port for a tenant already running, without spawning again', async () => {
  const child = makeFakeChild();
  let spawnCount = 0;
  const spawnFn = () => { spawnCount += 1; return child; };
  const pm = createProcessManager({
    hostWebEntry: 'fake-entry.js', pythonExecutable: 'python', spawnFn, portFinder: async () => 5001,
  });

  const promise = pm.ensureRunning({ id: 't1', workspaceRoot: '/ws/t1' });
  await flushMicrotasks();
  child.stdout.emit('data', Buffer.from('listening on http://127.0.0.1:5001\n'));
  await promise;

  const second = await pm.ensureRunning({ id: 't1', workspaceRoot: '/ws/t1' });
  assert.equal(second.port, 5001);
  assert.equal(spawnCount, 1);
});

test('ensureRunning rejects if the child exits before becoming ready', async () => {
  const child = makeFakeChild();
  const spawnFn = makeSpawnFn([child]);
  const pm = createProcessManager({
    hostWebEntry: 'fake-entry.js', pythonExecutable: 'python', spawnFn, portFinder: async () => 5002,
  });

  const promise = pm.ensureRunning({ id: 't1', workspaceRoot: '/ws/t1' });
  await flushMicrotasks();
  child.emit('exit', 1);
  await assert.rejects(promise, /exited before becoming ready/);
});

test('ensureRunning rejects once maxConcurrentTenants is reached for a new tenant', async () => {
  const childA = makeFakeChild();
  const childB = makeFakeChild();
  const spawnFn = makeSpawnFn([childA, childB]);
  const pm = createProcessManager({
    hostWebEntry: 'fake-entry.js', pythonExecutable: 'python', spawnFn, portFinder: async () => 5003,
    maxConcurrentTenants: 1,
  });

  const first = pm.ensureRunning({ id: 'alice', workspaceRoot: '/ws/alice' });
  await flushMicrotasks();
  childA.stdout.emit('data', Buffer.from('listening on http://127.0.0.1:5003\n'));
  await first;

  await assert.rejects(
    pm.ensureRunning({ id: 'bob', workspaceRoot: '/ws/bob' }),
    /Capacity reached/,
  );
});

test('sweepIdle stops only tenants idle longer than the threshold', async () => {
  let now = 0;
  const child = makeFakeChild();
  const spawnFn = makeSpawnFn([child]);
  const pm = createProcessManager({
    hostWebEntry: 'fake-entry.js', pythonExecutable: 'python', spawnFn, portFinder: async () => 5004,
    nowFn: () => now,
  });

  const promise = pm.ensureRunning({ id: 't1', workspaceRoot: '/ws/t1' });
  await flushMicrotasks();
  child.stdout.emit('data', Buffer.from('listening on http://127.0.0.1:5004\n'));
  await promise;

  now += 5000;
  assert.deepEqual(pm.sweepIdle(10000), []); // not idle enough yet
  assert.equal(pm.listRunning().length, 1);

  now += 20000;
  assert.deepEqual(pm.sweepIdle(10000), ['t1']);
  assert.equal(pm.listRunning().length, 0);
});

test('touch() resets a tenant\'s idle clock so sweepIdle does not stop it', async () => {
  let now = 0;
  const child = makeFakeChild();
  const spawnFn = makeSpawnFn([child]);
  const pm = createProcessManager({
    hostWebEntry: 'fake-entry.js', pythonExecutable: 'python', spawnFn, portFinder: async () => 5005,
    nowFn: () => now,
  });

  const promise = pm.ensureRunning({ id: 't1', workspaceRoot: '/ws/t1' });
  await flushMicrotasks();
  child.stdout.emit('data', Buffer.from('listening on http://127.0.0.1:5005\n'));
  await promise;

  now += 9000;
  pm.touch('t1');
  now += 9000;
  assert.deepEqual(pm.sweepIdle(10000), []);
});

test('stop() kills the child and removes it from listRunning', async () => {
  const child = makeFakeChild();
  const spawnFn = makeSpawnFn([child]);
  const pm = createProcessManager({
    hostWebEntry: 'fake-entry.js', pythonExecutable: 'python', spawnFn, portFinder: async () => 5006,
  });

  const promise = pm.ensureRunning({ id: 't1', workspaceRoot: '/ws/t1' });
  await flushMicrotasks();
  child.stdout.emit('data', Buffer.from('listening on http://127.0.0.1:5006\n'));
  await promise;

  assert.equal(pm.stop('t1'), true);
  assert.equal(pm.listRunning().length, 0);
  assert.equal(pm.stop('t1'), false);
});
