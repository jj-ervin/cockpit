'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildAuthorizeUrl, exchangeCodeForToken, fetchGithubUser } = require('../githubAuth');

test('buildAuthorizeUrl includes client id, redirect uri, and state', () => {
  const url = buildAuthorizeUrl({ clientId: 'cid', redirectUri: 'https://example.test/cb', state: 'abc' });
  const parsed = new URL(url);
  assert.equal(parsed.searchParams.get('client_id'), 'cid');
  assert.equal(parsed.searchParams.get('redirect_uri'), 'https://example.test/cb');
  assert.equal(parsed.searchParams.get('state'), 'abc');
});

test('exchangeCodeForToken returns the access_token from a successful response', async () => {
  const fetchFn = async () => ({ json: async () => ({ access_token: 'tok123' }) });
  const token = await exchangeCodeForToken({
    code: 'c1', clientId: 'cid', clientSecret: 'secret', redirectUri: 'https://example.test/cb', fetchFn,
  });
  assert.equal(token, 'tok123');
});

test('exchangeCodeForToken throws a clear error when GitHub returns no access_token', async () => {
  const fetchFn = async () => ({ json: async () => ({ error: 'bad_verification_code', error_description: 'expired' }) });
  await assert.rejects(
    () => exchangeCodeForToken({ code: 'c1', clientId: 'cid', clientSecret: 'secret', redirectUri: 'r', fetchFn }),
    /expired/,
  );
});

test('fetchGithubUser returns githubId and login', async () => {
  const fetchFn = async () => ({ json: async () => ({ id: 42, login: 'alice' }) });
  const user = await fetchGithubUser({ accessToken: 'tok123', fetchFn });
  assert.deepEqual(user, { githubId: 42, login: 'alice' });
});

test('fetchGithubUser throws when the response has no id', async () => {
  const fetchFn = async () => ({ json: async () => ({ message: 'Bad credentials' }) });
  await assert.rejects(() => fetchGithubUser({ accessToken: 'bad', fetchFn }));
});
