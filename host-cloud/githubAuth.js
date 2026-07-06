'use strict';

const crypto = require('crypto');

const AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const TOKEN_URL = 'https://github.com/login/oauth/access_token';
const USER_URL = 'https://api.github.com/user';

function randomState() {
  return crypto.randomBytes(16).toString('hex');
}

function buildAuthorizeUrl({ clientId, redirectUri, state }) {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('scope', 'read:user');
  return url.toString();
}

/**
 * fetchFn is injectable for tests (defaults to the global fetch Node 18+
 * ships) - same pattern host-web/bridgeClient.js uses for spawnFn.
 */
async function exchangeCodeForToken({ code, clientId, clientSecret, redirectUri, fetchFn = fetch }) {
  const res = await fetchFn(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }),
  });
  const body = await res.json();
  if (!body.access_token) {
    throw new Error(`GitHub OAuth token exchange failed: ${body.error_description || body.error || 'no access_token in response'}`);
  }
  return body.access_token;
}

async function fetchGithubUser({ accessToken, fetchFn = fetch }) {
  const res = await fetchFn(USER_URL, {
    headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': 'cockpit-host-cloud' },
  });
  const body = await res.json();
  if (!body.id) {
    throw new Error('GitHub user lookup failed: no id in response');
  }
  return { githubId: body.id, login: body.login };
}

module.exports = { buildAuthorizeUrl, exchangeCodeForToken, fetchGithubUser, randomState };
