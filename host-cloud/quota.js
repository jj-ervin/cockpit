'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Best-effort, application-level disk usage check - not a real enforcement
 * mechanism. CKP.12.00's design doc named "container cpu/mem/pids/disk-
 * quota limits" as the real target; true disk quotas need filesystem/
 * container-runtime support (ext4 project quotas, a container storage
 * driver's --storage-opt size, etc.) that this non-Docker stand-in has no
 * access to. This walks the tenant's workspace directory and refuses new
 * mutating actions once it exceeds a configured byte limit - a soft
 * backstop, not a guarantee, and documented as such rather than presented
 * as real quota enforcement.
 */
function directorySizeBytes(root) {
  let total = 0;
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isSymbolicLink()) {
        continue; // don't follow symlinks when sizing a workspace
      }
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        try {
          total += fs.statSync(full).size;
        } catch {
          // file removed mid-walk; ignore
        }
      }
    }
  }
  return total;
}

function withinQuota(workspacePath, maxBytes) {
  if (!maxBytes || maxBytes <= 0) {
    return true; // quota disabled
  }
  return directorySizeBytes(workspacePath) <= maxBytes;
}

module.exports = { directorySizeBytes, withinQuota };
