# DEV-PATH — Cockpit

**AUTHORITY LEVEL: AL:1**
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
| CKP-P0-03 | Decide extraction/packaging boundary | done | eco Track B B.2-02 |
| CKP-P1-01 | Define Cockpit public API and extension points | done | cockpit-ui-spec |
| CKP-P1-02 | Define standalone install/demo path | planned | release packaging |
| CKP-P1-03 | Define screenshots and product positioning | planned | product readiness |
| CKP-P1-04 | Establish universal UI host framing — Cockpit is eco's operator surface AND the portfolio's universal UI host | done | DEV-PLAN.md 2026-06-21 |
| CKP-P1-05 | CKP.6 — Marlin governance panel: embed Marlin-DXP core; expose install/audit/status surfaces in Cockpit | planned | DEV-PLAN.md CKP.6 |

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

---

## Phase 4 — Universal UI Host Expansion

**Recorded:** 2026-06-29
**Source:** DEV-PLAN.md Product Definition (2026-06-21)

### Decision

Cockpit's canonical scope was expanded from "eco's operator surface" to a dual role:

1. **eco operator surface (primary)** — unchanged: run lifecycle, PASS launching, escalation approval, artifact browsing, policy visibility, diagnostics.
2. **Universal UI host (capability)** — Cockpit is the GUI home for portfolio governance tooling and any portfolio product that needs a visual surface.

The universal UI host role does not replace or dilute the eco operator surface. It adds a governed extension point for portfolio-level panels.

### CKP.6 — Marlin Governance Panel

The first concrete use of the universal UI host role. Marlin-DXP (`dxp-init/`) exposes install, audit validate, and status operations via CLI. CKP.6 surfaces these inside Cockpit as a governance panel — removing the need for a standalone GUI for Marlin.

This was already recorded in DEV-PLAN.md's Release Targets table (CKP.6) and Product Ladder (v1.0). Recording here so DEV-PATH.md captures the decision lineage.

### Anti-Drift Addition

Do not treat Cockpit's universal UI host role as a reason to absorb unrelated product scope. New panels must be portfolio-level governance tooling, not arbitrary applications.

---

## Phase 5 — Package Install Automation Hardening

**Recorded:** 2026-07-01
**Source:** CKP.05D in DEV-PLAN.md

### Decision

Cockpit Phase 1 install automation must preview by default and require explicit
`--apply` before mutating the active Python environment. Install automation is a
package boundary, so it must be portable and host-neutral: command-line callers,
Marlin, Cockpit panels, VS Code, CI, and future shell hosts all get the same
preview/apply contract.

### Scope Boundary

The explicit-apply rule applies to Cockpit package installation only. It does not
authorize Marlin package writes, Cockpit policy edits, run submission, or escalation
approval. Those remain separate governed operations.

---

## Phase 6 — Marlin Governance Panel Slice

**Recorded:** 2026-07-01
**Source:** CKP.6A in DEV-PLAN.md

### Decision

Cockpit's first Marlin governance panel slice is an install-readiness surface, not
an installer. It exposes a read-only bridge record that previews Cockpit Phase 1
package install steps and returns the explicit apply command a host may run only
after human approval.

### Boundary

The host bridge remains read-only for this slice. An apply request inside the
readiness query is invalid. Future UI work may render an apply control, but the
approval event and command execution must be separate from the readiness query.

---

## Phase 7 — CKP Numbering Correction to DEV-ACCORD.02 Conformance

**Recorded:** 2026-07-02
**Source:** governance-commons DEV-ACCORD.02 (GC:2010) CLUSTER.NN.NN numbering rule

### Problem

Cockpit's CKP numbering predates the portfolio adopting DEV-ACCORD.02 as the
governing PASS numbering standard and drifted from it in two ways: (1) letter-
suffixed sub-passes (`CKP.05A`, `CKP.05B`, `CKP.05C`, `CKP.05D`, `CKP.6A`), which
DEV-ACCORD.02 does not permit — sub-passes are `CLUSTER.NN.01`-`.09`; and (2) a
real collision between the "Sequential Roadmap" table's `CKP.6` (Marlin
governance panel, still open) and the "Detailed sub-PASS log"'s `CKP.06`
(screenshot/demo flow, already closed) — two different pieces of work that
happened to collide on zero-padding, not the same thing under two spellings.
None of the CKP numbers were ever registered in `eco/passes/passes.registry.json`
(only `CK.00`-`CK.02` are registered there) — the same failure class as the
`DEV-ACCORD.11` citation error found and fixed in governance-commons on
2026-07-02 (see governance-commons `passchangelog.md` GC-PASS-0020.00), just
predating any gate for it.

### Correction (not renumbering)

Per CANON.01's immutability principle (superseded/corrected identities remain in
history; corrections are recorded, not overwritten) and this portfolio's
append-only doctrine, the existing "CKP.NN Closure" sections in `DEV-PLAN.md`
are left as-is. This section is the authoritative correction record; the
governed identity of each closed item going forward is the CLUSTER.NN.NN form
in the right-hand column below:

| Original label | Corrected identity | What it is | Status |
| --- | --- | --- | --- |
| `CKP.01` | `CKP.01.00` | Standalone planning docs | Closed |
| `CKP.02` | `CKP.02.00` | Audit eco Cockpit files vs CK.01/CK.02 | Closed |
| `CKP.03` | `CKP.03.00` | Extraction shape decision | Closed |
| `CKP.04` | `CKP.04.00` | Public API surface | Closed |
| `CKP.05` | `CKP.05.00` | Packaging checklist (primary) | Closed |
| `CKP.05A` | `CKP.05.01` | VS Code host-to-Python adapter bridge | Closed |
| `CKP.05B` | `CKP.05.02` | Bridge packaging and diagnostics hardening | Closed |
| `CKP.05C` | `CKP.05.03` | Phase 1 package install automation | Closed |
| `CKP.05D` | `CKP.05.04` | Explicit apply for install automation | Closed |
| `CKP.06` (detailed log) | `CKP.06.00` | Screenshot/demo flow | Closed |
| `CKP.6` / roadmap (Marlin governance panel) | `CKP.07.00` | Marlin governance panel (primary, still open) | Open |
| `CKP.6A` | `CKP.07.01` | Marlin panel install-readiness slice | Closed |

The "Sequential Roadmap" table in `DEV-PLAN.md` (its `CKP.0`-`CKP.6` rows) was
never a PASS registry — it is reclassified as a DEV-ACCORD.02 Work Item tracker
(informal planning rows, not individually governed identities). It is stale
relative to the Detailed sub-PASS log and should be read as historical context,
not a numbering authority.

### Registration

The corrected set (`CKP.01.00` through `CKP.07.01`) is registered in
`eco/passes/passes.registry.json` in the same PLAY this correction was recorded
in. `CKP.08.00` (Cockpit UI extraction, the work that surfaced this gap) is
registered as a new primary PASS from the start — see the corresponding
DEV-PATH entry below.

