'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveRuntimeSecurity } = require('../index');

test('host-cloud refuses public HTTP without explicit TLS or insecure-dev override', () => {
  assert.throws(
    () => resolveRuntimeSecurity({ HOST: '0.0.0.0' }),
    /refuses to bind a public host without TLS/,
  );
});

test('host-cloud allows public bind when TLS termination is declared', () => {
  const config = resolveRuntimeSecurity({ HOST: '0.0.0.0', COCKPIT_CLOUD_TLS_TERMINATED: '1' });
  assert.equal(config.host, '0.0.0.0');
  assert.equal(config.secureCookies, true);
  assert.equal(config.tlsTerminated, true);
});

test('host-cloud insecure HTTP mode must be explicit and disables Secure cookies', () => {
  const config = resolveRuntimeSecurity({ HOST: '0.0.0.0', COCKPIT_CLOUD_ALLOW_INSECURE_HTTP: '1' });
  assert.equal(config.host, '0.0.0.0');
  assert.equal(config.secureCookies, false);
  assert.equal(config.allowInsecureHttp, true);
});

test('host-cloud loopback bind is allowed without TLS declaration', () => {
  const config = resolveRuntimeSecurity({ HOST: '127.0.0.1' });
  assert.equal(config.host, '127.0.0.1');
  assert.equal(config.secureCookies, false);
});
