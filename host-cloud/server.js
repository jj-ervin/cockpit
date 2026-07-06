'use strict';

const express = require('express');

const { buildAuthorizeUrl, exchangeCodeForToken, fetchGithubUser, randomState } = require('./githubAuth');
const session = require('./session');
const { requireCapability, requiredCapability } = require('./capabilities');
const { withinQuota } = require('./quota');
const proxy = require('./proxy');

const SESSION_COOKIE = 'cockpit_session';

function parseCookies(header) {
  const out = {};
  if (!header) {
    return out;
  }
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) {
      return;
    }
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  });
  return out;
}

function serializeCookie(name, value, { maxAgeSeconds, secure = true }) {
  const secureFlag = secure ? '; Secure' : '';
  return `${name}=${encodeURIComponent(value)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}${secureFlag}`;
}

/**
 * createApp wires the full CKP.14.00 control plane: GitHub OAuth
 * login/callback, session verification, rate limiting, capability
 * enforcement, quota checks, per-tenant process lifecycle (processManager -
 * CKP.12.00's container model stood in for on this machine, see
 * processManager.js's own doc comment), and proxying an authenticated
 * request through to that tenant's real host-web instance.
 *
 * deps is injectable for tests (fetchFn for GitHub calls, a fixed `now`/
 * `state` for deterministic auth-flow tests, processManager/rateLimiter/
 * proxy fakes), matching the makeDeps() pattern already used in
 * host-web/tests/actions.test.js.
 */
function createApp({
  tenantRegistry, sessionSecret, github, processManager, rateLimiter,
  tenantDiskQuotaBytes = 0, secureCookies = true, deps = {},
} = {}) {
  const app = express();
  app.use(express.json());

  const fetchFn = deps.fetchFn;
  const nowFn = deps.nowFn || (() => Date.now());
  const stateFn = deps.stateFn || randomState;
  const proxyForward = deps.proxyForward || proxy.forward;

  app.get('/auth/github/login', (req, res) => {
    const state = stateFn();
    res.setHeader('Set-Cookie', serializeCookie('oauth_state', state, { maxAgeSeconds: 600, secure: secureCookies }));
    res.redirect(buildAuthorizeUrl({ clientId: github.clientId, redirectUri: github.redirectUri, state }));
  });

  app.get('/auth/github/callback', async (req, res) => {
    const cookies = parseCookies(req.headers.cookie);
    const { code, state } = req.query;
    if (!state || state !== cookies.oauth_state) {
      res.status(400).json({ error: 'Invalid or missing OAuth state.' });
      return;
    }
    try {
      const accessToken = await exchangeCodeForToken({
        code,
        clientId: github.clientId,
        clientSecret: github.clientSecret,
        redirectUri: github.redirectUri,
        fetchFn,
      });
      const { githubId, login } = await fetchGithubUser({ accessToken, fetchFn });
      const tenant = tenantRegistry.upsertByGithubId({ githubId, login });
      const token = session.sign({ tenantId: tenant.id, secret: sessionSecret, now: nowFn() });
      res.setHeader('Set-Cookie', serializeCookie(SESSION_COOKIE, token, { maxAgeSeconds: 3600, secure: secureCookies }));
      res.redirect('/');
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  function requireSession(req, res, next) {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[SESSION_COOKIE];
    if (!token) {
      res.status(401).json({ error: 'No session.' });
      return;
    }
    let claims;
    try {
      claims = session.verify(token, { secret: sessionSecret, now: nowFn() });
    } catch (err) {
      res.status(401).json({ error: err instanceof Error ? err.message : String(err) });
      return;
    }
    const tenant = tenantRegistry.getById(claims.tenantId);
    if (!tenant) {
      res.status(401).json({ error: 'Unknown tenant.' });
      return;
    }
    // The only place workspaceRoot is ever set on the request - from the
    // server-owned tenant record, never from req.body/req.query/req.headers.
    req.tenant = { id: tenant.id, workspaceRoot: tenant.workspacePath };
    // Separate from req.tenant: the token's own claims (capabilities), read
    // by requireCapability in capabilities.js independent of tenancy.
    req.session = { tenantId: claims.tenantId, capabilities: claims.capabilities };
    next();
  }

  function requireRateLimit(req, res, next) {
    if (!rateLimiter || rateLimiter.take(req.tenant.id)) {
      next();
      return;
    }
    res.status(429).json({ error: 'Rate limit exceeded for this tenant.' });
  }

  app.post('/api/whoami', requireSession, (req, res) => {
    // Deliberately ignores any workspaceRoot/workspace field the client
    // sent in the body - req.tenant.workspaceRoot (set only in
    // requireSession above) is the sole source of truth.
    res.json({ tenantId: req.tenant.id, workspaceRoot: req.tenant.workspaceRoot });
  });

  app.post('/api/bridge', requireSession, requireRateLimit, requireCapability, async (req, res) => {
    if (!req.body || typeof req.body.type !== 'string') {
      res.status(400).json({ error: 'Missing message type.' });
      return;
    }
    // Mutating actions are gated on quota; read-only ones are exempt, since
    // an over-quota tenant should still be able to see their own state.
    const isWrite = requiredCapability(req.body.type) === 'write';
    if (isWrite && tenantDiskQuotaBytes > 0 && !withinQuota(req.tenant.workspaceRoot, tenantDiskQuotaBytes)) {
      res.status(507).json({ error: 'Tenant workspace over its disk quota; mutating actions are paused.' });
      return;
    }

    try {
      const { port } = await processManager.ensureRunning(req.tenant);
      processManager.touch && processManager.touch(req.tenant.id);
      // The client-supplied body is relayed as the message payload, but
      // workspaceRoot/tenant selection was already fixed above by
      // requireSession - the proxied host-web instance is itself scoped to
      // exactly one tenant's workspace at process-spawn time, so there is
      // no second place for a client value to redirect it.
      const { type, ...message } = req.body;
      const messages = await proxyForward({ port, type, message }, { fetchFn });
      res.json(messages);
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  return app;
}

module.exports = { createApp, SESSION_COOKIE, parseCookies, serializeCookie };
