(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.CockpitCommandReview = factory;
}(typeof window !== 'undefined' ? window : globalThis, function createCommandReview() {
  function review(request, parameters) {
    if (!request || request.ok !== true) return { ok: false, error: 'command-not-interpreted' };
    const input = parameters && typeof parameters === 'object' && !Array.isArray(parameters) ? parameters : {};
    return Object.freeze({ ok: true, providerId: request.providerId, commandId: request.commandId, parameters: Object.freeze({ ...input }), requiresConfirmation: request.requiresConfirmation === true, approved: false });
  }
  function approve(reviewed) {
    if (!reviewed || reviewed.ok !== true) throw new TypeError('CommandReview.approve requires a reviewed command');
    return Object.freeze({ ...reviewed, approved: true });
  }
  return Object.freeze({ review, approve });
}));