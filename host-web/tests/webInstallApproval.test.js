'use strict';

/**
 * Browser-level proof of the INIT.19.06 install-approval click flow:
 * search result -> Install -> resolve metadata approval block -> Confirm
 * Install sends confirm:true. Loads the real web/cockpit.html + cockpit.js
 * bundle into jsdom (the same file host-web/server.js serves unmodified —
 * see server.js's own comment that web/cockpit.js needs zero changes to
 * work against any host) and drives it purely through DOM events, exactly
 * as a real browser click would. Host responses are fixtures (search,
 * resolve, install), not a real bridge call — this test's job is proving
 * the UI wiring, not re-proving the provider/bridge plumbing already
 * covered by actions.test.js and providerCommand.integration.test.js. The
 * real hosted-registry + real Marlin install proof is a separate manual
 * run against a disposable MARLIN_HOME (see DEV-PLAN.md).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const WEB_DIR = path.join(__dirname, '..', '..', 'web');
const HTML_SOURCE = fs.readFileSync(path.join(WEB_DIR, 'cockpit.html'), 'utf-8');
const STATE_SOURCE = fs.readFileSync(path.join(WEB_DIR, 'cockpitState.js'), 'utf-8');
const SCRIPT_SOURCE = fs.readFileSync(path.join(WEB_DIR, 'cockpit.js'), 'utf-8');

/**
 * Two macrotask hops: the fake host's own setTimeout(0) reply-scheduling,
 * then jsdom's internal task for dispatching the resulting postMessage
 * 'message' event. One tick alone can observe the state before the second
 * hop lands (verified against a real jsdom run).
 */
async function tick() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Builds a fresh jsdom window running the real bundle, wired to a fake
 * host whose replies come from `responses` (message.type -> reply payload,
 * or a function (message) => reply payload). Every posted message is
 * captured in the returned `posted` array so tests can assert on the exact
 * outgoing request shape (e.g. that Confirm Install really sent
 * confirm:true), not just on the resulting render.
 */
function mountCockpit(responses) {
  const dom = new JSDOM(HTML_SOURCE, {
    runScripts: 'dangerously',
    url: 'http://localhost/',
    // No `resources` loader: <link rel="stylesheet"> and the static
    // <script src="cockpit.js"> tag are inert. cockpit.js itself is
    // executed explicitly below via window.eval, after cockpitHost is
    // wired, matching the ordering the bundle's own top-of-file comment
    // requires ("Any host ... must set window.cockpitHost ... before this
    // script runs").
  });
  const { window } = dom;
  const posted = [];

  window.cockpitHost = {
    postMessage: function (message) {
      posted.push(message);
      const handler = responses[message.type];
      if (!handler) return;
      const reply = typeof handler === 'function' ? handler(message) : handler;
      if (!reply) return;
      const replies = Array.isArray(reply) ? reply : [reply];
      // Real transport (fetch -> /api/bridge -> window.postMessage) is
      // asynchronous; scheduling here the same way means this test proves
      // the bundle's real event-driven message handling, not a same-tick
      // synchronous shortcut that a real host could never provide.
      setTimeout(() => {
        replies.forEach((m) => window.postMessage(m, '*'));
      }, 0);
    },
  };

  window.eval(STATE_SOURCE);
  window.eval(SCRIPT_SOURCE);

  return { window, document: window.document, posted };
}

function baseResponses(overrides) {
  return Object.assign(
    {
      'eco.cockpit.ready': {
        type: 'eco.cockpit.state',
        payload: {
          development: {
            installReadiness: {
              status: 'ready',
              mode: 'preview',
              requires_human_apply: true,
              preview_steps: [],
              apply_command: ['echo', 'noop'],
            },
          },
        },
      },
      'eco.cockpit.refresh': {
        type: 'eco.cockpit.state',
        payload: {
          development: {
            installReadiness: {
              status: 'ready',
              mode: 'preview',
              requires_human_apply: true,
              preview_steps: [],
              apply_command: ['echo', 'noop'],
            },
          },
        },
      },
    },
    overrides,
  );
}

function findInstallButton(document, packageLabel) {
  const rows = Array.from(document.querySelectorAll('.wizard-provider-panel .item.action-item'));
  const row = rows.find((r) => r.querySelector('strong').textContent === packageLabel);
  assert.ok(row, `expected a search-result row for ${packageLabel}`);
  return row.querySelector('button');
}

