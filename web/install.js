(function () {
  // Constrained install-mode bundle. Deliberately separate from cockpit.js:
  // no tab bar, no nav, no wizard, no unrelated panels -- this file must
  // never grow the ability to render any of that. Speaks the exact same
  // window.cockpitHost.postMessage / window.addEventListener('message', ...)
  // contract as the full shell (see CKP.08-host-loader-contract.md) so it
  // goes through the same host-web/actions.js dispatch cases -- marlin
  // remains the sole owner of resolve/install/checksum/attestation.
  const hasRealHost = Boolean(window.cockpitHost && typeof window.cockpitHost.postMessage === 'function');
  const host = hasRealHost ? window.cockpitHost : { postMessage: function () {} };

  const packageName = typeof window.__installIntent === 'string' ? window.__installIntent.trim() : '';

  const state = {
    status: packageName ? 'resolving' : 'no-target',
    resolved: null,
    error: '',
    installResult: null,
  };

  const elements = {
    title: document.getElementById('install-title'),
    subtitle: document.getElementById('install-subtitle'),
    metadata: document.getElementById('install-metadata'),
    note: document.getElementById('install-note'),
    details: document.getElementById('install-details'),
    detailsBody: document.getElementById('install-details-body'),
    actions: document.getElementById('install-actions'),
  };

  function displayName(name) {
    return name ? name.charAt(0).toUpperCase() + name.slice(1) : 'Package';
  }

  function post(message) {
    host.postMessage(message);
  }

  function clear(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function metadataRow(label, value) {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    return [dt, dd];
  }

  function button(label, handler, opts) {
    opts = opts || {};
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    if (opts.secondary) b.className = 'secondary';
    if (opts.disabled) b.disabled = true;
    b.addEventListener('click', handler);
    return b;
  }

  // Window-chrome actions (close this window, hand off to the full shell)
  // are not provider/backend actions -- they go through a dedicated,
  // narrowly-scoped preload (installPreload.cjs), never through
  // cockpitHost. Falls back to window.close() for the standalone web host
  // and tests, where no Electron window owns this page.
  function closeWindow() {
    if (window.installControls && typeof window.installControls.closeWindow === 'function') {
      window.installControls.closeWindow();
    } else {
      window.close();
    }
  }

  function openCockpit() {
    if (window.installControls && typeof window.installControls.openCockpit === 'function') {
      window.installControls.openCockpit();
    } else {
      window.close();
    }
  }

  function render() {
    const title = 'Install ' + displayName(packageName);
    document.title = title;
    elements.title.textContent = title;

    clear(elements.metadata);
    clear(elements.actions);
    elements.note.hidden = true;
    elements.note.className = 'install-note';
    elements.details.hidden = true;

    if (state.status === 'no-target') {
      elements.subtitle.textContent = 'No package was specified for this installer.';
      elements.note.hidden = false;
      elements.note.className = 'install-note is-error';
      elements.note.textContent = 'This installer was launched without a target package.';
      elements.actions.appendChild(button('Close', closeWindow));
      return;
    }

    if (state.status === 'resolving') {
      elements.subtitle.textContent = 'Looking up ' + packageName + '…';
      elements.actions.appendChild(button('Cancel', closeWindow, { secondary: true }));
      return;
    }

    if (state.status === 'resolve-error') {
      elements.subtitle.textContent = 'Could not find ' + packageName + '.';
      elements.note.hidden = false;
      elements.note.className = 'install-note is-error';
      elements.note.textContent = state.error || 'Resolve failed.';
      elements.actions.appendChild(button('Close', closeWindow));
      return;
    }

    if (state.status === 'ready' || state.status === 'installing') {
      const resolved = state.resolved || {};
      elements.subtitle.textContent = String(resolved.version || '-')
        + (resolved.description ? ' — ' + resolved.description : '');

      elements.metadata.append(...metadataRow('Package', String(resolved.name || packageName)));
      elements.metadata.append(...metadataRow('Version', String(resolved.version || '-')));
      elements.metadata.append(...metadataRow('Source', String(resolved.source || 'unknown')));
      if (resolved.source === 'bundled-fallback' && resolved.fallback_reason) {
        elements.metadata.append(...metadataRow('Fallback reason', String(resolved.fallback_reason)));
      }
      const checksum = resolved.checksum;
      elements.metadata.append(...metadataRow(
        'Checksum',
        checksum && checksum.value ? (checksum.algorithm || 'sha256') + ':' + checksum.value : 'not declared',
      ));
      elements.metadata.append(...metadataRow('Cockpit provider', resolved.has_provider ? 'yes' : 'no'));

      if (resolved.source === 'bundled-fallback') {
        elements.note.hidden = false;
        elements.note.className = 'install-note is-error';
        elements.note.textContent = 'Hosted registry was not used for this resolution — this package/version may be stale.';
      }

      if (state.status === 'installing') {
        elements.actions.appendChild(button('Installing…', function () {}, { disabled: true }));
      } else {
        elements.actions.appendChild(button('Cancel', closeWindow, { secondary: true }));
        elements.actions.appendChild(button('Install', function () {
          state.status = 'installing';
          render();
          post({ type: 'eco.cockpit.marlinInstallPackage', packageName: packageName, confirm: true });
        }));
      }
      return;
    }

    if (state.status === 'install-error') {
      elements.subtitle.textContent = 'Install failed.';
      elements.note.hidden = false;
      elements.note.className = 'install-note is-error';
      elements.note.textContent = state.error || 'Install failed.';
      elements.actions.appendChild(button('Close', closeWindow));
      return;
    }

    if (state.status === 'installed') {
      const result = state.installResult || {};
      const pkg = result.package || {};
      const resolved = state.resolved || {};
      elements.subtitle.textContent = displayName(packageName) + ' ' + String(pkg.version || resolved.version || '') + ' installed.';
      elements.note.hidden = false;
      elements.note.className = 'install-note is-success';
      elements.note.textContent = 'Install complete.';

      elements.details.hidden = false;
      elements.detailsBody.textContent = JSON.stringify(result, null, 2);

      // "Open <package>" would only ever appear when the install actually
      // registered a launch target (InstalledPackage.bins) AND a host
      // action to launch it exists -- neither is true for any package
      // today, so it never renders. "Open Cockpit" is always a real
      // destination and is the only affirmative option offered.
      const hasLaunchTarget = Array.isArray(pkg.bins) && pkg.bins.length > 0;
      void hasLaunchTarget; // reserved for a future per-package launch action
      elements.actions.appendChild(button('Open Cockpit', openCockpit));
      elements.actions.appendChild(button('Close', closeWindow, { secondary: true }));
      return;
    }
  }

  window.addEventListener('message', function (event) {
    const message = event.data;
    if (!message || typeof message.type !== 'string') return;

    if (message.type === 'eco.cockpit.marlinPackageResolveResult') {
      const payload = message.payload || {};
      if (payload.ok === false) {
        state.status = 'resolve-error';
        state.error = payload.error || 'Resolve failed.';
      } else {
        state.status = 'ready';
        state.resolved = payload;
        state.error = '';
      }
      render();
      return;
    }

    if (message.type === 'eco.cockpit.marlinInstallResult') {
      const payload = message.payload || {};
      if (payload.ok === false) {
        state.status = 'install-error';
        state.error = payload.error || 'Install failed.';
      } else {
        state.status = 'installed';
        state.installResult = payload;
        state.error = '';
      }
      render();
      return;
    }

    if (message.type === 'eco.cockpit.error' || message.type === 'eco.cockpit.actionResult') {
      // A thrown error (network failure, provider crash, registration
      // fault) surfaces as one of these generic host-level messages rather
      // than the typed resolve/install result -- e.g. host-web/actions.js's
      // outer try/catch wraps any exception from the bridge call as
      // actionResult(false, ...), not marlinPackageResolveResult/
      // marlinInstallResult. Without handling both here, a thrown error
      // leaves the UI stuck on "Looking up..."/"Installing..." forever.
      const payload = message.payload || {};
      state.status = state.status === 'installing' ? 'install-error' : 'resolve-error';
      state.error = payload.message || 'Host error.';
      render();
    }
  });

  render();

  if (packageName) {
    post({ type: 'eco.cockpit.marlinResolvePackage', packageName: packageName });
  }
})();
