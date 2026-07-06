'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { forward } = require('../proxy');

test('forward posts to the tenant port\'s /api/bridge and returns the parsed messages array', async () => {
  let capturedUrl;
  let capturedBody;
  const fetchFn = async (url, opts) => {
    capturedUrl = url;
    capturedBody = JSON.parse(opts.body);
    return { ok: true, json: async () => [{ type: 'eco.cockpit.state', payload: {} }] };
  };
  const messages = await forward({ port: 4321, type: 'eco.cockpit.ready', message: {} }, { fetchFn });
  assert.equal(capturedUrl, 'http://127.0.0.1:4321/api/bridge');
  assert.equal(capturedBody.type, 'eco.cockpit.ready');
  assert.deepEqual(messages, [{ type: 'eco.cockpit.state', payload: {} }]);
});

test('forward throws a clear error on a non-OK HTTP response', async () => {
  const fetchFn = async () => ({ ok: false, status: 502, json: async () => ({}) });
  await assert.rejects(
    forward({ port: 4321, type: 'eco.cockpit.ready', message: {} }, { fetchFn }),
    /HTTP 502/,
  );
});
