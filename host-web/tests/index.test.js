'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveHost, parseWorkspaceArg } = require('../index');

test('resolveHost defaults to loopback when COCKPIT_HOST is unset', () => {
  assert.equal(resolveHost({}), '127.0.0.1');
});

test('resolveHost honors COCKPIT_HOST override', () => {
  assert.equal(resolveHost({ COCKPIT_HOST: '0.0.0.0' }), '0.0.0.0');
});

test('parseWorkspaceArg reads --workspace flag', () => {
  assert.equal(parseWorkspaceArg(['node', 'index.js', '--workspace', 'C:\\ws']), 'C:\\ws');
});

test('parseWorkspaceArg returns null when flag absent', () => {
  assert.equal(parseWorkspaceArg(['node', 'index.js']), null);
});
