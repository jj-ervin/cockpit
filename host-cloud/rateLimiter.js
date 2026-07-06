'use strict';

/**
 * Per-tenant token bucket. One bucket per tenantId, created lazily on first
 * use so an idle tenant costs nothing. take() both refills (based on
 * elapsed time since last refill) and attempts to spend one token, atomic
 * within a single call - no separate refill tick/timer needed.
 */
function createRateLimiter({ capacity = 20, refillPerSecond = 5, nowFn = () => Date.now() } = {}) {
  const buckets = new Map(); // tenantId -> { tokens, lastRefill }

  function take(tenantId) {
    const now = nowFn();
    let bucket = buckets.get(tenantId);
    if (!bucket) {
      bucket = { tokens: capacity, lastRefill: now };
      buckets.set(tenantId, bucket);
    }
    const elapsedSeconds = Math.max(0, (now - bucket.lastRefill) / 1000);
    bucket.tokens = Math.min(capacity, bucket.tokens + elapsedSeconds * refillPerSecond);
    bucket.lastRefill = now;

    if (bucket.tokens < 1) {
      return false;
    }
    bucket.tokens -= 1;
    return true;
  }

  function reset(tenantId) {
    buckets.delete(tenantId);
  }

  return { take, reset };
}

module.exports = { createRateLimiter };
