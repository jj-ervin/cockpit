(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory;
  } else {
    root.AppShell = factory(root.document);
  }
}(typeof window !== 'undefined' ? window : globalThis, function createAppShell(documentRef) {
  if (!documentRef || typeof documentRef.createElement !== 'function') {
    throw new TypeError('AppShell requires a DOM document');
  }

  function clear(element) {
    while (element.firstChild) element.removeChild(element.firstChild);
    return element;
  }

  function emptyDiv(message) {
    const element = documentRef.createElement('div');
    element.className = 'empty-state';
    element.textContent = String(message || '');
    return element;
  }

  function showNotice(element, message, options) {
    const config = options || {};
    element.textContent = String(message || '');
    element.classList.toggle('is-error', config.kind === 'error');
    return element;
  }

  function createApplicationDefinition(definition) {
    const source = definition || {};
    const navigation = source.navigation || {};
    return Object.freeze({
      id: String(source.id || ''),
      title: String(source.title || ''),
      navigation: Object.freeze({
        activeId: String(navigation.activeId || ''),
      }),
    });
  }

  function setActiveTab(buttons, panels, application) {
    const definition = application || {};
    const navigation = definition.navigation || {};
    const target = String(navigation.activeId || '');
    buttons.forEach(function (button) {
      button.classList.toggle('is-active', button.getAttribute('data-tab') === target);
    });
    panels.forEach(function (panel) {
      panel.classList.toggle('is-active', panel.id === target);
    });
  }

  function renderList(container, items, renderItem, emptyMessage) {
    clear(container);
    const values = Array.isArray(items) ? items : [];
    if (!values.length) {
      if (emptyMessage) {
        container.appendChild(emptyDiv(emptyMessage));
      }
      return container;
    }
    const renderer = typeof renderItem === 'function'
      ? renderItem
      : function (item) {
        const row = documentRef.createElement('div');
        const value = documentRef.createElement('span');
        let text;
        if (item === null || item === undefined) {
          text = '';
        } else if (typeof item === 'object') {
          try {
            text = JSON.stringify(item);
          } catch (error) {
            text = String(item);
          }
        } else {
          text = String(item);
        }
        row.className = 'item';
        value.textContent = text;
        row.appendChild(value);
        return row;
      };
    values.forEach(function (item, index) {
      container.appendChild(renderer(item, index));
    });
    return container;
  }

  function createPanel(title, content) {
    const panel = documentRef.createElement('section');
    panel.className = 'panel';
    const header = documentRef.createElement('div');
    header.className = 'panel-header';
    const heading = documentRef.createElement('h2');
    heading.textContent = String(title || '');
    header.appendChild(heading);
    panel.appendChild(header);
    if (content) panel.appendChild(content);
    return panel;
  }

  function createStatusBadge(label, state) {
    const badge = documentRef.createElement('strong');
    badge.className = 'connection-badge';
    badge.textContent = String(label || '');
    if (state) badge.dataset.state = String(state);
    return badge;
  }

  function emptyTableRow(colspan, message) {
    const row = documentRef.createElement('tr');
    const cell = documentRef.createElement('td');
    cell.colSpan = Number(colspan) || 1;
    cell.textContent = String(message || '');
    row.appendChild(cell);
    return row;
  }

  function emptyItem(message) {
    const item = documentRef.createElement('div');
    item.className = 'item';
    item.textContent = String(message || '');
    return item;
  }

  function createListItem(title, detail) {
    const item = documentRef.createElement('div');
    const heading = documentRef.createElement('strong');
    const description = documentRef.createElement('span');
    item.className = 'item';
    heading.textContent = String(title || '');
    description.textContent = String(detail || '');
    item.appendChild(heading);
    if (detail) item.appendChild(description);
    return item;
  }
  function createCommandItem(title, commandId, action, input, badge) {
    const item = documentRef.createElement('article');
    const heading = documentRef.createElement('strong');
    const id = documentRef.createElement('code');
    const actionText = documentRef.createElement('small');
    const inputText = documentRef.createElement('small');
    const status = documentRef.createElement('span');
    item.className = 'command-palette-item';
    heading.textContent = String(title || '');
    id.textContent = String(commandId || '');
    actionText.textContent = String(action || '');
    inputText.textContent = String(input || '');
    status.className = 'command-palette-badge';
    status.textContent = String(badge || '');
    item.appendChild(heading);
    item.appendChild(id);
    item.appendChild(actionText);
    item.appendChild(inputText);
    item.appendChild(status);
    return item;
  }


  function metadataRow(label, value) {
    const row = documentRef.createElement('div');
    const dt = documentRef.createElement('dt');
    const dd = documentRef.createElement('dd');
    dt.textContent = String(label || '');
    dd.textContent = String(value);
    row.appendChild(dt);
    row.appendChild(dd);
    return row;
  }

  function cell(value) {
    const td = documentRef.createElement('td');
    td.textContent = String(value);
    return td;
  }

  function renderDetail(titleElement, contentElement, title, content) {
    titleElement.textContent = String(title || '');
    contentElement.textContent = String(content || '');
    return { titleElement, contentElement };
  }

  function option(value, label) {
    const item = documentRef.createElement('option');
    item.value = String(value);
    item.textContent = String(label || '');
    return item;
  }

  return Object.freeze({
    clear,
    emptyDiv,
    showNotice,
    setActiveTab,
    createApplicationDefinition,
    renderList,
    createPanel,
    createStatusBadge,
    emptyTableRow,
    emptyItem,
    createListItem,
    createCommandItem,
    metadataRow,
    cell,
    option,
    renderDetail,
  });
}));
