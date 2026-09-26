'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const createCommandInterface = require('../commandInterface.js');

test('command interface interprets human input through an injected resolver', () => {
  const posted = [];
  const commandInterface = createCommandInterface({
    host: { postMessage: (message) => posted.push(message) },
    resolve: (input) => input === 'status' ? {
      providerId: 'demo',
      commandId: 'demo.status',
      parameters: { scope: 'workspace' },
      requiresConfirmation: false,
    } : null,
  });

  const result = commandInterface.submit('  status  ');

  assert.equal(result.ok, true);
  assert.equal(result.request.input, 'status');
  assert.deepEqual(result.request.parameters, { scope: 'workspace' });
  assert.equal(result.message.type, 'eco.cockpit.invokeProviderCommand');
  assert.equal(result.message.providerId, 'demo');
  assert.equal(result.message.commandId, 'demo.status');
  assert.equal(result.message.confirm, false);
  assert.deepEqual(posted, [result.message]);
});

test('command interface fails closed when input cannot resolve to a command', () => {
  const posted = [];
  const commandInterface = createCommandInterface({
    host: { postMessage: (message) => posted.push(message) },
    resolve: () => null,
  });

  const result = commandInterface.submit('/does-not-exist');

  assert.equal(result.ok, false);
  assert.equal(result.error, 'command-not-found');
  assert.equal(posted.length, 0);
});

test('command interface does not invent provider semantics', () => {
  const posted = [];
  const commandInterface = createCommandInterface({
    host: { postMessage: (message) => posted.push(message) },
    resolve: (input) => input === 'install' ? {
      providerId: 'demo',
      commandId: 'demo.install',
      parameters: { package: 'x' },
      requiresConfirmation: true,
    } : null,
  });

  const result = commandInterface.submit('install');

  assert.equal(result.ok, true);
  assert.equal(result.message.confirm, true);
  assert.equal(result.message.input.package, 'x');
  assert.equal(result.message.commandId, 'demo.install');
  assert.equal(typeof result.message.action, 'undefined');
  assert.equal(typeof result.message.provider, 'undefined');
});

test('command interface requires an explicit interpreted request before invocation', () => {
  const commandInterface = createCommandInterface({
    host: { postMessage() {} },
    resolve: () => null,
  });

  assert.throws(
    () => commandInterface.invoke({ providerId: 'demo', commandId: 'demo.status' }),
    /interpreted command/,
  );
});
