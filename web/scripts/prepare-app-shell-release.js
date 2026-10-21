'use strict';

// Local-only release candidate preparation. No network or publication.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const source = path.join(root, 'web/appShell.js');
const output = path.join(root, 'web/dist');
const version = process.argv[2];

if (!/^0\.[0-9]+\.[0-9]+(?:-[a-z0-9.-]+)?$/.test(version || '')) {
  console.error('Usage: node web/scripts/prepare-app-shell-release.js 0.x.y[-prerelease]');
  process.exit(2);
}
const bytes = fs.readFileSync(source);
const digest = crypto.createHash('sha256').update(bytes).digest('hex');
let commit;
try {
  commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
} catch {
  console.error('Git commit required for release provenance');
  process.exit(2);
}
if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error('Invalid git commit');
fs.mkdirSync(output, { recursive: true });
const filename = 'cockpit-app-shell-' + version + '.js';
fs.writeFileSync(path.join(output, filename), bytes);
const manifest = {
  schema: 'cockpit.app-shell.release-candidate.v1',
  version,
  repository: 'jj-ervin/cockpit',
  commit,
  source: 'web/appShell.js',
  artifact: filename,
  sha256: digest,
  distributionApproved: false,
  licenseReview: 'required',
  note: 'Local candidate only. Not a redistribution grant or published release.'
};
fs.writeFileSync(path.join(output, 'manifest-' + version + '.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('Prepared local candidate:', filename, 'SHA-256:', digest);
