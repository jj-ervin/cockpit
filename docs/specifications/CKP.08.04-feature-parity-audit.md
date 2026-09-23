# CKP.08.04 Feature-Parity Audit

Status: HISTORICAL AUDIT / CLOSED BY LATER PASSes
Updated: 2026-09-23

**Current-state authority:** `docs/architecture/cockpit-current-state.md`

This audit is retained for lineage. Its earlier "recommended next step" and open-gap language predates CKP.08.05–CKP.08.10 and later hardening. Do not use those historical recommendations as current work without reconciliation against the PASS registry and current code.

## Scope

This audit compares the older embedded Cockpit implementation in
`eco/surfaces/vscode/eco-vs` with the extracted host-agnostic Cockpit bundle in
`cockpit/web` and the current `eco-vscode` host loader.

The audit does not restore missing features. It classifies parity gaps so the
next PASS can port the right capabilities onto the Cockpit adapter and
host-loader contracts instead of copying the old direct `.eco/` filesystem
implementation.

## Sources Reviewed

| Source | Role |
| --- | --- |
| `eco/surfaces/vscode/eco-vs/src/app/cockpit.ts` | Older embedded VS Code host bridge and action handlers |
| `eco/surfaces/vscode/eco-vs/src/webview/cockpit.html` | Older tabbed Cockpit UI |
| `eco/surfaces/vscode/eco-vs/src/webview/cockpit.js` | Older webview interaction logic |
| `eco/surfaces/vscode/eco-vs/src/webview/cockpit.css` | Older Cockpit visual system |
| `cockpit/src/cockpit/adapters/eco.py` | Current eco adapter read/write support |
| `cockpit/web/cockpit.html` | Extracted host-agnostic bundle markup |
| `cockpit/web/cockpit.js` | Extracted host-agnostic bundle logic |
| `cockpit/web/cockpit.css` | Extracted host-agnostic bundle styles |
| `eco-vscode/src/webviewHost.ts` | Current VS Code host loader and bridge relay |
| `eco-vscode/src/cockpitApi.ts` | Current Python bridge client |

## Current Extracted Bundle

`cockpit/web/` currently renders one read-only dashboard view:

- eight stat tiles: status, total runs, escalations, artifacts, health,
  `.eco` root, backend, workspace
- run-state-count list
- records-count list
- Marlin install-readiness panel
- one Refresh button

## Older eco-vs Surface

`eco/surfaces/vscode/eco-vs` renders a six-tab read/write operator interface:

- Run Record Viewer
- Escalation Queue
- Artifact Index
- PASS Run Launcher
- Policy Viewer
- Governance

It also includes live editor-plane sync.

## Summary

The extracted bundle is host-agnostic and correctly removes VS Code-only calls
from `cockpit/web`. That part of CKP.08 is working.

Feature parity is not complete, but most of the gap is UI-only. The current
Cockpit adapter/bridge already exposes the read and action contracts needed for
run records, escalation approval, artifact listing/open handoff, PASS run
submission, and policy updates. The true backend/architecture gaps are
artifact trash/restore, governance diagnostics as a modeled record, and live
editor-plane sync.

The correct restoration path is to port the seven UI-only panels first against
existing adapter calls, then handle the real backend gaps as smaller follow-on
PASSes. Do not port the old direct `.eco/` filesystem reads and writes into the
bundle.

## Gap Table

| eco-vs feature | Adapter support today | Gap type |
| --- | --- | --- |
| Run list plus detail pane with raw JSON view | `list_records("run")`, `get_record("run", id)` | UI-only |
| Copy run JSON to clipboard | `get_record("run", id)` plus host clipboard API | UI-only |
| Re-run a record | `submit("run", payload)`; required field names already match adapter contract | UI-only |
| Escalation queue plus approve/deny | `list_records("escalation")`, `approve(id, decision, reason)` | UI-only |
| Artifact index plus open in editor | `list_records("artifact")`; open is host-side editor API | UI-only |
| Delete / undo-delete artifact | No adapter method; CockpitAdapter has no delete/trash concept | Real backend gap |
| PASS Run Launcher form | `submit("run", payload)` | UI-only |
| Policy viewer/editor validate/save/revert/open | `list_records("policy")`, `update_record("policy", payload)` with validation | UI-only |
| Governance tab diagnostics/mode/health/issue table | No `EcoAdapter.RECORD_TYPES` entry; old implementation reads `governance-diagnostics.json`, `project.yaml`, `health-report.json` directly | Real backend gap |
| Editor-plane live sync | No equivalent; old model pushes on file change while bridge model is request/response | Real architectural gap |

## Findings

### Finding 1 — Operator feature parity is incomplete, but mostly UI-only

The old embedded panel was an operator console. The extracted bundle is currently
a bridge-backed dashboard plus Marlin readiness panel. It does not yet meet the
old CK.01 surface set: Run Record Viewer, Escalation Queue, Artifact Index, PASS
Run Launcher, and Policy Viewer.

Seven of the ten audited rows can be restored through UI and host-message wiring
against existing adapter calls. That makes the first restoration pass bounded and
low backend risk.

Severity: high for CKP.08 parity; moderate implementation risk.

### Finding 2 — Three gaps are real backend or architecture gaps

Artifact delete/trash, governance diagnostics, and editor-plane live sync are not
just missing markup. They need either adapter contract expansion or an explicit
architecture decision:

- Artifact delete/trash needs a delete or trash/restore contract.
- Governance diagnostics needs a modeled record type or adapter method.
- Editor-plane sync needs a polling-vs-streaming decision.

Severity: high for zero-trust portability.

### Finding 3 — Restore UI-only parity before backend expansion

The next work should not wait on the backend gaps. The UI-only features should be
ported first as one bounded single PASS:

