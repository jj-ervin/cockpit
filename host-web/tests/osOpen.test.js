'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('events');

const { openWithDefaultApp, revealInFileManager } = require('../osOpen');

function fakeChild() {
  const child = new EventEmitter();
  child.unref = () => {};
  return child;
}

// These tests assert this machine's real platform (win32, per the dev
// environment) rather than faking process.platform - simpler and still
// exercises the real code path that will actually run.

test('openWithDefaultApp spawns cmd.exe /c start on win32, shell:false (cmd.exe is a real .exe)', async () => {
  let capturedExecutable, capturedArgs, capturedOptions;
  const spawnFn = (executable, args, options) => {
    capturedExecutable = executable;
    capturedArgs = args;
    capturedOptions = options;
    return fakeChild();
  };

  await openWithDefaultApp('C:\\fake\\workspace\\.eco\\policy.json', { spawnFn });

  if (process.platform === 'win32') {
    assert.equal(capturedExecutable, 'cmd.exe');
    assert.deepEqual(capturedArgs, ['/c', 'start', '', 'C:\\fake\\workspace\\.eco\\policy.json']);
    assert.equal(capturedOptions.shell, false);
  }
});

test('revealInFileManager spawns explorer.exe on the containing directory on win32', async () => {
  let capturedExecutable, capturedArgs;
  const spawnFn = (executable, args) => {
    capturedExecutable = executable;
    capturedArgs = args;
    return fakeChild();
  };

  await revealInFileManager('C:\\fake\\workspace\\.eco\\artifacts\\a.json', { spawnFn });

  if (process.platform === 'win32') {
    assert.equal(capturedExecutable, 'explorer.exe');
    assert.deepEqual(capturedArgs, ['C:\\fake\\workspace\\.eco\\artifacts']);
  }
});

test('openWithDefaultApp rejects with a clear message when the executable is missing', async () => {
  const spawnFn = () => {
    const child = fakeChild();
    setImmediate(() => {
      const err = new Error('spawn cmd.exe ENOENT');
      err.code = 'ENOENT';
      child.emit('error', err);
    });
    return child;
  };

  await assert.rejects(() => openWithDefaultApp('C:\\fake\\file.txt', { spawnFn }), /not found on this system/);
});
