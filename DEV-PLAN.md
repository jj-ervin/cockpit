# DEV-PLAN — Cockpit

**AUTHORITY LEVEL: AL:1**
**Status:** SCAFFOLD / ACTIVE PRODUCT DIRECTION
**Updated:** 2026-08-12
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
| CKP.2 | Package Cockpit as an installable standalone module/SKU | In progress — Electron x64 host and offline NSIS installer are buildable locally; release and Marlin registry publication remain gated. |
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
| v5.0 | Reserved for future/unpredictable development — deliberately not scoped yet (portfolio owner, 2026-07-06) |

**Note on v5.0 (2026-07-06):** unlike v2.0-v4.0, which name specific
(if unbuilt) capability areas, v5.0 is an intentionally open slot — a place
for work that doesn't fit or predict cleanly into v1.0-v4.0's themes,
without forcing a premature label onto it. Do not backfill a specific
scope for v5.0 without a portfolio-owner decision; treat naming it here as
recording the reservation itself, not a spec.

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

**2026-08-19 correction:** "blocked on `devxtoolkit-v2-x` being Phase 0" is
stale. `devxtoolkit-v2-x` underwent a scope-correction migration and
gained the output-styling pillar the same day — it's `status: active`,
`ModuleVersion 2.1.0`, 12 real exported commands, 46/46 Pester passing,
not yet published. Quick-Bar remains unscheduled; only the stated blocking
reason is corrected here. See `cockpit/DEV-PATH.md`'s Phase 15 Decision 2
correction note and `dxp-org/devxtoolkit-v2-x/DEV-PLAN.md`/`DEV-PATH.md`
for the full account.

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

---

## CKP.14.00 Closure — Process Orchestration, Rate/Quota Limits, Capability Tokens, Real Proxying

**Closed:** 2026-07-06

Did all four items named as future scope in `CKP.13.00`'s closure, as one
compound PASS per the portfolio owner's request. Docker was attempted for
real first (Docker Desktop launch on this machine) and failed with
`WSL_E_WSL_MOUNT_NOT_SUPPORTED` — ARM64 + Windows build 26200, needs
27653+. Confirmed as a platform-version gap, not a config/sign-in issue.
`CKP.12.00`'s container design is unaffected and remains the target once a
compatible Docker host exists.

Built instead: `processManager.js` spawns one real, unmodified `host-web`
child process per tenant (real OS-process isolation, container-shaped
interface for a later swap-in); `rateLimiter.js` (per-tenant token bucket);
`quota.js` (best-effort disk usage check, honestly documented as not real
enforcement); `session.js`/`capabilities.js` (a `capabilities` token claim
plus a read/write action-type map, independent of tenancy); `proxy.js` +
`server.js`'s real `/api/bridge` chain (session → rate limit → capability →
quota → process ensure → proxy).

**A real bug only live end-to-end testing caught:** a property-name
mismatch (`req.tenant.workspaceRoot` vs. `processManager`'s expected
`tenant.workspaceRoot` — originally read as `.workspacePath`) meant every
tenant's spawned process would have silently inherited the control plane's
own working directory instead of its isolated workspace. A mocked-only test
would have had to encode the same wrong assumption to pass; the real spawn
test caught it. Fixed and verified.

**Not built:** real container orchestration (blocked on this machine's
platform), an endpoint to issue narrower read-only tokens, true filesystem
quota enforcement.

**Validation:** 54 tests in `host-cloud/tests/` (30 new), 53 passing, 1
self-skipped (unchanged from `CKP.13.00`). `host-web` unchanged, 28/28
still passing.

---

## CKP.15.00 Closure — Secure-Cookie Enforcement

**Closed:** 2026-07-06

A security review of `CKP.12.00`-`14.00`'s `host-cloud/` code found
`serializeCookie` never set `Secure` on the session/OAuth-state cookies.
Since `cockpit_session` is the sole bearer credential for a control plane
explicitly built for public multi-tenant hosting, and `host-cloud` defaults
to binding `0.0.0.0` with no TLS of its own, this was a concrete
session-hijacking vector in the PASS's own shipped default, not a
theoretical gap.

Fixed: `serializeCookie` takes a `secure` option (default `true`);
`index.js`'s new `resolveRuntimeSecurity()` **refuses to start** on a
non-loopback bind unless `COCKPIT_CLOUD_TLS_TERMINATED=1` or an explicit
`COCKPIT_CLOUD_ALLOW_INSECURE_HTTP=1` opt-out is set. Loopback binding is
unaffected.

**Validation:** 61 tests (7 new), 60 passing, 1 self-skipped (unchanged).

---

