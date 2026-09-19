'use strict';

/**
 * Browser-level proof of the constrained install-mode surface (web/install.js
 * loaded into the real web/install.html). Mirrors webInstallApproval.test.js's
 * jsdom technique: real DOM, real events, fixture host responses -- this
 * file's job is proving the install-mode UI wiring and its boundary (auto-
 * resolve with no click, Install -> confirm:true only after resolve, no
 * full-shell markup anywhere in this page), not re-proving the provider/
 * bridge plumbing already covered elsewhere.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const WEB_DIR = path.join(__dirname, '..', '..', 'web');
const HTML_SOURCE = fs.readFileSync(path.join(WEB_DIR, 'install.html'), 'utf-8');
const STATE_SOURCE = fs.readFileSync(path.join(WEB_DIR, 'cockpitState.js'), 'utf-8');
const SCRIPT_SOURCE = fs.readFileSync(path.join(WEB_DIR, 'install.js'), 'utf-8');

async function tick() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Builds a fresh jsdom window running the real install.js bundle. Sets
 * window.__installIntent and window.cockpitHost before evaluating the
 * script, matching how host-web/server.js's renderInstallHtml() and
 * bootstrapScript() order things in the real served page (both injected
 * before the <script src="install.js"> tag). Also fakes window.installControls
 * (normally installPreload.cjs's contextBridge surface) so tests can assert
 * on window-chrome calls (close, open Cockpit) without a real Electron window.
 */
function mountInstall({ installIntent = 'sealdex', responses = {} } = {}) {
  const dom = new JSDOM(HTML_SOURCE, { runScripts: 'dangerously', url: 'http://localhost/install' });
  const { window } = dom;
  const posted = [];
  const controlCalls = { close: 0, openCockpit: 0 };

  window.__installIntent = installIntent;

  window.cockpitHost = {
    postMessage: function (message) {
      posted.push(message);
      const handler = responses[message.type];
      if (!handler) return;
      const reply = typeof handler === 'function' ? handler(message) : handler;
      if (!reply) return;
      const replies = Array.isArray(reply) ? reply : [reply];
      setTimeout(() => {
        replies.forEach((m) => window.postMessage(m, '*'));
      }, 0);
    },
  };

  window.installControls = {
    closeWindow: function () { controlCalls.close += 1; },
    openCockpit: function () { controlCalls.openCockpit += 1; },
  };

  window.eval(STATE_SOURCE);
  window.eval(SCRIPT_SOURCE);

  return { window, document: window.document, posted, controlCalls };
}

function findButton(document, label) {
  return Array.from(document.querySelectorAll('#install-actions button')).find((b) => b.textContent === label);
}

// Walks a resolved installer from Authorization to Ready (Continue, then
// Next), matching the real wizard's forward path. Used by tests whose
// focus is the install/complete/error stages, not the walk itself --
// that walk has its own dedicated test above.
function advanceToReady(document, window) {
  findButton(document, 'Continue').dispatchEvent(new window.Event('click', { bubbles: true }));
  findButton(document, 'Next').dispatchEvent(new window.Event('click', { bubbles: true }));
}

test('install-mode: auto-resolves the target package on load, with no click', () => {
  const { posted } = mountInstall({ installIntent: 'sealdex' });
  assert.equal(posted.length, 1);
  assert.equal(posted[0].type, 'eco.cockpit.marlinResolvePackage');
  assert.equal(posted[0].packageName, 'sealdex');
});

test('install-mode: renders no full-shell nav/tab/wizard markup anywhere', () => {
  const { document } = mountInstall({ installIntent: 'sealdex' });
  assert.equal(document.querySelectorAll('.tab').length, 0);
  assert.equal(document.querySelectorAll('.tab-panel').length, 0);
  assert.equal(document.getElementById('wizard'), null);
  assert.equal(document.querySelector('nav'), null);
});

test('install-mode: with no installIntent, shows a fail-closed error and never calls resolve', () => {
  const { window, document, posted, controlCalls } = mountInstall({ installIntent: '' });
  assert.equal(posted.length, 0, 'must never resolve without a target package');
  assert.match(document.getElementById('install-note').textContent, /launched without a target package/);
  assert.equal(
    document.getElementById('brand-badge').classList.contains('is-marlin-asset'),
    false,
    'the Marlin asset is scoped to the authorization stage only -- no-target stays on the plain monogram',
  );
  findButton(document, 'Close').dispatchEvent(new window.Event('click', { bubbles: true }));
  assert.equal(controlCalls.close, 1);
});

