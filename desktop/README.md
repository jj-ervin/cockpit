# Cockpit Desktop

This directory packages Cockpit as a standalone Windows x64 Electron app.  It
hosts the existing Cockpit web bundle on loopback and calls a bundled local
`cockpit-bridge.exe`; it does not require VS Code or a Python installation on
the target machine.

## Build

Cockpit v1.0.0 ships as a per-user Windows x64 NSIS installer. It does not
request elevation and does not depend on a source checkout after installation.

From the Cockpit repository root, build the bridge and installer together:

```powershell
.\scripts\build-standalone.ps1
```

Then build the offline Windows x64 installer:

```powershell
Set-Location desktop
npm ci
npm run build:win
```

The release artifact is
`release\Cockpit-<version>-windows-x64-setup.exe`. Its payload
includes the Electron host, the Cockpit web bundle, the production Express
dependency, and the x64 bridge.

The installed app opens the current directory by default. Set
`COCKPIT_WORKSPACE` to an ordinary repository path when launching it from a
terminal or another desktop integration; packaged Electron does not accept
application-specific `--workspace` switches.

## Verification

Before publishing an artifact, run:

```powershell
npm run check
npm audit --omit=dev
```

Also run Cockpit's host-web and Python bridge tests.  The packaged bridge and
the unpacked Electron host must be smoke-tested without relying on the source
checkout.

The release-gating stranger exercise installs a copied artifact into a fresh
temporary per-user directory, opens an ordinary repository outside the
portfolio, waits for the real Electron shell and bundled bridge, verifies the
packaged resource paths and provider schemas, and removes the isolated proof:

```powershell
.\scripts\stranger-install-smoke.ps1
```

The desktop host remains a shell: Cockpit owns the future human-facing Marlin
setup wizard, while Marlin remains the installer, verifier, updater, and
repair engine.
