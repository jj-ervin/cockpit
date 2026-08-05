# Cockpit

Cockpit is eco's operator command surface: the place one person manages an eco
workspace, sees governance state, launches governed runs, reviews artifacts, and
approves escalations.

This standalone repo now owns the Phase 1 Python package boundary for Cockpit.
The VS Code host consumes that package through a read-only JSON bridge.

Current package surfaces:

- `src/cockpit/core/adapter.py` - adapter contract and result envelope
- `src/cockpit/adapters/eco.py` - eco workspace adapter
- `src/cockpit/adapters/marlin.py` - Marlin state adapter
- `src/cockpit/host_bridge.py` - `python -m cockpit.host_bridge` JSON host bridge

Marlin governance panel slice:

- `backend: "marlin"` + `record_type: "install-readiness"` returns a read-only
  preview of Cockpit Phase 1 install steps and an explicit `--apply` command for
  a human-approved host action.
- The bridge rejects attempts to pass `apply: true` through `install-readiness`.
  Package mutation stays outside the read-only panel query.

The governing specs and original implementation lineage include:

- `eco/passes/ck/CK.00.md` - Cockpit cluster header and scope boundary
- `eco/passes/ck/CK.01.md` - Cockpit v0.1 implementation spec
- `eco/passes/ck/CK.02.md` - eco.ui dependency and component binding
- `eco-vscode/src/cockpitApi.ts` - current VS Code host bridge client
- `eco-vscode/src/webview/cockpit.*` - current webview surface

Local verification:

```powershell
python -m venv .venv                   # cockpit-local venv - do not reuse another repo's venv
.venv\Scripts\Activate.ps1
pip install -e ".[test]"
python -m playwright install chromium  # one-time, needed for the web bundle smoke tests
python -m pytest
```

Cockpit must work regardless of which venv or platform runs it. Installing
into another repo's shared venv (e.g. running these commands with `eco`'s
`.venv` active instead of cockpit's own) works by accident but breaks the
"self-contained, portable" standard this portfolio holds every repo to -
always use a dedicated `cockpit/.venv`.

Phase 1 package install automation:

```powershell
cd C:\dev\cockpit
python -m cockpit.install_phase1 --workspace C:\dev\eco
python -m cockpit.install_phase1 --workspace C:\dev\eco --apply
```

After installation, the console entrypoint is also available:

```powershell
cockpit-install-phase1 --workspace C:\dev\eco --apply
```

The command previews by default. Use `--apply` to perform the editable package
install, tests, and bridge smoke.

VS Code host verification:

```powershell
cd C:\dev\eco-vscode
npm run build
code --new-window --extensionDevelopmentPath=C:\dev\eco-vscode C:\dev\eco --command eco.openCockpit
```

## Standalone Windows desktop

Cockpit v1.0.0's distributable SKU is a per-user Windows x64 NSIS installer.
It bundles Electron, the loopback Express host, the web UI, the frozen Cockpit
bridge, and the provider protocol schemas; it requires neither VS Code nor a
Python installation. Build and verify it from the repository root:

```powershell
.\scripts\build-standalone.ps1
.\scripts\stranger-install-smoke.ps1
```

The verifier copies the installer to an isolated temp directory, installs it
without elevation, opens an ordinary Git repository outside the portfolio,
waits for the real packaged shell and bridge, validates packaged resource
paths, then uninstalls and removes the proof. Set `COCKPIT_WORKSPACE` when
launching the installed app from a terminal or desktop integration to select a
repository; otherwise it opens the process working directory.

## Standalone web host (Phase 3)

`host-web/` implements `CKP.03`'s Phase 3 — a universal standalone shell, no
VS Code required. It's a plain Express server that serves the *same*
`web/cockpit.{html,css,js}` bundle used by the VS Code host (zero bundle
changes — that's the entire point of `docs/specifications/
CKP.08-host-loader-contract.md`, which already speced this exact shim) and
relays `eco.cockpit.*` messages to `python -m cockpit.host_bridge` over
plain HTTP instead of VS Code's `postMessage` channel.

```powershell
cd host-web
npm install
$env:COCKPIT_PYTHON = "C:\dev\cockpit\.venv\Scripts\python.exe"   # interpreter with cockpit installed
npm start -- --workspace C:\dev\your-eco-workspace                # or set WORKSPACE_ROOT
```

Open `http://localhost:4174`. This is a **local tool** (run it on your own
machine, point it at your own workspace) — not a hosted service. A genuinely
public multi-tenant version (strangers sharing a server) is a distinct,
much larger, deliberately-deferred future phase (**Phase 4** — see
`DEV-PATH.md`), not something this server attempts.

Three actions have no clean web equivalent and are honestly downgraded
rather than faked (see `host-web/actions.js`'s own doc comment for detail):
copying run JSON logs to the server console instead of a clipboard; opening
an artifact/policy file uses your OS default app instead of a VS Code editor
tab; installing a Marlin package declines with an explanatory message,
since there's no web equivalent to VS Code's native confirmation dialog and
skipping confirmation for a real package-mutating action would be a safety
regression, not just a missing nicety.

Boundary summary:

- Cockpit is UX and operator control.
- DevXToolkit provides semantic commands and metadata that Cockpit can surface.
- eco provides governance, runtime contracts, policy, and run records.
- LSOE/LASSO handles internal logic and state orchestration; Cockpit only surfaces outputs.
- NEHI owns deterministic commit authority; Cockpit does not reason or commit by itself.
- HELM composes Cockpit with operator modes and LENS; Cockpit is not HELM.
