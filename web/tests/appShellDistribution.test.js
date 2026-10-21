'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'appShell.js'), 'utf8');

function documentStub() {
  return {
    createElement(tagName) {
      return {
        tagName,
        textContent: '',
        className: '',
        dataset: {},
        children: [],
        classList: { toggle() {} },
        appendChild(child) { this.children.push(child); return child; },
        setAttribute() {},
        getAttribute() { return null; }
      };
    }
  };
}

test('CommonJS export is a document-injected factory', () => {
  const createAppShell = require('../appShell.js');
  assert.equal(typeof createAppShell, 'function');
  const shell = createAppShell(documentStub());
  for (const method of ['createApplicationDefinition', 'createPanel', 'createStatusBadge', 'setActiveTab']) {
    assert.equal(typeof shell[method], 'function');
  }
});

test('browser UMD export is window.AppShell instance, not a factory', () => {
  const window = { document: documentStub() };
  vm.runInNewContext(source, { window });
  assert.equal(typeof window.AppShell, 'object');
  assert.equal(typeof window.AppShell.createApplicationDefinition, 'function');
  assert.equal(typeof window.AppShell.createPanel, 'function');
  assert.equal(typeof window.AppShell.createStatusBadge, 'function');
  assert.equal(typeof window.AppShell.setActiveTab, 'function');
  const definition = window.AppShell.createApplicationDefinition({
    id: 'gc-portal', title: 'Governance Commons', navigation: { activeId: 'chat' }
  });
  assert.equal(definition.id, 'gc-portal');
  assert.equal(definition.navigation.activeId, 'chat');
});
