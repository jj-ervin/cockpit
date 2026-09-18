'use strict';

/**
 * Minimal Reddit Data API client for Cockpit's local publishing worker.
 *
 * Credentials are environment-provided; no Reddit secret is persisted by
 * Cockpit. A user-authorized OAuth refresh token is required for posting.
 */
class RedditClient {
  constructor(env = process.env, fetchImpl = globalThis.fetch) {
    this.env = env;
    this.fetch = fetchImpl;
    this.accessToken = null;
    this.accessTokenExpiresAt = 0;
  }

  configured() {
    return Boolean(
      this.env.REDDIT_CLIENT_ID &&
      this.env.REDDIT_CLIENT_SECRET &&
      this.env.REDDIT_REFRESH_TOKEN &&
      this.env.REDDIT_USER_AGENT,
    );
  }

  configurationError() {
    const missing = [
      ['REDDIT_CLIENT_ID', this.env.REDDIT_CLIENT_ID],
      ['REDDIT_CLIENT_SECRET', this.env.REDDIT_CLIENT_SECRET],
      ['REDDIT_REFRESH_TOKEN', this.env.REDDIT_REFRESH_TOKEN],
      ['REDDIT_USER_AGENT', this.env.REDDIT_USER_AGENT],
    ].filter(([, value]) => !value).map(([name]) => name);
    return missing.length
      ? `Reddit publishing is not configured. Missing: ${missing.join(', ')}`
      : null;
  }

  async token() {
    if (!this.configured()) throw new Error(this.configurationError());
    if (this.accessToken && Date.now() < this.accessTokenExpiresAt - 60_000) {
      return this.accessToken;
    }

    const credentials = Buffer
      .from(`${this.env.REDDIT_CLIENT_ID}:${this.env.REDDIT_CLIENT_SECRET}`)
      .toString('base64');

    const response = await this.fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': this.env.REDDIT_USER_AGENT,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.env.REDDIT_REFRESH_TOKEN,
      }),
    });
    const body = await response.json();
    if (!response.ok || body.error) {
      throw new Error(`Reddit OAuth failed: ${body.error_description || body.error || response.status}`);
    }

    this.accessToken = body.access_token;
    this.accessTokenExpiresAt = Date.now() + (Number(body.expires_in || 3600) * 1000);
    return this.accessToken;
  }

  async submit({ subreddit, title, text, url, kind = 'self' }) {
    const token = await this.token();
    const payload = {
      sr: subreddit,
      title,
      kind,
      api_type: 'json',
      resubmit: 'true',
    };
    if (kind === 'link') payload.url = url;
    else payload.text = text;

    const response = await this.fetch('https://oauth.reddit.com/api/submit', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': this.env.REDDIT_USER_AGENT,
      },
      body: new URLSearchParams(payload),
    });
    const body = await response.json();
    const errors = body?.json?.errors || [];
    if (!response.ok || errors.length) {
      const detail = errors.map((entry) => entry.join(': ')).join('; ');
      throw new Error(`Reddit submission failed: ${detail || response.status}`);
    }

    const data = body?.json?.data || {};
    return {
      id: data.id || null,
      name: data.name || null,
      url: data.url || null,
      permalink: data.permalink || null,
    };
  }
}

module.exports = { RedditClient };
