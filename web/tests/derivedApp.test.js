'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const createAppShell = require('../appShell.js');

function makeDocument() {
  function element(tagName) {
    return {
      tagName,
      className: '',
      textContent: '',
      id: '',
      dataset: {},
      children: [],
      firstChild: null,
      attributes: {},
      classList: {
        values: new Set(),
        toggle(name, force) {
          if (force === undefined ? !this.values.has(name) : force) {
            this.values.add(name);
          } else {
            this.values.delete(name);
          }
        },
        contains(name) {
          return this.values.has(name);
        },
      },
      appendChild(child) {
        this.children.push(child);
        this.firstChild = this.children[0] || null;
        return child;
      },
      removeChild(child) {
        const index = this.children.indexOf(child);
        if (index !== -1) this.children.splice(index, 1);
        this.firstChild = this.children[0] || null;
        return child;
      },
      setAttribute(name, value) {
        this.attributes[name] = String(value);
      },
      getAttribute(name) {
        return this.attributes[name] ?? null;
      },
    };
  }

  return { createElement: element };
}

function createDerivedApp(appShell, host) {
  const application = appShell.createApplicationDefinition({
    id: 'derived-proof',
    title: 'Derived Proof',
    navigation: { activeId: 'home' },
  });

  const state = {
    count: 0,
    status: 'ready',
  };

  function render(root) {
    appShell.clear(root);

    const heading = root.ownerDocument.createElement('h1');
    heading.textContent = application.title;
    root.appendChild(heading);

    const badge = appShell.createStatusBadge(state.status, 'ready');
    root.appendChild(badge);

    const list = root.ownerDocument.createElement('div');
    appShell.renderList(list, [
      { title: 'Owned by derived app', detail: 'Not Cockpit data' },
    ], (item) => appShell.createListItem(item.title, item.detail));
    root.appendChild(list);

    const detailTitle = root.ownerDocument.createElement('h2');
    const detailContent = root.ownerDocument.createElement('pre');
    appShell.renderDetail(detailTitle, detailContent, 'State', JSON.stringify(state));
    root.appendChild(detailTitle);
    root.appendChild(detailContent);
  }

  function increment() {
    state.count += 1;
    host.postMessage({
      type: 'derived-proof.increment',
      count: state.count,
    });
  }

  return Object.freeze({ application, state, render, increment });
}

test('derived app can use App Shell without importing Cockpit code', () => {
  const documentRef = makeDocument();
  const root = documentRef.createElement('main');
  root.ownerDocument = documentRef;

  const posted = [];
  const host = {
    postMessage(message) {
      posted.push(message);
    },
  };

  const shell = createAppShell(documentRef);
  const app = createDerivedApp(shell, host);

  assert.deepEqual(app.application, {
    id: 'derived-proof',
    title: 'Derived Proof',
    navigation: { activeId: 'home' },
  });

  app.render(root);

  assert.equal(root.children[0].textContent, 'Derived Proof');
  assert.equal(root.children[1].textContent, 'ready');
  assert.equal(root.children[2].children[0].children[0].textContent, 'Owned by derived app');
  assert.match(root.children[4].textContent, /"count":0/);

  app.increment();

  assert.equal(app.state.count, 1);
  assert.deepEqual(posted, [{
    type: 'derived-proof.increment',
    count: 1,
  }]);
});

test('derived app owns its state and host semantics rather than leaking them into App Shell', () => {
  const documentRef = makeDocument();
  const shell = createAppShell(documentRef);
  const app = createDerivedApp(shell, { postMessage() {} });

  assert.equal('state' in shell, false);
  assert.equal('host' in shell, false);
  assert.equal('CockpitState' in shell, false);
  assert.equal('cockpitHost' in shell, false);

  app.state.status = 'local-only';
  assert.equal(app.state.status, 'local-only');
});
