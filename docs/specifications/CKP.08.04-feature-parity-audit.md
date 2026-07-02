# CKP.08.04 Feature-Parity Audit

Status: active audit
Updated: 2026-07-02

## Scope

This audit compares the older embedded Cockpit implementation in
`eco/surfaces/vscode/eco-vs` with the extracted host-agnostic Cockpit bundle in
`cockpit/web` and the current `eco-vscode` host loader.

The audit does not restore missing features. It classifies parity gaps so the
next compound PASS can port the right capabilities onto the Cockpit adapter and
host-loader contracts instead of copying the old direct `.eco/` filesystem
implementation.

## Sources Reviewed

| Source | Role |
| --- | --- |
| `eco/surfaces/vscode/eco-vs/src/app/cockpit.ts` | Older embedded VS Code host bridge and action handlers |
| `eco/surfaces/vscode/eco-vs/src/webview/cockpit.html` | Older tabbed Cockpit UI |
| `eco/surfaces/vscode/eco-vs/src/webview/cockpit.js` | Older webview interaction logic |
| `eco/surfaces/vscode/eco-vs/src/webview/cockpit.css` | Older Cockpit visual system |
| `cockpit/web/cockpit.html` | Extracted host-agnostic bundle markup |
| `cockpit/web/cockpit.js` | Extracted host-agnostic bundle logic |
| `cockpit/web/cockpit.css` | Extracted host-agnostic bundle styles |
| `eco-vscode/src/webviewHost.ts` | Current VS Code host loader and bridge relay |
| `eco-vscode/src/cockpitApi.ts` | Current Python bridge client |

## Summary

The extracted bundle is host-agnostic and correctly removes VS Code-only calls
from `cockpit/web`. That part of CKP.08 is working.

Feature parity is not complete. The current extracted bundle is closer to a
dashboard/readiness view than the older embedded Cockpit operator panel. The
largest missing class is not visual polish; it is action parity. The old
`eco-vs` implementation includes run submission, escalation approval, artifact
open/delete/undo, policy edit/save/revert, and record copy/rerun actions. The
current extracted bundle deliberately does not expose those write paths.

The correct restoration path is to add governed adapter/bridge operations and
host-mediated approval gates, then render the richer UI against those contracts.
Do not port the old direct `.eco/` filesystem reads and writes into the bundle.

## Parity Matrix

| Capability | Older `eco-vs` implementation | Extracted bundle / `eco-vscode` host | Status | Next action |
| --- | --- | --- | --- | --- |
| Host-agnostic rendering | VS Code-specific webview; `acquireVsCodeApi()` inside bundled JS | `cockpit/web` uses `window.cockpitHost.postMessage`; VS Code-specific call is isolated in host loader | parity improved | Keep contract; test with headless DOM harness |
| Workspace health/status | Status text and run-state updates | Status grid with health, `.eco` root, backend, workspace | partial parity | Add richer state labels if needed |
| Run state counts | Fixed summary cards for pending/validating/executing/escalated/complete/failed | Dynamic Run State Counts list | parity | Keep dynamic list |
| Run record viewer | Tabbed table with filter, selected row, JSON details, copy JSON, rerun | Record count summary only; no run table or details | missing | Add run table/detail view backed by adapter records |
| Escalation queue | Shows escalated runs with approve/deny/comment actions | Escalation count only | missing | Add read model first, then approval action gate |
| Artifact index | Artifact table with open/delete/undo actions | Artifact count only | missing | Add artifact table; keep destructive actions host-approved |
| PASS run launcher | Form submits pass name, artifact type, objective through runtime runner | Not present | missing | Add governed submit operation after adapter contract exists |
| Policy viewer/editor | Loads policy JSON, validates, saves, reverts, opens in editor | Not present | missing | Add read-only policy view first; gate writes separately |
| Governance diagnostics | Mode, health, error/warning counts, hash status, issue table | Not present in bundle; eco-vscode still has diagnostics elsewhere | missing in Cockpit | Add diagnostics record type or host snapshot field |
| Editor-plane sync | Active PASS, run state, governance state badges | Not present | missing | Add to host snapshot after source-of-truth contract is decided |
| HELM mode display | HELM mode pill and mode activation message | Not present | deferred | Restore only when HELM bridge contract is active |
| Marlin install readiness | Not present | Present: readiness status, preview steps, explicit apply command, disabled apply button | new capability | Keep; next add approval execution path |
| Direct filesystem mutation | Old host directly reads/writes `.eco` files and artifacts | Bundle is read-only; bridge enforces read-only for current exposed operations | intentionally changed | Preserve zero-trust boundary |
| CSP/packaging | VS Code-local assets | Host-loader contract plus copied `out/webview` bundle | parity improved | Add package-time parity check |

## Findings

### Finding 1 — Operator feature parity is incomplete

The old embedded panel was an operator console. The extracted bundle is currently
a bridge-backed dashboard plus Marlin readiness panel. It does not yet meet the
old CK.01 surface set: Run Record Viewer, Escalation Queue, Artifact Index, PASS
Run Launcher, and Policy Viewer.

Severity: high for CKP.08 parity; not a blocker for host-agnostic extraction.

### Finding 2 — Missing features should not be restored by copying old host code

The old `eco-vs` host owns direct filesystem reads/writes, artifact mutation,
policy writes, and runtime calls. Copying that into `cockpit/web` would violate
the CKP.08 host-agnostic boundary. Restoration should happen through Cockpit
adapter methods and explicit host-mediated action gates.

Severity: high for zero-trust portability.

### Finding 3 — CKP.08 needs a compound parity-restoration PASS

The next work should not be one micro-PLAY per feature. The missing parity items
cluster naturally into a compound PASS:

- read-model restoration: runs, escalations, artifacts, policy, diagnostics
- UI restoration: tabs/tables/details using host-agnostic rendering
- action-gate restoration: copy/rerun/approve/deny/open/delete/save/submit
- tests: bundle DOM tests, bridge contract tests, VS Code build smoke
- docs/release: mark old `eco-vs` Cockpit superseded only after parity reaches
  the accepted threshold

Severity: process improvement; recommended next step.

## Acceptance Position

CKP.08 extraction is structurally valid, but CKP.08 feature parity is open.

Do not mark the old `eco-vs` Cockpit panel superseded yet. Supersession should
wait until the extracted bundle plus host loader covers the CK.01 required
surfaces or explicitly documents replacements for each one.

## Recommended Next Compound PASS

`CKP.08.10 — Compound PASS: Operator Parity Restoration`

Suggested sub-PASS lanes:

| Lane | Scope | Primary repo |
| --- | --- | --- |
| `CKP.08.11` | Run record table, filter, selected JSON detail, copy command surface | `cockpit`, `eco-vscode` |
| `CKP.08.12` | Escalation queue read model and guarded approve/deny UX | `cockpit`, `eco-vscode` |
| `CKP.08.13` | Artifact index read model and guarded open/delete/undo UX | `cockpit`, `eco-vscode` |
| `CKP.08.14` | Policy viewer/editor read model, validation, guarded save/revert/open | `cockpit`, `eco-vscode` |
| `CKP.08.15` | Governance diagnostics and editor-plane sync restoration | `cockpit`, `eco-vscode` |
| `CKP.08.16` | Headless bundle DOM tests and packaged host-loader parity checks | `cockpit`, `eco-vscode` |

Done when the extracted bundle can replace the old `eco-vs` Cockpit panel for
the CK.01 required surfaces without direct bundle-level filesystem or VS Code
API dependencies.
