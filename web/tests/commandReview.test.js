'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const createCommandInterface = require('../commandInterface.js');
const createCatalogResolver = require('../catalogResolver.js');
const createParameterInteraction = require('../parameterInteraction.js');
const createCommandReview = require('../commandReview.js');

test('real catalog command reaches review without execution', () => {
  const posted = [];
  const catalog = { schema_version: 'cockpit-provider-command-catalog-v1.1', providers: [{ id: 'demo', commands: [{ id: 'demo.install', title: 'Install', action: 'install', mutation: true, requires_confirmation: true, input: { type: 'object', fields: [{ id: 'package', type: 'string', required: true }] } }]}] };
  const ci = createCommandInterface({ host: { postMessage: m => posted.push(m) }, resolve: createCatalogResolver(catalog).resolve });
  const request = ci.interpret('demo.install');
  const params = createParameterInteraction(request.parameterSchema).validate({ package: 'demo' });
  assert.equal(params.ok, true);
  const api = createCommandReview();
  const reviewed = api.review(request, params.parameters);
  assert.equal(reviewed.ok, true);
  assert.equal(reviewed.approved, false);
  assert.deepEqual(reviewed.parameters, { package: 'demo' });
  const approved = api.approve(reviewed);
  assert.equal(approved.approved, true);
  assert.equal(posted.length, 0);
});

test('invalid parameters stop before review and invocation', () => {
  const posted = [];
  const ci = createCommandInterface({ host: { postMessage: m => posted.push(m) }, resolve: createCatalogResolver({ providers: [{ id: 'demo', commands: [{ id: 'demo.install', title: 'Install', action: 'install', mutation: true, requires_confirmation: true, input: { type: 'object', fields: [{ id: 'package', type: 'string', required: true }] } }]}] }).resolve });
  const request = ci.interpret('demo.install');
  const invalid = createParameterInteraction(request.parameterSchema).validate({ extra: 'x' });
  assert.equal(invalid.ok, false);
  assert.equal(posted.length, 0);
});

test('review does not grant execution authority', () => {
  const reviewed = createCommandReview().review({ ok: true, providerId: 'demo', commandId: 'demo.install', requiresConfirmation: true }, { package: 'demo' });
  assert.equal(reviewed.approved, false);
  assert.equal(reviewed.execute, undefined);
  assert.equal(reviewed.confirm, undefined);
});