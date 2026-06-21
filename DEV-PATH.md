# DEV-PATH - Cockpit

**Status:** ACTIVE PRODUCT DIRECTION / STANDALONE REPO SCAFFOLD
**Updated:** 2026-06-21
**Authority:** CK.00, CK.01, CK.02 in `C:\dev\eco`

---

## Purpose

This file preserves Cockpit's recovered scope so the project does not drift into
"TBD" again.

Cockpit is an original eco product surface: the operator-facing command surface for
one person managing one eco workspace.

---

## Recovered Lineage

### DevXToolkit lineage

DevXToolkit v1 defined the semantic foundation for a PowerShell cockpit:

- ergonomic aliases
- canonical PowerShell functions
- minimal semantic grammar
- metadata registry
- templates
- introspection commands

The DevXToolkit integration contract is:

```text
Toolkit = semantics
Cockpit = UX
```

Cockpit consumes DevXToolkit command metadata, grammar, templates, structured
results, and diagnostics. It does not replace DevXToolkit.

### eco governance lineage

eco formalized Cockpit under the CK cluster:

- CK.00 - Cockpit cluster header and modularity boundary
- CK.01 - Cockpit v0.1 implementation spec
- CK.02 - eco.ui dependency and component binding

Archived eco development paths also record Cockpit as Phase 3 work:

- CK.00 written
- CK.01 written
- Cockpit TypeScript/webview implementation completed in eco.vs
- Cockpit Python backend support added under `eco/src/cockpit/`
- Cockpit live proof opened the panel in VS Code

### Current implementation locations

| Location | Role |
| --- | --- |
| `eco/surfaces/vscode/eco-vs/src/app/cockpit.ts` | VS Code host bridge and message handling |
| `eco/surfaces/vscode/eco-vs/src/webview/cockpit.html` | Cockpit webview markup |
| `eco/surfaces/vscode/eco-vs/src/webview/cockpit.css` | Cockpit webview styling |
| `eco/surfaces/vscode/eco-vs/src/webview/cockpit.js` | Cockpit webview client logic |
| `eco/src/cockpit/` | Python backend support modules |
| `eco/tests/test_cockpit_backend.py` | Backend coverage |
| `eco/tests/test_vscode_*` | VS Code integration coverage touching Cockpit paths |

---

## Canonical Scope

Cockpit is:

- the personal workspace hub
- the command surface
- the run lifecycle monitor
- the escalation approval surface
- the artifact browser
- the policy viewer/editor
- the diagnostics dashboard
- the UX layer over eco runtime/governance state

Cockpit is not:

- a multi-agent portal
- a reasoning engine
- an execution kernel
- an adaptive operator station
- a field operations surface
- DevXToolkit itself

---

## Routing Rule

| Need | Owner |
| --- | --- |
| One person, one workspace, personal operational control | Cockpit |
| Semantic commands, metadata, templates, PowerShell tooling | DevXToolkit |
| Governed execution, policy, run records | eco runtime |
| Deterministic commit authority | NEHI |
| Internal logic/state orchestration | LSOE / legacy LASSO |
| Adaptive operator mode and personality rendering | HELM + LENS |
| Field/physical operations | JAEGER / vertical surfaces |

---

## Phase History

### Phase 0 - Original Cockpit Concept

Cockpit began as the UX/control surface sitting above DevXToolkit's semantic command
layer.

Recovered source:

- `dxp-org/devxtoolkit-v1-x/docs/architecture/DevXToolkit-V1.0-ImplementationPlan.md`

### Phase 1 - eco CK Formalization

eco wrote the CK cluster:

| PASS | Meaning |
| --- | --- |
| CK.00 | Cockpit command/control surface header and boundary |
| CK.01 | v0.1 WebviewPanel implementation spec |
| CK.02 | eco.ui token/component binding |

### Phase 2 - Embedded eco Implementation

Cockpit was implemented inside the eco VS Code extension path and backend support
modules.

This phase proved the surface but did not package `C:\dev\cockpit` as an independent
repo.

### Phase 3 - Standalone Repo Normalization

Current phase.

Goal: make `C:\dev\cockpit` the packaging and product home without losing the CK
governance lineage or duplicating eco internals.

---

## Task Registry

| ID | Task | Status | Source |
| --- | --- | --- | --- |
| CKP-P0-01 | Recover Cockpit product scope into standalone docs | done | CK.00/CK.01/CK.02 + DevXToolkit |
| CKP-P0-02 | Inventory eco implementation files and test coverage | planned | eco Track B |
| CKP-P0-03 | Decide extraction/packaging boundary | planned | eco Track B B.2-02 |
| CKP-P1-01 | Define Cockpit public API and extension points | planned | cockpit-ui-spec |
| CKP-P1-02 | Define standalone install/demo path | planned | release packaging |
| CKP-P1-03 | Define screenshots and product positioning | planned | product readiness |

---

## Anti-Drift Rules

1. Do not call Cockpit "TBD" while CK.00/CK.01/CK.02 exist.
2. Do not infer that an empty standalone repo means there is no Cockpit scope.
3. Do not move eco runtime, NEHI, LSOE, HELM, or DevXToolkit responsibilities into Cockpit.
4. Do not write a conflicting Cockpit spec; amend the CK cluster instead.
5. Do not package Cockpit until the eco implementation inventory is complete.

---

## Next Validation

Before implementation work in this repo:

- compare eco Cockpit implementation against CK.01/CK.02
- list files to extract or wrap
- decide package form
- keep `projects.yaml` pointed at these docs
- keep eco Track B as the release/SKU source until standalone packaging is real
