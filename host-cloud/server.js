'use strict';

const express = require('express');

const { buildAuthorizeUrl, exchangeCodeForToken, fetchGithubUser, randomState } = require('./githubAuth');
const session = require('./session');

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

function serializeCookie(name, value, { maxAgeSeconds }) {
  return `${name}=${encodeURIComponent(value)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`;
}

/**
 * createApp wires the whole skeleton: GitHub OAuth login/callback, a
 * session-verification middleware, and one proof-of-invariant endpoint
 * (/api/whoami). It does not proxy to a per-tenant host-web container yet -
 * CKP.12.00 scoped container orchestration out of this PASS. What matters
 * here is proving the core design invariant end-to-end: workspaceRoot is
 * resolved only from the authenticated tenant record, and nothing in the
 * request body can override it.
 *
 * deps is injectable for tests (fetchFn for GitHub calls, a fixed `now`/
 * `state` for deterministic auth-flow tests), matching the makeDeps()
 * pattern already used in host-web/tests/actions.test.js.
 */
function createApp({ tenantRegistry, sessionSecret, github, deps = {} } = {}) {
  const app = express();
  app.use(express.json());

  const fetchFn = deps.fetchFn;
  const nowFn = deps.nowFn || (() => Date.now());
  const stateFn = deps.stateFn || randomState;

  app.get('/auth/github/login', (req, res) => {
    const state = stateFn();
    res.setHeader('Set-Cookie', serializeCookie('oauth_state', state, { maxAgeSeconds: 600 }));
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
      res.setHeader('Set-Cookie', serializeCookie(SESSION_COOKIE, token, { maxAgeSeconds: 3600 }));
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
    next();
  }

  app.post('/api/whoami', requireSession, (req, res) => {
    // Deliberately ignores any workspaceRoot/workspace field the client
    // sent in the body - req.tenant.workspaceRoot (set only in
    // requireSession above) is the sole source of truth.
    res.json({ tenantId: req.tenant.id, workspaceRoot: req.tenant.workspaceRoot });
  });

  return app;
}

module.exports = { createApp, SESSION_COOKIE, parseCookies };