**Correction (2026-07-02, same session):** the paragraph above was written
before a follow-up decision changed the plan. eco's `ECO:` namespace is
explicitly "eco-specific, not portable" (`eco/passes/namespace.yaml`), and
`projects.yaml` already described Cockpit's governance as `runtime_of: eco` —
registering CKP there would have reaffirmed the exact dependency this
extraction removes. Instead, Cockpit self-declared its own `CKP:` namespace
under CANON.01's external-adopter model. The actual registry is
`cockpit/passes/passes.registry.json` (this repo, not eco's), with its own
`passes/namespace.yaml` and `passes/layers.yaml`. `projects.yaml`'s cockpit
entry was updated to drop `runtime_of: eco` and point at the new registry.

## Phase 8 — Cockpit UI Extraction (CKP.08.00)

**Recorded:** 2026-07-02
**Source:** CKP.08.00 in `passes/passes.registry.json`

### Decision

Extracted `cockpit.{html,css,js}` from `eco-vscode`'s embedded copy into
`web/` in this repo, making Cockpit's UI a standalone, host-agnostic bundle.
The only VS-Code-specific call in the entire bundle was `acquireVsCodeApi()`
(2 usages) — replaced with a generic `window.cockpitHost.postMessage()`
contract, documented in `docs/specifications/CKP.08-host-loader-contract.md`.
CSS's 8 `var(--vscode-*)` references got standalone fallback values.

`eco-vscode` was rewired (its own commit `c2c734b`) to resolve the bundle from
`../cockpit/web` (sibling checkout, matching the existing pattern
`cockpitBridgeConfig.ts` already used for the Python package), with its old
embedded `src/webview/` copy kept only as a documented legacy fallback.
`copy-webview-assets.cjs` (the VSIX packaging step) copies from the sibling
checkout at build time so a packaged extension doesn't depend on it existing
at runtime.

Verified end-to-end: `npm run build` in eco-vscode compiled clean and the
copied output was byte-identical to the new bundle source. All 71 existing
cockpit pytest tests still pass (untouched by this change).

### Remaining CKP.08 sub-lanes (not done this session)

- `CKP.08.04` — feature-parity audit against `eco/surfaces/vscode/eco-vs`'s
  richer, older embedded Cockpit implementation (869-line `cockpit.ts` vs
  `eco-vscode`'s 260-line `cockpitApi.ts`); port any missing UI features
  (run detail, artifact handling, policy editing, escalation approval) onto
  the bridge/adapter contract, not by copying `eco-vs`'s direct `.eco/`
  filesystem reads.
- `CKP.08.05` — mark `eco-vs`'s Cockpit panel superseded once parity is
  reached; update `eco-vscode`'s own DEV-PLAN "should converge" note to
  "converged".
- `CKP.08.06` — broader test coverage for the extracted bundle itself (a
  headless DOM test harness) and docs/PLAY closure.

## Phase 8.04 — Feature-Parity Audit (CKP.08.04)

**Recorded:** 2026-07-02
**Source:** `docs/specifications/CKP.08.04-feature-parity-audit.md`

### Decision

CKP.08.04 audited the older embedded `eco/surfaces/vscode/eco-vs` Cockpit panel
against the extracted `cockpit/web` bundle and the current `eco-vscode` host
loader. The extraction is structurally valid and host-agnostic, but feature
parity is not complete.

The old embedded panel included richer operator surfaces: run table/detail/copy
and rerun, escalation approval, artifact open/delete/undo, PASS run launching,
policy edit/validate/save/revert/open, governance diagnostics, editor-plane sync,
and HELM mode display. The extracted bundle currently covers health/status,
dynamic run-state counts, record counts, and Marlin install readiness.

### Boundary

The missing capabilities must be restored through Cockpit adapter/bridge
contracts and host-mediated approval gates. They must not be restored by copying
the old direct `.eco/` filesystem reads/writes into `cockpit/web`.

### Correction

Follow-up adapter review showed most of the parity gap is UI-only: run
list/detail/copy/rerun, escalation queue approve/deny, artifact list/open, PASS
run launcher, and policy viewer/editor already have enough adapter/bridge support
to port as a bounded UI PASS.

The real backend/architecture gaps are artifact trash/restore, governance
diagnostics as a modeled record, and editor-plane live sync.

### Next

Recommended next scope is `CKP.08.04a — UI-Only Operator Parity Port` as a
single PASS. Follow with smaller PASSes for artifact trash/restore and governance
diagnostics; defer editor-plane sync until the polling-vs-streaming architecture
choice is made.

## Phase 8.04a — UI-Only Operator Parity Port

**Recorded:** 2026-07-02
**Source:** `docs/specifications/CKP.08.04-feature-parity-audit.md`

### Decision

CKP.08.04a restored the UI-only operator surfaces in the extracted
`cockpit/web` bundle instead of copying the old embedded implementation. The
bundle now renders dashboard, run records, escalation queue, artifact index,
PASS run launcher, and policy editor tabs from one host-agnostic HTML/CSS/JS
surface.

### Boundary

The web bundle still contains no VS Code API calls and no direct `.eco`
filesystem access. It emits host-message intents only. Clipboard, editor open,
run submission, escalation approval, and policy save are delegated to the host
bridge and adapter contract.

Artifact delete/trash, governance diagnostics, and editor-plane live sync remain
outside this pass because they require backend contract or architecture changes.

### Zero-Trust Note

The VS Code host constrains artifact and policy editor-open paths to the active
workspace before calling VS Code editor APIs. Write-style actions route through
the Cockpit adapter contract and fail closed if the backing runtime client does
not support mutation.

### Next

Recommended next single PASS is `CKP.08.04b — Artifact Trash/Restore Backend
Contract`, unless visual smoke/headless DOM coverage for the extracted bundle is
prioritized first under CKP.08.06.

## Phase 9 — Portfolio Dirty/Sync Scan + Artifact Trash/Restore Backend Contract (CKP.08.06)

**Recorded:** 2026-07-02
**Source:** CKP.08.06 in `passes/passes.registry.json`

### Dirty/sync scan

Ran `git status --porcelain=v1 --branch` across cockpit, eco-vscode, eco,
governance-commons, marlin, niji before starting: all clean, all on `main`
tracking `origin/main`. Nothing uncommitted anywhere. The prior turn's large
diffs (CKP.08.04 audit, CKP.08.04a UI parity port) had already landed as real
commits from a concurrent session (`codex`, per `PLAY.jsonl` `declared_by`),
converging independently on the same UI-only/backend-gap classification this
session's own CKP.08.04 audit reached.

One real finding from the scan: `CKP.08.04a` was cited extensively (headings,
prose, `Pass-ID`-adjacent text) but never registered — the exact
CI-41 failure this session already fixed once, recurring one turn
later in a different repo. Root cause this time: (1) `validate-pass-citations.ps1`
is not wired into cockpit's git hooks yet (only governance-commons and eco have
it), and (2) even if it were, its heading regex expects a trailing
`(CLUSTER.NN)` parenthetical (governance-commons' convention) and would not
match cockpit's own `## CKP.NN Closure — Title` heading style. Corrected by
registering `CKP.08.05` (the retroactive `CKP.08.04a` work) and `CKP.08.06`
(this PASS, previously informally called `CKP.08.04b`) as proper sibling
sub-passes under `CKP.08.00` — see the correction section appended to
`docs/specifications/CKP.08.04-feature-parity-audit.md`. Not fixed this session:
wiring the citation gate into cockpit itself, or widening its heading regex to
match this repo's convention — flagged as follow-on work, not done here to keep
this PASS bounded to what was asked.

### Artifact Trash/Restore Backend Contract (CKP.08.06)

Closes the first of the two real backend gaps from the CKP.08.04 audit (not
governance diagnostics, not editor-plane sync — those remain open).

Added to `CockpitAdapter` (the ABC): `delete_record(record_type, record_id)`
and `restore_record(record_type, record_id, trash_ref)`, both defaulting to
`WriteNotSupportedError` like the existing `submit`/`approve`/`update_record`
pattern.

Implemented in `EcoAdapter`: `delete_record` moves an artifact into
`.eco/.trash/artifacts` (collision-safe naming, matching the old `eco-vs`
`deleteArtifact` behavior); `restore_record` moves it back, refusing if a file
already occupies the original path. Both resolve their path arguments through
a new `_resolve_contained_path` helper (mirrors `eco-vs`'s proven
`assertContainedPath`) so a `record_id`/`trash_ref` value cannot escape the
artifacts or trash roots.

Wired into `host_bridge.py` as `delete_record`/`restore_record` operations,
following the same dispatch pattern as `submit`/`approve`/`update_record`.

Not done this PASS: `cockpitApi.ts`/`webviewHost.ts` relay, or bundle UI
(delete/undo-delete buttons in the artifact table) — this PASS is scoped to
the backend contract only, per the audit's own framing and the user's request.
That wiring is a natural next PASS once this contract is confirmed stable.

### Validation

16 new tests added (`test_eco_adapter.py`: 13; `test_host_bridge.py`: 3).
87/87 passing (71 pre-existing, unaffected). `gc-audit validate-registry`
passes with `-ResolveExternal`. `gc-audit validate-pass-citations` passes
clean on the corrected audit doc.

## Phase 10 — Governance Diagnostics + Editor-Plane Sync (CKP.08.07, CKP.08.08)

**Recorded:** 2026-07-02
**Source:** CKP.08.07 and CKP.08.08 in `passes/passes.registry.json`

Compound PASS closing the two remaining `CKP.08.04` audit gaps not already
covered by `CKP.08.06`.

### CKP.08.07 — Governance Diagnostics Record Type

`EcoAdapter.RECORD_TYPES` gains `"governance"`, flowing through the existing
generic `list_records`/`get_record` dispatch — no `host_bridge.py` changes
needed, unlike `CKP.08.06`'s write operations. `_read_governance()` merges
three workspace-root files the old `eco-vs` Governance tab read directly:
`governance-diagnostics.json` (issues, hash match), `project.yaml`'s
`governance_mode` (regex-extracted, matching the old TS logic exactly), and
`health-report.json`'s `overall_score`. All three degrade gracefully to
absent/`"unknown"`/`null` rather than raising, since a workspace legitimately
may not have run governance validation yet.

Relayed through `cockpitApi.ts` (widened `CockpitRecordType` union) and
`webviewHost.ts` (added to the `Promise.all` in `buildCockpitSnapshot`,
included in every state push and the two error-fallback branches). Rendered
as a new Governance tab in the bundle: mode/health/hash-match/issue-count
tiles plus an issue table, matching `eco-vs`'s `govSummary`/`govIssueTable`
shape.

### CKP.08.08 — Editor-Plane Sync via Polling

Per the portfolio owner's architecture decision (polling over streaming, to
fit the existing request/response bridge contract without new adapter or
host-side file-watcher plumbing): `webviewHost.ts` now polls
`buildCockpitSnapshot` every 4s while the panel is visible
(`onDidChangeViewState` starts/stops the timer; disposed on panel close). A
lightweight signature (active pass, run state, record counts, governance)
is diffed against the last poll; a full `eco.cockpit.state` push only happens
on an actual change, avoiding needless webview re-renders. Rendered as a
three-tile status bar (`Active PASS` / `Run State` / `Gov State`) at the top
of the dashboard tab — `Gov State` is computed client-side from the
governance record (`clean`/`violation`/`contained`/`unknown`), mirroring
`eco-vs`'s `buildEditorPlaneSyncState` classification exactly (a `contained`
issue is one whose `rule` starts with `"containment"`).

