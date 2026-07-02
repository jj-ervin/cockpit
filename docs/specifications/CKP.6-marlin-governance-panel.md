# CKP.6 Marlin Governance Panel

Status: active slice
Updated: 2026-07-01

## Scope

CKP.6 is Cockpit's Marlin governance panel. The first slice is install
readiness for Cockpit Phase 1 package automation.

This slice is read-only. It lets a host display what would run before any
package mutation is allowed.

## Bridge Query

Request:

```json
{
  "backend": "marlin",
  "operation": "list_records",
  "record_type": "install-readiness",
  "filters": {
    "project_root": "C:\\dev\\cockpit",
    "workspace": "C:\\dev\\eco",
    "python": "python"
  }
}
```

Response data contains one record:

- `id: phase1`
- `panel: marlin-governance`
- `kind: cockpit-phase1-install`
- `mode: preview`
- `requires_human_apply: true`
- `mutation_allowed_from_bridge: false`
- `preview_steps`: install, pytest, and bridge-smoke command previews
- `apply_command`: explicit `python -m cockpit.install_phase1 ... --apply --json`

## Safety Rules

- `install-readiness` never runs package mutation.
- `apply: true` or `mode: apply` in filters is rejected.
- The returned `apply_command` is an approval artifact for the host. A future UI
  button may run it only after explicit human approval.
- This slice does not expose Marlin package install, update, remove, policy edit,
  run submission, or escalation approval.

## Done Criteria

- Marlin adapter returns install-readiness preview.
- Host bridge exposes the preview through `list_records`.
- Host bridge rejects apply attempts through the read-only query.
- Tests cover adapter and bridge behavior.

## VS Code Host Slice

The first host implementation lives in `eco-vscode`.

The Cockpit webview renders:

- readiness status
- previewed install/test/bridge-smoke steps
- the explicit apply command
- a disabled Apply button
- approval copy explaining that package mutation requires a separate human
  approval execution path

The VS Code host does not run the apply command in this slice.
