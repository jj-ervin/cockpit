# DEV-PLAN — Cockpit

**AUTHORITY LEVEL: AL:1**
**Status:** SCAFFOLD / ACTIVE PRODUCT DIRECTION
**Updated:** 2026-06-21
**Authority:** CK.00, CK.01, CK.02 in `C:\dev\eco`

---

## Canonical Doc Rule

`DEV-PLAN.md` owns the current product scope, active milestones, and release targets
for the standalone Cockpit repo.

`DEV-PATH.md` owns recovered lineage, decisions, source pointers, and normalization
history.

The eco repo remains the governing source for CK PASSes until Cockpit is packaged as
its own installable product.

---

## Current Position

Cockpit is not a vague UI idea. It is eco's personal workspace command surface and
operator control plane.

The current implementation exists inside eco as:

- VS Code WebviewPanel host and bridge
- Cockpit webview HTML/CSS/JS
- Python backend support modules
- CK.00/CK.01/CK.02 governance specs

The standalone `C:\dev\cockpit` repo is the future packaging home. It should not invent
a new scope. It should extract and package the already-governed Cockpit surface from eco.

---

## Product Definition

Cockpit is where one operator manages one eco workspace.

Cockpit provides:

- run lifecycle monitoring
- PASS run launching
- escalation approval
- artifact browsing
- policy visibility and editing
- diagnostics and validation status
- environment setup and readiness views
- integration surfaces for DevXToolkit, eco.vs, HELM, and eco runtime records

Cockpit is the external product/interface name.

CK/CKPT are internal governance and primitive names used inside eco architecture.

---

## Boundaries

Cockpit owns:

- operator-facing UX
- command surface composition
- dashboard, panel, editor, inspector, validator, and log views
- display of runtime, governance, metadata, diagnostics, and artifact state
- human-in-the-loop approval UI
- extension points for views, panels, validators, inspectors, and logs

Cockpit does not own:

- runtime execution, owned by eco RT
- deterministic commit authority, owned by NEHI
- internal logic/state orchestration, owned by LSOE/legacy LASSO
- adaptive operator mode behavior, owned by HELM
- personality/rendering layer, owned by LENS under HELM
- DevXToolkit semantic command implementation
- eco.vs marketplace packaging except where Cockpit is embedded as a panel

---

## Source Of Truth

| Source | Role |
| --- | --- |
| `eco/passes/ck/CK.00.md` | Cockpit cluster header, purpose, boundaries, invariants |
| `eco/passes/ck/CK.01.md` | v0.1 implementation surfaces and runtime bridge |
| `eco/passes/ck/CK.02.md` | eco.ui dependency and component binding |
| `eco/docs/specifications/cockpit-ui-spec.md` | broader UI/primitive spec and version ladder |
| `eco/tracks/TRACK-B.md` | Cockpit SKU packaging track |
| `dxp-org/devxtoolkit-v1-x/docs/architecture/DevXToolkit-V1.0-ImplementationPlan.md` | DevXToolkit/Cockpit/ELAN lineage and integration contract |

---

## Release Targets

| Target | Description | Status |
| --- | --- | --- |
| CKP.0 | Recover standalone Cockpit planning docs | Done |
| CKP.1 | Inventory current eco Cockpit implementation and gaps | Planned |
| CKP.2 | Package Cockpit as an installable standalone module/SKU | Planned |
| CKP.3 | Embed Cockpit cleanly in eco.vs sidebar/panel flow | Planned |
| CKP.4 | Wire HELM mode integration against Cockpit state | Planned |
| CKP.5 | Define standalone plugin/extension contract | Planned |

---

## V0.1 Required Surfaces

These are inherited from CK.00/CK.01 and must remain the v0.1 baseline:

