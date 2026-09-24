const test = require('node:test');
const assert = require('node:assert/strict');

const createCockpitApplication = require('../cockpitApplication');

test('Cockpit application adapter supplies only Cockpit-owned identity and navigation', () => {
  const calls = [];
  const appShell = {
    createApplicationDefinition(definition) {
      calls.push(definition);
      return Object.freeze(definition);
    },
  };

  const adapter = createCockpitApplication(appShell);
  const definition = adapter.createApplicationDefinition('runs');

  assert.deepEqual(calls, [{
    id: 'cockpit',
    title: 'Cockpit',
    navigation: { activeId: 'runs' },
  }]);
  assert.deepEqual(definition, {
    id: 'cockpit',
    title: 'Cockpit',
    navigation: { activeId: 'runs' },
  });
  assert.equal('tabs' in definition, false);
});

test('Cockpit application adapter does not own the tab inventory', () => {
  const appShell = {
    createApplicationDefinition(definition) {
      return definition;
    },
  };
  const adapter = createCockpitApplication(appShell);
  const definition = adapter.createApplicationDefinition('dashboard');

  assert.equal(Object.prototype.hasOwnProperty.call(definition, 'tabs'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(definition, 'panels'), false);
});
