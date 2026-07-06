'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const session = require('../session');

const SECRET = 'test-secret';

test('sign/verify round trip returns the same tenantId', () => {
  const token = session.sign({ tenantId: 't1', secret: SECRET });
  const claims = session.verify(token, { secret: SECRET });
  assert.equal(claims.tenantId, 't1');
});

test('verify rejects a token signed with a different secret', () => {
  const token = session.sign({ tenantId: 't1', secret: 'other-secret' });
  assert.throws(() => session.verify(token, { secret: SECRET }));
});

test('verify rejects a tampered payload even if the signature string is untouched', () => {
  const token = session.sign({ tenantId: 't1', secret: SECRET });
  const [encoded, signature] = token.split('.');
  const forgedPayload = Buffer.from(JSON.stringify({ tenantId: 't2', exp: Date.now() + 100000 })).toString('base64url');
  assert.throws(() => session.verify(`${forgedPayload}.${signature}`, { secret: SECRET }));
});

test('verify rejects an expired token', () => {
  const now = Date.now();
  const token = session.sign({ tenantId: 't1', secret: SECRET, ttlSeconds: 1, now });
  assert.throws(() => session.verify(token, { secret: SECRET, now: now + 2000 }));
});

test('verify rejects a malformed token string', () => {
  assert.throws(() => session.verify('not-a-real-token', { secret: SECRET }));
});
