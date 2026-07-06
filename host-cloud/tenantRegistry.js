'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * JSON-file-backed tenant registry: one record per authenticated identity,
 * each with its own on-disk workspace directory. This is the server-owned
 * mapping CKP.12.00's design requires - a request may carry a tenant's
 * session token, but the workspaceRoot it resolves to always comes from
 * here, never from anything the client sends.
 *
 * No container orchestration yet (CKP.12.00 scoped this out) - workspaceRoot
 * is a plain directory on the host running this control plane, one per
 * tenant, created on first login.
 */
function createTenantRegistry({ dataDir }) {
  const registryFile = path.join(dataDir, 'tenants.json');
  const workspacesRoot = path.join(dataDir, 'tenants');

  function load() {
    if (!fs.existsSync(registryFile)) {
      return {};
    }
    try {
      return JSON.parse(fs.readFileSync(registryFile, 'utf-8'));
    } catch {
      return {};
    }
  }

  function save(records) {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(registryFile, JSON.stringify(records, null, 2));
  }

  function getById(tenantId) {
    const records = load();
    return records[tenantId] || null;
  }

  function findByGithubId(githubId) {
    const records = load();
    return Object.values(records).find((r) => r.githubId === String(githubId)) || null;
  }

  function createTenant({ githubId, login }) {
    const records = load();
    const id = crypto.randomUUID();
    const workspacePath = path.join(workspacesRoot, id, 'workspace');
    fs.mkdirSync(workspacePath, { recursive: true });
    const now = new Date().toISOString();
    const record = {
      id,
      githubId: String(githubId),
      login,
      workspacePath,
      createdAt: now,
      lastActiveAt: now,
    };
    records[id] = record;
    save(records);
    return record;
  }

  function touch(tenantId) {
    const records = load();
    if (!records[tenantId]) {
      return null;
    }
    records[tenantId].lastActiveAt = new Date().toISOString();
    save(records);
    return records[tenantId];
  }

  function upsertByGithubId({ githubId, login }) {
    const existing = findByGithubId(githubId);
    if (existing) {
      return touch(existing.id);
    }
    return createTenant({ githubId, login });
  }

  return { getById, findByGithubId, createTenant, touch, upsertByGithubId };
}

module.exports = { createTenantRegistry };