test('install-mode: authorization fields render after a successful resolve, identity is still Marlin', async () => {
  const { document } = mountInstall({
    installIntent: 'sealdex',
    responses: {
      'eco.cockpit.marlinResolvePackage': (message) => ({
        type: 'eco.cockpit.marlinPackageResolveResult',
        payload: {
          ok: true,
          name: message.packageName,
          version: '0.2.0',
          description: 'Local-first operational registry',
          source: 'hosted',
          checksum: { algorithm: 'sha256', value: '880f5006...' },
          has_provider: true,
        },
      }),
    },
  });

  await tick();

  assert.ok(document.body.classList.contains('identity-marlin'), 'authorization is still Marlin-dominant');
  assert.equal(document.body.classList.contains('identity-app'), false);
  assert.match(document.getElementById('install-heading').textContent, /Install Sealdex\?/);
  assert.ok(
    document.getElementById('brand-badge').classList.contains('is-marlin-asset'),
    'authorization uses the real Marlin badge asset, not the plain monogram',
  );

  const metadataText = document.getElementById('install-metadata').textContent;
  assert.match(metadataText, /sealdex/);
  assert.match(metadataText, /0\.2\.0/);
  assert.match(metadataText, /hosted/);
  assert.match(metadataText, /880f5006\.\.\./);

  assert.ok(findButton(document, 'Continue'), 'expected a Continue action to leave authorization');
  assert.equal(findButton(document, 'Install'), undefined, 'Install must not be offered before authorization/location/ready');
});

test('install-mode: Continue -> Location -> Next -> Ready walks through the wizard, identity shifts to the app, then Install sends confirm:true', async () => {
  const { window, document, posted } = mountInstall({
    installIntent: 'sealdex',
    responses: {
      'eco.cockpit.marlinResolvePackage': (message) => ({
        type: 'eco.cockpit.marlinPackageResolveResult',
        payload: {
          ok: true, name: message.packageName, version: '0.2.0', source: 'hosted',
          checksum: { algorithm: 'sha256', value: '880f5006...' }, has_provider: true,
        },
      }),
    },
  });

  await tick();
  findButton(document, 'Continue').dispatchEvent(new window.Event('click', { bubbles: true }));

  assert.ok(document.body.classList.contains('identity-app'), 'location stage shifts dominance to the package');
  assert.equal(document.body.classList.contains('identity-marlin'), false);
  assert.match(document.getElementById('install-heading').textContent, /Install location/);
  assert.match(document.getElementById('install-footer').textContent, /Guided by Marlin/);
  assert.equal(findButton(document, 'Install'), undefined, 'no install-time control skips straight to Install');

  const hero = document.getElementById('stage-hero');
  assert.equal(hero.hidden, false, 'the Sealdex hero banner appears once, on Location');
  assert.match(hero.src, /sealdex-installer-header-dark\.png$/);
  assert.ok(
    document.getElementById('brand-badge').classList.contains('is-sealdex-asset'),
    'location badge uses the real Sealdex icon',
  );

  findButton(document, 'Next').dispatchEvent(new window.Event('click', { bubbles: true }));
  assert.equal(document.getElementById('stage-hero').hidden, true, 'the hero banner does not persist past Location');

  assert.match(document.getElementById('install-heading').textContent, /Ready to install/);
  const installButton = findButton(document, 'Install');
  assert.ok(installButton, 'expected an Install button once the wizard reaches Ready');
  installButton.dispatchEvent(new window.Event('click', { bubbles: true }));

  const installMsg = posted.find((m) => m.type === 'eco.cockpit.marlinInstallPackage');
  assert.ok(installMsg, 'expected a marlinInstallPackage message after clicking Install');
  assert.equal(installMsg.packageName, 'sealdex');
  assert.equal(installMsg.confirm, true);
  assert.match(document.getElementById('install-heading').textContent, /Installing Sealdex/);
});

test('install-mode: Cancel on the resolved approval never sends an install request', async () => {
  const { window, document, posted, controlCalls } = mountInstall({
    installIntent: 'sealdex',
    responses: {
      'eco.cockpit.marlinResolvePackage': (message) => ({
        type: 'eco.cockpit.marlinPackageResolveResult',
        payload: { ok: true, name: message.packageName, version: '0.2.0', source: 'hosted', checksum: null, has_provider: true },
      }),
    },
  });

  await tick();

  const cancelButton = findButton(document, 'Cancel');
  assert.ok(cancelButton);
  cancelButton.dispatchEvent(new window.Event('click', { bubbles: true }));

  assert.equal(posted.some((m) => m.type === 'eco.cockpit.marlinInstallPackage'), false);
  assert.equal(controlCalls.close, 1, 'Cancel must close the install-mode window via installControls');
});

