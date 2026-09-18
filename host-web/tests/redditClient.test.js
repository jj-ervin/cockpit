'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { RedditClient } = require('../redditClient');

test('RedditClient reports missing configuration without making network calls', async () => {
  let calls = 0;
  const client = new RedditClient({}, async () => { calls += 1; });
  assert.equal(client.configured(), false);
  await assert.rejects(() => client.token(), /REDDIT_CLIENT_ID/);
  assert.equal(calls, 0);
});

test('RedditClient refreshes OAuth token and submits a text post', async () => {
  const requests = [];
  const client = new RedditClient({
    REDDIT_CLIENT_ID: 'id',
    REDDIT_CLIENT_SECRET: 'secret',
    REDDIT_REFRESH_TOKEN: 'refresh',
    REDDIT_USER_AGENT: 'CockpitTest/0.1',
  }, async (url, options) => {
    requests.push({ url, options });
    if (url.includes('access_token')) {
      return { ok: true, json: async () => ({ access_token: 'token', expires_in: 3600 }) };
    }
    return { ok: true, json: async () => ({ json: { errors: [], data: { id: 'abc', name: 't3_abc', permalink: '/r/test/comments/abc/x/' } } }) };
  });

  const result = await client.submit({ subreddit: 'test', title: 'Hello', text: 'World', kind: 'self' });
  assert.equal(result.id, 'abc');
  assert.equal(requests.length, 2);
  assert.match(requests[1].options.headers.Authorization, /^Bearer token$/);
  assert.match(String(requests[1].options.body), /sr=test/);
});