test('install-approval flow: search -> Install -> approval block -> Confirm Install sends confirm:true', async () => {
  const { window, document, posted } = mountCockpit(
    baseResponses({
      'eco.cockpit.marlinSearchPackages': (message) => ({
        type: 'eco.cockpit.marlinPackageSearchResult',
        payload: {
          ok: true,
          query: message.query,
          packages: [{ name: 'sealdex', version: '0.2.0', description: 'Local-first operational registry', source: 'hosted' }],
        },
      }),
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
      'eco.cockpit.marlinInstallPackage': (message) => ({
        type: 'eco.cockpit.marlinInstallResult',
        payload: {
          ok: true,
          package: { name: message.packageName, version: '0.2.0' },
          source: 'hosted',
          evidence_bundle: { bundle_id: 'evidence-fixture-1' },
        },
      }),
    }),
  );

  await tick(); // deliver eco.cockpit.state for the initial ready

  // Real click, not a direct state mutation: fill the search box and
  // submit the form the way a user would.
  const searchInput = document.querySelector('.wizard-search input[type="text"]');
  const searchForm = document.querySelector('.wizard-search');
  searchInput.value = 'sealdex';
  searchForm.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));

  const searchMsg = posted.find((m) => m.type === 'eco.cockpit.marlinSearchPackages');
  assert.ok(searchMsg, 'expected a marlinSearchPackages message to be posted');
  assert.equal(searchMsg.query, 'sealdex');

  await tick(); // deliver the search result and re-render

  const resultRow = document.querySelector('.wizard-provider-panel .item.action-item strong');
  assert.equal(resultRow.textContent, 'sealdex@0.2.0');
  assert.match(
    document.querySelector('.wizard-provider-panel .item.action-item span').textContent,
    /\[hosted\]/,
  );

  // Click Install -- must resolve first, never install directly.
  const installButton = findInstallButton(document, 'sealdex@0.2.0');
  installButton.dispatchEvent(new window.Event('click', { bubbles: true }));

  assert.equal(
    posted.some((m) => m.type === 'eco.cockpit.marlinInstallPackage'),
    false,
    'clicking Install must resolve metadata first, not install directly',
  );
  const resolveMsg = posted.find((m) => m.type === 'eco.cockpit.marlinResolvePackage');
  assert.ok(resolveMsg, 'expected a marlinResolvePackage message to be posted');
  assert.equal(resolveMsg.packageName, 'sealdex');

  await tick(); // deliver the resolve result and render the approval block

  const approvalBox = document.querySelector('.wizard-approval-box');
  assert.ok(approvalBox, 'expected an approval block to render after resolve succeeds');
  const approvalText = approvalBox.textContent;
  assert.match(approvalText, /sealdex@0\.2\.0/);
  assert.match(approvalText, /hosted/);
  assert.match(approvalText, /880f5006\.\.\./);

  // Click Confirm Install -- this is the one call in the whole flow that
  // is allowed to carry confirm:true.
  const confirmButton = Array.from(approvalBox.querySelectorAll('button')).find((b) => b.textContent === 'Confirm Install');
  assert.ok(confirmButton, 'expected a Confirm Install button in the approval block');
  confirmButton.dispatchEvent(new window.Event('click', { bubbles: true }));

  const installMsg = posted.find((m) => m.type === 'eco.cockpit.marlinInstallPackage');
  assert.ok(installMsg, 'expected a marlinInstallPackage message to be posted after Confirm Install');
  assert.equal(installMsg.packageName, 'sealdex');
  assert.equal(installMsg.confirm, true);

  await tick(); // deliver the install result and render it

  // Scoped to #wizard-content: .wizard-result is also used by the static
  // Doctor/Audit result <pre> elements elsewhere in cockpit.html, so an
  // unscoped query can match the wrong (empty) one.
  const resultBlock = document.querySelector('#wizard-content .wizard-result');
  assert.ok(resultBlock, 'expected an install result block to render');
  assert.match(resultBlock.textContent, /"ok": true/);
  assert.match(resultBlock.textContent, /evidence-fixture-1/);

  // The approval block clears once install finishes, whether it succeeded
  // or failed -- it must not linger showing a stale "installing" state.
  assert.equal(document.querySelector('.wizard-approval-box'), null);
});

