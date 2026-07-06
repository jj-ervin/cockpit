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

> **Priority note (2026-07-02):** "eco operator surface (primary)" below
> describes historical build order, not a permanent ranking. See
> `docs/specifications/CKP.v1.0-scoping.md`'s "Durable boundary" section:
> Cockpit's identity is the universal UI/UX host, owned by neither eco nor
> Marlin. Marlin's environment-setup surface is the current build priority.
> "Universal Cockpit, Marlin provider first" — not "Cockpit is eco's UI" and
> not "Cockpit is Marlin's UI."

Cockpit is the universal UI/UX host for the portfolio. Its primary surface is eco's
operator control plane — one operator managing one eco workspace. It is also the GUI
home for portfolio governance tooling and any other portfolio product that needs a
visual surface.

**eco operator surface (primary):**

- run lifecycle monitoring
- PASS run launching
- escalation approval
- artifact browsing
- policy visibility and editing
- diagnostics and validation status
- environment setup and readiness views
- integration surfaces for DevXToolkit, eco.vs, HELM, and eco runtime records

**Universal UI host (capability):**

- Marlin governance panel — install, audit, status surfaces backed by Marlin-DXP core
- future portfolio modules as needed

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
- universal UI host role — governance and portfolio tooling panels (Marlin, future)

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

> **Note (2026-07-02):** This table predates DEV-ACCORD.02 PASS numbering and is
> stale relative to the Immediate Work log below. It is a Work Item tracker, not
> a PASS registry — see `DEV-PATH.md` "Phase 7 — CKP Numbering Correction" for
> the governed `CLUSTER.NN.NN` identities and registration.

| Target | Description | Status |
| --- | --- | --- |
| CKP.0 | Recover standalone Cockpit planning docs | Done |
| CKP.1 | Inventory current eco Cockpit implementation and gaps | Planned |
| CKP.2 | Package Cockpit as an installable standalone module/SKU | Planned |
| CKP.3 | Embed Cockpit cleanly in eco.vs sidebar/panel flow | Planned |
| CKP.4 | Wire HELM mode integration against Cockpit state | Planned |
| CKP.5 | Define standalone plugin/extension contract | Planned |
| CKP.6 | Marlin governance panel — embed Marlin-DXP core; expose install/audit/status surfaces in Cockpit | Planned |

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

> **Correction (2026-07-02):** the v1.0 row below said "Marlin governance
> setup panel" as its fifth item. `eco/docs/specifications/cockpit-ui-spec.md`
> has a `CANONICAL-LOCKED` section declaring the real fifth item is
> **"environment setup wizard"** (guided install/verify/configure flow) - the
> locked spec supersedes this table per its own text. The Marlin governance
> panel (`CKP.07`) is real, valuable work, but it is not what v1.0's ladder
> entry names; it may be one step *inside* a future environment setup wizard,
> not the wizard itself. See `docs/specifications/CKP.v1.0-scoping.md` for
> the corrected v1.0 breakdown.

| Version | Responsibility |
| --- | --- |
| v0.1 | VS Code Cockpit panel; five CK.01 surfaces; workspace-local governance |
| v1.0 | Environment emergence UI, diagnostics dashboard, Quick-Bar, mode switching, Marlin governance setup panel |
| v2.0 | Developer OS controls, multi-agent orchestration console display, workspace graph, profile management |
| v3.0 | Semantic workspace controls, semantic search/diff/template workflows, AI-augmented diagnostics |
| v4.0 | Full developer OS shell, enterprise-grade identity and automation orchestration surfaces |

---

## Immediate Work

> **Note (2026-07-02):** IDs below are corrected to `CLUSTER.NN.NN` form in
> `DEV-PATH.md` "Phase 7 — CKP Numbering Correction" (e.g. `CKP.05A` →
> `CKP.05.01`) and registered in `eco/passes/passes.registry.json`. This table
> is left unedited per the append-only/caution rule for `DEV-PLAN.md`; use the
> corrected identities in new work.

