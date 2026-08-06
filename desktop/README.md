# Cockpit Desktop

This directory packages the Windows x64 Electron runtime consumed by Marlin.
It hosts the existing Cockpit web bundle on loopback and calls a bundled local
`cockpit-bridge.exe`; it does not require VS Code or a Python installation on
the target machine.

## Build

Cockpit v1.0.0 does not ship its own installer. This build emits an unpacked
runtime that is zipped as `cockpit-core`; MarlinSetup is the only bootstrap
installer and Marlin is the package authority.

From the Cockpit repository root, build the bridge and installer together:

```powershell
.\scripts\build-marlin-payload.ps1
```

The release payload is
`dist\marlin\cockpit-core-1.0.0-windows-{x64|arm64}.zip`. It includes the
architecture-matched Electron host, Cockpit web bundle, production Express
dependency, and frozen bridge. Build ARM64 with
`..\scripts\build-marlin-payload.ps1 -Architecture arm64`; the script rejects
an interpreter, bridge, or Electron executable whose PE machine type does not
match the requested architecture.

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

The release gate copies and installs MarlinSetup, then verifies Marlin's
checksum, managed package state, install directory, and Cockpit launch against
an ordinary repository outside the portfolio:

```powershell
.\scripts\stranger-install-smoke.ps1 -SandboxRoot C:\sandbox
```

The desktop host remains a shell. MarlinSetup owns bootstrap; Cockpit owns the
human-facing app-management experience after bootstrap; Marlin remains the
installer, verifier, updater, and repair engine.
