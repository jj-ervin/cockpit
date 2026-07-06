'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Symlink/junction-aware containment check - the strengthening
 * CKP.12.00's design doc calls for over host-web/pathContainment.js's
 * lexical-only path.resolve/path.relative check. A symlink placed inside a
 * tenant's workspace pointing outside it would pass the lexical check while
 * the actual filesystem access escapes; this resolves through fs.realpath
 * first, so the comparison happens on the real target, not the path string.
 *
 * For a requestedPath that doesn't exist yet (e.g. a file about to be
 * created), realpath is only called on the nearest existing ancestor, then
 * the non-existent suffix is reattached - matching realpath's own
 * documented behavior for parents that don't exist.
 */
function resolveContainedPathStrict(workspaceRoot, requestedPath) {
  const resolvedRoot = fs.realpathSync(path.resolve(workspaceRoot));
  const candidate = path.resolve(resolvedRoot, requestedPath);

  let existing = candidate;
  const suffixParts = [];
  while (!fs.existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) {
      throw new Error('Requested path does not resolve under any real filesystem root.');
    }
    suffixParts.unshift(path.basename(existing));
    existing = parent;
  }

  const realExisting = fs.realpathSync(existing);
  const resolved = suffixParts.length ? path.join(realExisting, ...suffixParts) : realExisting;

  const relative = path.relative(resolvedRoot, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Requested path is outside the active workspace.');
  }
  return resolved;
}

module.exports = { resolveContainedPathStrict };