| ID | Task | Priority | Status |
| --- | --- | --- | --- |
| CKP.01 | Add standalone planning docs | P0 | Done |
| CKP.02 | Audit current eco Cockpit files against CK.01 and CK.02 | P0 | Done - correction pass applied in eco |
| CKP.03 | Decide extraction shape: package, extension module, or standalone app shell | P0 | Done |
| CKP.04 | Define public API surface for Cockpit consumers | P1 | Done |
| CKP.05 | Produce packaging checklist for Track B B.2-02 | P1 | Done |
| CKP.05A | VS Code host-to-Python adapter bridge | P0 | Done |
| CKP.05B | Bridge packaging and diagnostics hardening | P0 | Done |
| CKP.06 | Define screenshots/demo flow for product positioning | P1 | Done |

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

## CKP.04 Closure — Public API Surface

**Closed:** 2026-07-01

Cockpit's public consumer API is the Phase 1 Python package adapter boundary, with VS Code and future standalone shells acting as hosts over that same API rather than defining independent product APIs.

The public surface consists of workspace-scoped adapter calls for governance status, validation/audit actions, install/readiness actions, run/artifact state, and panel-specific view models. Every call carries a workspace/node identifier so the API remains single-workspace usable now and multi-agent-capable later.

**Next:** Begin the Phase 2 VS Code webview host as an adapter consumer. The host may render Cockpit panels and relay user actions, but governance authority remains in eco/runtime adapters.

---

## CKP.05A Closure — VS Code Host-To-Python Adapter Bridge

**Closed:** 2026-07-01

The Phase 2 VS Code host now consumes the Phase 1 Python package adapter boundary through a read-only JSON bridge. The host calls `cockpit.host_bridge` for `health`, `get_state`, `list_records`, and `get_record`; the bridge returns the existing `AdapterResult` envelope with `AdapterOrigin` provenance.

This keeps TypeScript in the host role and keeps backend behavior in the Cockpit Python package. The bridge does not expose write operations, approvals, installs, or policy edits.

**Next:** Finish CKP.05 by turning the bridge into a packaging checklist: Python package availability, VS Code setting defaults, local-dev path handling, extension packaging rules, and demo verification steps.

---

## CKP.05B Closure — Bridge Packaging And Diagnostics Hardening

**Closed:** 2026-07-01

The VS Code host now resolves the Cockpit Python bridge through explicit packaging rules:

1. If `eco.cockpit.packageRoot` is set, use that local Cockpit checkout.
2. Else, if a sibling `cockpit` checkout exists beside `eco-vscode`, use it for local development.
3. Else, call `python -m cockpit.host_bridge` from the active Python environment.

The extension exposes `eco: Cockpit Bridge Health`, which verifies Python path, package-root resolution, backend health, and adapter state without opening the webview. This gives packaging and support a fast failure surface when the Python package is missing or misconfigured.

**VSIX rule:** The extension must not bundle private planning/bootstrap docs. It should either depend on an installed `cockpit` Python package or use an explicitly configured local checkout during development.

**Next:** Move to CKP.06 screenshot/demo flow, using the bridge-backed VS Code host as the product proof.

---

## CKP.05 Closure — Packaging Checklist

**Closed:** 2026-07-01

CKP.05 is captured in `docs/specifications/CKP.05-packaging-checklist.md`.

The checklist defines:

- Python package install and bridge smoke commands
- VS Code host build and compiled bridge smoke commands
- Extension Development Host visual smoke path
- Bridge resolution order for local checkout vs installed package
- VSIX release exclusions for private dev docs and source-only files
- done criteria for Track B packaging readiness

**Next:** CKP.06 screenshot/demo flow.

---

## CKP.05C Closure — Phase 1 Package Install Automation

**Closed:** 2026-07-01

Cockpit now provides `cockpit.install_phase1` and the `cockpit-install-phase1`
console entrypoint for Phase 1 package install automation. The command performs
editable Python package install, Python test verification, and a read-only
`cockpit.host_bridge` health smoke against a selected eco workspace.

This automation belongs to the Phase 1 package boundary. It does not add Marlin
package writes, Cockpit run submission, escalation approval, or policy editing.

**Next:** Use the automated install step as the first packaging readiness gate before
VS Code host build and visual smoke.

---

## CKP.06 Closure — Screenshot/Demo Flow

**Closed:** 2026-07-01

CKP.06 is captured in `docs/specifications/CKP.06-demo-flow.md`.

The demo flow uses the VS Code Extension Development Host against `C:\dev\eco` and positions Cockpit as a bridge-backed operator surface. It defines setup commands, expected visible signals, screenshot sequence, caption language, and claims boundaries.

**Next:** Start the first Marlin governance panel slice under CKP.6.

---

## Non-Goals

