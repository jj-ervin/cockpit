'use strict';

const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const pack = path.join(__dirname, '..', 'assets', 'cockpit-icon-pack');
const expectedFrames = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256];

async function sha256(file) {
  return crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex');
}

async function main() {
  const manifest = await fs.readFile(path.join(pack, 'SHA256SUMS.txt'), 'utf8');
  for (const line of manifest.split(/\r?\n/)) {
    const match = line.match(/^([a-f0-9]{64})  (.+)$/i);
    if (!match) continue;
    const actual = await sha256(path.join(pack, match[2]));
    if (actual !== match[1].toLowerCase()) {
      throw new Error(`Icon pack checksum mismatch: ${match[2]}`);
    }
  }
  const ico = await fs.readFile(path.join(pack, 'cockpit.ico'));
  if (ico.length < 6 || ico.readUInt16LE(0) !== 0 || ico.readUInt16LE(2) !== 1) {
    throw new Error('cockpit.ico is not a valid ICO file.');
  }
  const count = ico.readUInt16LE(4);
  const frames = [];
  for (let index = 0; index < count; index += 1) {
    const entry = 6 + index * 16;
    let width = ico[entry];
    if (width === 0) width = 256;
    frames.push(width);
  }
  if (frames.join(',') !== expectedFrames.join(',')) {
    throw new Error(`Unexpected ICO frame set: ${frames.join(', ')}`);
  }
  console.log(`Verified Cockpit optical icon pack (${expectedFrames.join(', ')}px).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
