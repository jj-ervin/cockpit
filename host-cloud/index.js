'use strict';

const path = require('path');

const { createApp } = require('./server');
const { createTenantRegistry } = require('./tenantRegistry');

if (require.main === module) {
  const port = process.env.PORT ? Number(process.env.PORT) : 4175;
  // Unlike host-web (Phase 3, a locally-run single-user tool that defaults
  // to loopback-only), host-cloud is meant to be reached by multiple
  // tenants over the network - it defaults to all interfaces, gated by
  // auth instead of by network reachability. Deploy behind a reverse proxy/
  // TLS terminator; that's ops scope CKP.12.00 explicitly deferred.
  const host = process.env.HOST || '0.0.0.0';
  const dataDir = process.env.COCKPIT_CLOUD_DATA_DIR || path.join(process.cwd(), '.cockpit-cloud-data');
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    throw new Error('SESSION_SECRET must be set - refusing to start with an undefined signing key.');
  }

  const tenantRegistry = createTenantRegistry({ dataDir });
  const app = createApp({
    tenantRegistry,
    sessionSecret,
    github: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      redirectUri: process.env.GITHUB_REDIRECT_URI,
    },
  });

  app.listen(port, host, () => {
    console.log(`Cockpit host-cloud (Phase 4 control-plane skeleton) listening on http://${host}:${port}`);
    console.log(`Tenant data dir: ${dataDir}`);
  });
}

module.exports = { createApp, createTenantRegistry };
