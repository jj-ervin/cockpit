'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createRateLimiter } = require('../rateLimiter');

test('take() succeeds up to capacity, then fails', () => {
  let now = 0;
  const limiter = createRateLimiter({ capacity: 3, refillPerSecond: 0, nowFn: () => now });
  assert.equal(limiter.take('t1'), true);
  assert.equal(limiter.take('t1'), true);
  assert.equal(limiter.take('t1'), true);
  assert.equal(limiter.take('t1'), false);
});

test('tokens refill over time', () => {
  let now = 0;
  const limiter = createRateLimiter({ capacity: 2, refillPerSecond: 1, nowFn: () => now });
  assert.equal(limiter.take('t1'), true);
  assert.equal(limiter.take('t1'), true);
  assert.equal(limiter.take('t1'), false);
  now += 1000; // 1 second later, refill 1 token
  assert.equal(limiter.take('t1'), true);
  assert.equal(limiter.take('t1'), false);
});

test('buckets are independent per tenant', () => {
  let now = 0;
  const limiter = createRateLimiter({ capacity: 1, refillPerSecond: 0, nowFn: () => now });
  assert.equal(limiter.take('alice'), true);
  assert.equal(limiter.take('alice'), false);
  assert.equal(limiter.take('bob'), true);
});

test('reset() clears a tenant bucket back to full capacity on next use', () => {
  let now = 0;
  const limiter = createRateLimiter({ capacity: 1, refillPerSecond: 0, nowFn: () => now });
  limiter.take('t1');
  assert.equal(limiter.take('t1'), false);
  limiter.reset('t1');
  assert.equal(limiter.take('t1'), true);
});
