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
python -m pytest
```

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

Boundary summary:

- Cockpit is UX and operator control.
- DevXToolkit provides semantic commands and metadata that Cockpit can surface.
- eco provides governance, runtime contracts, policy, and run records.
- LSOE/LASSO handles internal logic and state orchestration; Cockpit only surfaces outputs.
- NEHI owns deterministic commit authority; Cockpit does not reason or commit by itself.
- HELM composes Cockpit with operator modes and LENS; Cockpit is not HELM.
