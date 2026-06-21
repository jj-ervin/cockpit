# Cockpit

Cockpit is eco's operator command surface: the place one person manages an eco
workspace, sees governance state, launches governed runs, reviews artifacts, and
approves escalations.

This standalone repo is currently a scaffold for packaging Cockpit as its own
installable product. The live implementation and governing specs currently live
in the eco repo:

- `eco/passes/ck/CK.00.md` - Cockpit cluster header and scope boundary
- `eco/passes/ck/CK.01.md` - Cockpit v0.1 implementation spec
- `eco/passes/ck/CK.02.md` - eco.ui dependency and component binding
- `eco/surfaces/vscode/eco-vs/src/app/cockpit.ts` - current VS Code host bridge
- `eco/surfaces/vscode/eco-vs/src/webview/cockpit.*` - current webview surface
- `eco/src/cockpit/` - Python backend support modules

Boundary summary:

- Cockpit is UX and operator control.
- DevXToolkit provides semantic commands and metadata that Cockpit can surface.
- eco provides governance, runtime contracts, policy, and run records.
- LSOE/LASSO handles internal logic and state orchestration; Cockpit only surfaces outputs.
- NEHI owns deterministic commit authority; Cockpit does not reason or commit by itself.
- HELM composes Cockpit with operator modes and LENS; Cockpit is not HELM.
