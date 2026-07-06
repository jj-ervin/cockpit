'use strict';

const path = require('path');

/**
 * Resolves requestedPath relative to workspaceRoot and asserts the result
 * stays inside it - mirrors EcoAdapter._resolve_contained_path (Python) and
 * webviewHost.ts's resolveContainedPath (VS Code host). A record_id/path
 * value from the browser must never be able to escape the workspace root.
 */
function resolveContainedPath(workspaceRoot, requestedPath) {
  const resolvedRoot = path.resolve(workspaceRoot);
  const resolvedPath = path.resolve(resolvedRoot, requestedPath);
  const relative = path.relative(resolvedRoot, resolvedPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Requested path is outside the active workspace.');
  }
  return resolvedPath;
}

module.exports = { resolveContainedPath };
