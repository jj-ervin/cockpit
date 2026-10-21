'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const verifier = fs.readFileSync(path.join(__dirname, '../scripts/verify-app-shell-release.js'), 'utf8');

test('candidate verification validates SHA-256 and canonical bytes', () => {
  assert.match(verifier, /createHash\('sha256'\)/);
  assert.match(verifier, /artifact\.equals\(source\)/);
  assert.match(verifier, /digest !== manifest\.sha256/);
});
test('candidate verification rejects unapproved manifest state', () => {
  assert.match(verifier, /manifest\.distributionApproved !== false/);
  assert.match(verifier, /manifest\.licenseReview !== 'required'/);
  assert.match(verifier, /manifest\.repository !== 'jj-ervin\/cockpit'/);
});
test('candidate verification has no publishing behavior', () => {
  assert.doesNotMatch(verifier, /npm publish|gh release create|fetch\(|curl /);
});