test('install-approval flow: Cancel on the approval block never sends an install request', async () => {
  const { window, document, posted } = mountCockpit(
    baseResponses({
      'eco.cockpit.marlinSearchPackages': () => ({
        type: 'eco.cockpit.marlinPackageSearchResult',
        payload: { ok: true, query: 'sealdex', packages: [{ name: 'sealdex', version: '0.2.0', description: 'x', source: 'hosted' }] },
      }),
      'eco.cockpit.marlinResolvePackage': (message) => ({
        type: 'eco.cockpit.marlinPackageResolveResult',
        payload: { ok: true, name: message.packageName, version: '0.2.0', source: 'hosted', checksum: null, has_provider: true },
      }),
    }),
  );

  await tick();

  const searchInput = document.querySelector('.wizard-search input[type="text"]');
  const searchForm = document.querySelector('.wizard-search');
  searchInput.value = 'sealdex';
  searchForm.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await tick();

  findInstallButton(document, 'sealdex@0.2.0').dispatchEvent(new window.Event('click', { bubbles: true }));
  await tick();

  const approvalBox = document.querySelector('.wizard-approval-box');
  assert.ok(approvalBox);
  const cancelButton = Array.from(approvalBox.querySelectorAll('button')).find((b) => b.textContent === 'Cancel');
  assert.ok(cancelButton, 'expected a Cancel button in the approval block');
  cancelButton.dispatchEvent(new window.Event('click', { bubbles: true }));
  await tick();

  assert.equal(document.querySelector('.wizard-approval-box'), null);
  assert.equal(posted.some((m) => m.type === 'eco.cockpit.marlinInstallPackage'), false, 'Cancel must never send an install request');
});

test('install-approval flow: a resolve failure renders an error, not a stale approval block', async () => {
  const { window, document, posted } = mountCockpit(
    baseResponses({
      'eco.cockpit.marlinSearchPackages': () => ({
        type: 'eco.cockpit.marlinPackageSearchResult',
        payload: { ok: true, query: 'nope', packages: [{ name: 'nope', version: '0.0.0', description: 'x', source: 'hosted' }] },
      }),
      'eco.cockpit.marlinResolvePackage': () => ({
        type: 'eco.cockpit.marlinPackageResolveResult',
        payload: { ok: false, error: 'package not found: nope' },
      }),
    }),
  );

  await tick();

  const searchInput = document.querySelector('.wizard-search input[type="text"]');
  const searchForm = document.querySelector('.wizard-search');
  searchInput.value = 'nope';
  searchForm.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await tick();

  findInstallButton(document, 'nope@0.0.0').dispatchEvent(new window.Event('click', { bubbles: true }));
  await tick();

  assert.equal(document.querySelector('.wizard-approval-box'), null);
  const errorNote = document.querySelector('.wizard-approval .panel-note.is-error');
  assert.ok(errorNote, 'expected an error note in the approval area');
  assert.match(errorNote.textContent, /package not found: nope/);
  assert.equal(posted.some((m) => m.type === 'eco.cockpit.marlinInstallPackage'), false);
});

test('install intent: the full shell no longer auto-acts on installIntent (that is install-mode\'s job now, see webInstallMode.test.js)', async () => {
  const { document, posted } = mountCockpit(
    baseResponses({
      'eco.cockpit.ready': {
        type: 'eco.cockpit.state',
        payload: {
          installIntent: 'sealdex',
          development: {
            installReadiness: {
              status: 'ready', mode: 'preview', requires_human_apply: true,
              preview_steps: [], apply_command: ['echo', 'noop'],
            },
          },
        },
      },
    }),
  );

  await tick();

  assert.equal(
    posted.some((m) => m.type === 'eco.cockpit.marlinSearchPackages'),
    false,
    'the full shell must never auto-search from installIntent -- install-mode (web/install.js) owns that surface now',
  );
  const wizardTab = document.querySelector(".tab[data-tab='wizard']");
  assert.equal(wizardTab.classList.contains('is-active'), false, 'the full shell must land on its normal default tab');
});
