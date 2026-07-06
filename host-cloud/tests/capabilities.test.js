'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { requiredCapability, requireCapability } = require('../capabilities');

test('requiredCapability classifies known read-only action types as read', () => {
  assert.equal(requiredCapability('eco.cockpit.ready'), 'read');
  assert.equal(requiredCapability('eco.cockpit.refresh'), 'read');
  assert.equal(requiredCapability('eco.cockpit.marlinSearchPackages'), 'read');
  assert.equal(requiredCapability('eco.cockpit.workspaceStatus'), 'read');
  assert.equal(requiredCapability('eco.cockpit.copyRunJson'), 'read');
});

test('requiredCapability classifies known mutating action types as write', () => {
  for (const type of [
    'eco.cockpit.submitRun', 'eco.cockpit.approveEscalation', 'eco.cockpit.savePolicy',
    'eco.cockpit.deleteArtifact', 'eco.cockpit.undoDeleteArtifact', 'eco.cockpit.setHelmMode',
    'eco.cockpit.openArtifact', 'eco.cockpit.openPolicy', 'eco.cockpit.workspaceReveal',
    'eco.cockpit.marlinInstallPackage', 'eco.cockpit.rerunRecord',
  ]) {
    assert.equal(requiredCapability(type), 'write');
  }
});

test('requiredCapability fails closed (write) for an unrecognized type', () => {
  assert.equal(requiredCapability('eco.cockpit.someBrandNewActionNobodyClassifiedYet'), 'write');
});

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}

test('requireCapability calls next() when the token has the required capability', () => {
  const req = { body: { type: 'eco.cockpit.ready' }, session: { capabilities: ['read'] } };
  const res = mockRes();
  let called = false;
  requireCapability(req, res, () => { called = true; });
  assert.equal(called, true);
});

test('requireCapability rejects with 403 when the token lacks the required capability', () => {
  const req = { body: { type: 'eco.cockpit.submitRun' }, session: { capabilities: ['read'] } };
  const res = mockRes();
  let called = false;
  requireCapability(req, res, () => { called = true; });
  assert.equal(called, false);
  assert.equal(res.statusCode, 403);
});
