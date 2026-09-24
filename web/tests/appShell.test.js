const test = require('node:test');
const assert = require('node:assert/strict');

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

const createAppShell = require('../appShell.js');

test('App Shell primitives expose a small generic surface', () => {
  const shell = createAppShell(makeDocument());
  assert.deepEqual(Object.keys(shell).sort(), [
    'clear',
    'createPanel',
    'createStatusBadge',
    'emptyDiv',
    'renderList',
    'setActiveTab',
    'showNotice',
  ]);
});

test('clear removes existing children without owning application semantics', () => {
  const documentRef = makeDocument();
  const shell = createAppShell(documentRef);
  const container = documentRef.createElement('div');
  container.appendChild(documentRef.createElement('p'));
  shell.clear(container);
  assert.equal(container.children.length, 0);
});

test('generic presentation primitives render supplied data only', () => {
  const documentRef = makeDocument();
  const shell = createAppShell(documentRef);
  const empty = shell.emptyDiv('Nothing here');
  assert.equal(empty.className, 'empty-state');
  assert.equal(empty.textContent, 'Nothing here');

  const notice = documentRef.createElement('div');
  shell.showNotice(notice, 'Failed', { kind: 'error' });
  assert.equal(notice.textContent, 'Failed');
  assert.equal(notice.classList.contains('is-error'), true);

  const badge = shell.createStatusBadge('Connected', 'live');
  assert.equal(badge.textContent, 'Connected');
  assert.equal(badge.dataset.state, 'live');

  const panel = shell.createPanel('Example');
  assert.equal(panel.className, 'panel');
  assert.equal(panel.children[0].children[0].textContent, 'Example');
});

test('navigation primitive changes presentation state only', () => {
  const documentRef = makeDocument();
  const shell = createAppShell(documentRef);
  const buttons = ['one', 'two'].map((id) => {
    const button = documentRef.createElement('button');
    button.setAttribute('data-tab', id);
    return button;
  });
  const panels = ['one', 'two'].map((id) => {
    const panel = documentRef.createElement('section');
    panel.id = id;
    return panel;
  });

  shell.setActiveTab(buttons, panels, 'two');
  assert.equal(buttons[0].classList.contains('is-active'), false);
  assert.equal(buttons[1].classList.contains('is-active'), true);
  assert.equal(panels[0].classList.contains('is-active'), false);
  assert.equal(panels[1].classList.contains('is-active'), true);
});

test('renderList delegates item rendering and does not interpret domain data', () => {
  const documentRef = makeDocument();
  const shell = createAppShell(documentRef);
  const container = documentRef.createElement('div');
  shell.renderList(container, ['a', 'b'], (value) => {
    const item = documentRef.createElement('div');
    item.textContent = value;
    return item;
  });
  assert.deepEqual(container.children.map((item) => item.textContent), ['a', 'b']);

  shell.renderList(container, [], () => documentRef.createElement('div'), 'Nothing here');
  assert.equal(container.children.length, 1);
  assert.equal(container.children[0].className, 'empty-state');
  assert.equal(container.children[0].textContent, 'Nothing here');
});
