'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');

const { dispatch } = require('./actions');
const { RedditPublishingScheduler } = require('./redditScheduler');

const WEB_DIR = path.join(__dirname, '..', 'web');

/**
 * Builds the bootstrap script that becomes window.cockpitHost - the *only*
 * host-specific script, matching CKP.08-host-loader-contract.md's own
 * description of what a plain-browser host needs. Every eco.cockpit.*
 * message the bundle posts is relayed to /api/bridge as a plain HTTP POST;
 * the response is an array of messages (usually one, sometimes two - see
 * actions.js's deleteArtifact case) which get replayed into the page via
 * window.postMessage, exactly like the bundle already expects from any host.
 */
function bootstrapScript(nonce) {
  return `<script nonce="${nonce}">
window.cockpitHost = {
  postMessage: function (msg) {
    fetch('/api/bridge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(msg),
    })
      .then(function (r) { return r.json(); })
      .then(function (messages) {
        (messages || []).forEach(function (m) { window.postMessage(m, '*'); });
      })
      .catch(function (err) {
        window.postMessage({ type: 'eco.cockpit.error', payload: { message: String(err) } }, '*');
      });
  },
};
</script>`;
}

function renderHtml() {
  const nonce = crypto.randomBytes(16).toString('hex');
  let html = fs.readFileSync(path.join(WEB_DIR, 'cockpit.html'), 'utf-8');
  html = html.replaceAll('${cspSource}', "'self'");
  html = html.replaceAll('${nonce}', nonce);
  // The bundle's static CSP template has no connect-src directive, so it
  // falls back to default-src 'none' - which blocks this host's bootstrap
  // script from fetch()-ing /api/bridge entirely (verified against a real
  // headless Chromium: "Refused to connect because it violates the
  // document's Content Security Policy"). VS Code's webview transport
  // doesn't need connect-src (postMessage isn't a fetch), so this gap never
  // showed up there. Per CKP.08-host-loader-contract.md, a plain-browser
  // host may substitute a more permissive CSP - this one just adds
  // connect-src 'self' to allow same-origin fetch, keeping everything else
  // the bundle's own template already specifies.
  html = html.replace(
    /content="default-src 'none'[^"]*"/,
    `content="default-src 'none'; connect-src 'self'; img-src 'self' https:; ` +
    `style-src 'self' 'unsafe-inline'; script-src 'nonce-${nonce}' 'self';"`,
  );
  html = html.replace('<!-- cockpit-host-bootstrap -->', bootstrapScript(nonce));
  return html;
}

/**
 * Renders the constrained install-mode page (web/install.html). Shares
 * renderHtml()'s nonce/CSP handling, plus one extra substitution: the
 * target package name is baked in directly (window.__installIntent) rather
 * than delivered through a snapshot round trip, since install-mode has no
 * use for the full eco.cockpit.state payload the shell needs.
 */
function renderInstallHtml(installIntent) {
  const nonce = crypto.randomBytes(16).toString('hex');
  let html = fs.readFileSync(path.join(WEB_DIR, 'install.html'), 'utf-8');
  html = html.replaceAll('${cspSource}', "'self'");
  html = html.replaceAll('${nonce}', nonce);
  html = html.replace(
    /content="default-src 'none'[^"]*"/,
    `content="default-src 'none'; connect-src 'self'; img-src 'self' https:; ` +
    `style-src 'self' 'unsafe-inline'; script-src 'nonce-${nonce}' 'self';"`,
  );
  const intentScript = `<script nonce="${nonce}">window.__installIntent = ${JSON.stringify(installIntent || '')};</script>`;
  html = html.replace('<!-- cockpit-install-intent -->', intentScript);
  html = html.replace('<!-- cockpit-host-bootstrap -->', bootstrapScript(nonce));
  return html;
}

function createApp({ workspaceRoot, pythonExecutable, bridgeExecutable, installIntent, deps } = {}) {
  const app = express();
  app.use(express.json());

  const redditScheduler = new RedditPublishingScheduler(workspaceRoot || process.cwd());
  redditScheduler.start();

  app.get('/', (req, res) => {
    res.set('Content-Type', 'text/html').send(renderHtml());
  });

  app.get('/install', (req, res) => {
    res.set('Content-Type', 'text/html').send(renderInstallHtml(installIntent));
  });

  app.use(express.static(WEB_DIR, { index: false }));

  app.post('/api/bridge', async (req, res) => {
    try {
      const messages = await dispatch(req.body.type, req.body, { workspaceRoot, pythonExecutable, bridgeExecutable, installIntent, deps: { ...(deps || {}), redditScheduler } });
      res.json(messages);
    } catch (err) {
      res.json([{ type: 'eco.cockpit.error', payload: { message: err instanceof Error ? err.message : String(err) } }]);
    }
  });

  app.on?.('close', () => redditScheduler.stop());
  return app;
}

module.exports = { createApp, renderHtml, renderInstallHtml };
