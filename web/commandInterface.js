(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory;
  } else {
    root.CockpitCommandInterface = factory;
  }
}(typeof window !== 'undefined' ? window : globalThis, function createCommandInterface(options) {
  const config = options || {};
  if (!config.host || typeof config.host.postMessage !== 'function') {
    throw new TypeError('CommandInterface requires a host adapter');
  }
  if (typeof config.resolve !== 'function') {
    throw new TypeError('CommandInterface requires an input resolver');
  }

  function interpret(input) {
    const raw = String(input == null ? '' : input).trim();
    if (!raw) return { ok: false, error: 'empty-input' };

    const resolved = config.resolve(raw);
    if (!resolved || !resolved.providerId || !resolved.commandId) {
      return { ok: false, error: 'command-not-found', input: raw };
    }

    return {
      ok: true,
      input: raw,
      providerId: String(resolved.providerId),
      commandId: String(resolved.commandId),
      parameters: resolved.parameters === undefined ? {} : resolved.parameters,
      requiresConfirmation: resolved.requiresConfirmation === true,
    };
  }

  function invoke(request) {
    if (!request || request.ok !== true) {
      throw new TypeError('CommandInterface.invoke requires an interpreted command');
    }

    const message = {
      type: 'eco.cockpit.invokeProviderCommand',
      providerId: request.providerId,
      commandId: request.commandId,
      input: request.parameters,
      confirm: request.requiresConfirmation === true,
    };

    config.host.postMessage(message);
    return message;
  }

  function submit(input) {
    const request = interpret(input);
    if (!request.ok) return request;
    return {
      ok: true,
      request,
      message: invoke(request),
    };
  }

  return Object.freeze({ interpret, invoke, submit });
}));
