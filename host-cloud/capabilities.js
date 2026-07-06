'use strict';

/**
 * Maps each eco.cockpit.* message type (host-web/actions.js's own dispatch
 * switch is the source of truth for this list) to the capability class
 * CKP.12.00's design doc named: read-only provider panels vs. mutating
 * actions (submit run, approve escalation, save policy, delete/restore
 * artifact, set HELM mode, OS open/reveal). Anything not in this map
 * defaults to 'write' - fail closed on an unrecognized action type, rather
 * than silently trusting it as read-only.
 */
const READ_TYPES = new Set([
  'eco.cockpit.ready',
  'eco.cockpit.refresh',
  'eco.cockpit.marlinSearchPackages',
  'eco.cockpit.workspaceStatus',
  'eco.cockpit.copyRunJson',
]);

function requiredCapability(type) {
  return READ_TYPES.has(type) ? 'read' : 'write';
}

/**
 * Express middleware factory. Reads req.session (attached by
 * requireSession in server.js) and req.body.type, and rejects with 403 if
 * the token's capabilities don't include what this action type needs.
 * Independent of tenancy (requireSession) and rate limiting - a valid
 * session for the right tenant can still lack 'write' if it was issued as
 * a read-only token.
 */
function requireCapability(req, res, next) {
  const capability = requiredCapability(req.body && req.body.type);
  const granted = (req.session && req.session.capabilities) || [];
  if (!granted.includes(capability)) {
    res.status(403).json({ error: `Token lacks '${capability}' capability required for this action.` });
    return;
  }
  next();
}

module.exports = { requiredCapability, requireCapability, READ_TYPES };
