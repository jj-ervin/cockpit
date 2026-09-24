(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory;
  } else {
    root.CockpitApplication = factory(root.AppShell);
  }
}(typeof window !== 'undefined' ? window : globalThis, function createCockpitApplication(appShell) {
  if (!appShell || typeof appShell.createApplicationDefinition !== 'function') {
    throw new TypeError('CockpitApplication requires AppShell');
  }

  function createApplicationDefinition(activeId) {
    return appShell.createApplicationDefinition({
      id: 'cockpit',
      title: 'Cockpit',
      navigation: {
        activeId: activeId,
      },
    });
  }

  return Object.freeze({
    createApplicationDefinition,
  });
}));
