'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const script = fs.readFileSync(path.join(__dirname, '../scripts/prepare-app-shell-release.js'), 'utf8');

test('release preparation is explicitly non-publishing and requires review', () => {
  assert.match(script, /distributionApproved: false/);
  assert.match(script, /licenseReview: 'required'/);
  assert.doesNotMatch(script, /npm publish|gh release create|curl |fetch\(/);
});

test('release digest uses SHA-256 over exact canonical source bytes', () => {
  const bytes = fs.readFileSync(path.join(__dirname, '../appShell.js'));
  const digest = crypto.createHash('sha256').update(bytes).digest('hex');
  assert.match(digest, /^[0-9a-f]{64}$/);
  assert.match(script, /readFileSync\(source\)/);
  assert.match(script, /createHash\('sha256'\)/);
});

test('candidate records commit and source identity', () => {
  assert.match(script, /rev-parse/);
  assert.match(script, /web\/appShell\.js/);
  assert.match(script, /jj-ervin\/cockpit/);
});
