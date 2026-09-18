# CKP.10 — Reddit Publishing

**Status:** v0.1 implementation slice  
**Scope:** Cockpit standalone host + web UI  
**Boundary:** Reddit is a publishing provider; Cockpit remains the operator/control surface.

## Purpose

Cockpit's Publishing tab provides a governed local workflow for preparing and publishing Reddit posts without browser automation.

The first slice is:

**Draft → Human Approval → Schedule → Submit → Record**

The scheduler is owned by the standalone host process, not by the browser UI. Queue state is persisted under the active workspace:

`.cockpit/reddit-publishing.json`

## UI

The Publishing tab provides:

- subreddit, title, text/link draft fields
- configurable minimum/maximum interval
- human-approval checkbox
- persistent queue
- scheduler pause/resume
- immediate human-confirmed posting
- posted permalink/result display
- failure/error display

The default interval is **120–240 minutes (2–4 hours)**.

The scheduler starts **paused** by default. Automatic publishing requires an explicit Resume action.

## Reddit boundary

Cockpit uses Reddit's authenticated API from the local host process. It does not automate reddit.com with Selenium, browser clicks, or credential scraping.

Required environment variables:

- `REDDIT_CLIENT_ID`
- `REDDIT_CLIENT_SECRET`
- `REDDIT_REFRESH_TOKEN`
- `REDDIT_USER_AGENT`

No Reddit secret is written to the repository or queue file.

A Reddit app/account must be registered and authorized separately. The implementation intentionally fails closed when credentials are absent.

## Scheduling behavior

A queue item is either:

- `pending-approval`
- `queued`
- `posting`
- `posted`
- `failed`

Approved automatic posts receive a next-run timestamp selected inside the configured interval.

The worker checks the persistent queue every 30 seconds. The worker is part of the local Cockpit host process, so refreshing or changing the Cockpit UI does not reset the queue.

Immediate posting requires a literal `confirm: true` at the host boundary and cannot bypass an outstanding approval state.

## Non-goals

This slice does not:

- scrape or automate reddit.com
- evade subreddit moderation or Reddit enforcement
- generate spam automatically
- post without an authenticated user/app context
- implement subreddit-specific rule discovery yet
- implement analytics yet
- implement multi-network publishing yet

## Next slice

CKP.10.1 should add subreddit policy/preflight inspection before an item becomes schedulable, followed by richer campaign/analytics surfaces.
