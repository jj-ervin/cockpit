# CKP.06 Demo Flow

Status: ready  
Updated: 2026-07-01

## Purpose

CKP.06 defines the first product-positioning demo for Cockpit as a VS Code-hosted,
bridge-backed operator surface over an eco-governed workspace.

## Demo Setup

Workspace:

```text
C:\dev\eco
```

Extension host:

```powershell
cd C:\dev\eco-vscode
npm run build
code --new-window --extensionDevelopmentPath=C:\dev\eco-vscode C:\dev\eco --command eco.openCockpit
```

Optional bridge check:

```powershell
eco: Cockpit Bridge Health
```

Expected bridge report:

- status: OK
- backend: eco
- health: ok
- total runs: matches `.eco/runs/*.json`

## Screenshot Sequence

### 1. Cockpit Opens In VS Code

Show `eco: Open Cockpit` loaded inside an Extension Development Host.

Required visible signals:

- window title includes Extension Development Host
- tab title is `eco Cockpit`
- page title is `Workspace Governance`

### 2. Workspace Detection

Show top cards:

- `Status`: `Detected`
- `Health`: `ok`
- `.eco Root`: `yes`

### 3. Run State Summary

Show `Total Runs` and `Run State Counts`.

For the current `C:\dev\eco` smoke workspace, the verified bridge output was:

```json
{"health":"ok","totalRuns":3,"runs":3,"backend":"eco"}
```

### 4. Records Surface

Show the records count panel:

- runs
- escalations
- artifacts
- policies

The point of this screenshot is not visual polish; it proves the webview is consuming
the Python package adapter boundary.

## Caption

Recommended caption:

> Cockpit running in the VS Code Extension Development Host, backed by the Phase 1
> Python adapter bridge against an eco-governed workspace.

## Demo Boundaries

Do not claim:

- Cockpit executes runs.
- Cockpit owns governance authority.
- Cockpit edits policy.
- Cockpit is standalone Electron yet.

Do claim:

- Cockpit hosts the operator surface.
- The VS Code host consumes the Cockpit Python package API.
- Adapter provenance flows from Python to the webview.
- The current bridge is intentionally read-only.

## Captured Proof

Local verification screenshots from 2026-07-01:

- `C:\dev\_tmp\cockpit-devhost-exact-window.png`
- `C:\dev\_tmp\cockpit-devhost-clean-full.png`

These are temporary proof artifacts, not release assets.
