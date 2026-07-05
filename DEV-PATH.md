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
