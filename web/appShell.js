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

  function setActiveTab(buttons, panels, tabId) {
    const target = String(tabId || '');
    buttons.forEach(function (button) {
      button.classList.toggle('is-active', button.getAttribute('data-tab') === target);
    });
    panels.forEach(function (panel) {
      panel.classList.toggle('is-active', panel.id === target);
    });
  }

  function renderList(container, items, renderItem) {
    clear(container);
    (Array.isArray(items) ? items : []).forEach(function (item, index) {
      container.appendChild(renderItem(item, index));
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

  return Object.freeze({
    clear,
    emptyDiv,
    showNotice,
    setActiveTab,
    renderList,
    createPanel,
    createStatusBadge,
  });
}));
