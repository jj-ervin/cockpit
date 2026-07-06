'use strict';

/**
 * Forwards one eco.cockpit.* message to a tenant's running host-web
 * instance's POST /api/bridge, and returns the same messages array
 * host-web itself returns - host-cloud doesn't reinterpret the response,
 * it relays it, so the bundle's contract stays satisfied end-to-end
 * exactly as CKP.08-host-loader-contract.md requires. fetchFn is
 * injectable for tests.
 */
async function forward({ port, type, message }, { fetchFn = fetch } = {}) {
  const res = await fetchFn(`http://127.0.0.1:${port}/api/bridge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, ...message }),
  });
  if (!res.ok) {
    throw new Error(`host-web instance responded with HTTP ${res.status}`);
  }
  return res.json();
}

module.exports = { forward };
