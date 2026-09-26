(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory;
  } else {
    root.CockpitCatalogResolver = factory;
  }
}(typeof window !== 'undefined' ? window : globalThis, function createCatalogResolver(catalog) {
  const source = catalog || {};

  function resolve(input) {
    const raw = String(input == null ? '' : input).trim();
    if (!raw || !Array.isArray(source.providers)) return null;

    for (const provider of source.providers) {
      if (!provider || typeof provider.id !== 'string' || !Array.isArray(provider.commands)) continue;
      for (const command of provider.commands) {
        if (!command || typeof command.id !== 'string') continue;
        if (command.id === raw) {
          return {
            providerId: provider.id,
            commandId: command.id,
            parameters: {},
            requiresConfirmation: command.requires_confirmation === true || command.mutation === true,
            ...(command.input && typeof command.input === 'object' && !Array.isArray(command.input)
              ? { parameterSchema: command.input }
              : {}),
          };
        }
      }
    }

    return null;
  }

  return Object.freeze({ resolve });
}));