### Validation

`npx tsc --noEmit` clean. `npm run build` clean, webview copy byte-identical
to source. `node --check cockpit.js` clean. Python: 96/96 passing (8 new
governance tests: defaults-when-absent, reads-diagnostics-file, reads-mode,
mode-defaults-to-full, reads-health-score, ignores-non-numeric-score,
malformed-json-treated-as-absent, list_records-single-item; plus 1 bridge
test). `CKP.08.08` has no Python-side change (host-only polling), so no new
Python tests for it.

## Phase 11 — Citation Gate Wiring (CKP.08.09)

**Recorded:** 2026-07-02
**Source:** portfolio-wide dirty/sync scan finding from the `CKP.08.06` PLAY

This repo had no git hooks at all - not the missing gap governance-commons
and eco already closed, a full absence. New `.pre-commit-config.yaml` wires
the shared `governance-commons/gc-audit/tools/validate-pass-citations.ps1`
(not duplicated per-repo) at both `pre-commit` (staged diff) and `commit-msg`
(trailer block) stages, matching the pattern already established in
governance-commons and eco. `pre-commit install --hook-type pre-commit
--hook-type commit-msg` installed cleanly - unlike eco, this repo had no
conflicting `core.hooksPath` (no Husky here).

The companion fix - widening the validator's heading regex to also match this
repo's `## CKP.NN Closure — Title` convention (governance-commons' gate
previously only recognized its own trailing-parenthetical style) - was made
in governance-commons (commit `0f8e8cb`), not here.

Verified with a fabricated `## CKP.99.99 Closure` heading staged in a scratch
file: `pre-commit run pass-citations-staged` correctly failed with the
unresolved-citation error, then the scratch file was unstaged and deleted.

## Phase 12 — Environment Setup Wizard Shell (CKP.09.04)

**Recorded:** 2026-07-02
**Source:** CKP.09.04 in `passes/passes.registry.json`, following the
`CKP.09.00` durable-boundary correction

Generic wizard shell added to the bundle: a new "Setup Wizard" tab with a
step indicator (active/complete states), a content area, and Back/Next
navigation. Steps are pluggable objects (`id`, `title`, `render`,
`isComplete`) so future provider setup flows register without touching the
shell itself — the shell was built generic on purpose, not Marlin-specific,
per the boundary statement.

`CKP.07`'s Marlin install-readiness preview is wired in as the one real step
today, rendered independently from the existing dashboard Marlin panel (same
underlying `state.snapshot.marlin` data, separate DOM/render path) so the
dashboard panel is unaffected. A step is marked complete when readiness data
has loaded (`status: ready` or `mode: preview`), not when a human has
actually applied anything — the bridge remains read-only; apply stays a
human action outside it, unchanged from `CKP.07`'s original safety boundary.

No backend/adapter changes - pure UI, reusing data already fetched by
`buildCockpitSnapshot`. 96/96 Python tests unaffected (none needed).

### Validation

`node --check cockpit.js` clean. `npm run build` clean, all three bundle
files (`cockpit.js`/`.html`/`.css`) byte-identical between source and copied
output. Python: 96/96 passing, unchanged.

## Phase 13 — Compound PASS: Marlin Provider Real Install + Niji Provider (CKP.09.05)

**Recorded:** 2026-07-02
**Source:** human-authorized compound PASS after CKP.09.04 and Marlin
environment setup scope correction

Cockpit remains the universal UI/UX host. This PASS does not narrow Cockpit into
"Marlin's UI" and does not move Marlin's installer, package registry, scaffold,
audit, or governance authority into Cockpit. The user-facing description is:
Marlin Environment Setup Wizard, rendered in Cockpit.

The bundle's setup wizard now includes a Marlin provider package-search/install
panel backed by host messages. The web UI sends only intent; eco-vscode owns the
VS Code host confirmation dialog and invokes the real Marlin CLI after explicit
human confirmation. Cockpit displays the returned JSON result.

A read-only Niji provider adapter was added through the existing adapter/bridge
pattern. It surfaces Niji health, available schemes, and a sample palette preview
without giving Cockpit write authority over Niji.

### Validation

Marlin JSON CLI smokes passed for `search`, `list`, and `install --dry-run`.
Cockpit Python tests pass with the Niji adapter tests included. eco-vscode builds
with the host-side Marlin subprocess and Niji snapshot integration.

## Phase 14 — Lasso Workspace and Marlin Workspace Explorer (CKP.10.00, CKP.10.01)

**Recorded:** 2026-07-05
**Source:** CKP.10.00 and CKP.10.01 in `passes/passes.registry.json`

### Registration note

`CKP.10.00`'s implementing commit (`9260f15`, "feat(web): add Lasso and
workspace explorer panels") landed with `Change-Level: DRIVE` and
`Dev-Docs: not-needed` in its trailer. Per DEV-ACCORD.06, DRIVE requires
`Dev-Docs: updated`, not `not-needed` — new panels and a new adapter record
type are a milestone, not a documentation-exempt change. This phase entry,
the matching DEV-PLAN closure, and the registry entries are that correction,
applied retroactively for `CKP.10.00` and from creation for `CKP.10.01`.

### CKP.10.00 — Lasso Workspace and Marlin Workspace Explorer Panels

Two new universal-host provider surfaces landed in the extracted bundle:

- **Lasso Workspace** — a multi-lane prompt-compose panel (Codex/Claude/
  Reviewer lanes, per-lane include toggles, shared prompt input, client-side
  merge into a composed-output textarea) mirroring the portfolio's existing
  3-agent workflow. Browser-local only; no backend adapter.
- **Marlin Workspace Explorer** — a read-only workspace-tree/repo-status
  surface. `MarlinAdapter` gains `workspace-tree` and `repo-status` record
  types: a depth/item-bounded directory walk with a skip-list for noise
  directories (`.git`, `node_modules`, `.venv`, build caches, etc.), path
  containment via `_resolve_contained_path` (same pattern as the `CKP.08.06`
  artifact trash/restore contract — refuses to resolve outside the workspace
  root or through UNC paths), and a `git status --porcelain=v1 --branch`
  shell-out per repo for branch/dirty detection.

### CKP.10.01 — Repo Status UI, Connection Badge, Responsive Shell

Follow-up UI pass rendering what `CKP.10.00`'s backend already exposed but
the bundle didn't yet show: a repository card grid (name, path, git branch/
dirty state, registry match) under the workspace tree/inspector. Adds a
topbar connection badge (`Host connected` vs `Preview mode`) so the operator
can tell live data from static preview data at a glance, a two-tier nav
grouping (`Operate` / `Providers` labels), and a wide-viewport (>=1040px)
responsive shell that moves the tab list into a sticky left rail. Also
enriches the bundle's static preview-mode fixture data (fake runs,
escalations, artifacts, policies, install-readiness, workspace tree, repo
statuses) so preview mode exercises the same render paths as a live host.

### Validation

`pytest` 115/115 passing (43 of those across
`test_web_bundle_smoke.py`/`test_marlin_adapter.py`/`test_host_bridge.py`
specifically). `node --check web/cockpit.js` clean.

### Next

No queued single PASS. Governance diagnostics and editor-plane sync remain
closed (`CKP.08.07`/`.08`); Lasso currently has no backend — wiring an actual
merge/dispatch adapter behind it (if the portfolio wants server-side lane
execution rather than client-only compose) is the natural next scope if
prioritized.

## Phase 15 — Boundary Decisions: Lasso Deferred, Quick-Bar Deferred, Mode Switching Built Host-Agnostic (CKP.09.01)

