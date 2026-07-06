'use strict';

const crypto = require('crypto');

/**
 * Minimal stateless session token: base64url(payload) + '.' + HMAC-SHA256
 * signature over that payload, hex-encoded. Deliberately not a full JWT
 * library - the claim set is fixed and tiny (tenantId + exp), so a small
 * self-contained signer is less surface than pulling in a dependency for
 * auth-critical code in this repo specifically (unlike time-loc, which is a
 * shared cross-repo format and got real packaging instead).
 *
 * The only claim that matters for CKP.12.00's core invariant is tenantId -
 * everything downstream (workspaceRoot resolution) must come from looking
 * that tenantId up in the tenant registry, never from any other field a
 * caller could set.
 */
function sign({ tenantId, ttlSeconds = 3600, now = Date.now(), secret }) {
  const payload = { tenantId, exp: now + ttlSeconds * 1000 };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(encoded).digest('hex');
  return `${encoded}.${signature}`;
}

function verify(token, { secret, now = Date.now() }) {
  if (typeof token !== 'string' || !token.includes('.')) {
    throw new Error('Malformed session token.');
  }
  const [encoded, signature] = token.split('.');
  const expected = crypto.createHmac('sha256', secret).update(encoded).digest('hex');
  const signatureBuf = Buffer.from(signature, 'hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  if (signatureBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(signatureBuf, expectedBuf)) {
    throw new Error('Invalid session token signature.');
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8'));
  } catch {
    throw new Error('Malformed session token payload.');
  }
  if (typeof payload.exp !== 'number' || now > payload.exp) {
    throw new Error('Session token expired.');
  }
  if (typeof payload.tenantId !== 'string' || !payload.tenantId) {
    throw new Error('Session token missing tenantId.');
  }
  return { tenantId: payload.tenantId };
}

module.exports = { sign, verify };