## CKP.16.00 Closure — Read-Only Token Issuance Endpoint

**Closed:** 2026-07-06

`POST /api/tokens/readonly` lets any authenticated tenant mint a token
scoped to exactly `['read']`, regardless of their own capabilities (never
an escalation). `ttlSeconds` is clamped to `[60, 86400]`. `requireSession`
also gained `Authorization: Bearer <token>` support (cookie still takes
priority) — a token minted here would otherwise have no way to actually be
used, since non-browser callers have no cookie jar.

**Validation:** 66 tests (5 new), 65 passing, 1 self-skipped (unchanged).

---

## CKP.09.02 Closure — Diagnostics Dashboard Expansion

**Closed:** 2026-07-06

Builds the v1.0 ladder's Diagnostics panel item — the only real, unblocked
v1.0 item left. Researched each of the locked spec's three undefined
categories before building: integrations was cheap (adapters already had
`health()`, just not all called); environment checks was genuinely new
(no existing source anywhere — portfolio owner scoped it to Python/Node/
cockpit-importable); agent pipelines was medium (raw data already existed
in `PLAY.jsonl`, needed aggregation).

Built: new `SystemAdapter` (Python), a new `agent-pipeline` `EcoAdapter`
record type reading `PLAY.jsonl`, wired into both `host-web` and
`eco-vscode` (parity per `CKP.08`'s contract), and a new Diagnostics tab
in the bundle. A property-mismatch-shaped false alarm during manual
verification turned out to be an artifact of the ad hoc test command's own
shell-escaping, not a real bug — re-verified with a real script file.

**Validation:** 145 Python tests (145/145, +15 new), 15 Playwright bundle
smoke tests (+2 new), 28 `host-web` tests (unchanged). `eco-vscode`:
`tsc --noEmit` and `npm run build` both clean.
## cockpit-provider-v1 Contract Slice (2026-07-11)

The first implementation slice of the v1 provider contract now exists:
versioned JSON Schemas for provider manifests, operation requests/results,
and Marlin-issued installation attestations; zero-trust Marlin and Niji
fixtures; and a generic `ProviderRegistry` that validates schemas, matches
provider identity/version, verifies the exact manifest SHA-256 digest, resolves
only an existing absolute executable from the Marlin attestation, and denies
unknown providers or commands. Provider manifests cannot choose executables.
Mutations must declare confirmation. Appearance is limited to validated
semantic identity; Cockpit retains trust chrome and global theme authority.

Validation: 155 Python tests pass, including 10 provider-contract/registry
tests. The v1 release gate remains in progress: `host_bridge.py` still uses
built-in adapter branches and must be migrated to registry-backed provider
dispatch before provider registration can be called portable end to end.

## QUEUED IDEAS

### Host-view and navigation character themes (2026-07-14)

Explore Cockpit-owned appearance modes that alter presentation and navigation
character without changing provider contracts, trust chrome, permissions, or
underlying information architecture:

- a legally distributable LCARS-adjacent mode using condensed geometric type,
  segmented information bands, strong hierarchy, and spatial navigation —
  inspired by optimistic control-room interfaces without copying Star Trek
  marks, terminology, exact layouts, or proprietary font assets;
- a modern aviation mode influenced by glass cockpits, flight-management
  systems, restrained instrument panels, and high-legibility operational data;
- a vintage aviation mode influenced by analog gauges, placards, charting,
  navigation logs, and tactile cockpit materials while retaining accessible
  contrast and contemporary interaction behavior.

Treat these as host-view/theme experiments, not separate product forks. A
future design pass should determine whether they are full themes, navigation
profiles, optional host shells, or smaller visual modes. Cockpit remains the
authority for global theme and trust presentation; provider-supplied appearance
must not override safety-critical states.

## Niji Hosted-Session Adapter Completion (2026-07-26)

Completed the Niji provider's v1.1 hosting gaps without changing its read-only
authority boundary. Cockpit now consumes Niji's installed integration facade,
not a sibling-checkout `sys.path` fallback. The adapter creates a host-scoped
session, hands off host context, and records Niji lifecycle events through the
existing `NijiEventSink` protocol. Generic bridge `activate`/`close`
operations remain non-mutating for all providers; only Niji implements them
today. `submit` and `update_record` still fail closed for Niji.

**Validation:** 157 Cockpit Python tests passed; Niji's 19 integration API
tests passed. Installed-provider end-to-end smoke remains blocked only by the
current virtual-environment dependency mismatch, not by a sibling-path
fallback in source.

## CKP.17.01 (working name, not yet registered) Closure — Real Installed-Provider Smoke, Not a Venv Blocker

**Closed:** 2026-08-05. Registration deferred to `CKP.17.00`'s close, per the
compound PASS brief this lane belongs to.

The prior note's "virtual-environment dependency mismatch" did not reproduce:
`cockpit`'s own `.venv` and unit tests were already clean. What was actually
missing was a real installed-provider smoke test — one that installs through
the unmodified Marlin CLI into an isolated home (`APPDATA` override, no
`C:\dev`, no eco, no sibling checkout on the resolved path), registers the
resulting Marlin attestation through `ProviderRegistry` exactly as a host
would, and sends one real `cockpit-operation-request-v1` to the installed
`niji-provider.exe` over stdio. That test now exists:
`test_real_marlin_installed_provider_stdio_roundtrip` in
`test_provider_registry.py`, opt-in via
`COCKPIT_REAL_PROVIDER_SMOKE_MARLIN_CLI` (needs network + `gh` auth for
niji's private release, so it does not run in default `pytest`). A manual run
against the real Marlin CLI and the real published niji 1.1.1 release passed
end to end: checksum-verified download, real attestation, real stdio spawn,
real palette response.

**Stale fixture found and fixed:** `examples/providers/niji.provider.json`
still declared `"version": "1.0.0"`; the real, currently published Niji
provider is 1.1.1. Updated to match, and `test_provider_registry.py`'s
`write_registration()` fixture updated to the real attested shape
(`provider_version: "1.1.1"`, populated `package_digest`, `args: []` instead
of a fabricated `["provider", "--stdio"]` that no real attestation ever had).

**Real bug found and fixed, then a second real bug found in the fix itself:**
`ProviderRegistry.register()` accepted `package_digest` in the schema but
never verified it — an executable swapped after Marlin's install would
register without complaint. First fix hashed `executable` and compared
against `package_digest`. Running that against the real Marlin-installed
niji 1.1.1 attestation immediately failed: `package_digest` is the digest of
the downloaded install **archive**, verified once by Marlin before
extraction (`marlin/packages/marlin/src/installer.ts`'s `verifyChecksum`),
not a digest of the extracted `executable`. The archive no longer exists by
the time Cockpit registers the provider, so there is nothing left to
re-verify that field against. Reverted to treating `package_digest` as
install-time provenance only, documented in a code comment, with a test
(`test_package_digest_is_not_verified_against_executable_bytes`) that proves
and records the real, current behavior rather than a wrong assumption.
**Open gap, not closed here:** Cockpit cannot currently detect a provider
executable being swapped after Marlin installed it. Closing that needs
Marlin to attest a digest of the extracted executable itself — a new
attestation-schema field, out of this PASS's authorized scope.

**Cleanup:** the manual verification pass installed niji into a scratch
`APPDATA`, which added that scratch path to the real Windows user `PATH` (a
Marlin install side effect) and left install files on disk. Both removed
after verification; the automated opt-in test uses a pytest `tmp_path` and
does not touch the real user `PATH`.

**Validation:** 159 Cockpit Python tests passing (7 in
`test_provider_registry.py`, including the opt-in real smoke, +2 net new),
1 pre-existing self-skip (symlink permission) unrelated to this change.
`node --check web/cockpit.js` clean.

**Next:** `CKP.17.02` — `host_bridge.py` already dispatches generically via
`ADAPTER_REGISTRY` for local Python adapters (eco, marlin, niji, system); it
has no path yet to `ProviderRegistry`-backed external stdio providers. Add
that dispatch without touching the existing local-adapter path.

## CKP.17.02 (working name, not yet registered) Closure — External Provider Dispatch, Additive to ADAPTER_REGISTRY

**Closed:** 2026-08-05. Registration deferred to `CKP.17.00`'s close, per the
compound PASS brief this lane belongs to.

Added a second, parallel dispatch path in `host_bridge.py` for Marlin-
installed external `cockpit-provider-v1` providers, alongside — not
replacing — the existing `ADAPTER_REGISTRY` dispatch for local Python
adapters (eco, marlin, niji, system). The two protocols are genuinely
different shapes: `ADAPTER_REGISTRY` backends implement Cockpit's fixed
adapter vocabulary (`health`/`get_state`/`list_records`/...); external
providers declare their own arbitrary `commands` in a manifest and speak
`cockpit-operation-request-v1`/`-result-v1` over stdio. Forcing providers
through the adapter ABC would have been the wrong shape; a new
`invoke_provider_command` bridge operation carries `command_id`/`input`/
`confirm` and routes to a new `cockpit/provider_discovery.py` +
`ProviderRegistry` instead.

**New module:** `provider_discovery.py` scans `<marlin_home>/providers/
<id>/<version>/` for `manifest.json`+`attestation.json` pairs and registers
the newest version per provider. Marlin home resolution mirrors
`marlin/packages/marlin/src/platform.ts`'s own per-platform logic
(`COCKPIT_MARLIN_HOME` override, else `%APPDATA%/marlin` /
`~/Library/Application Support/marlin` / `$XDG_DATA_HOME/marlin`) —
Cockpit does not import Marlin or depend on it as a package, only on its
documented install-layout contract. One broken provider install is
recorded as an error and skipped, not fatal to discovery.

**Mutation confirmation, per the schema's own design, not an invented
convention:** `cockpit-provider-v1.schema.json`'s command sub-schema already
enforces `mutation: true` ⟹ `requires_confirmation: true` at the manifest
level. `invoke_provider_command` gates on `requires_confirmation`
specifically (not `mutation`) to match the schema's actual intent, and
raises before ever spawning the provider process if an unconfirmed mutating
command is requested.

**Second `ProviderRegistry` bug found via this lane's own real test:**
`register()` let a raw `jsonschema.ValidationError` escape uncaught on a
schema-invalid manifest, contradicting the class's own docstring ("A
provider failed schema, integrity, or executable verification" — implying
`ProviderRegistrationError` for all three). Found because
`test_broken_provider_install_is_reported_not_fatal` exercises a genuinely
malformed manifest rather than a hand-picked failure mode. Fixed by wrapping
both `validate()` calls; schema failures now raise `ProviderRegistrationError`
like every other registration failure.

**Real, non-fake verification:** beyond the fixture-based tests (a small
Python script standing in for a provider executable, registered directly
into the bridge's registry singleton via `monkeypatch`), ran the actual
`python -m cockpit.host_bridge` module entrypoint — the exact process a VS
Code or web host spawns — against a fresh, isolated real Marlin install of
niji 1.1.1 (`COCKPIT_MARLIN_HOME` pointed at a scratch home, no `C:\dev`
involvement in the resolved provider path). It discovered the real
provider from disk and returned a real palette result over real stdio.

**Validation:** 170 Cockpit Python tests passing (11 net new: 6 in
`test_provider_discovery.py`, 6 in `test_host_bridge.py` minus 1 shared
helper, 1 in `test_provider_registry.py` for the schema-error fix), 1
pre-existing self-skip unrelated to this change. `node --check
web/cockpit.js` clean. Real end-to-end proof against a live Marlin install,
manually run and not part of the automated suite (same rationale as
`CKP.17.01`'s opt-in real test — needs network + `gh` auth).

**Next:** `CKP.17.03` — Marlin itself is not yet a conforming provider.
Unlike Niji, Marlin's real value is mutating (install/audit/remediate), so
this is not a copy of Niji's read-only pattern: it needs a manifest with
real `mutation`/`requires_confirmation`-gated commands, an execution path,
verification, and evidence-bundle export, per the discover→validate→
remediate→approve→execute→verify→evidence-export vertical slice.

## CKP.17.03 (working name, not yet registered) Closure — Marlin Provider, Built and Verified in the marlin Repo

**Closed:** 2026-08-05. Full implementation, tests, and closure detail live
in `marlin/DEV-PLAN.md` (this lane's code changes are entirely in the
`marlin` repo — `packages/marlin-dxp/src/provider.ts`,
`core/selfProvider.ts`, `cli/provider.ts`, `provider/marlin.provider.json`).
Recorded here only for cross-reference since this repo owns the
`ProviderRegistry`/`provider_discovery.py` side of the contract Marlin now
conforms to.

Marlin exposes four real commands (`marlin.audit.validate`,
`marlin.audit.normalize.preview`, `marlin.audit.normalize.apply` —
mutating, confirmation-gated — `marlin.audit.verify`), each wrapping the
same GC-AUDIT machinery `marlin audit` already used from the terminal, with
a real signed evidence bundle on every run. Verified for real through
Cockpit's own `python -m cockpit.host_bridge` entrypoint against a real,
isolated `marlin provider register-self` registration — the identical
discovery/dispatch path proven in `CKP.17.02`, now exercised against a
second real provider, not just Niji.

**Important, out-of-scope finding surfaced by that real run:** dispatching
against this actual `c:\dev` portfolio failed — not from anything in
`CKP.17.01`-`.03`, but a pre-existing YAML syntax error in
`governance-commons/gc-audit/GC-AUDIT-REGISTRY.yaml` (confirmed by
reproducing the identical failure with the plain, unmodified `marlin audit
validate` command). This currently breaks `marlin audit` for every verb
against the real portfolio, not just the provider path. See
`marlin/DEV-PLAN.md`'s `CKP.17.03` entry for the exact line and cause. Not
fixed here — GC-AUDIT registry content is a different repo/domain requiring
its own authorized PLAY per DEV-ACCORD-CI-42/43.

**Next:** the full discover→validate→remediate→approve→execute→verify→
evidence-export vertical slice against the real portfolio is blocked only
on that registry fix now — the mechanism itself (all three CKP.17 lanes) is
proven end to end against a scratch portfolio and a real Marlin-installed
Niji provider.

**Correction, 2026-08-05, same session:** the registry fix above was
authorized and applied (governance-commons commit `120daa6`). It surfaced a
second real bug — Marlin's own `console.log`/inherited-stdio output
corrupting the provider's stdout — fixed in marlin commit `e2f4dfe`. The
real vertical-slice proof against this actual portfolio then succeeded:
`marlin.audit.validate` returned `status: succeeded` with a real signed
evidence bundle, `conformant: true`. Neither blocker remains open. See
`marlin/DEV-PLAN.md`'s `CKP.17.03` addendum for the full detail.

## CKP.17.00 Closure — Provider Architecture Runtime Slice

**Closed:** 2026-08-05. The umbrella and its three completed lanes are now
registered at closure as `CKP:1025` (`CKP.17.00`) through `CKP:1028`
(`CKP.17.03`). The final adversarial review found one correlation hole left
after schema validation: because `command_id` is optional in the shared result
schema, a provider could omit it and still have its response accepted. The
bridge now requires exact equality with the requested command in every result,
and a real-subprocess regression test covers omission as well as spoofed
operation/provider identities.

This closes the provider runtime architecture claimed by CKP.17: installed
provider discovery, trusted registry dispatch, strict request/result validation,
literal confirmation for mutations, the Marlin provider and attestation, real
HTTP-to-bridge-to-provider execution, and signed evidence export. It does not
close Cockpit v1.0.0. The browser bundle still needs an approval/rendering path
that invokes provider commands, and the release still requires its complete
stranger-install scenario; those stay open in `DEV-RELEASE.md`.

## CKP.18.01 Closure — Provider Ownership Consolidation

**Closed:** 2026-08-05. The four pre-implementation inventories were confirmed:
installed package state was Marlin-owned, package search/install had two direct
host subprocess paths, while development readiness and workspace status were
mislabelled as Marlin capabilities. The `MarlinAdapter` is removed.

Marlin now exposes `marlin.package.list`, `.search`, and `.install` through its
existing attested stdio provider. Install is declared mutating and confirmation-
gated, verifies Marlin's installed state, and emits a digest-addressed evidence
bundle. Cockpit now owns separate `cockpit` development-readiness and `workspace`
tree/repository-status adapters. host-web and eco-vscode both invoke the same
provider request/result contract; no direct Marlin CLI resolution/spawn remains.
Provider absence degrades only Marlin package status and does not suppress the
Cockpit-owned workspace/readiness snapshot.

Validation includes 163 Cockpit Python tests, host-web process/HTTP tests,
Marlin provider package list/search/install/malformed-input/evidence tests and a
real built-provider package-list subprocess, plus eco-vscode typecheck/build.
The browser command-rendering/approval lane and stranger-install lane remain
separate CKP.18 release work.

## CKP.18.02 Closure — Browser Provider Vertical Slice

**Closed:** 2026-08-05. Cockpit's shared browser bundle now renders the full
Marlin governance workflow: repository selection, validation findings,
normalization preview, exact-scope approval, execution, automatic verification,
and final evidence-bundle download. Approval is bound to the canonical
provider/command/input scope and rejected by `host_bridge.py` when absent or
mismatched; provider failures remain structured results so findings can render
instead of being mistaken for bridge crashes.

The same generic provider message works through host-web and eco-vscode. The
non-mocked Chromium gate starts the real Express host, real Python bridge, and
the built Marlin stdio provider against an isolated GC-AUDIT portfolio; apply
writes a real marker, verify observes it, and the browser downloads Marlin's
real verify evidence bundle. Cockpit v1.0.0 now has one open entry condition:
the stranger-install release exercise.

## CKP.18.03 Closure — Standalone Distribution and Stranger Install

**Closed:** 2026-08-05. Cockpit v1.0.0's standalone distribution is the
per-user, non-admin Windows x64 NSIS installer produced by
`scripts/build-standalone.ps1`. The installer contains Electron, host-web, the
shared UI bundle, a PyInstaller-frozen bridge, and all provider schemas. The
packaged app selects an ordinary repository through `COCKPIT_WORKSPACE`; it has
no Python, VS Code, eco-workspace, or portfolio-checkout dependency.

The real stranger exercise forced four source-only assumptions into the open
and closed them: schemas were absent from the frozen bridge, the packaged host
dropped its bridge executable during snapshot construction, optional Niji
absence failed the whole shell, and 17 parallel frozen bridge starts exceeded
the startup timeout. Schemas now resolve from PyInstaller's data root,
snapshot construction preserves the bridge executable and uses one bounded
batch request, and missing optional providers degrade independently.

The final copied-artifact proof installed silently under the user temp area,
opened a new ordinary Git repository, rendered the packaged 13-tab shell with
installed-only resource paths, emitted SHA-256-addressed PASS evidence, and
uninstalled cleanly. All v1.0.0 entry gates are closed; publishing the installer
and Marlin registry entries remains separate release authority.

### CKP.18.04 Corrective Closure — MarlinSetup Is the Installer

The CKP.18.03 Cockpit-owned NSIS decision violated the established product
boundary and is superseded. Cockpit now builds only the `cockpit-core` runtime
ZIP plus `marlin.pkg.yaml`. MarlinSetup embeds that checksum-pinned artifact and
delegates installation to Marlin's `installPackage`; Cockpit does not extract,
register, or record itself. The real `C:\sandbox` proof shows Marlin's state,
managed install path, registered bin, and launched packaged shell all agree.

## Cockpit Payload Closure — Windows ARM64 + x64

**Closed:** 2026-08-05 under Marlin-owned `INIT.23.00`. Cockpit now emits
checksum-pinned `cockpit-core-1.0.0-windows-{x64|arm64}.zip` payloads. The build
selects an architecture-specific Python environment and Electron target, then
verifies PE machine types for the interpreter, frozen bridge, and Cockpit
executable before creating the artifact.

Real copied-MarlinSetup stranger tests passed for ARM64 and x64. ARM64 used
native PE `0xAA64` throughout the installed runtime and payload; x64 used
`0x8664`. Both launched the packaged 13-tab Cockpit shell from Marlin's managed
app directory against an ordinary repository outside the portfolio, then
uninstalled and cleaned up. The thin NSIS extraction stub is separately
recorded as x86 (`0x014C`) and is not the runtime architecture.

## Marlin Doctor Cross-Repo Note — Registry View

**Closed:** 2026-08-12 under Marlin-owned Doctor registry-view work.

Cockpit now renders a Marlin Doctor tab over Marlin's target-scoped operations
registry provider commands: list, register, and unregister. The UI uses the
existing workspace repository picker and `eco.cockpit.invokeProviderCommand`
path. Register/unregister are confirmation-gated provider mutations; operation
execution, health scoring, agent flow, and hygiene migration remain future
Marlin Doctor slices.

## Marlin Doctor Cross-Repo Note — Approval Dialog Fix (INIT.30.03a)

**Closed:** 2026-08-12 under Marlin-owned `INIT.30.03a`.

A review of the registry-view slice above found that register/unregister
sent a valid `confirm: true` + `approval` on the same click that triggered
the mutation — no dialog, no checkbox, no human review step, unlike the
Marlin Audit panel this tab was meant to follow. Fixed entirely in this
repo: `#doctor-approval-dialog` now mirrors `#audit-approval-dialog`
exactly, and `runDoctorCommand()` requires an externally-supplied
approval for register/unregister rather than generating one itself.
Confirming also checks the target repository hasn't changed since the
dialog opened, invalidating a stale approval instead of silently
reusing it. The Doctor browser smoke test now drives the real two-step
flow. No marlin-repo files changed for this fix.

## Marlin Doctor Cross-Repo Note — Operation Execution

**Closed:** 2026-08-12 under Marlin-owned Doctor execution work.

Cockpit's Doctor table now exposes Preview and Run/Apply controls backed by
Marlin's provider. Every target-defined command uses the corrected human
approval dialog, including operations labelled read-only or preview, because a
target repository can edit its own registry. Approval includes the loaded
registry digest; Marlin rejects the run if that registry changes before spawn.
The result panel renders Marlin's bounded stdout/stderr, outcome metadata, and
signed evidence bundle. Cockpit still presents and approves; it does not spawn
the operation or decide whether it is safe.

Validation: web bundle smoke passed 17/17; host-web passed 33/33;
`node --check web/cockpit.js` passed.

## Marlin Doctor Cross-Repo Note — Agent Roster (INIT.30.05)

**Closed:** 2026-08-12 under Marlin-owned agent launcher roster work.

Cockpit's Marlin Doctor tab gained an Agent Roster panel: a table of
built-in and custom agent CLI templates, a "Detect all" action, and a
register/remove form for custom templates. Detection only -- no agent's
real work runs from Cockpit, only Marlin's bounded version-style probe
against each template's `detect` command.

Reuses the approval dialog from `INIT.30.03a` rather than building a
second one. `detect` requires the same human approval as
`register`/`unregister` even though it only reads a probe result,
because the roster (including custom `detect` commands) is
registry-editable -- the same rule already applied to Doctor operations.
Built-in templates never show a Remove control; Marlin marks which rows
are built-in so Cockpit doesn't duplicate that id list.

Validation: web bundle smoke passed 18/18 (was 17); host-web passed
33/33, unaffected; `node --check web/cockpit.js` passed.

## Marlin Doctor Cross-Repo Note — Agent Roster Adversarial Review Fixes (INIT.30.05a)

**Closed:** 2026-08-12 under Marlin-owned `INIT.30.05a`.

Two of Codex's five adversarial-review findings against `INIT.30.05`
touched this repo's UI: the "Detect all" approval carried an empty scope
instead of a roster digest (part of the TOCTOU gap fixed in Marlin), and
the approval dialog described what it was approving as "all known
templates" instead of showing real detect commands. Fixed here:
`state.agents.rosterDigest` is tracked from every agent provider result,
the Detect button is disabled until a digest exists, and the approval
dialog now lists the digest and every template's actual `detect.command`
argv. The Doctor smoke test now runs detect twice around a registration
and asserts the second approval carries the updated digest, not the first.

Validation: web bundle smoke passed 18/18 (rewritten, not a new count);
host-web passed 33/33, unaffected; `node --check web/cockpit.js` passed.

## Marlin Doctor Cross-Repo Note — Hygiene Migration (INIT.30.06)

**Closed:** 2026-08-12 under Marlin-owned `INIT.30.06`.

Cockpit's duplicate Portfolio Hygiene tab, standalone-provider dispatch, and
separate approval dialog are removed. The Marlin Doctor table now renders
validated string/choice inputs declared by target-scoped operations, preserves
their values between preview and apply, and includes the exact input object in
the existing digest-bound approval scope. The add-operation form accepts input
definitions as JSON so parameterized scripts remain runtime-addable rather
than becoming a hardcoded portfolio special case.

The browser regression drives required-input disablement, string/choice entry,
preview approval, rerender, apply approval, and exact provider payload binding.

## Marlin Doctor Cross-Repo Note — Target Health (INIT.30.07)

**Closed:** 2026-08-12 under Marlin-owned `INIT.30.07`.

Cockpit's Doctor tab now requests and renders Marlin's read-only
`marlin.doctor.assessment.v1`: project kind, Git state, governance detection,
last-known test status, machine-readable flags, policy-pack path, operation
counts/digest, DEV-DOC signal, supplied agent count, and assessment time.
The request is non-mutating and carries no approval because Marlin's health
handler reads manifests and existing evidence only; it does not run tests,
audits, registered operations, or agent probes.

Validation: browser smoke 18/18, host-web 33/33, and
`node --check web/cockpit.js` clean.

## Cross-Repo Note — Marlin Audit Demo Gaps Fixed (2026-08-20)

**Closed:** 2026-08-20 under `marlin` RUN work and a governance-commons RUN
(`gc-play-2026-08-20-001`), not Cockpit-owned code.

A live Playwright-driven run of this repo's own `host-web` against
`c:\dev\marlin` proved the discover→validate→remediate→approve→execute→
verify→evidence-export mechanism genuinely works end to end (real browser,
real subprocess, real downloaded evidence bundle), but surfaced three gaps
in the Marlin/GC-AUDIT machinery underneath it, all now fixed:

1. `marlin provider register-self` was implemented but never wired into
   the built `marlin` CLI — fixed in `marlin/packages/marlin-dxp/src/
   index.ts` (see `marlin/DEV-PLAN.md`).
2. `marlin`'s own `PLAY.jsonl` had two structural bugs and an 18-record
   required-checks non-conformance, corrected/documented under an
   authorized CI-30 exception (see `marlin/DEV-PLAN.md` and
   `marlin/PLAY.jsonl`'s `mrl-play-2026-08-20-001`).
3. `gc-audit.verify` (the `verify` stage of this repo's own stated
   7-stage chain) was a registered-but-`planned` stub, always returning
   `not-implemented`. Activated in `governance-commons/GC-AUDIT-REGISTRY.
   yaml` under its own authorized tooling PLAY (DEV-ACCORD-CI-43;
   `governance-commons/PLAY.jsonl`'s `gc-play-2026-08-20-001`) — new
   meaning: confirm a normalize apply actually took effect, by re-running
   `validate-bootstrap`/`validate-planning`/`validate-pointers`. No Cockpit
   code changes required; the fix is entirely in the registry and provider
   layers Cockpit already calls through.

Net effect: the Marlin Audit panel's `verify` stage now returns real
pass/fail results instead of always failing, closing the gap the original
demo surfaced. No changes to `web/cockpit.js`, `web/cockpit.html`, or
`host-web/` were needed — this cross-reference exists because the finding
came from exercising Cockpit's own UI, not because Cockpit's code changed.

## Platform Positioning — Cockpit Platform Boundary Locked (2026-08-20)

**Closed:** 2026-08-20, user directive, same session as the Marlin Audit
demo cross-repo note above.

The demo's finding — that Cockpit's only proven provider plugs
portfolio-specific GC-AUDIT content into an otherwise provider-agnostic
shell, making Cockpit useful to nobody but this portfolio's own user —
is resolved as a permanent positioning decision, not a bug to fix by
making every future provider look like Marlin's. See
`docs/specifications/cockpit-platform-boundary.md` for the full
statement. Summary: Cockpit is a customizable AI workspace shell with a
shared layer (shell, nav, command palette, settings, themes, approvals,
logs, provider discovery, diagnostics, extension points) that hosts a
tiered spectrum of providers — eco-native apps get the deepest
integration, but lighter provider contracts (a manifest, no governance
stack) are an equally valid, permanent tier, not a lesser one. Separately,
user-facing experience (themes, layout, density, shortcuts, workspace
profiles) is freely customizable; trust semantics (approval meaning,
permission warnings, provenance/evidence meaning, secret handling,
provider identity, security errors) are fixed platform behavior, never
themeable or per-provider.

The new doc also records, honestly, that Niji's current Cockpit
integration (`src/cockpit/adapters/niji.py`, wired into `host-web`'s
snapshot builder as a read-only health/state/preview card) is real
shipped code but is not equivalent to Marlin's proof: it has never been
run live against the real `niji` package (only a `FakeNijiAdapter` in
its test suite), and it has no approve/execute/verify/evidence stages —
it should not be cited as a second successful governed-loop integration
until it earns that claim the way Marlin's did.

## Niji Mode 4 Provider Proof — Closed (2026-08-21)

**Closed:** 2026-08-21, user-authorized gated sequence, same session as
the platform-boundary lock above.

Proved Cockpit can dispatch to a real, Marlin-discovered, external
`niji` provider over its real `cockpit-provider-v1` stdio protocol — not
`FakeNijiAdapter`, and not a rewrite of the existing in-process
`niji.py` adapter, which was left untouched. Full narrative and
acceptance-criteria checklist: `docs/specifications/cockpit-platform-boundary.md`'s
"Niji as a real mode-4 provider — proven 2026-08-21" section.

Summary of what changed in this repo:

- `web/cockpit.html` / `web/cockpit.js`: added a "Real Provider (Mode 4
  proof)" panel to the Niji tab. Runs `niji.palette.preview` through the
  existing generic `eco.cockpit.invokeProviderCommand` action — no
  backend plumbing changes were needed, since that path (`actions.js`,
  `host_bridge.py`'s `_execute_provider_command`) was already
  provider-agnostic and already proven against Marlin.
- `src/cockpit/tests/test_provider_browser_niji.py` (new): a default
  fixture-backed real-browser test (stages the real
  `providers/<id>/<version>/` directory shape with a stand-in stdio
  script, no build required) and an opt-in real-provider real-browser
  test (stages the actual `niji-provider.exe`, skipped unless a local
  build exists). Both pass locally.
- `src/cockpit/tests/test_provider_registry.py`: added an inline note
  to the pre-existing opt-in `test_real_marlin_installed_provider_stdio_roundtrip`
  explaining why it currently still fails on this machine (a separate,
  tracked issue in the private `marlin` repo, not this proof) — no
  assertion or behavior changed.

Cross-repo work this proof depended on, not in this repo: a
`marlin-registry` manifest fix adding `windows.arm64` support for niji
1.1.1 via x64 emulation (commit `a38f9c7`, pushed). Full record:
`marlin-registry`'s own commit message and this session's history.

Known follow-up, explicitly not fixed here: the private `marlin`
repo's bundled local dev-registry snapshot
(`packages/marlin/registry/manifests/niji.yaml`) shadows the corrected
`marlin-registry` entry for niji when installing through the real
`marlin install` CLI, so that specific path still fails on this
machine's arm64 even though the underlying binary and manifest are
now both correct. Needs a separately-authorized fix in the `marlin`
repo if/when the real published CLI needs to install niji on arm64
end-to-end.
