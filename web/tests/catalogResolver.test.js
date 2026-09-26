'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const createCatalogResolver = require('../catalogResolver.js');
const createCommandInterface = require('../commandInterface.js');

test('catalog resolver resolves a discovered command without owning provider semantics', () => {
  const catalog = {
    schema_version: 'cockpit-provider-command-catalog-v1.1',
    providers: [{
      id: 'niji',
      name: 'Niji',
      commands: [{
        id: 'niji.palette.preview',
        title: 'Preview palette',
        action: 'preview',
        mutation: false,
        requires_confirmation: false,
      }],
    }],
  };

  const resolver = createCatalogResolver(catalog);
  assert.deepEqual(resolver.resolve('niji.palette.preview'), {
    providerId: 'niji',
    commandId: 'niji.palette.preview',
    parameters: {},
    requiresConfirmation: false,
  });
});

test('catalog resolver fails closed for unknown input', () => {
  const resolver = createCatalogResolver({
    providers: [{
      id: 'niji',
      commands: [{ id: 'niji.palette.preview' }],
    }],
  });

  assert.equal(resolver.resolve('niji.palette.missing'), null);
});

test('real catalog resolver can be injected into CommandInterface', () => {
  const posted = [];
  const catalog = {
    schema_version: 'cockpit-provider-command-catalog-v1.1',
    providers: [{
      id: 'niji',
      commands: [{
        id: 'niji.palette.preview',
        mutation: false,
        requires_confirmation: false,
      }],
    }],
  };

  const commandInterface = createCommandInterface({
    host: { postMessage: (message) => posted.push(message) },
    resolve: createCatalogResolver(catalog).resolve,
  });

  const result = commandInterface.submit('  niji.palette.preview  ');

  assert.equal(result.ok, true);
  assert.equal(result.request.providerId, 'niji');
  assert.equal(result.request.commandId, 'niji.palette.preview');
  assert.deepEqual(result.request.parameters, {});
  assert.equal(result.message.type, 'eco.cockpit.invokeProviderCommand');
  assert.deepEqual(posted, [result.message]);
});

test('catalog resolver does not turn discovery metadata into arbitrary execution input', () => {
  const resolver = createCatalogResolver({
    providers: [{
      id: 'demo',
      commands: [{
        id: 'demo.install',
        action: 'install',
        input: { mode: 'object', fields: [{ id: 'package', required: true }] },
        mutation: true,
        requires_confirmation: true,
      }],
    }],
  });

  const resolved = resolver.resolve('demo.install');

  assert.deepEqual(resolved.parameters, {});
  assert.equal(resolved.requiresConfirmation, true);
  assert.equal(resolved.action, undefined);
  assert.equal(resolved.input, undefined);
});