test('install-mode: a resolve failure renders an error, not approval fields', async () => {
  const { document } = mountInstall({
    installIntent: 'nope',
    responses: {
      'eco.cockpit.marlinResolvePackage': () => ({
        type: 'eco.cockpit.marlinPackageResolveResult',
        payload: { ok: false, error: 'package not found: nope' },
      }),
    },
  });

  await tick();

  assert.equal(findButton(document, 'Install'), undefined);
  assert.match(document.getElementById('install-note').textContent, /package not found: nope/);
});

test('install-mode: complete stage shows Open Cockpit + Finish (no launch target), stays app-dominant, and Open Cockpit calls installControls', async () => {
  const { window, document, controlCalls } = mountInstall({
    installIntent: 'sealdex',
    responses: {
      'eco.cockpit.marlinResolvePackage': (message) => ({
        type: 'eco.cockpit.marlinPackageResolveResult',
        payload: { ok: true, name: message.packageName, version: '0.2.0', source: 'hosted', checksum: null, has_provider: true },
      }),
      'eco.cockpit.marlinInstallPackage': (message) => ({
        type: 'eco.cockpit.marlinInstallResult',
        payload: {
          ok: true,
          package: { name: message.packageName, version: '0.2.0', bins: [] },
          source: 'hosted',
          evidence_bundle: { bundle_id: 'evidence-fixture-1' },
        },
      }),
    },
  });

  await tick();
  advanceToReady(document, window);
  findButton(document, 'Install').dispatchEvent(new window.Event('click', { bubbles: true }));
  await tick();

  assert.ok(document.body.classList.contains('identity-app'), 'completion stays package-dominant');
  assert.match(document.getElementById('install-footer').textContent, /Installed with Marlin/);
  assert.equal(findButton(document, 'Open Sealdex'), undefined, 'must never claim a launch target that does not exist');
  const openCockpitBtn = findButton(document, 'Open Cockpit');
  assert.ok(openCockpitBtn, 'expected an Open Cockpit fallback when there is no real launch target');
  assert.ok(findButton(document, 'Finish'), 'the successful-completion close action is labeled Finish, not Close');
  assert.equal(findButton(document, 'Close'), undefined);

  const detailsBody = document.getElementById('install-details-body').textContent;
  assert.match(detailsBody, /evidence-fixture-1/);

  openCockpitBtn.dispatchEvent(new window.Event('click', { bubbles: true }));
  assert.equal(controlCalls.openCockpit, 1);
});

test('install-mode: an install failure renders an error, keeps app identity, and clears the approval controls', async () => {
  const { window, document } = mountInstall({
    installIntent: 'sealdex',
    responses: {
      'eco.cockpit.marlinResolvePackage': (message) => ({
        type: 'eco.cockpit.marlinPackageResolveResult',
        payload: { ok: true, name: message.packageName, version: '0.2.0', source: 'hosted', checksum: null, has_provider: true },
      }),
      'eco.cockpit.marlinInstallPackage': () => ({
        type: 'eco.cockpit.marlinInstallResult',
        payload: { ok: false, error: 'checksum mismatch' },
      }),
    },
  });

  await tick();
  advanceToReady(document, window);
  findButton(document, 'Install').dispatchEvent(new window.Event('click', { bubbles: true }));
  await tick();

  assert.equal(findButton(document, 'Install'), undefined);
  assert.ok(document.body.classList.contains('identity-app'), 'a failed install after authorization does not fall back to Marlin identity');
  assert.match(document.getElementById('install-note').textContent, /checksum mismatch/);
  assert.ok(findButton(document, 'Close'));
});

test('install-mode: a thrown provider error (generic actionResult, not a typed result) still surfaces, never hangs on "Installing..."', async () => {
  const { window, document } = mountInstall({
    installIntent: 'sealdex',
    responses: {
      'eco.cockpit.marlinResolvePackage': (message) => ({
        type: 'eco.cockpit.marlinPackageResolveResult',
        payload: { ok: true, name: message.packageName, version: '0.2.0', source: 'hosted', checksum: null, has_provider: true },
      }),
      // host-web/actions.js's outer try/catch wraps a thrown exception
      // (network failure, provider registration fault, subprocess crash)
      // as a generic actionResult, not marlinInstallResult -- this must
      // still resolve the "Installing..." state, not leave it stuck.
      'eco.cockpit.marlinInstallPackage': () => ({
        type: 'eco.cockpit.actionResult',
        payload: { ok: false, message: "ValueError: provider 'marlin' exited 1: boom", refresh: true },
      }),
    },
  });

  await tick();
  advanceToReady(document, window);
  findButton(document, 'Install').dispatchEvent(new window.Event('click', { bubbles: true }));
  await tick();

  assert.equal(findButton(document, 'Install'), undefined);
  assert.equal(document.querySelector('#install-actions button').textContent, 'Close');
  assert.match(document.getElementById('install-note').textContent, /provider 'marlin' exited 1: boom/);
});
