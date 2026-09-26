(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.CockpitParameterInteraction = factory;
}(typeof window !== 'undefined' ? window : globalThis, function createParameterInteraction(schema) {
  const source = schema && typeof schema === 'object' && !Array.isArray(schema) ? schema : {};

  function fields() {
    if (source.type !== 'object' || !Array.isArray(source.fields)) return [];
    return source.fields
      .filter((field) => field && typeof field.id === 'string' && field.id.trim())
      .map((field) => Object.freeze({
        id: field.id,
        label: typeof field.label === 'string' && field.label.trim() ? field.label : field.id,
        type: typeof field.type === 'string' ? field.type : 'string',
        required: field.required === true,
        options: Array.isArray(field.options) ? Object.freeze(field.options.slice()) : undefined,
        default: field.default,
      }));
  }

  function validate(values) {
    const input = values && typeof values === 'object' && !Array.isArray(values) ? values : {};
    const declared = fields();
    const byId = new Map(declared.map((field) => [field.id, field]));
    const errors = [];

    for (const field of declared) {
      const value = input[field.id];
      if (value === undefined || value === null || value === '') {
        if (field.required) errors.push({ field: field.id, error: 'required' });
        continue;
      }
      if (!matchesType(value, field.type)) {
        errors.push({ field: field.id, error: 'invalid-type' });
        continue;
      }
      if (field.options && !field.options.some((option) => option === value)) {
        errors.push({ field: field.id, error: 'invalid-option' });
      }
    }

    for (const key of Object.keys(input)) {
      if (!byId.has(key)) errors.push({ field: key, error: 'undeclared-parameter' });
    }

    return errors.length ? { ok: false, errors } : { ok: true, parameters: Object.freeze({ ...input }) };
  }

  function matchesType(value, type) {
    if (type === 'string') return typeof value === 'string';
    if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
    if (type === 'boolean') return typeof value === 'boolean';
    return false;
  }

  return Object.freeze({ fields, validate });
}));