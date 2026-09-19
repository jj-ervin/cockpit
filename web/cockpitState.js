(function () {
  'use strict';

  /**
   * Cockpit operational state boundary.
   *
   * The GUI may read this store and subscribe to changes. It must update
   * operational state through set/replace rather than keeping a second
   * authoritative state object in rendering code.
   */
  function clone(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
  }

  function createCockpitState(initial) {
    const seed = initial || {};
    let revision = Number.isInteger(seed.revision) && seed.revision >= 0 ? seed.revision : 0;
    let current = {
      schema_version: 'cockpit-state-v1',
      revision,
      snapshot: clone(seed.snapshot || {}),
      ui: {
        selectedRunId: '',
        runFilter: 'all',
        wizardStep: 0,
        ...(clone(seed.ui || {})),
      },
    };
    const listeners = new Set();

    function emit() {
      const snapshot = clone(current);
      listeners.forEach((listener) => listener(snapshot));
      return snapshot;
    }

    return {
      get() {
        return clone(current);
      },

      set(patch) {
        const next = patch || {};
        revision += 1;
        current = {
          ...current,
          ...clone(next),
          revision,
          ui: {
            ...current.ui,
            ...(clone(next.ui || {})),
          },
        };
        return emit();
      },

      replaceSnapshot(snapshot) {
        revision += 1;
        current = {
          ...current,
          revision,
          snapshot: clone(snapshot || {}),
        };
        return emit();
      },

      setUi(patch) {
        return this.set({ ui: patch || {} });
      },

      subscribe(listener) {
        if (typeof listener !== 'function') {
          throw new TypeError('Cockpit state subscriber must be a function');
        }
        listeners.add(listener);
        return function unsubscribe() {
          listeners.delete(listener);
        };
      },
    };
  }

  window.CockpitState = Object.freeze({
    create: createCockpitState,
  });
}());
