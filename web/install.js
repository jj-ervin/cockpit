(function () {
  // Constrained install-mode bundle. Deliberately separate from cockpit.js:
  // no tab bar, no nav, no wizard, no unrelated panels -- this file must
  // never grow the ability to render any of that. Speaks the exact same
  // window.cockpitHost.postMessage / window.addEventListener('message', ...)
  // contract as the full shell (see CKP.08-host-loader-contract.md) so it
  // goes through the same host-web/actions.js dispatch cases -- marlin
  // remains the sole owner of resolve/install/checksum/attestation.
  //
  // Implements the Marlin One-Click Installer Template (marlin/DEV-RELEASE.md
  // "Marlin One-Click Installer Base Template") and the Installer Identity
  // Transition Model it promotes: Splash -> Authorization -> Location ->
  // Ready -> Progress -> Complete, with visual dominance shifting from
  // Marlin (splash/authorization) to the target package (location onward)
  // after the user explicitly authorizes. Window size/navigation stay
  // stable across the whole flow -- only branding and stage content change.
  const hasRealHost = Boolean(window.cockpitHost && typeof window.cockpitHost.postMessage === 'function');
  const host = hasRealHost ? window.cockpitHost : { postMessage: function () {} };

  const packageName = typeof window.__installIntent === 'string' ? window.__installIntent.trim() : '';

  const state = {
    stage: packageName ? 'splash' : 'no-target',
    resolved: null,
    error: '',
    installResult: null,
  };

  const elements = {
    badge: document.getElementById('brand-badge'),
    hero: document.getElementById('stage-hero'),
    title: document.getElementById('install-title'),
    subtitle: document.getElementById('install-subtitle'),
    heading: document.getElementById('install-heading'),
    body: document.getElementById('install-body'),
    metadata: document.getElementById('install-metadata'),
    note: document.getElementById('install-note'),
    details: document.getElementById('install-details'),
    detailsBody: document.getElementById('install-details-body'),
    progress: document.getElementById('install-progress'),
    actions: document.getElementById('install-actions'),
    footer: document.getElementById('install-footer'),
  };

  // Stages where the target package has not been authorized yet -- Marlin
  // is the only identity on screen. Every later stage belongs to the
  // package: it becomes visually dominant, and Marlin drops to quiet
  // footer attribution, never disappearing entirely and never co-branding
  // as an equal.
  const MARLIN_STAGES = new Set(['no-target', 'splash', 'resolve-error', 'authorization']);

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

  function appName() {
    const resolved = state.resolved || {};
    return displayName(resolved.name || packageName);
  }

  // The branding contract (marlin/DEV-RELEASE.md) names icon/avatar as a
  // package-supplied identity field with a required safe fallback.
  // marlin.package.resolve does not return one today, so the generic path
  // always falls back to a generated monogram, never a broken <img>.
  //
  // The Sealdex branch below is a PROOF-ONLY exception, not part of that
  // generic mechanism: it statically wires in the real Sealdex mark
  // (web/assets/sealdex-icon-64.png) purely to demonstrate the template
  // with a real asset instead of the monogram, because no backend field
  // carries package icons yet. It must never be generalized into an
  // "if packageName === X" branch for other packages -- the real fix is
  // the branding-contract icon field landing in marlin.package.resolve;
  // every other package keeps using the monogram fallback until then.
  function renderBadge(letter) {
    clear(elements.badge);
    elements.badge.classList.remove('is-sealdex-asset', 'is-marlin-asset');
    if (letter === 'S' && packageName === 'sealdex' && !MARLIN_STAGES.has(state.stage)) {
      elements.badge.classList.add('is-sealdex-asset');
      return;
    }
    // Marlin's own identity, unlike a package's, is never proof-only or
    // backend-supplied -- it's the template's permanent asset, used only
    // for the authorization moment (the "Install X?" query), not every
    // Marlin-dominant stage, so splash/resolve-error/no-target keep
    // showing the plain monogram.
    if (letter === 'M' && state.stage === 'authorization') {
      elements.badge.classList.add('is-marlin-asset');
      return;
    }
    elements.badge.textContent = letter;
  }

  // Trust-indicator metadata shared by the Authorization and Ready stages.
  // Marlin owns every field rendered here (checksum/source/attestation
  // signal) -- the package never supplies or overrides these.
  function renderMetadata(resolved) {
    clear(elements.metadata);
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
  }

  function renderBundledFallbackWarning(resolved) {
    if (resolved.source !== 'bundled-fallback') return;
    elements.note.hidden = false;
    elements.note.className = 'install-note is-error';
    elements.note.textContent = 'Hosted registry was not used for this resolution — this package/version may be stale.';
  }

  function render() {
    const isAppStage = !MARLIN_STAGES.has(state.stage);
    document.body.classList.toggle('identity-marlin', !isAppStage);
    document.body.classList.toggle('identity-app', isAppStage);

    clear(elements.metadata);
    clear(elements.actions);
    elements.heading.hidden = true;
    elements.body.hidden = true;
    elements.note.hidden = true;
    elements.note.className = 'install-note';
    elements.details.hidden = true;
    elements.progress.hidden = true;
    elements.hero.hidden = true;
    elements.footer.textContent = '';

    if (state.stage === 'no-target') {
      renderBadge('M');
      document.title = 'Marlin';
      elements.title.textContent = 'Marlin';
      elements.subtitle.textContent = 'No package was specified for this installer.';
      elements.note.hidden = false;
      elements.note.className = 'install-note is-error';
      elements.note.textContent = 'This installer was launched without a target package.';
      elements.actions.appendChild(button('Close', closeWindow));
      return;
    }

    if (state.stage === 'splash') {
      renderBadge('M');
      document.title = 'Marlin';
      elements.title.textContent = 'Marlin';
      elements.subtitle.textContent = 'Preparing ' + displayName(packageName) + '…';
      elements.progress.hidden = false;
      elements.actions.appendChild(button('Cancel', closeWindow, { secondary: true }));
      return;
    }

    if (state.stage === 'resolve-error') {
      renderBadge('M');
      document.title = 'Marlin';
      elements.title.textContent = 'Marlin';
      elements.subtitle.textContent = 'Could not find ' + displayName(packageName) + '.';
      elements.note.hidden = false;
      elements.note.className = 'install-note is-error';
      elements.note.textContent = state.error || 'Resolve failed.';
      elements.actions.appendChild(button('Close', closeWindow));
      return;
    }

    if (state.stage === 'authorization') {
      const resolved = state.resolved || {};
      renderBadge('M');
      document.title = 'Install ' + appName() + '?';
      elements.title.textContent = 'Marlin';
      elements.subtitle.textContent = 'Ready to guide your install.';

      elements.heading.hidden = false;
      elements.heading.textContent = 'Install ' + appName() + '?';
      elements.body.hidden = false;
      elements.body.textContent = 'Marlin will guide the installation of ' + appName()
        + (resolved.version ? ' ' + resolved.version : '') + '.';

      renderMetadata(resolved);
      renderBundledFallbackWarning(resolved);

      elements.actions.appendChild(button('Cancel', closeWindow, { secondary: true }));
      elements.actions.appendChild(button('Continue', function () {
        state.stage = 'location';
        render();
      }));
      return;
    }

    if (state.stage === 'location') {
      const resolved = state.resolved || {};
      renderBadge(appName().charAt(0));
      document.title = 'Install ' + appName();
      elements.title.textContent = appName();
      elements.subtitle.textContent = String(resolved.version || '-')
        + (resolved.description ? ' — ' + resolved.description : '');

      // The app's one "grand entrance" moment, shown once on Location --
      // the first Sealdex-dominant stage -- and never again, mirroring
      // the Marlin bootstrap wizard's own one-time splash hero. Statically
      // scoped to Sealdex, same as renderBadge()'s asset branch: not the
      // generic branding-contract mechanism, and never generalized into a
      // per-packageName lookup.
      if (packageName === 'sealdex') {
        elements.hero.hidden = false;
        elements.hero.src = 'assets/sealdex-installer-header-dark.png';
        elements.hero.alt = appName();
      }

      elements.heading.hidden = false;
      elements.heading.textContent = 'Install location';
      elements.body.hidden = false;
      // No location picker: the installer engine (marlin.package.install)
      // does not accept a custom install path today, so this stage
      // discloses the fixed destination rather than offering a control
      // that would not do anything -- an install-time choice only
      // belongs in this wizard once the backend actually accepts it.
      elements.body.textContent = appName() + ' installs into Marlin’s managed package location. '
        + 'Custom install locations are not available for one-click package installs.';

      elements.footer.textContent = 'Guided by Marlin';
      elements.actions.appendChild(button('Cancel', closeWindow, { secondary: true }));
      elements.actions.appendChild(button('Next', function () {
        state.stage = 'ready';
        render();
      }));
      return;
    }

    if (state.stage === 'ready' || state.stage === 'progress') {
      const resolved = state.resolved || {};
      renderBadge(appName().charAt(0));
      document.title = 'Install ' + appName();
      elements.title.textContent = appName();
      elements.subtitle.textContent = String(resolved.version || '-')
        + (resolved.description ? ' — ' + resolved.description : '');

      if (state.stage === 'progress') {
        elements.heading.hidden = false;
        elements.heading.textContent = 'Installing ' + appName() + '…';
        elements.progress.hidden = false;
        elements.footer.textContent = 'Guided by Marlin';
        elements.actions.appendChild(button('Installing…', function () {}, { disabled: true }));
        return;
      }

      elements.heading.hidden = false;
      elements.heading.textContent = 'Ready to install';
      renderMetadata(resolved);
      renderBundledFallbackWarning(resolved);
      elements.footer.textContent = 'Guided by Marlin';

      elements.actions.appendChild(button('Cancel', closeWindow, { secondary: true }));
      elements.actions.appendChild(button('Install', function () {
        state.stage = 'progress';
        render();
        post({ type: 'eco.cockpit.marlinInstallPackage', packageName: packageName, confirm: true });
      }));
      return;
    }

    if (state.stage === 'install-error') {
      renderBadge(appName().charAt(0));
      document.title = 'Install ' + appName();
      elements.title.textContent = appName();
      elements.subtitle.textContent = 'Install failed.';
      elements.heading.hidden = false;
      elements.heading.textContent = 'Install failed';
      elements.note.hidden = false;
      elements.note.className = 'install-note is-error';
      elements.note.textContent = state.error || 'Install failed.';
      elements.footer.textContent = 'Guided by Marlin';
      elements.actions.appendChild(button('Close', closeWindow));
      return;
    }

    if (state.stage === 'complete') {
      const result = state.installResult || {};
      const pkg = result.package || {};
      const resolved = state.resolved || {};
      renderBadge(appName().charAt(0));
      document.title = appName() + ' installed';
      elements.title.textContent = appName();
      elements.subtitle.textContent = String(pkg.version || resolved.version || '') + ' installed.';

      elements.heading.hidden = false;
      elements.heading.textContent = appName() + ' installed successfully';
      elements.note.hidden = false;
      elements.note.className = 'install-note is-success';
      elements.note.textContent = 'Install complete.';

      elements.details.hidden = false;
      elements.detailsBody.textContent = JSON.stringify(result, null, 2);

      elements.footer.textContent = 'Installed with Marlin';

      // "Open <package>" would only ever appear when the install actually
      // registered a launch target (InstalledPackage.bins) AND a host
      // action to launch it exists -- neither is true for any package
      // today, so it never renders. "Open Cockpit" is always a real
      // destination and is the only affirmative option offered. "Finish"
      // (not "Close") because this is the successful-completion stage --
      // it only ever appears after a real install succeeded.
      const hasLaunchTarget = Array.isArray(pkg.bins) && pkg.bins.length > 0;
      void hasLaunchTarget; // reserved for a future per-package launch action
      elements.actions.appendChild(button('Open Cockpit', openCockpit, { secondary: true }));
      elements.actions.appendChild(button('Finish', closeWindow));
      return;
    }
  }

  window.addEventListener('message', function (event) {
    const message = event.data;
    if (!message || typeof message.type !== 'string') return;

    if (message.type === 'eco.cockpit.marlinPackageResolveResult') {
      const payload = message.payload || {};
      if (payload.ok === false) {
        state.stage = 'resolve-error';
        state.error = payload.error || 'Resolve failed.';
      } else {
        state.stage = 'authorization';
        state.resolved = payload;
        state.error = '';
      }
      render();
      return;
    }

    if (message.type === 'eco.cockpit.marlinInstallResult') {
      const payload = message.payload || {};
      if (payload.ok === false) {
        state.stage = 'install-error';
        state.error = payload.error || 'Install failed.';
      } else {
        state.stage = 'complete';
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
      // leaves the UI stuck on "Preparing…"/"Installing…" forever. Only
      // the resolve (stage 'splash') and install (stage 'progress')
      // requests are ever in flight, so the current stage unambiguously
      // identifies which one this error belongs to.
      const payload = message.payload || {};
      state.stage = state.stage === 'progress' ? 'install-error' : 'resolve-error';
      state.error = payload.message || 'Host error.';
      render();
    }
  });

  render();

  if (packageName) {
    post({ type: 'eco.cockpit.marlinResolvePackage', packageName: packageName });
  }
})();
