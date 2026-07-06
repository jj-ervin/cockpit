'use strict';

const path = require('path');

const { createApp } = require('./server');
const { createTenantRegistry } = require('./tenantRegistry');
const { createProcessManager } = require('./processManager');
const { createRateLimiter } = require('./rateLimiter');

function isLoopbackHost(host) {
  return host === '127.0.0.1' || host === 'localhost' || host === '::1';
}

function resolveRuntimeSecurity(env = process.env) {
  const host = env.HOST || '0.0.0.0';
  const publicBind = !isLoopbackHost(host);
  const allowInsecureHttp = env.COCKPIT_CLOUD_ALLOW_INSECURE_HTTP === '1';
  const tlsTerminated = env.COCKPIT_CLOUD_TLS_TERMINATED === '1';

  if (publicBind && !tlsTerminated && !allowInsecureHttp) {
    throw new Error(
      'host-cloud refuses to bind a public host without TLS. Set ' +
      'COCKPIT_CLOUD_TLS_TERMINATED=1 when deployed behind HTTPS termination, ' +
      'or set COCKPIT_CLOUD_ALLOW_INSECURE_HTTP=1 for local/dev-only testing.'
    );
  }

  return {
    host,
    secureCookies: tlsTerminated || (publicBind && !allowInsecureHttp),
    tlsTerminated,
    allowInsecureHttp,
  };
}

if (require.main === module) {
  const port = process.env.PORT ? Number(process.env.PORT) : 4175;
  // Unlike host-web (Phase 3, a locally-run single-user tool that defaults
  // to loopback-only), host-cloud is meant to be reached by multiple
  // tenants over the network - it defaults to all interfaces, gated by
  // auth instead of by network reachability. Deploy behind a reverse proxy/
  // TLS terminator; that's ops scope CKP.12.00 explicitly deferred.
  const runtimeSecurity = resolveRuntimeSecurity(process.env);
  const host = runtimeSecurity.host;
  const dataDir = process.env.COCKPIT_CLOUD_DATA_DIR || path.join(process.cwd(), '.cockpit-cloud-data');
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    throw new Error('SESSION_SECRET must be set - refusing to start with an undefined signing key.');
  }

  const tenantRegistry = createTenantRegistry({ dataDir });

  const processManager = createProcessManager({
    hostWebEntry: process.env.HOST_WEB_ENTRY || path.join(__dirname, '..', 'host-web', 'index.js'),
    pythonExecutable: process.env.COCKPIT_PYTHON || 'python',
    maxConcurrentTenants: process.env.MAX_CONCURRENT_TENANTS ? Number(process.env.MAX_CONCURRENT_TENANTS) : 10,
    readyTimeoutMs: process.env.TENANT_READY_TIMEOUT_MS ? Number(process.env.TENANT_READY_TIMEOUT_MS) : undefined,
  });

  const rateLimiter = createRateLimiter({
    capacity: process.env.RATE_LIMIT_CAPACITY ? Number(process.env.RATE_LIMIT_CAPACITY) : 20,
    refillPerSecond: process.env.RATE_LIMIT_REFILL_PER_SEC ? Number(process.env.RATE_LIMIT_REFILL_PER_SEC) : 5,
  });

  const idleTimeoutMs = process.env.TENANT_IDLE_TIMEOUT_MS ? Number(process.env.TENANT_IDLE_TIMEOUT_MS) : 15 * 60 * 1000;
  const idleSweepInterval = setInterval(() => {
    const stopped = processManager.sweepIdle(idleTimeoutMs);
    if (stopped.length) {
      console.log(`Stopped idle tenant processes: ${stopped.join(', ')}`);
    }
  }, Math.min(idleTimeoutMs, 60000));
  idleSweepInterval.unref();

  const app = createApp({
    tenantRegistry,
    sessionSecret,
    processManager,
    rateLimiter,
    tenantDiskQuotaBytes: process.env.TENANT_DISK_QUOTA_BYTES ? Number(process.env.TENANT_DISK_QUOTA_BYTES) : 0,
    secureCookies: runtimeSecurity.secureCookies,
    github: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      redirectUri: process.env.GITHUB_REDIRECT_URI,
    },
  });

  app.listen(port, host, () => {
    const scheme = runtimeSecurity.tlsTerminated ? 'https' : 'http';
    console.log(`Cockpit host-cloud (Phase 4 control plane) listening on ${scheme}://${host}:${port}`);
    console.log(`Tenant data dir: ${dataDir}`);
    console.log(`Secure cookies: ${runtimeSecurity.secureCookies ? 'enabled' : 'disabled (insecure dev mode)'}`);
  });

  process.on('SIGINT', () => {
    processManager.stopAll();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    processManager.stopAll();
    process.exit(0);
  });
}

module.exports = { createApp, createTenantRegistry, createProcessManager, createRateLimiter, resolveRuntimeSecurity };