- Do not turn Cockpit into the runtime.
- Do not give Cockpit autonomous commit authority.
- Do not absorb HELM, LENS, or LSOE/legacy LASSO.
- Do not fork a second UI spec that conflicts with CK.00/CK.01/CK.02.
- Do not treat the empty standalone repo as proof the idea was empty.

---

## CKP.05D Closure — Explicit Apply For Install Automation

**Closed:** 2026-07-01

The Phase 1 package install automation now follows an explicit-apply rule:
`python -m cockpit.install_phase1 --workspace <eco-workspace>` previews the install,
test, and bridge-smoke steps, while `--apply` is required before the command mutates
the active Python environment.

This keeps Cockpit package automation aligned with GC zero-trust expectations and
portable host behavior. Cockpit, Marlin, VS Code, CI, and future shell hosts can
inspect the planned install sequence before allowing package writes.

**Next:** Use the explicit-apply install command as the first packaging readiness
gate before VS Code host build and visual smoke.

---

## CKP.6A Closure — Marlin Panel Install Readiness Slice

**Closed:** 2026-07-01

The first Marlin governance panel slice is implemented as a read-only
`install-readiness` record type on the Marlin adapter and host bridge. It returns
preview steps for Cockpit Phase 1 install automation plus an explicit
`--apply --json` command for a future human-approved host action.

The bridge rejects attempts to pass `apply: true` or `mode: apply` through the
read-only query. This preserves the Phase 1 safety boundary: Cockpit can display
install readiness, but package mutation requires explicit human apply outside the
read query.

**Next:** Render the `install-readiness` view model in the VS Code Cockpit panel
with a disabled-by-default apply action and approval copy.

---

## CKP.08.04 Closure — Feature-Parity Audit

**Closed:** 2026-07-02

The feature-parity audit is captured in
`docs/specifications/CKP.08.04-feature-parity-audit.md`.

Result: CKP.08 extraction is structurally valid and host-agnostic, but the
extracted bundle does not yet match the older embedded `eco-vs` operator feature
set. Missing surfaces include run table/detail/copy/rerun, escalation approval,
artifact open/delete/undo, PASS run launcher, policy viewer/editor, governance
diagnostics, editor-plane sync, and HELM mode display.

**Correction:** Adapter review showed seven of the ten parity gaps are UI-only
because existing adapter calls already cover run records, escalation approval,
artifact listing/open handoff, PASS run submission, and policy update.

**Next Single PASS:** `CKP.08.04a — UI-Only Operator Parity Port`, followed by
smaller PASSes for artifact trash/restore and governance diagnostics. Editor-plane
sync remains deferred pending a polling-vs-streaming architecture decision.

---

## CKP.08.04a Closure — UI-Only Operator Parity Port

**Closed:** 2026-07-02

The extracted `cockpit/web` bundle now restores the UI-only operator parity
surfaces from the older embedded `eco-vs` Cockpit panel:

- run table/detail/raw JSON/copy/re-run
- escalation queue approve/deny with reason
- artifact index with host-mediated open action
- PASS run launcher
- policy JSON viewer/editor with validate/save/revert/open

The bundle remains host-agnostic and posts action intent through
`window.cockpitHost.postMessage()`. It does not read or write `.eco` files
directly. Write authority remains in the adapter/host layer, so unsupported
mutations fail closed until the underlying runtime client is configured.

**Next Single PASS:** `CKP.08.04b — Artifact Trash/Restore Backend Contract`, or
defer that and begin Cockpit visual smoke/headless bundle tests under CKP.08.06.

---

## CKP.09.05 Closure — Marlin Provider Real Install + Niji Provider

**Closed:** 2026-07-02

Cockpit now renders the Marlin Environment Setup Wizard as a provider workflow
inside the universal Cockpit UI/UX host. Marlin owns package search/install,
trust gates, registry semantics, scaffold/audit/governance behavior, and the CLI
implementation. Cockpit renders the human-facing flow and displays structured
JSON results; it does not absorb Marlin authority.

The setup wizard can search Marlin packages and request a real install through
host messages. eco-vscode performs the explicit human confirmation and spawns the
Marlin CLI; the web bundle remains an intent surface.

Cockpit also has a read-only Niji adapter/provider panel for health, scheme
inventory, and sample palette preview.

