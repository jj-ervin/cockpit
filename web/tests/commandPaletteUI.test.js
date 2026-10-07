'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const UI = require('../commandPaletteUI.js');
const Resolver = require('../catalogResolver.js');
const CommandInterface = require('../commandInterface.js');
const ParameterInteraction = require('../parameterInteraction.js');
const CommandReview = require('../commandReview.js');
const PaletteFlow = require('../commandPaletteFlow.js');

function doc() {
  return {
    createElement(tag) {
      const listeners = {};
      return {
        tagName: tag,
        children: [],
        dataset: {},
        parentNode: null,
        className: '',
        textContent: '',
        type: '',
        value: '',
        disabled: false,
        tabIndex: 0,
        appendChild(node) {
          this.children.push(node);
          node.parentNode = this;
        },
        removeChild(node) {
          this.children = this.children.filter((child) => child !== node);
          node.parentNode = null;
        },
        addEventListener(type, handler) {
          listeners[type] = handler;
        },
        dispatchEvent(event) {
          if (listeners[event.type]) listeners[event.type](event);
        },
        setAttribute() {},
        click() {
          if (listeners.click) listeners.click({ type: 'click' });
        },
      };
    },
  };
}

function findButton(node, label) {
  if (node.tagName === 'button' && node.textContent === label) return node;
  for (const child of node.children) {
    const match = findButton(child, label);
    if (match) return match;
  }
  return null;
}

function findInput(node, fieldId) {
  if (node.dataset && node.dataset.fieldId === fieldId) return node;
  for (const child of node.children) {
    const match = findInput(child, fieldId);
    if (match) return match;
  }
  return null;
}

function makeUI(posted, catalog) {
  const d = doc();
  const root = d.createElement('div');
  const list = d.createElement('div');

  const ui = UI({
    document: d,
    root,
    list,
    catalog,
    host: { postMessage: (message) => posted.push(message) },
    resolverFactory: Resolver,
    commandInterfaceFactory: CommandInterface,
    parameterInteractionFactory: ParameterInteraction,
    reviewFactory: CommandReview,
    flowFactory: PaletteFlow,
  });
  return { ui, root };
}

test('selecting a discovered command opens parameter review without invocation', () => {
  const posted = [];
  const catalog = {
    providers: [{
      id: 'demo',
      name: 'Demo',
      commands: [{
        id: 'demo.install',
        title: 'Install',
        input: {
          type: 'object',
          fields: [{ id: 'package', type: 'string', required: true }],
        },
      }],
    }],
  };

  const { ui, root } = makeUI(posted, catalog);

  ui.select('demo.install');

  assert.equal(root.children.length, 1);
  assert.equal(posted.length, 0);
});

test('review and explicit approval invoke only through the existing host intent seam', () => {
  const posted = [];
  const catalog = {
    providers: [{
      id: 'demo',
      name: 'Demo',
      commands: [{
        id: 'demo.install',
        title: 'Install',
        input: {
          type: 'object',
          fields: [{ id: 'package', type: 'string', required: true }],
        },
      }],
    }],
  };

  const { ui, root } = makeUI(posted, catalog);

  ui.select('demo.install');

  const panel = root.children[0];
  const input = findInput(panel, 'package');
  const reviewButton = findButton(panel, 'Review');
  const approveButton = findButton(panel, 'Approve & Invoke');

  assert.ok(input);
  assert.ok(reviewButton);
  assert.ok(approveButton);
  assert.equal(approveButton.disabled, true);
  assert.equal(posted.length, 0);

  input.value = 'sealdex';
  reviewButton.click();

  assert.equal(approveButton.disabled, false);
  assert.equal(posted.length, 0);

  approveButton.click();

  assert.equal(posted.length, 1);
  assert.deepEqual(posted[0], {
    type: 'eco.cockpit.invokeProviderCommand',
    providerId: 'demo',
    commandId: 'demo.install',
    input: { package: 'sealdex' },
    confirm: false,
  });
});