| Surface | Purpose | Current source |
| --- | --- | --- |
| Run Record Viewer | Inspect `.eco/runs/*.json`, state, artifacts, logs | eco CK.01 |
| Escalation Queue | Approve or deny human-gated runs | eco CK.01 |
| Artifact Index | Browse `.eco/artifacts/` and open records | eco CK.01 |
| PASS Run Launcher | Submit governed run requests | eco CK.01 |
| Policy Viewer | Inspect and edit `.eco/policy.json` through validation | eco CK.01 |

---

## Product Ladder

| Version | Responsibility |
| --- | --- |
| v0.1 | VS Code Cockpit panel; five CK.01 surfaces; workspace-local governance |
| v1.0 | Environment emergence UI, diagnostics dashboard, Quick-Bar, mode switching, setup wizard |
| v2.0 | Developer OS controls, multi-agent orchestration console display, workspace graph, profile management |
| v3.0 | Semantic workspace controls, semantic search/diff/template workflows, AI-augmented diagnostics |
| v4.0 | Full developer OS shell, enterprise-grade identity and automation orchestration surfaces |

---

## Immediate Work

| ID | Task | Priority | Status |
| --- | --- | --- | --- |
| CKP.01 | Add standalone planning docs | P0 | Done |
| CKP.02 | Audit current eco Cockpit files against CK.01 and CK.02 | P0 | Done - correction pass applied in eco |
| CKP.03 | Decide extraction shape: package, extension module, or standalone app shell | P0 | Planned |
| CKP.04 | Define public API surface for Cockpit consumers | P1 | Planned |
| CKP.05 | Produce packaging checklist for Track B B.2-02 | P1 | Planned |
| CKP.06 | Define screenshots/demo flow for product positioning | P1 | Planned |

---

## CKP.03 Decision — Extraction Shape

**Decided:** 2026-06-26

Cockpit ships in three sequential forms, each building on the previous:

| Phase | Form | What it is |
| --- | --- | --- |
| 1 | Python package | Core adapter logic, data models, backend API surface — installable via pip, no UI dependency |
| 2 | VS Code extension module | Wraps the Python package; adds WebviewPanel UI host and VS Code bridge |
| 3 | Universal standalone shell | Electron or web app host; no VS Code dependency; same adapter API as phases 1 and 2 |

**Dependency rule:** Phase 2 depends on Phase 1. Phase 3 depends on Phase 1. Phase 2 and Phase 3 are parallel consumers of the same Python package API.

**Consequence for CKP.04:** The public API surface must be defined against the Python package boundary first. VS Code bridge and standalone shell are adapters on top of it, not separate APIs.

**Consequence for CKP.05:** There will be three packaging checklists — one per form — produced in phase order.

**Platform targets:** Windows, Linux, and macOS are all Phase 3 build targets. Python package and VS Code extension inherit cross-platform from their respective runtimes. Standalone shell uses Electron; explicit platform build targets declared in CKP.05 round 3.

---

## Phase 1 API Constraint — Multi-Agent-Capable Adapter Interface

**Decided:** 2026-06-26  
**Applies to:** CKP.04 and all adapter implementations

Every backend adapter in the Python package must accept a workspace/node identifier as a first-class parameter. No adapter may assume a single workspace.

**Rule:** `adapter.query(backend, workspace_id, ...)` — not `adapter.query(backend, ...)`

**Why:** Phase 1 operates single-workspace. v2.0 multi-agent orchestration passes multiple workspace/node identifiers to the same adapters without API change. Retrofitting this after Phase 1 ships breaks consumers.

**Consequence:** The adapter interface is multi-agent-capable from day one, even though the Phase 1 host only connects to one workspace at a time. v2.0 adds fleet aggregation at the host layer, not the adapter layer.

---

## Non-Goals

- Do not turn Cockpit into the runtime.
- Do not give Cockpit autonomous commit authority.
- Do not absorb HELM, LENS, or LSOE/legacy LASSO.
- Do not fork a second UI spec that conflicts with CK.00/CK.01/CK.02.
- Do not treat the empty standalone repo as proof the idea was empty.
