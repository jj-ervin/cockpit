# Cockpit Desktop

This directory packages Cockpit as a standalone Windows x64 Electron app.  It
hosts the existing Cockpit web bundle on loopback and calls a bundled local
`cockpit-bridge.exe`; it does not require VS Code or a Python installation on
the target machine.

## Build

From the Cockpit repository root, create the local bridge first:

```powershell
.\.venv\Scripts\python.exe -m pip install -e ".[package]"
.\.venv\Scripts\pyinstaller.exe cockpit-bridge.spec --noconfirm
```

Then build the offline Windows x64 installer:

```powershell
Set-Location desktop
npm ci
npm run build:win
```

The release artifact is `release\Cockpit Setup <version>.exe`.  Its payload
includes the Electron host, the Cockpit web bundle, the production Express
dependency, and the x64 bridge.

## Verification

Before publishing an artifact, run:

```powershell
npm run check
npm audit --omit=dev
```

Also run Cockpit's host-web and Python bridge tests.  The packaged bridge and
the unpacked Electron host must be smoke-tested without relying on the source
checkout.

The desktop host remains a shell: Cockpit owns the future human-facing Marlin
setup wizard, while Marlin remains the installer, verifier, updater, and
repair engine.
