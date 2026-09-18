'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { RedditClient } = require('./redditClient');

function clampMinutes(value, fallback, minimum) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.round(number)) : fallback;
}

class RedditPublishingScheduler {
  constructor(workspaceRoot, { env = process.env, client = null, now = () => Date.now() } = {}) {
    this.workspaceRoot = workspaceRoot;
    this.env = env;
    this.client = client || new RedditClient(env);
    this.now = now;
    this.file = path.join(workspaceRoot, '.cockpit', 'reddit-publishing.json');
    this.timer = null;
    this.data = this.load();
  }

  load() {
    try {
      const value = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      return {
        paused: value.paused !== false,
        min_minutes: clampMinutes(value.min_minutes, 120, 1),
        max_minutes: clampMinutes(value.max_minutes, 240, 1),
        queue: Array.isArray(value.queue) ? value.queue : [],
      };
    } catch {
      return { paused: true, min_minutes: 120, max_minutes: 240, queue: [] };
    }
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2) + '\n', 'utf8');
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick().catch(() => {}), 30_000);
    this.timer.unref?.();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  status() {
    return {
      configured: this.client.configured(),
      configuration_error: this.client.configurationError(),
      paused: this.data.paused,
      min_minutes: this.data.min_minutes,
      max_minutes: this.data.max_minutes,
      queue: this.data.queue,
    };
  }

  setSettings({ min_minutes, max_minutes, paused }) {
    const min = clampMinutes(min_minutes, this.data.min_minutes, 1);
    const max = clampMinutes(max_minutes, this.data.max_minutes, min);
    this.data.min_minutes = Math.min(min, max);
    this.data.max_minutes = Math.max(min, max);
    if (typeof paused === 'boolean') this.data.paused = paused;
    this.save();
    return this.status();
  }

  addDraft({ subreddit, title, text = '', url = '', kind = 'self', approval_required = true }) {
    if (!subreddit || !title) throw new Error('subreddit and title are required');
    if (kind === 'self' && !text.trim()) throw new Error('text is required for a text post');
    if (kind === 'link' && !url.trim()) throw new Error('url is required for a link post');

    const item = {
      id: crypto.randomUUID(),
      created_at: new Date(this.now()).toISOString(),
      subreddit: subreddit.replace(/^r\\//, ''),
      title,
      text,
      url,
      kind,
      approval_required: Boolean(approval_required),
      status: approval_required ? 'pending-approval' : 'queued',
      next_at: approval_required ? null : this.nextTime(),
      posted_at: null,
      result: null,
      error: null,
    };
    this.data.queue.push(item);
    this.save();
    return item;
  }

  approve(id) {
    const item = this.find(id);
    if (item.status !== 'pending-approval') throw new Error('Post is not awaiting approval');
    item.status = 'queued';
    item.next_at = this.nextTime();
    item.error = null;
    this.save();
    return item;
  }

  async postNow(id, confirm) {
    if (confirm !== true) throw new Error('Posting requires literal boolean confirmation.');
    const item = this.find(id);
    if (!['queued', 'pending-approval', 'failed'].includes(item.status)) {
      throw new Error(`Post is not postable from state ${item.status}`);
    }
    return this.execute(item);
  }

  pause() {
    this.data.paused = true;
    this.save();
    return this.status();
  }

  resume() {
    this.data.paused = false;
    this.save();
    return this.status();
  }

  async tick() {
    if (this.data.paused || !this.client.configured()) return;
    const now = this.now();
    const item = this.data.queue.find((candidate) =>
      candidate.status === 'queued' &&
      candidate.next_at &&
      Date.parse(candidate.next_at) <= now
    );
    if (item) await this.execute(item);
  }

  async execute(item) {
    item.status = 'posting';
    item.error = null;
    this.save();
    try {
      const result = await this.client.submit(item);
      item.status = 'posted';
      item.posted_at = new Date(this.now()).toISOString();
      item.result = result;
      item.next_at = null;
      this.save();
      return item;
    } catch (error) {
      item.status = 'failed';
      item.error = error instanceof Error ? error.message : String(error);
      this.save();
      throw error;
    }
  }

  nextTime() {
    const min = this.data.min_minutes;
    const max = Math.max(min, this.data.max_minutes);
    const delay = min + Math.floor(Math.random() * (max - min + 1));
    return new Date(this.now() + delay * 60_000).toISOString();
  }

  find(id) {
    const item = this.data.queue.find((candidate) => candidate.id === id);
    if (!item) throw new Error(`Reddit queue item not found: ${id}`);
    return item;
  }
}

module.exports = { RedditPublishingScheduler };
