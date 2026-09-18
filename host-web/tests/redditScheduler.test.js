'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { RedditPublishingScheduler } = require('../redditScheduler');

function tempWorkspace() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cockpit-reddit-'));
}

function fakeClient() {
  return {
    configured: () => true,
    configurationError: () => null,
    submit: async () => ({ id: 'abc', permalink: '/r/test/comments/abc/post/' }),
  };
}

test('scheduler defaults paused and persists its queue', () => {
  const root = tempWorkspace();
  let now = Date.parse('2026-09-18T08:00:00Z');
  const scheduler = new RedditPublishingScheduler(root, { client: fakeClient(), now: () => now });
  assert.equal(scheduler.status().paused, true);

  const item = scheduler.addDraft({
    subreddit: 'r/test',
    title: 'Hello',
    text: 'World',
    approval_required: true,
  });
  assert.equal(item.status, 'pending-approval');

  scheduler.approve(item.id);
  assert.equal(scheduler.status().queue[0].status, 'queued');
  assert.ok(Date.parse(scheduler.status().queue[0].next_at) >= now + 120 * 60_000);
  assert.ok(Date.parse(scheduler.status().queue[0].next_at) <= now + 240 * 60_000);

  const reloaded = new RedditPublishingScheduler(root, { client: fakeClient(), now: () => now });
  assert.equal(reloaded.status().queue.length, 1);
  assert.equal(reloaded.status().queue[0].id, item.id);
});

test('scheduler requires explicit confirmation for immediate posting', async () => {
  const root = tempWorkspace();
  const scheduler = new RedditPublishingScheduler(root, { client: fakeClient(), now: () => Date.now() });
  const item = scheduler.addDraft({
    subreddit: 'test',
    title: 'Hello',
    text: 'World',
    approval_required: false,
  });
  await assert.rejects(() => scheduler.postNow(item.id, false), /literal boolean confirmation/);
  const posted = await scheduler.postNow(item.id, true);
  assert.equal(posted.status, 'posted');
  assert.equal(posted.result.id, 'abc');
});