**Next Compound PASS:** visual/headless smoke for the extracted Cockpit bundle
(artifact trash/restore UI wiring already landed earlier, under CKP.08.06 —
see that entry).

---

## CKP.09.06 Closure — Headless DOM Smoke Test for the Extracted Bundle

**Closed:** 2026-07-02

**Correction:** this work was first drafted under the alias `CKP.08.06` — an
untracked mis-citation, since that alias is already registered to the
artifact trash/restore backend contract (closed earlier, commit `3e00e47`).
Caught before it reached a commit trailer or any tracked file (this note
lives in the gitignored DEV-PLAN.md) and corrected to `CKP.09.06`, registered
in `passes/passes.registry.json` (`CKP:1014`) with a changelog entry
explaining the correction, per DEV-ACCORD-CI-41.

`src/cockpit/tests/test_web_bundle_smoke.py` — 9 Playwright (headless
Chromium) tests loading `web/cockpit.html` + `cockpit.js` + `cockpit.css`
with the host-template placeholders substituted the same way `eco-vscode`'s
`webviewHost.ts` does, except posted messages are captured into
`window.__posted` instead of relaying to a real VS Code host. Covers:

- bundle loads with zero console errors and posts `eco.cockpit.ready`
- a synthetic `eco.cockpit.state` snapshot (shaped like
  `buildCockpitSnapshot()`'s real payload) correctly hydrates the dashboard,
  run table, escalations, artifacts, policy editor, and Niji panel
- each UI-only operator-parity action from CKP.08.04a posts the correct
  message: copy run JSON, approve escalation (with reason), delete artifact,
  submit PASS launcher form, save policy, refresh

Does not re-test eco-vscode's snapshot assembly or adapter/backend logic
(those have their own suites) — this only proves the extracted, host-agnostic
bundle itself is wired correctly. `pytest-playwright` is declared in
cockpit's own `pyproject.toml` under a `[test]` extra (`pip install
-e ".[test]"`), not a sibling repo's shared venv — per the portfolio-wide
modularity/portability standard. Headless Chromium is installed via the
standard one-time `python -m playwright install chromium` step (documented
in README.md), which is a per-machine browser cache, independent of any venv.
111/111 cockpit tests passing (9 new).

**Next Single PASS:** governance diagnostics and editor-plane sync remain the
two open backend gaps from the CKP.08.04 audit (see CKP.08.07/.08 for the
diagnostics record type and sync bundle UI already landed on the dashboard
side); no further single PASS is queued here beyond that.

---

## CKP.10.00 Closure — Lasso Workspace and Marlin Workspace Explorer Panels

**Closed:** 2026-07-05

Two new universal-host provider surfaces: a browser-local Lasso Workspace
panel (Codex/Claude/Reviewer prompt-compose lanes, no backend adapter) and a
read-only Marlin Workspace Explorer (`workspace-tree` and `repo-status`
record types on `MarlinAdapter`, depth/item-bounded directory walk with a
noise-directory skip-list, path containment via `_resolve_contained_path`,
per-repo `git status` shell-out for branch/dirty state).

**Registration correction:** the implementing commit (`9260f15`) used
`Change-Level: DRIVE` with `Dev-Docs: not-needed`. DEV-ACCORD.06 requires
`Dev-Docs: updated` for DRIVE-level changes — new panels and a new adapter
record type are exactly the "visible or release-affecting" case DRIVE exists
for. This closure entry and the matching `passes/passes.registry.json`
(`CKP:1015`) registration are the correction, applied retroactively.

**Next:** Render the `repo-status` records this backend already returns
(`CKP.10.01`).

---

## CKP.10.01 Closure — Repo Status UI, Connection Badge, Responsive Shell

**Closed:** 2026-07-05

Renders `CKP.10.00`'s `repo-status` records as a repository card grid (name,
path, git branch/dirty state, registry match) under the workspace explorer's
tree/inspector. Adds a topbar connection badge (`Host connected` vs
`Preview mode`) so an operator can tell live data from static preview data at
a glance, a two-tier `Operate`/`Providers` nav grouping, and a wide-viewport
(>=1040px) responsive shell that moves the tab list into a sticky left rail
instead of a horizontal bar. Enriches the bundle's static preview-mode
fixture data (runs, escalations, artifacts, policies, install-readiness,
workspace tree, repo statuses) so preview mode exercises the same render
paths as a live host instead of showing empty states.

**Validation:** 115/115 pytest passing; `node --check web/cockpit.js` clean.

**Next:** No queued single PASS. Lasso currently has no backend — a
merge/dispatch adapter behind it, if server-side lane execution is wanted
over client-only compose, is the natural next scope if prioritized.

---

## CKP.09.01 Closure — Mode Switching (HELM), Host-Agnostic

**Closed:** 2026-07-05

Implements the v1.0 ladder's mode-switching item (`docs/specifications/
CKP.v1.0-scoping.md` identified real prior art — HELM's 5-mode system — as
schedulable, unlike Quick-Bar, which remains blocked on `devxtoolkit-v2-x`
being Phase 0). `EcoAdapter` gains a `"mode"` record type: reads
`<workspace_root>/.eco/helm/mode_history.json` with the same
graceful-degradation pattern as `CKP.08.07`'s governance record, and
`submit("mode", {mode})` appends a mode-change entry — pure file I/O, no
subprocess, no VS Code API dependency, per the `CKP.03` three-phase rule that
the Python package must stay host-agnostic. Bundle UI: an "Operator Mode"
tile on the dashboard status bar, and a "HELM Mode" selector/history section
on the Governance tab.

**Correction made mid-session, before any cross-repo code was written:** an
earlier draft proposed porting `eco-vs`'s `helm.ts` implementation into
`eco-vscode` (mirroring `CKP.08`'s Cockpit-UI extraction), reasoning from an
open "HELM/PASS convergence" note in `eco-vscode/DEV-PLAN.md`. The user
correctly rejected this — it would make the feature itself VS-Code-dependent.
This PASS makes **no changes to `eco-vs` or the `eco` repo**; `eco-vscode`
gets only a thin, generic relay case (`eco.cockpit.setHelmMode` → Python
bridge `submit` → relay result), identical in shape to existing write actions.

Also this session: the Lasso tab was relabeled "Compose Scratchpad"
(cosmetic only, separate `BUNT` commit) — real multi-agent dispatch stays
out of scope for Cockpit; that's LASSO's (`c:\dev\lasso`) product to build,
not a Cockpit panel's.

**Validation:** 126/126 pytest passing (11 new). `node --check web/cockpit.js`
clean.

**Next:** `eco-vscode`'s relay case + `cockpitApi.ts` widening for the
`"mode"` record type is a separate commit in that repo, still pending as of
this closure.

---

## CKP.09.01 Correction — Real `time.loc` Schema, Not a Plain Timestamp

**Recorded:** 2026-07-05

Checking real HELM history (`c:\dev\eco\.eco\helm\mode_history.json`, written
by `eco-vs`'s live usage) before manual round-trip testing found `time_loc`
is a structured **time.loc v1.2** record, not the plain ISO string this PASS
originally wrote. `time-loc` (`c:\dev\time-loc`) had no packaging; it now
does (commit `340aefc` in that repo), so cockpit depends on it for real
instead of inventing a competing timestamp format. `EcoAdapter._write_mode`
now uses `produce_unsigned_unavailable().to_dict()`.

Also surfaced: cockpit's own `pytest` currently resolves to `eco`'s shared
`.venv`, not a cockpit-local one — a real gap against this repo's own
self-contained/portable goal. Not fixed here (separate, larger cleanup);
all verification for this correction used throwaway scratch venvs instead.

**Validation:** 127/127 pytest passing in an isolated venv; a clean
`pip install -e .` of `time-loc` verified with no manual workarounds.

---

## CKP.03 Phase 3 Closure — Standalone Web Host

**Closed:** 2026-07-05

Implements the "Universal standalone shell" packaging form `CKP.03` reserved
but never built: `host-web/`, a plain Express server serving the unmodified
`web/cockpit.{html,css,js}` bundle and relaying `eco.cockpit.*` messages to
`python -m cockpit.host_bridge` over HTTP instead of VS Code's `postMessage`
channel. Confirms `docs/specifications/CKP.08-host-loader-contract.md`'s
host-agnostic bundle contract is real — that doc already speced this exact
"small local HTTP shim" case before any code existed.

**Deployment model:** locally-run tool (`npm start`, point at your own
workspace), matching `CKP.03`'s Phase 3 definition and LASSO's v0 shape from
the same session. A public multi-tenant hosted version is named **Phase 4**
in `DEV-PATH.md` — planned, deliberately deferred, not scoped here.

**Real gaps found during build, handled honestly rather than faked:**

- The bundle's static CSP has no `connect-src`, silently blocking the
  bootstrap script's `fetch()` call — found via a real headless-Chromium
  console error, not assumed; fixed server-side (permissive CSP
  substitution, per the host-loader-contract's own allowance).
- `marlin search`'s query is a positional CLI arg, not stdin-fed like
  `claude`/`codex` — the same shell-injection class LASSO fixed doesn't have
  a clean fix here, so the PATH-based `.cmd` fallback is refused outright
  (fails closed) rather than accepting the risk; only the safe
  sibling-checkout path (real `.exe`, no shell) is supported.
- Three actions with no web equivalent (clipboard copy, VS Code editor
  open, native install-confirm dialog) are downgraded to honest
  alternatives (console log, OS-default-app open, explicit decline) instead
  of faked — see `host-web/actions.js`'s doc comment and `DEV-PATH.md`'s
  Phase 16 for the full reasoning per action.

**Validation:** 24/24 new unit tests (mocked subprocess). Manually verified
end-to-end against real infrastructure: full dashboard render against
`c:\dev\eco`'s real data with zero console errors in real headless Chromium;
a full HELM-mode write round trip verified against a scratch workspace.

**Next:** Cockpit's Phase 1/2/3 packaging forms are now all real. Phase 4
(public multi-tenant hosting) is the only unbuilt item from `CKP.03`'s
original three-form plan, now formally four with Phase 4 added — its own
future design pass (auth, isolation, sandboxing, abuse limits), not
scheduled.

---

## CKP.12.00 Phase 4 Design Closure — Multi-Tenant Hosting Design

**Closed:** 2026-07-06

Design-only pass (no implementation) answering the Phase 4 deferral above:
`docs/specifications/CKP.12-phase4-multitenant-design.md` recommends a thin
control plane (new `host-cloud/` directory, colocated in this repo) in front
of unmodified, one-per-tenant Phase 3 `host-web` instances running in
containers — directly reusing the design principle already recorded in
`CKP.11.00`'s closure above. Auth, tenant isolation, subprocess sandboxing,
and abuse/resource limits all live in the new control-plane component only;
`host-web` itself is not rewritten.

**Still open:** the auth model (GitHub OAuth vs. email magic link) is
documented as a tradeoff with a recommendation, not decided — closing it is
a prerequisite for any implementation PASS. Production hosting/orchestrator
choice, secrets management, billing/quota mechanics, and TLS/domain routing
are also explicitly out of scope for this design.

**Real gap found during review, fixed separately:** `host-web/index.js`
bound to all network interfaces by default with zero auth in place — fixed
in the same session as an independent Phase 3 hardening patch (default bind
now `127.0.0.1`, overridable via `COCKPIT_HOST`), not part of the Phase 4
design itself.

**Next:** close the auth model decision and build a minimal tenant-registry
skeleton (no container orchestration yet) as the first bounded
implementation PASS — see the spec doc's own "Recommended Next Bounded
PASS" section for the concrete test plan.

---

## CKP.13.00 Closure — Auth Model Decision + Tenant-Registry Skeleton

**Closed:** 2026-07-06

Closed `CKP.12.00`'s open auth-model decision (GitHub OAuth, per that doc's
recommendation) and built the first real slice of the Phase 4 control
plane: new `host-cloud/` directory with a JSON-file-backed tenant registry,
a stateless HMAC-signed session token, a GitHub OAuth login/callback flow,
and a `POST /api/whoami` proof endpoint. `host-web` and the Python `cockpit`
package are unchanged.

Proves the core Phase 4 invariant end-to-end, not just by design: a
session's `workspaceRoot` is resolved only from the server-owned tenant
registry, and a request body cannot override it (dedicated regression test
in `host-cloud/tests/server.test.js`). Also closes the symlink/junction
containment gap `CKP.12.00` flagged, via a new `resolveContainedPathStrict`
that resolves through `fs.realpath` before the containment check.

**Not built:** container orchestration, rate limiting/quotas/idle-teardown,
capability-scoped tokens, and actual proxying to a tenant's `host-web`
instance — all named as future scope, not attempted in this PASS.

**Validation:** 24 new tests (`host-cloud/tests/`), 23 passing, 1
self-skipped (symlink creation needs elevated privileges on this Windows
dev machine — confirmed `EPERM`, not silently swallowed).