- run list/detail/copy/rerun
- escalation queue approve/deny
- artifact list/open
- PASS run launcher
- policy viewer/editor

Severity: process improvement; recommended next step.

## Acceptance Position

CKP.08 extraction is structurally valid, but CKP.08 feature parity is open.

Do not mark the old `eco-vs` Cockpit panel superseded yet. Supersession should
wait until the extracted bundle plus host loader covers the CK.01 required
surfaces or explicitly documents replacements for each one.

## Update — 2026-07-02 — Supersession Gate Met (CKP.08.10)

All 5 CK.01 required surfaces (Run Record Viewer, Escalation Queue, Artifact
Index, PASS Run Launcher, Policy Viewer) plus `eco-vs`'s two extras
(Governance, editor-plane sync) are now covered by the extracted bundle and
`eco-vscode` host loader — `CKP.08.05` (UI-only port), `CKP.08.06` (artifact
trash/restore), `CKP.08.07` (governance diagnostics), `CKP.08.08` (editor-plane
sync via polling).

Verification behind this: `tsc --noEmit` clean, `npm run build` clean with
byte-identical bundle copy, Python 96/96 tests passing, plus a manual
Extension Development Host smoke test against `C:\dev\eco` (portfolio owner
confirmed 2026-07-02) — all tabs render, no console errors, Governance tab
degrades gracefully with no `governance-diagnostics.json` present in that
workspace. Not exhaustively verified: artifact delete/undo round-trip was not
explicitly confirmed to complete in that manual pass, and the Governance
tab's non-empty-data path (a workspace that actually has diagnostics) was
never exercised live. Recorded honestly as a residual gap, not a blocker to
this decision.

**Decision: `eco-vs`'s Cockpit panel is superseded.** Marked in
`eco/surfaces/vscode/eco-vs/src/app/cockpit.ts` and its webview files.
`eco-vscode/DEV-PLAN.md`'s Cockpit convergence note updated accordingly.
This does not affect `eco-vs`'s HELM or PASS surfaces, which are out of
scope for this audit and remain active.

## Recommended Next Step

`Single PASS — CKP.08.04a: UI-Only Operator Parity Port`

This should port the seven UI-only tabs/panels into the extracted bundle against
existing adapter calls. It is bounded and should not require backend contract
changes.

Follow-on single PASSes:

- `CKP.08.04b` — artifact trash/restore backend contract
- `CKP.08.04c` — governance diagnostics record type
- deferred architecture call — editor-plane sync polling vs streaming

Done for CKP.08.04a when the extracted bundle has the old operator tabs and uses
only host-agnostic rendering plus existing bridge/adapter calls.

## CKP.08.04a Implementation Note

Status: implemented
Updated: 2026-07-02

CKP.08.04a ports the seven UI-only parity surfaces into the extracted
`cockpit/web` bundle:

- dashboard with existing status, record counts, and Marlin install readiness
- run records table with detail pane, raw JSON, copy, and re-run actions
- escalation queue with approve/deny and decision reason
- artifact index with host-mediated open action only
- PASS run launcher form
- policy JSON viewer/editor with validate, save, revert, and open actions

The bundle remains host-agnostic. It still talks only through
`window.cockpitHost.postMessage()` and receives host messages through
`window.postMessage`. Clipboard, editor opening, bridge calls, and mutation
authority are owned by the host.

The VS Code host now relays these UI actions to the existing Cockpit adapter
contract:

- `get_record("run", id)` for copy and re-run seed data
- `submit("run", payload)` for re-run and launcher submission
- `approve(id, decision, reason)` for escalation decisions
- `update_record("policy", "policy", payload)` for policy saves
- VS Code clipboard and editor APIs for copy/open handoff

Zero-trust boundary: artifact and policy open actions are resolved by the host
and constrained to the active workspace. The web bundle does not perform direct
filesystem reads or writes, and this pass does not implement artifact
delete/trash, governance diagnostics, or editor-plane live sync.

Remaining follow-on work:

- `CKP.08.04b` — artifact trash/restore backend contract
- `CKP.08.04c` — governance diagnostics record type
- `CKP.08.06+` — editor-plane sync architecture decision and test harness

## Correction — 2026-07-02 — Letter-Suffixed Sub-Pass Names Never Registered

`CKP.08.04a`, `CKP.08.04b`, and `CKP.08.04c` above were used as informal names
before being registered, and are not valid `CLUSTER.NN.NN` identities per
DEV-ACCORD.02 (no letter suffixes, no three-level nesting under a sub-pass —
the same issue corrected for `CKP.05A`-`CKP.05D` earlier this session). Found
during a portfolio-wide dirty/sync scan, one turn after the citation-resolution
gate (`validate-pass-citations.ps1`, DEV-ACCORD-CI-41) was built specifically
to catch this failure class — the gate is not yet wired into this repo, and
its heading-pattern matcher does not yet recognize this repo's `## CKP.NN
Closure — Title` convention, so it would not have caught this even if it were.

Corrected identities (siblings under `CKP.08.00`, not nested under `CKP.08.04`):

| Informal name | Corrected identity |
| --- | --- |
| `CKP.08.04a` (UI-Only Operator Parity Port, implemented) | `CKP.08.05` |
| `CKP.08.04b` (Artifact Trash/Restore Backend Contract) | `CKP.08.06` |
| `CKP.08.04c` (Governance diagnostics record type, not yet started) | reserve `CKP.08.07` when started |

Both `CKP.08.05` and `CKP.08.06` are now registered in
`passes/passes.registry.json` with `legacy_ids` preserving the informal names
used above and in `DEV-PATH.md`/`DEV-PLAN.md`. Existing text elsewhere in this
document and those files is left as historical record, not rewritten.