**Recorded:** 2026-07-05
**Source:** CKP.09.01 in `passes/passes.registry.json`, plus two scope
decisions made in the same session that produced no code (recorded here so
they aren't re-litigated)

### Decision 1 — Lasso stays client-only; real multi-agent work belongs to LASSO

The user asked for a real backend (CLI dispatch, configurable N-lane,
role-assignment) behind Cockpit's "Lasso Workspace" panel. Investigation
found that the actual multi-agent-collaboration product is **LASSO**
(`c:\dev\lasso`), a separate, pre-build/vision-phase repo with its own
owners (20Amp Labs engine, HBL Creative Studios UI) and its own four modes
(Parallel/Consensus/Merge/Plan-Role) — explicitly *not* eco's admin panel or
Cockpit's job to build. Building that architecture into Cockpit's tab would
mean building LASSO's product inside the wrong repo — throwaway work once
LASSO is built for real, since LASSO's engine will call through eco, not
spawn raw CLIs directly.

**Correction applied this session:** the tab's function is left completely
untouched. Its label was changed from "Lasso"/"Lasso Workspace" to
**"Compose Scratchpad"** (cosmetic only, `Change-Level: BUNT`, separate
commit from `CKP.09.01`) so it stops implying it's a preview of the real
LASSO product.

### Decision 2 — Quick-Bar deferred (still blocked on DevXToolkit v2.x)

`docs/specifications/CKP.v1.0-scoping.md` already marks Quick-Bar
**blocked**: the locked spec defines it as routing DevXToolkit v2.x
commands, and `devxtoolkit-v2-x` is an empty Phase-0 scaffold with nothing
to route to. Building a narrower substitute (a Cockpit-only command
palette over existing actions) was considered and explicitly rejected —
same reasoning as Decision 1: a stand-in either gets thrown away or becomes
a permanent unofficial substitute for scope DevXToolkit v2.x should own.
**Quick-Bar remains not scheduled.** Mode Switching (`CKP.09.01`, below) was
built instead, since the same scoping doc identifies it as the item with
real, usable prior art and no external blocker.

**2026-08-19 correction:** the "empty Phase-0 scaffold with nothing to
route to" premise no longer holds. `devxtoolkit-v2-x` underwent a scope-
correction migration the same day — it received the command-registry/
alias-grammar/introspection pillars `devxtoolkit-v1-x`'s v1.5/v1.6 had
built despite v2's own architecture brief having reserved them, plus
`Write-DevStatus` (the output-styling pillar). It is now `status: active`,
`ModuleVersion 2.1.0`, 12 real exported commands, 46/46 Pester passing —
not published to GitHub/PowerShell Gallery yet, but no longer an empty
scaffold. Quick-Bar is still **not scheduled** — clearing the blocker is
not the same as scheduling the work, and that remains a prioritization
call for the portfolio owner — but the specific reasoning above ("nothing
to route to") is stale as of this correction. See
`dxp-org/devxtoolkit-v2-x/DEV-PLAN.md` and `DEV-PATH.md`'s "Phase 2"/
"Phase 3" entries for the full account.

### CKP.09.01 — Mode Switching (HELM), built entirely host-agnostic

Implements the v1.0 ladder's mode-switching item. `EcoAdapter` gains a
`"mode"` record type: `list_records`/`get_record` read
`<workspace_root>/.eco/helm/mode_history.json` (same graceful-degradation
pattern as `CKP.08.07`'s governance record — absent/malformed file reads as
`current_mode: null`, empty history), and `submit("mode", {mode})` appends a
`{previous_mode, current_mode, time_loc}` entry — pure file I/O, no
subprocess, no VS Code API, works under any future host per the `CKP.03`
three-phase rule.

**Design correction made mid-session:** an earlier draft of this PASS
proposed porting `eco-vs`'s actual `helm.ts`/`helm-session.ts` implementation
into `eco-vscode` (mirroring how Cockpit's own UI was extracted from `eco-vs`
in `CKP.08`), on the theory that it matched a documented "HELM/PASS
convergence remains open" note in `eco-vscode/DEV-PLAN.md`. The user
correctly objected: that would make the mode-switching *feature itself*
depend on a VS Code extension, contradicting `CKP.03`'s explicit rule that
"VS Code bridge and standalone shell are adapters on top of [the Python
package], not separate APIs." The design was corrected before any
`eco-vscode` or `eco` code was touched — this PASS makes **zero changes to
`eco-vs` or the `eco` repo**. `eco-vscode`'s only role is the same thin,
generic message-relay every other write action (approve escalation, save
policy, delete artifact) already requires — no new business logic there.

Bundle UI: a 4th "Operator Mode" tile on the dashboard's editor-plane-sync
status bar (read-only), and a "HELM Mode" section on the Governance tab
(mode selector, Activate button, change history list).

### Validation

126/126 pytest passing (11 new: 8 `EcoAdapter` mode tests, 2 Playwright
smoke tests, 1 updated existing `submit()` error-message assertion).
`node --check web/cockpit.js` clean.

### Correction — `time_loc` conformance to the real time.loc v1.2 schema

Before doing live-round-trip testing, `c:\dev\eco\.eco\helm\mode_history.json`
(real history written by `eco-vs`'s live usage) was checked to sanity-check
the `time_loc` field shape. It is not a plain timestamp string as this PASS
originally assumed — it is a structured **time.loc v1.2** record (a portable
portfolio-wide standard, `c:\dev\time-loc`: dual local/UTC timestamps, geo
provenance, a ULID sequence, HMAC-SHA256 integrity). `EcoAdapter._write_mode`
was writing a bare ISO string, which would have mixed formats in a real,
shared file.

`time-loc` had no packaging (no `pyproject.toml`) and could not be
pip-installed. Rather than vendor a copy (the precedent `governed-event`
already uses — it vendors its own `time_loc.py`/`time_loc_compact.py` instead
of depending on a package), the portfolio owner chose to fix the root cause:
`time-loc` (`340aefc`) now ships a real `pyproject.toml` packaging its three
flat top-level modules (`time_loc`, `time_loc_compact`, `time_loc_validator`
— matching `governed-event`'s actual working imports and the modules' own
docstrings, not the inconsistent `python.time_loc`-style example the README
previously showed). `typing-extensions` was added as an explicit dependency
after a clean-venv install revealed `python-ulid` needs it but doesn't
declare it.

`cockpit/pyproject.toml` now depends on `time-loc` (git dependency, not a
local-path dependency, per the portfolio's modularity/portability standard).
`_write_mode` uses `produce_unsigned_unavailable().to_dict()` — same
provenance shape (`geo.source: "unavailable"`, `sig: "unsigned"`) `eco-vs`'s
real entries already use. The bundle's history renderer (`renderHelmMode`)
gained a `formatTimeLoc()` helper handling both the old plain-string shape
(covered by the smoke-test fixture) and the new structured-object shape
(covered by the static preview fixture and a new adapter test asserting the
full `time.loc/1.2` shape).

**Also surfaced, not fixed (separate, larger issue):** `cockpit`'s own
`pytest` run was found to resolve to `c:\dev\eco\.venv\Scripts\python.exe`
rather than a cockpit-local venv — cockpit is not currently self-contained
against its own stated goal (and the portfolio's modularity standard) of
working regardless of venv or platform. All verification in this PASS was
done in throwaway scratch venvs specifically to avoid deepening that
coupling, but the coupling itself remains and needs a dedicated fix.

**Validation:** 127/127 pytest passing (re-run in an isolated scratch venv,
not `eco`'s), including a fresh `pip install -e .` of `time-loc` from a clean
venv with no manual workarounds. `node --check web/cockpit.js` clean.

**Live round-trip confirmed (2026-07-05, portfolio owner):** the full path —
Cockpit bundle → `eco.cockpit.setHelmMode` → `eco-vscode`'s relay →
`EcoAdapter.submit("mode", ...)` → `mode_history.json` write → next poll's
snapshot reflecting the new mode and history — was exercised in a real VS
Code Extension Development Host against a scratch `.eco/` workspace and
works. The one remaining unknown flagged at the end of `CKP.09.01`'s original
implementation is closed.

## Correction — Dashboard Degrades By Provider, Not By Eco Workspace (2026-07-05)

User pointed out Cockpit should function without eco. Checked the actual
`buildCockpitSnapshot` behavior first: it already only hard-requires *a VS
Code folder be open*, not an `.eco/` workspace — `EcoAdapter`'s own methods
already return empty/degraded data rather than raising when `.eco/` is
absent, so Marlin, Niji, HELM Mode, and Workspace Explorer already populate
with real data in any folder. The actual bug was presentation: the top
dashboard status-grid (`Status`/`Total runs`/`Escalations`/`Artifacts`/
`Health`/`.eco root`) is entirely eco-scoped data, but its labels didn't say
so — so `Health: degraded` (accurate for the eco adapter specifically, since
`EcoAdapter.health()` correctly reports degraded without an eco root) read as
"Cockpit itself is broken," even when every other provider tab was working.

Fix: relabeled the top-grid tiles (`Status`→`Eco Status`, `Total runs`→
`Eco Runs`, etc., `Health`→`Eco Health`) so scope is explicit at a glance, and
reworded the initial-load footer placeholder from "Open an eco-governed
workspace to load Cockpit state" to name which tabs need `.eco/` (Runs,
Escalations, Artifacts, Policy, Governance) versus which don't (Marlin, Niji,
Workspace, Mode). No backend/adapter changes — this was a labeling bug, not a
functional one. A follow-up worth doing later (not done here, kept this fix
small per explicit instruction): a compact non-eco "Providers" summary tile
on the dashboard, so the top-of-page view isn't 100% eco-flavored even in
its accurate labels.

**Not done, considered and deferred:** a standalone (no VS Code, no eco, open
a URL) public web shell — Cockpit's own `CKP.03` Phase 3, still unbuilt. That
would be the real fix for "Cockpit as a free public offering," but is a
substantial separate build, not part of this correction.

**Validation:** 127/127 pytest (cockpit's own `.venv`), `node --check
web/cockpit.js` clean.

## Phase 16 — Standalone Web Host, CKP.03's Phase 3 Finally Built

**Recorded:** 2026-07-05

### Deployment model and Phase 4

Built the **locally-run** standalone web host (`npm start`, open `localhost`,
point at your own machine's workspace) — matches `CKP.03`'s own Phase 3
definition exactly, and mirrors LASSO's v0 shape from the same session. A
genuinely public, multi-tenant hosted version (strangers sharing a server)
is named **Phase 4** here for the first time: a distinct, deliberately
deferred, much larger, security-critical project (auth, per-tenant
workspace isolation, subprocess sandboxing, abuse/resource limits) —
planned-not-started, not scoped or estimated in this PASS. Design principle
so Phase 4 doesn't require a Phase 3 rewrite: `host-web/server.js`'s
`/api/bridge` handler is stateless per request, scoped to one configured
workspace root with no global mutable state beyond that — a future Phase 4
control plane could run one Phase 3 server instance per tenant/container.

### What got built

New `host-web/` directory (colocated in this repo, not a separate repo —
unlike `eco-vscode`, which is separate purely for VS Code marketplace
packaging reasons that don't apply here): a plain Express server serving
the **unmodified** `web/cockpit.{html,css,js}` bundle, proving
`docs/specifications/CKP.08-host-loader-contract.md`'s host-agnostic
contract is real — that document already speced this exact case ("a
plain-browser host... can skip the CSP/nonce substitution entirely and
call `cockpit.host_bridge` from a small local HTTP shim") before any code
existed.

`host-web/bridgeClient.js` spawns `python -m cockpit.host_bridge` per
request (same JSON-stdin/stdout contract `eco-vscode`'s TypeScript already
uses, just called from Node); `host-web/snapshotBuilder.js` assembles one
combined snapshot mirroring `buildCockpitSnapshot`'s exact shape via
parallel bridge calls, independently of `eco-vscode`'s own TS orchestration
(the contract requires compliance, not shared code, between hosts);
`host-web/actions.js` dispatches every `eco.cockpit.*` message type the
bundle already sends, matching `webviewHost.ts`'s message shapes field-for-
field so the bundle needs zero changes.

### Security work carried over and extended from LASSO

The same session's LASSO build (`c:\dev\lasso`) had already found and fixed
a real command-injection bug: spawning a `.cmd` npm shim on Windows requires
`shell: true`, and Node does not escape `args` when shell is true. That
lesson applied again here for `marlinCli.js` (real `marlin search` CLI
spawn) — but with an added wrinkle LASSO's `claude`/`codex` case didn't
have: `marlin search <query>` is a positional-arg CLI with no evidence it
accepts stdin instead, so the stdin-instead-of-argv fix wouldn't apply
cleanly. Rather than accept the injection risk for the PATH-based `.cmd`
fallback, `marlinCli.js` **fails closed**: it only runs via the sibling-
checkout path (`process.execPath` invoking the compiled JS directly — a
real `.exe`, no shell involved, no injection surface regardless of query
content) and explicitly refuses to fall back to the shell-requiring `.cmd`
path at all, rather than silently exposing the same class of bug.

### Gap found and fixed during manual verification, not caught by unit tests

The unmodified bundle's CSP template (`web/cockpit.html`) has no
`connect-src` directive, so it falls back to `default-src 'none'` — which
silently blocks the bootstrap script's `fetch('/api/bridge', ...)` call
entirely. VS Code's `postMessage` transport never needed `connect-src`, so
this gap never surfaced there; it only appeared when testing this host in a
real headless Chromium (confirmed via the exact browser console error:
*"Refused to connect because it violates the document's Content Security
Policy"*). Fixed in `server.js` by substituting the whole CSP directive
server-side (adding `connect-src 'self'`) rather than just filling the
`${cspSource}`/`${nonce}` placeholders — per the host-loader-contract's own
allowance that a plain-browser host may use a more permissive CSP.

### Three actions with no clean web equivalent — downgraded, not faked

- `copyRunJson`: no host-side clipboard API without a bundle-side script
  change (out of scope, zero bundle changes) — logs JSON to the server
  console instead.
- `openArtifact`/`openPolicy`: no in-bundle slot to render file content
  inline without a bundle change — opens the file with the OS default
  application instead (`host-web/osOpen.js`; real equivalent for
  `workspaceReveal` too, revealing the containing folder).
- `marlinInstallPackage`: VS Code gates real package installs behind a
  native modal confirm dialog; a headless Node process has no equivalent
  without a bundle change, and silently skipping confirmation for a real
  package-mutating action would be a genuine safety regression, not a
  missing nicety — declines with an explanatory message instead.

### Validation

24/24 new `host-web` unit tests (mocked subprocess throughout — `node --test
tests/*.test.js`, no real CLI/Python calls). Manually verified end-to-end
against real infrastructure: full dashboard render against `c:\dev\eco`'s
real `.eco/` data (including real historical HELM mode entries from actual
`eco-vs` usage back in April) with zero console errors in a real headless
Chromium; a full write round trip (mode selector → Activate → real
`mode_history.json` write with a correctly-shaped `time.loc/1.2` record)
verified against a scratch workspace, not the real `eco` one, to avoid
polluting production history during testing.

**Registration correction:** the implementing commit (`2eee10d`) used
`Change-Level: PASS` with `Pass-ID: standalone` — a placeholder accepted by
the citation gate as a valid non-citation value, not an actual registered
PASS ID, which `Change-Level: PASS` requires per `DEV-ACCORD.06`. Registered
as `CKP.11.00` (`CKP:1018`, parent `CKP:0003` — the `CKP.03.00` extraction-
shape decision this closes the third form of) in a follow-up commit — the
same self-caught conformance pattern already corrected twice earlier this
session (`CKP.09.01`'s original commit, and the Lasso-relabel/`time_loc`
commits).

## Phase 17 — Phase 4 Multi-Tenant Hosting Design (CKP.12.00)

**Recorded:** 2026-07-06
**Source:** `docs/specifications/CKP.12-phase4-multitenant-design.md`

### Decision

Phase 16 deferred public multi-tenant hosting as its own security-critical
planning pass. This phase is that pass: a design, not an implementation.
Portfolio-wide search found no existing auth, multi-tenancy, or subprocess
sandboxing precedent anywhere in `c:\dev` — Phase 4 is a from-scratch design.

The recommended architecture is a thin control plane in front of unmodified,
one-per-tenant Phase 3 `host-web` instances running in containers, directly
reusing Phase 16's own stated design principle. Auth, tenant isolation,
subprocess sandboxing, and abuse/resource limits all live in the new
control-plane component (`host-cloud/`, colocated in this repo); `host-web`
itself is not rewritten.

**Left explicitly open:** the auth model (GitHub OAuth vs. email magic
link) is documented as a tradeoff with a recommendation, not decided —
closing it is a prerequisite for any implementation PASS. Production
hosting/orchestrator choice, secrets management, billing/quota mechanics,
and TLS/domain routing are also out of scope for this design.

### Real gap found during design review, fixed separately

Reviewing `host-web` for this design surfaced an independent, pre-existing
gap in already-shipped Phase 3 code: `index.js` bound the server to all
network interfaces by default (no host argument to `app.listen`), and
`host-web` has zero auth — so a locally-run `npm start` was reachable by
anyone who could reach that interface, not just `localhost`. Fixed in the
same session as a small separate patch: default bind is now `127.0.0.1`,
overridable via `COCKPIT_HOST`. This is a Phase 3 hardening fix, not part of
the Phase 4 design itself.

### Next

Recommended next bounded PASS: close the auth model decision and build a
minimal tenant-registry skeleton (no container orchestration yet) — see the
spec doc's "Recommended Next Bounded PASS" section for the concrete test
plan. Phase 4 as a whole remains planned-not-started.

## Phase 18 — Auth Model Decision + Tenant-Registry Skeleton (CKP.13.00)

**Recorded:** 2026-07-06
**Source:** `CKP.12.00`'s "Recommended Next Bounded PASS" section

### Decision

Closed the auth model decision `CKP.12.00` left open: **GitHub OAuth**, per
that doc's own recommendation (no credential storage, fits a dev-tooling
audience). Built the smallest real slice of the control plane: a new
`host-cloud/` directory (colocated in this repo, sibling to `host-web/`),
containing a JSON-file-backed tenant registry, a stateless signed session
token (HMAC-SHA256, not a JWT library — a small self-written signer for a
fixed, tiny claim set), a GitHub OAuth login/callback flow, and one proof
endpoint (`POST /api/whoami`) demonstrating the core invariant end-to-end.

**No container orchestration yet** — `host-cloud` runs as a single process
today; per-tenant container lifecycle remains future scope, as `CKP.12.00`
itself scoped out.

### The core invariant, proven not just asserted

`server.js`'s `requireSession` middleware is the only place `req.tenant` is
ever set, and it derives `workspaceRoot` exclusively from the tenant record
looked up by the session token's `tenantId` claim — never from
`req.body`/`req.query`/`req.headers`. A dedicated test
(`host-cloud/tests/server.test.js`, "a request cannot override its resolved
workspaceRoot/tenant via the request body") sends a body containing both a
forged `workspaceRoot: '/etc'` and a forged `tenantId` for another tenant,
and asserts the response still reflects the authenticated caller's own
record. This is the exact Phase 3 gap `CKP.12.00`'s design identified,
closed for `host-cloud`'s new code path (`host-web` itself is unchanged).

### Symlink-aware containment, closing the gap `CKP.12.00` flagged

`host-cloud/pathContainment.js` adds `resolveContainedPathStrict`, resolving
through `fs.realpathSync` (walking up to the nearest existing ancestor for
not-yet-created paths, then reattaching the suffix) before the containment
comparison — unlike `host-web/pathContainment.js`'s lexical-only
`path.resolve`/`path.relative` check, this one is not fooled by a symlink
inside the workspace pointing outside it.
`host-cloud/tests/pathContainment.test.js` includes a real symlink-escape
test; it skips itself (via `t.skip`, not a hard failure) in environments
where symlink creation needs elevated privileges (confirmed on this Windows
dev machine: `EPERM`, no Developer Mode enabled) rather than silently
passing or failing the whole suite.

### Deliberately not built this PASS

- Container orchestration / per-tenant process isolation (still plain JSON
  file and directory storage, not containers).
- Rate limiting, concurrency caps, disk quotas, idle-teardown (all named in
  `CKP.12.00`'s "Abuse / Resource Limits" section, none implemented here).
- Capability-scoped tokens (read-only vs. mutating action classes) —
  today's session token only carries `tenantId`; per-action-class claims
  are future scope.
- Actual proxying to a tenant's `host-web` instance — `/api/whoami` proves
  the resolution invariant without a real `host-web` process behind it yet.

### Validation

24 new tests in `host-cloud/tests/` (`tenantRegistry.test.js`,
`session.test.js`, `githubAuth.test.js`, `pathContainment.test.js`,
`server.test.js`): 23 passing, 1 self-skipped (symlink creation permission
in this environment). No changes to `host-web/` or any Python code in this
PASS.

### Next

The items listed under "Deliberately not built this PASS" are the natural
follow-on slices — container orchestration is the largest of them and
warrants its own bounded PASS rather than being combined with anything
else.

## Phase 19 — Process Orchestration, Rate/Quota Limits, Capability Tokens, Real Proxying (CKP.14.00)

**Recorded:** 2026-07-06
**Source:** `CKP.13.00`'s "Deliberately not built this PASS" list, done together as one compound PASS at the portfolio owner's request ("as much as possible")

### Docker was attempted for real, and genuinely cannot run here

Before writing any stand-in, a real attempt was made to run `CKP.12.00`'s
actual container-orchestration design: Docker Desktop was launched on this
machine. It failed with `WSL_E_WSL_MOUNT_NOT_SUPPORTED` — `wsl.exe --mount`
requires Windows build 27653+ on ARM64, and this machine is on build
26200 (confirmed via `[System.Environment]::OSVersion.Version`, not
assumed). This is a platform-version gap, not a sign-in or configuration
issue — the VS Code Docker extension was also considered and confirmed to
depend on the same underlying daemon, so it doesn't route around the gap
either. Real container orchestration against this design remains
unbuilt-and-unbuildable **on this specific machine** until a compatible
Windows build or a different host is available; the design itself
(`CKP.12.00`) is unaffected and should still be the target once a working
Docker host exists.

### Non-Docker stand-in: real per-tenant OS processes

`host-cloud/processManager.js` spawns one **unmodified** `host-web`
(`CKP.11.00`) child process per tenant — real OS-process isolation (separate
PID, separate loopback port, separate Express instance state), with a
narrower blast radius than a container (no cgroup/seccomp/filesystem-
namespace boundary). `ensureRunning`/`stop`/`sweepIdle`/`touch` are
deliberately container-manager-shaped so a real Docker (or other runtime)
backing can be swapped in later without changing `server.js`'s calling code.
Readiness is detected by watching the child's stdout for `host-web/index.js`'s
own `"listening on"` log line, not a fixed sleep.

### Abuse / resource limits

- `rateLimiter.js` — per-tenant token bucket (capacity + refill rate),
  checked before a request reaches process spawn or proxying.
- `quota.js` — best-effort, application-level disk usage check
  (`directorySizeBytes`/`withinQuota`), gating mutating actions only (read
  actions remain available even over quota). Documented honestly as a soft
  backstop, not real enforcement — true disk quotas need filesystem/
  container-runtime support this non-Docker stand-in doesn't have.
- `processManager`'s `maxConcurrentTenants` cap and `sweepIdle` (idle-timeout
  teardown, driven by an explicit `touch()` on every proxied request, not a
  fixed TTL).

### Capability-scoped tokens

`session.js` gained a `capabilities` claim (`['read', 'write']` by default
for a normal login; a narrower `['read']`-only token can be issued
separately). `capabilities.js` maps every `eco.cockpit.*` message type from
`host-web/actions.js`'s own dispatch switch to `'read'` or `'write'`
(unrecognized types fail closed to `'write'`), and its `requireCapability`
middleware enforces this independently of tenancy — a valid session for the
right tenant can still lack `'write'` if issued as a read-only token.

### Real proxying, and a real bug live testing caught that mocks would have missed

`proxy.js` forwards an authenticated request to the tenant's running
`host-web` instance's `POST /api/bridge` and relays its response unchanged,
per `CKP.08-host-loader-contract.md`. `server.js`'s `/api/bridge` now chains
`requireSession` → `requireRateLimit` → `requireCapability` → quota check →
`processManager.ensureRunning` → `proxy.forward`.

While building the real end-to-end test (`host-cloud/tests/endToEnd.test.js`
— spawns an actual `host-web` child against this repo's own `.venv`, no
mocks), a genuine bug surfaced: `requireSession` builds
`req.tenant = { id, workspaceRoot: tenant.workspacePath }`, but
`processManager.ensureRunning` read `tenant.workspacePath` — a property-name
mismatch, so `WORKSPACE_ROOT` was passed to the child as `undefined`, and
`host-web/index.js`'s own fallback chain silently resolved to the child's
inherited **control-plane** cwd instead of the tenant's workspace. Every
tenant would have gotten the control plane's own directory. Caught only
because the end-to-end test asserted the *real* resolved path against a
*real* spawned process instead of trusting a mock; a mocked-only test
double would have had no way to expose this, since the mock would have had
to encode the same (wrong) assumption to begin with. Fixed by renaming
`processManager.js`'s expectation to `tenant.workspaceRoot`, matching the
property name every other part of this codebase already uses.

### Deliberately not built this PASS

- Real Docker/container orchestration (blocked on this machine's platform
  version, see above — the design and code shape are ready for it).
- Capability tokens are issued only with full `['read','write']` today;
  there is no UI/endpoint yet to actually request or hand out a narrower
  `['read']`-only token to a third party.
- True filesystem-level disk quota enforcement (only the best-effort
  application-level check exists).

### Validation

54 tests in `host-cloud/tests/` (30 new this PASS: `processManager.test.js`,
`rateLimiter.test.js`, `quota.test.js`, `capabilities.test.js`,
`proxy.test.js`, `endToEnd.test.js`, plus `/api/bridge` additions to
`server.test.js` and capability additions to `session.test.js`): 53 passing,
1 self-skipped (symlink permission, unchanged from `CKP.13.00`). The
end-to-end test is a real spawn of `host-web` + the real Python `cockpit`
package via this repo's own `.venv` — not mocked — and is the test that
caught the `workspaceRoot` bug above. `host-web`'s own 28/28 tests remain
unaffected (no changes to `host-web` in this PASS).

### Next

Real container orchestration once a compatible Docker host exists (a
different machine, a newer Windows build, or a Linux CI runner); a real
endpoint for issuing narrower-scoped tokens; true disk quota enforcement.

## Phase 20 — Secure-Cookie Enforcement (CKP.15.00)

**Recorded:** 2026-07-06
**Source:** security review of `CKP.12.00`–`CKP.14.00`'s `host-cloud/` changes

### The finding

A security review of `host-cloud`'s auth-critical code found
`server.js`'s `serializeCookie` set `HttpOnly; SameSite=Lax` on both the
`oauth_state` and `cockpit_session` cookies but never `Secure`. Since
`cockpit_session` is the sole bearer credential for a control plane
explicitly designed for public multi-tenant hosting, and `host-cloud`
defaults to binding `0.0.0.0` with no TLS termination of its own (TLS/
reverse-proxy setup was named as deferred ops scope in `CKP.12.00`), the
session cookie would be sent over plain HTTP in this PASS's own shipped
default configuration — a concrete session-hijacking vector via network
interception (public wifi, shared LAN, or any passive on-path attacker),
not a theoretical hardening gap.

### The fix

`serializeCookie` now takes a `secure` option (default `true`). `index.js`
gained `resolveRuntimeSecurity()`, which fails closed: binding a
non-loopback host now **refuses to start** unless the operator explicitly
sets `COCKPIT_CLOUD_TLS_TERMINATED=1` (deployed behind real HTTPS
termination — cookies get `Secure`) or `COCKPIT_CLOUD_ALLOW_INSECURE_HTTP=1`
(an explicit, named opt-out for local/dev-only testing — cookies drop
`Secure` too, since a `Secure` cookie over plain HTTP is simply never sent
by the browser and would silently break the flow rather than protect it).
A loopback bind (`127.0.0.1`/`localhost`/`::1`) is allowed without either
flag, matching `host-web`'s own local-dev posture.

### Validation

61 tests in `host-cloud/tests/` (7 new: 3 cookie-attribute assertions in
`server.test.js`, 4 `resolveRuntimeSecurity` cases in a new
`index.test.js`), 60 passing, 1 self-skipped (symlink permission,
unchanged). Confirmed the refusal path is real: `resolveRuntimeSecurity`
throws for the default (`HOST` unset → `0.0.0.0`, no TLS/insecure flag)
rather than silently starting insecure, which is what `CKP.12.00`-`14.00`
shipped before this fix.

## Phase 21 — Read-Only Token Issuance Endpoint (CKP.16.00)

**Recorded:** 2026-07-06
**Source:** `CKP.14.00`'s "Deliberately not built this PASS" list — capability
tokens existed with no endpoint to actually issue a narrower one

### Decision

`POST /api/tokens/readonly` (`server.js`) lets any authenticated tenant
mint a new token scoped to exactly `['read']`, regardless of the caller's
own capabilities — this never escalates, since the issued token's
capability set is fixed, not inherited or widened. `ttlSeconds` is
accepted in the body and clamped to `[60, 86400]` (1 minute to 24 hours),
defaulting to 1 hour, so a caller can't mint an effectively-permanent
token by requesting an absurd TTL.

The intended use is generating a share/embed link or a token for a
read-only integration without handing out the caller's own full session.

### A second, necessary change: Bearer-token authentication

A token minted by this endpoint would have been useless without a way to
actually use it — `requireSession` only read `cockpit_session` from a
cookie, and a non-browser caller (a script, a third-party read-only
integration) has no cookie jar. `requireSession` now also accepts
`Authorization: Bearer <token>`, checked as a fallback after the cookie.
This doesn't change any existing behavior for browser sessions (cookie
still takes priority) and doesn't add any new trust boundary — it's the
same `session.verify()` call, just fed from a different transport.

### Validation

66 tests in `host-cloud/tests/` (5 new: token issuance, TTL clamping,
requires-session, Bearer-header auth round trip, and a read-only Bearer
token still rejected from a write action), 65 passing, 1 self-skipped
(symlink permission, unchanged).

### Next

Real GitHub OAuth verification (currently mocked-fetch-only) needs a real
GitHub OAuth App's credentials from the portfolio owner; real container
orchestration remains blocked on Docker access; true filesystem quota
enforcement remains unbuilt.

## Phase 22 — Diagnostics Dashboard Expansion (CKP.09.02)

**Recorded:** 2026-07-06
**Source:** `CKP.v1.0-scoping.md`'s item 2 (Diagnostics dashboard), the only
real, unblocked v1.0 ladder item left — Quick-Bar and "environment
emergence UI" remain blocked on things outside Cockpit's control.

### Research before building

The locked spec (`eco/docs/specifications/cockpit-ui-spec.md`) requires
"unified status for runtime health, integrations, environment checks, and
agent pipelines." Runtime health already existed (`CKP.08.07`'s Governance
tab). Before writing code, each of the other three was investigated for a
real existing data source rather than assumed:

- **Integrations** — cheap. `EcoAdapter`/`MarlinAdapter`/`NijiAdapter`
  already each have a `health()` method with a uniform shape; only
  `marlin('health')` was missing from the snapshot call, everything else
  already existed.
- **Environment checks** — genuinely new. No `marlin doctor`, no venv/
  toolchain/version check existed anywhere in this portfolio. The
  portfolio owner scoped it: Python interpreter/version + cockpit package
  importable, Node version.
- **Agent pipelines** — medium. `PLAY.jsonl` (a per-repo dev-process
  ledger, this portfolio's own governance convention, not a `.eco/`
  runtime artifact) already records which agent declared each PASS, but
  nothing aggregated it into a status view.

### What was built

- `src/cockpit/adapters/system.py` — new `SystemAdapter` (`backend_id`
  `"system"`, not workspace-scoped — there is exactly one "system" per
  running `cockpit.host_bridge` process), registered in
  `host_bridge.py`'s `_build_adapter`. Reports Python executable/version/
  cockpit-importable/cockpit-version, and Node availability/version (via
  `shutil.which` + `node --version`).
- `EcoAdapter` gained a new `"agent-pipeline"` record type: reads
  `<workspace_root>/PLAY.jsonl`, aggregates by `declared_by`, gracefully
  degrades to an empty aggregation if the file is absent or a line is
  malformed — matching every other `_read_*` method's pattern in this
  adapter.
- `host-web/snapshotBuilder.js` — added the `marlin('health')` call, the
  new `system('get_record', ...)` call, and the new
  `eco('get_record', {record_type: 'agent-pipeline', ...})` call; assembled
  into a new `diagnostics` section of the snapshot shape.
- `eco-vscode/src/cockpitApi.ts`/`webviewHost.ts` — added
  `createPythonSystemCockpitApi`, the two new `CockpitRecordType` values,
  and the same `diagnostics` assembly in `buildCockpitSnapshot`/
  `loadMarlinInstallReadiness`, so both hosts stay in sync per
  `CKP.08-host-loader-contract.md`.
- `web/cockpit.html`/`cockpit.js` — a new "Diagnostics" tab: an
  Integrations status grid, an Environment status grid, and an Agent
  Pipelines table. Static preview-mode fixture data enriched to match.

### A real bug caught by an inline ad hoc test, not the real code

While manually verifying the wiring, an early test run showed
`workspace_id` arriving at Python with its backslashes stripped
(`"C:devcockpit"` instead of `"C:\dev\cockpit"`). Traced to the ad hoc
verification command itself — nested bash/JS string escaping consumed the
backslashes before Node ever saw them — not a bug in `snapshotBuilder.js`
or `bridgeClient.js`. Re-verified with a real script file (no shell
re-escaping) and confirmed the actual wiring is correct: real
`marlin.health`, all three integrations, real Python/Node environment
data, and real `PLAY.jsonl` entries correctly aggregated by agent. Recorded
here as a reminder that ad hoc one-liner verification commands are
themselves a source of false signals, not just the code under test.

### Validation

145 Python tests (145/145 passing, up from 141: +9 `SystemAdapter` tests,
+4 `agent-pipeline` tests, +2 `host_bridge` system-backend tests), 15
Playwright bundle smoke tests (15/15, +2 new Diagnostics-tab tests), 28
`host-web` tests (unchanged — `snapshotBuilder.js` has no pre-existing
unit-test infrastructure; verified instead by direct invocation against a
real workspace). `eco-vscode`: `npx tsc --noEmit` clean, `npm run build`
clean (no automated test suite exists for this repo, matching prior
PASSes' validation pattern for TS-only changes).

### Next

Quick-Bar and "environment emergence UI" remain the two blocked v1.0
ladder items (upstream `devxtoolkit-v2-x` still Phase 0; the design itself
still undefined). v1.0 is now 3-of-5 real; those two remain genuinely
outside Cockpit's control.

**2026-08-19 correction:** `devxtoolkit-v2-x`'s "still Phase 0" status
above is stale — see the correction note under Phase 15's Decision 2 for
the full account. It is now `status: active`, v2.1.0, 12 real commands.
"Environment emergence UI" is unaffected by this correction and remains
blocked on its own undefined-design issue.

## cockpit-provider-v1 — Contract and Trusted Registry Foundation (2026-07-11)

Defined the portable provider boundary as code rather than a Marlin-specific
UI convention. Cockpit owns shell rendering, permissions, approvals, themes,
accessibility, and trust chrome; providers own domain commands and views;
Marlin owns verified installation identity. The provider manifest is therefore
declarative and cannot select an executable. A separate Marlin attestation
binds provider ID/version and manifest digest to an installed executable.

The v1 wire baseline is one JSON request on stdin and one structured JSON
result on stdout. Marlin is the first full provider and Niji is the independent
portability fixture. Generic registration is implemented and tested; replacing
`host_bridge.py`'s built-in adapter selection with registry-backed dispatch is
the next implementation boundary, not claimed complete here.

## CKP.17.00 Provider Architecture Runtime Closure (2026-08-05)

The external-provider boundary is now executable end to end. Cockpit discovers
Marlin-attested installations through `ProviderRegistry`, validates complete
operation requests and provider results against the shared v1 schemas, requires
exact operation/provider/command identity correlation, and gates mutations on
the literal JSON boolean `true`. Local built-in adapters remain on their
existing registry and are not conflated with external executable providers.

Niji proves an independently installed provider can be discovered and spawned;
Marlin now also exposes a conforming stdio provider whose mutating apply command
requires confirmation and whose runs produce Marlin-signed evidence bundles.
The standalone web host exposes this execution path over `/api/bridge`, with
real process-boundary coverage.

This completes the provider runtime architecture (`CKP.17.00`-.03), not the
v1.0.0 product release. The remaining product boundary is browser-side command
rendering and approval plus the full stranger-install release exercise. Those
remain release work and must not be inferred from the runtime closure.

## CKP.18.01 — Correct Provider Ownership

The old Marlin-labelled surface combined three owners. It is now split at the
actual authority boundaries: Cockpit owns development readiness; the Cockpit
workspace adapter owns local tree/git/project-registry inspection; and Marlin's
attested provider alone owns installed package state, registry search, and
package installation. Hosts transport provider requests but do not resolve or
spawn the Marlin CLI. Literal confirmation remains mandatory for installation,
and a missing Marlin provider leaves Cockpit-native workspace views usable.

## CKP.18.02 — Browser Provider Workflow and Bound Approval

Cockpit now owns a provider-neutral browser interaction path for the Marlin
v1 slice: repository discovery/selection, structured findings, remediation
preview, human approval, execution, verification, and evidence export. The
approval dialog binds the exact Marlin provider, normalize-apply command,
target input, and preview operation. The bridge independently checks a
canonical provider/command/input scope before spawning a confirmed mutation.

Real browser testing exposed and corrected a host-envelope bug: both host-web
and eco-vscode previously treated any top-level `error` property as a bridge
crash, even though a valid failed provider result is required to carry one.
Hosts now distinguish the bridge's error-only envelope from
`cockpit-operation-result-v1`, allowing failed validation findings to remain
visible and actionable. The isolated end-to-end proof uses the actual built
Marlin provider and real GC-AUDIT PowerShell execution, including mutation,
verification, and browser evidence download.

## CKP.18.03 — Standalone Distribution Boundary

Cockpit v1.0.0 distributes as a per-user Windows x64 Electron/NSIS desktop
application. The installed boundary contains the loopback host, shared browser
assets, frozen Python bridge, and protocol schemas. It deliberately does not
absorb Marlin or provider installation: providers remain independently
attested per-user installations discovered through the public layout contract.

The stranger-install proof is artifact-first. It copies the installer away
from the repository, installs without elevation into a fresh temp root, creates
an ordinary Git repository and isolated Electron profile, starts the packaged
shell, validates that resources and bridge resolve inside the installation,
then uninstalls and removes the proof. `COCKPIT_WORKSPACE` is the packaged-app
repository selection contract because Electron rejects unknown application
switches before Cockpit code runs.

Standalone startup now performs one bounded bridge batch instead of spawning
one frozen Python process per snapshot field. Item errors stay isolated and
structured; required adapter failures still fail closed, while missing optional
providers degrade their own integration only. Frozen schema resolution uses
PyInstaller's extraction root and retains the source-tree path in development.

### CKP.18.04 correction — Marlin owns installation

The Cockpit-owned NSIS conclusion above was rejected by the portfolio owner and
is superseded. The useful runtime fixes remain, but Cockpit now emits only a
`cockpit-core` ZIP and package manifest. MarlinSetup is the only NSIS bootstrap;
it invokes Marlin's real installer API, which verifies the exact payload digest,
runs the package steps, records `state.yaml`, registers the `cockpit` bin, and
launches the managed executable. A real copied-MarlinSetup proof under
`C:\sandbox` installed and launched Cockpit entirely from
`marlin-home\apps\cockpit-core\1.0.0`.

### Native Windows ARM64 and x64 payloads (INIT.23, 2026-08-05)

Cockpit's Marlin-managed package now has explicit Windows x64 and ARM64
artifacts. Build-time PE inspection fails closed unless Python, the PyInstaller
bridge, and Electron all match the requested architecture. A native ARM64
Python/PyInstaller environment was required; `platform.machine()` was rejected
as proof because x64 Python under emulation reported the ARM64 OS.

Copied MarlinSetup proofs installed and opened both variants from isolated
Marlin homes. ARM64 installed runtimes report `0xAA64`; x64 reports `0x8664`.
The x86 NSIS launcher is only the outer extraction shim and does not change
Marlin or Cockpit's installed runtime architecture.

### Marlin Doctor Registry View (Marlin cross-repo, 2026-08-12)

Cockpit now hosts the first Marlin Doctor registry view from Marlin's
Doctor registry-view PASS. The web bundle adds a Marlin Doctor tab that reuses
the existing external-provider command channel and workspace repository
inventory: select a target, load its Doctor operations, register an operation,
and remove an operation.

Authority remains with Marlin. The provider commands are
`marlin.doctor.operations.list`, `.register`, and `.unregister`; registry
mutations are confirmation-gated by the existing provider manifest/bridge path.
Cockpit does not execute user-registered Doctor commands and does not replace
the older hygiene tab yet.

Validation: `node --check web/cockpit.js` passed. The full web bundle smoke
passed 17/17 using repo-local pytest basetemp.

### Marlin Doctor Approval Dialog Fix (Marlin cross-repo, INIT.30.03a, 2026-08-12)

Review found the registry view above had a real gap: register/unregister
constructed and sent a valid `confirm: true` + `approval` in the same
click that triggered the mutation, with no human-facing review step —
the wire shape was correct (nothing server-side could tell an
auto-generated approval from a human-reviewed one), but the UI never
put a human in the loop, unlike the Marlin Audit panel this tab was
built to follow.

Fixed entirely in this repo. `#doctor-approval-dialog` mirrors
`#audit-approval-dialog`'s structure exactly (scope list, required
checkbox, cancel/confirm). `runDoctorCommand()` now requires an
approval to be passed in for mutating stages instead of generating one
itself; the register form and the "Remove" button open the dialog
instead of posting directly. Confirming re-checks the target repository
against the approval's recorded target and refuses a stale approval if
it changed while the dialog was open. The Doctor browser smoke test
was rewritten to drive the real two-step interaction instead of
asserting the previous single-click auto-approval.

Validation: Cockpit web bundle smoke passed 17/17 (rewritten Doctor
test included); `host-web` suite unaffected, 33/33.

### Marlin Doctor Operation Execution (Marlin cross-repo, 2026-08-12)

Extended the existing Doctor registry view with Preview and Run/Apply actions.
Both actions reuse the human approval dialog and send the exact target,
operation ID, mode-specific provider command, and loaded registry digest
through `eco.cockpit.invokeProviderCommand`. A target change still invalidates
the dialog, and Marlin independently rejects a stale registry digest before
executing changed argv.

The operations table only enables execution after a digest-bearing registry
result is loaded. Preview appears only when the entry contains both
`supports_preview` and an explicit structured `preview_command`; Cockpit never
invents dry-run flags. Provider results remain visible in the existing result
panel, including bounded process output and signed evidence metadata.

Validation: `node --check web/cockpit.js` passed; web bundle smoke passed
17/17 with preview/apply approval scope assertions; host-web passed 33/33.

### Marlin Agent Roster Panel (Marlin cross-repo, INIT.30.05, 2026-08-12)

Added an Agent Roster panel to the Marlin Doctor tab, over Marlin's new
`marlin.doctor.agents.{list,detect,register,unregister}` provider
commands. Detection-only: the panel shows built-in and custom agent CLI
templates with detected/not-detected status; no agent's real work is
ever run from Cockpit, only Marlin's bounded version-style probe.

Reuses `INIT.30.03a`'s approval dialog rather than building a second one
-- `detect` requires the same human review as `register`/`unregister`,
even though it doesn't write anything, because it spawns a process built
from registry-editable data (the same rule Doctor operations already
follow). Built-in template rows never show a Remove control; the server
marks which rows are built-in (`template.builtin`) so Cockpit doesn't
duplicate Marlin's id list client-side.

Validation: `node --check web/cockpit.js` passed; web bundle smoke passed
18/18 (was 17); `host-web` passed 33/33, unaffected.

### Marlin Agent Roster Adversarial Review Fixes (Marlin cross-repo, INIT.30.05a, 2026-08-12)

Codex's adversarial review of `INIT.30.05` found two blocking gaps: `detect`
approval was not bound to the mutable roster (a TOCTOU gap — the roster
could change between approval and spawn without invalidating it), and the
approval dialog showed a vague "all known templates" placeholder instead of
the real detect argv being approved. Both are Cockpit-visible even though
the underlying fix (digest re-check before spawn) lives in Marlin.

Fixed entirely in this repo to match: `state.agents.rosterDigest` is now
captured from every `list`/`detect`/`register`/`unregister` result; the
"Detect all" button stays disabled until a digest is known, and clicking it
binds the current digest into the approval instead of an empty scope. The
approval dialog for `detect` now lists the roster digest plus every
template's real detect command, not a placeholder. A rewritten smoke test
drives two detect passes across a registration, proving the digest sent the
second time is the new one, not a stale cached one.

Validation: `node --check web/cockpit.js` passed; web bundle smoke passed
18/18, unaffected in count but materially rewritten; `host-web` passed
33/33, unaffected. No agent execution semantics changed — detection only,
same as `.05`.
