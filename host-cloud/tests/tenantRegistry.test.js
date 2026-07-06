'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createTenantRegistry } = require('../tenantRegistry');

function makeTmpDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cockpit-cloud-test-'));
}

test('createTenant makes a distinct on-disk workspace directory', () => {
  const dataDir = makeTmpDataDir();
  const registry = createTenantRegistry({ dataDir });
  const tenant = registry.createTenant({ githubId: 111, login: 'alice' });
  assert.ok(fs.existsSync(tenant.workspacePath));
  assert.equal(registry.getById(tenant.id).id, tenant.id);
});

test('two distinct tenants get two distinct workspaceRoot values from the same registry instance', () => {
  const dataDir = makeTmpDataDir();
  const registry = createTenantRegistry({ dataDir });
  const a = registry.createTenant({ githubId: 111, login: 'alice' });
  const b = registry.createTenant({ githubId: 222, login: 'bob' });
  assert.notEqual(a.workspacePath, b.workspacePath);
  assert.equal(registry.getById(a.id).workspacePath, a.workspacePath);
  assert.equal(registry.getById(b.id).workspacePath, b.workspacePath);
});

test('upsertByGithubId is idempotent - same githubId returns the same tenant, not a new one', () => {
  const dataDir = makeTmpDataDir();
  const registry = createTenantRegistry({ dataDir });
  const first = registry.upsertByGithubId({ githubId: 111, login: 'alice' });
  const second = registry.upsertByGithubId({ githubId: 111, login: 'alice' });
  assert.equal(first.id, second.id);
  assert.equal(first.workspacePath, second.workspacePath);
});

test('upsertByGithubId touches lastActiveAt on repeat login', () => {
  const dataDir = makeTmpDataDir();
  const registry = createTenantRegistry({ dataDir });
  const first = registry.upsertByGithubId({ githubId: 111, login: 'alice' });
  const before = first.lastActiveAt;
  const second = registry.upsertByGithubId({ githubId: 111, login: 'alice' });
  assert.ok(second.lastActiveAt >= before);
});

test('getById returns null for an unknown tenant', () => {
  const dataDir = makeTmpDataDir();
  const registry = createTenantRegistry({ dataDir });
  assert.equal(registry.getById('does-not-exist'), null);
});
