'use strict';

// Offline verifier for a Cockpit App Shell candidate. Does not publish or authorize.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '../..');
const version = process.argv[2];
if (!/^0\.[0-9]+\.[0-9]+(?:-[a-z0-9.-]+)?$/.test(version || '')) {
  console.error('Usage: node web/scripts/verify-app-shell-release.js 0.x.y[-prerelease]');
  process.exit(2);
}
const dist = path.join(root, 'web/dist');
const filename = 'cockpit-app-shell-' + version + '.js';
const manifestFile = path.join(dist, 'manifest-' + version + '.json');
function fail(reason) { throw new Error('Release candidate verification failed: ' + reason); }
const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
if (manifest.schema !== 'cockpit.app-shell.release-candidate.v1' ||
    manifest.version !== version ||
    manifest.repository !== 'jj-ervin/cockpit' ||
    manifest.source !== 'web/appShell.js' ||
    manifest.artifact !== filename ||
    !/^[a-f0-9]{40}$/.test(manifest.commit || '') ||
    !/^[a-f0-9]{64}$/.test(manifest.sha256 || '') ||
    manifest.distributionApproved !== false ||
    manifest.licenseReview !== 'required') fail('invalid manifest metadata');
const artifact = fs.readFileSync(path.join(dist, filename));
const source = fs.readFileSync(path.join(root, 'web/appShell.js'));
const digest = crypto.createHash('sha256').update(artifact).digest('hex');
if (digest !== manifest.sha256) fail('artifact SHA-256 mismatch');
if (!artifact.equals(source)) fail('artifact differs from canonical source');
console.log('Verified local candidate:', filename, 'SHA-256:', digest);
console.log('NOT authorized for redistribution; licensing and provenance review required.');
