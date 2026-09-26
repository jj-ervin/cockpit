'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const createParameterInteraction = require('../parameterInteraction.js');
const createCatalogResolver = require('../catalogResolver.js');

test('parameter interaction exposes only catalog-declared fields', () => {
  const interaction = createParameterInteraction({
    type: 'object',
    fields: [
      { id: 'package', label: 'Package', type: 'string', required: true },
      { id: 'channel', label: 'Channel', type: 'string', options: ['stable', 'beta'] },
    ],
  });
  assert.deepEqual(interaction.fields(), [
    { id: 'package', label: 'Package', type: 'string', required: true, options: undefined, default: undefined },
    { id: 'channel', label: 'Channel', type: 'string', required: false, options: ['stable', 'beta'], default: undefined },
  ]);
});

test('parameter interaction rejects missing, invalid, and undeclared values', () => {
  const interaction = createParameterInteraction({
    type: 'object',
    fields: [
      { id: 'package', type: 'string', required: true },
      { id: 'count', type: 'number' },
      { id: 'channel', type: 'string', options: ['stable', 'beta'] },
    ],
  });
  assert.deepEqual(interaction.validate({ count: '2', channel: 'nightly', extra: 'not-declared' }), {
    ok: false,
    errors: [
      { field: 'package', error: 'required' },
      { field: 'count', error: 'invalid-type' },
      { field: 'channel', error: 'invalid-option' },
      { field: 'extra', error: 'undeclared-parameter' },
    ],
  });
});

test('valid parameters remain inert data', () => {
  const result = createParameterInteraction({
    type: 'object',
    fields: [{ id: 'package', type: 'string', required: true }],
  }).validate({ package: 'demo' });
  assert.equal(result.ok, true);
  assert.deepEqual(result.parameters, { package: 'demo' });
  assert.equal(result.action, undefined);
  assert.equal(result.providerId, undefined);
  assert.equal(result.commandId, undefined);
});

test('catalog-declared input metadata feeds parameter interaction without granting execution', () => {
  const resolved = createCatalogResolver({
    schema_version: 'cockpit-provider-command-catalog-v1.1',
    providers: [{ id: 'demo', commands: [{
      id: 'demo.install', title: 'Install', action: 'install', mutation: true, requires_confirmation: true,
      input: { type: 'object', fields: [{ id: 'package', type: 'string', required: true }] },
    }]}],
  }).resolve('demo.install');

  assert.deepEqual(resolved.parameters, {});
  assert.deepEqual(resolved.parameterSchema, { type: 'object', fields: [{ id: 'package', type: 'string', required: true }] });
  assert.deepEqual(createParameterInteraction(resolved.parameterSchema).validate({ package: 'demo' }), {
    ok: true, parameters: { package: 'demo' },
  });
  assert.equal(resolved.action, undefined);
});