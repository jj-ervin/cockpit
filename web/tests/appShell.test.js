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
    'cell',
    'clear',
    'createPanel',
    'createStatusBadge',
    'emptyDiv',
    'emptyItem',
    'emptyTableRow',
    'metadataRow',
    'option',
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

test('renderList default renderer is generic and does not interpret title/detail fields', () => {
  const documentRef = makeDocument();
  const shell = createAppShell(documentRef);
  const container = documentRef.createElement('div');

  shell.renderList(container, [{ title: 'Domain title', detail: 'Domain detail' }, 'plain']);
  assert.equal(container.children.length, 2);
  assert.equal(container.children[0].children[0].textContent, '{"title":"Domain title","detail":"Domain detail"}');
  assert.equal(container.children[1].children[0].textContent, 'plain');
});

test('renderList passes item metadata unchanged to an explicit renderer', () => {
  const documentRef = makeDocument();
  const shell = createAppShell(documentRef);
  const container = documentRef.createElement('div');
  const metadata = { id: 'command.example', title: 'Example', parameters: { mode: 'safe' } };
  let receivedItem;
  let receivedIndex;

  shell.renderList(container, [metadata], (item, index) => {
    receivedItem = item;
    receivedIndex = index;
    return documentRef.createElement('div');
  });

  assert.equal(receivedItem, metadata);
  assert.equal(receivedIndex, 0);
});

test('renderList ignores a renderer when the list is empty and uses the empty state when supplied', () => {
  const documentRef = makeDocument();
  const shell = createAppShell(documentRef);
  const container = documentRef.createElement('div');
  let rendererCalled = false;

  shell.renderList(container, [], () => {
    rendererCalled = true;
    return documentRef.createElement('div');
  }, 'No commands');

  assert.equal(rendererCalled, false);
  assert.equal(container.children.length, 1);
  assert.equal(container.children[0].className, 'empty-state');
  assert.equal(container.children[0].textContent, 'No commands');

  shell.renderList(container, []);
  assert.equal(container.children.length, 0);
});

test('createStatusBadge renders injected status data without domain semantics', () => {
  const documentRef = makeDocument();
  const shell = createAppShell(documentRef);
  const badge = shell.createStatusBadge('Host connected', 'live');

  assert.equal(badge.tagName, 'strong');
  assert.equal(badge.className, 'connection-badge');
  assert.equal(badge.textContent, 'Host connected');
  assert.equal(badge.dataset.state, 'live');
});

test('generic presentation primitives render injected values', () => {
  const documentRef = makeDocument();
  const shell = createAppShell(documentRef);

  const tableRow = shell.emptyTableRow(3, 'No rows');
  assert.equal(tableRow.tagName, 'tr');
  assert.equal(tableRow.children[0].colSpan, 3);
  assert.equal(tableRow.children[0].textContent, 'No rows');

  const item = shell.emptyItem('Nothing here');
  assert.equal(item.className, 'item');
  assert.equal(item.textContent, 'Nothing here');

  const metadata = shell.metadataRow('Status', 42);
  assert.equal(metadata.children[0].textContent, 'Status');
  assert.equal(metadata.children[1].textContent, '42');

  const tableCell = shell.cell(42);
  assert.equal(tableCell.tagName, 'td');
  assert.equal(tableCell.textContent, '42');

  const selectOption = shell.option('safe', 'Safe mode');
  assert.equal(selectOption.value, 'safe');
  assert.equal(selectOption.textContent, 'Safe mode');
});
