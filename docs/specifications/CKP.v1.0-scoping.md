# Cockpit v1.0 Scoping

Status: scoping (no implementation yet)
Updated: 2026-07-02

## Purpose

Breaks the five v1.0 items from `eco/docs/specifications/cockpit-ui-spec.md`'s
`CANONICAL-LOCKED` section into real, estimable PASSes. That section is
authoritative over `cockpit/DEV-PLAN.md`'s Product Ladder table, which used
"Marlin governance setup panel" as the fifth item — the locked spec's actual
fifth item is "environment setup wizard," a broader, different thing. See the
correction note in `DEV-PLAN.md`'s Product Ladder section.

v0.1 is done (`CKP.05` through `CKP.08.10`, closed 2026-07-02). This document
does not re-scope v0.1.

## Durable boundary (portfolio owner, 2026-07-02)

Cockpit is the **universal UI/UX host**. That is Cockpit's identity and
scope — it does not narrow to Marlin's UI, and it must not be narrowed to
Marlin's UI by any future PASS, agent, or doc. Marlin is one backend/provider
inside Cockpit, not Cockpit's definition.

Cockpit must not absorb Marlin's installer, scaffold, audit, package, or
governance-authority logic. Marlin owns that logic. Cockpit only renders and
orchestrates the human-facing UX for it, through explicit adapter contracts.
(Verified 2026-07-02: `MarlinAdapter`/`install_phase1.py` already respect this
— every write path raises `WriteNotSupportedError` and points at the real
Marlin CLI; `install-readiness` only previews steps and hands back an
`apply_command` for human execution. This boundary was already correctly
implemented in code; the risk was in planning-doc language drifting toward
"Cockpit is Marlin's UI," not in the adapter itself.)

**The durable boundary (verbatim, portfolio owner, 2026-07-02):**

> Cockpit owns: UI shell, panels, interaction design, human approval UX,
> operator workflows, view composition.
> Marlin owns: install/scaffold/audit/package/governance setup logic.
> Adapters own: typed contract between them.
>
> Agents must stop saying: "Cockpit is just Marlin's UI."
> Agents should say: "Cockpit hosts Marlin UX as one provider surface."

| Owns | Scope |
| --- | --- |
| **Cockpit** | UI shell, panels, interaction design, human-approval UX, operator workflows, view composition |
| **Marlin** | install/scaffold/audit/package/governance-setup logic |
| **Adapters** | the typed contract between them |

**Priority, not scope:** Marlin's environment-setup UI is the priority
*provider surface* to build next — not because Cockpit's scope narrows to
Marlin, but because it's the most concrete, ready-to-build v1.0 item right
now. The correct phrase for this is **"Universal Cockpit, Marlin provider
first"** — not "Marlin-first Cockpit," and never "Cockpit is just Marlin's
UI." Say "Cockpit hosts Marlin UX as one provider surface."

## Priority order for what's built next

1. **Environment setup wizard / Marlin provider surface** (item 4 below) —
   build first. `CKP.07`'s Marlin install-readiness preview becomes step one
   of a real wizard.
2. Diagnostics dashboard expansion (item 2) — only the parts needed to
   support Marlin/install/setup visibility, not the full "integrations,
   environment checks, agent pipelines" breadth yet.
3. Mode switching, Quick-Bar, environment emergence UI (items 1, 3, 5) — not
   next. Real prior art exists for mode switching (see below) so it isn't
   thrown away, it's just not what gets built next.

The item numbering below is an inventory (what's real, what's blocked), not
a build order — read the priority list above for build order.

## v1.0 items, real state, and proposed PASSes

### 1. Mode switching → `CKP.09.01`

**Real prior art, not a blank slate.** `eco-vs` already implements this:
`surfaces/vscode/eco-vs/src/app/helm.ts` (435 lines) + `helm-session.ts` (101
lines), a working `HelmMode` type, `setMode`/`getCurrentMode`/`activateMode`,
and — notably — a `updateCockpitSnapshot(mode)` function already integrating
HELM mode state into a Cockpit config snapshot concept. Three PASSes already
registered: `HELM.00`/`HELM.01`/`HELM.02` (`ECO:2008`-`ECO:2010`).

This is structurally the same situation Cockpit itself was in before `CKP.08`:
a working embedded implementation in `eco-vs` that needs extracting into the
host-agnostic bundle + adapter pattern, not built from scratch. The `CKP.08`
playbook (adapter method → `host_bridge.py` operation → `cockpitApi.ts` →
`webviewHost.ts` → bundle UI) applies directly.

**Done-when:** Cockpit bundle exposes a mode selector; mode state reads/writes
through the adapter contract (new `CockpitAdapter.get_mode`/`set_mode` or a
`"mode"` record type, mirroring `CKP.08.07`'s `"governance"` pattern);
selecting a mode in the bundle drives the same downstream effects
`eco-vs`'s `updateCockpitSnapshot`/`updateLensSnapshot` currently drive.

**Relative effort:** comparable to `CKP.08.07` (one adapter method + full
relay chain) plus UI for a mode selector — smaller than the original `CKP.08`
extraction since the adapter/bridge/UI wiring pattern is now proven and
reusable, not being invented.

### 2. Diagnostics dashboard → `CKP.09.02`

**Partially started.** `CKP.08.07`'s Governance tab already covers
`governance-diagnostics.json`/mode/health score/issues. The locked spec's
"Diagnostics panel" contract is broader: "unified status for runtime health,
**integrations, environment checks, and agent pipelines**" — three categories
beyond what exists today.

**Done-when:** the existing Governance tab is either renamed/expanded into a
Diagnostics tab, or a new tab is added, covering the three missing categories.
Each category needs its own data source identified first — none are defined
yet (unlike governance, which had `governance-diagnostics.json` already).

**Relative effort:** unknown until the three missing categories' data sources
are identified — this PASS should start with a short investigation
(what does "integrations," "environment checks," and "agent pipelines" status
actually come from?), not a UI build.

### 3. Quick-Bar → blocked, not yet a PASS

**Zero implementation, real upstream blocker.** The locked spec defines it as
"centralized command launcher for runtime-aware actions and **routed
DevXToolkit v2.x commands**." Checked `dxp-org/devxtoolkit-v2-x`: status is
`SCAFFOLD`, "Empty normalized v2 repo scaffold," Phase 0. There is nothing to
route to yet.

**Not schedulable as a PASS right now.** Building a command launcher with no
commands to launch would mean inventing scope DevXToolkit v2.x should own.
Revisit when `devxtoolkit-v2-x` has real command definitions.

**2026-08-19 correction:** the premise above is now stale.
`devxtoolkit-v2-x` is no longer an empty Phase-0 scaffold — a scope-
correction migration moved `devxtoolkit-v1-x`'s command-registry/alias-
grammar/introspection pillars into it (they were built into v1.5/v1.6
despite this repo's own architecture brief having reserved that scope for
v2), and the same day it gained `Write-DevStatus`, the output-styling
pillar. `devxtoolkit-v2-x` is `status: active`, `ModuleVersion 2.1.0`, 12
real exported commands, 46/46 Pester passing — there is now something to
route to. This does not retroactively schedule Quick-Bar as a PASS; that
remains a prioritization call for the portfolio owner, and the module is
still unpublished (no GitHub tag/release or PowerShell Gallery
publication yet). It only corrects the "nothing to route to" blocking
reason, which no longer holds. See `dxp-org/devxtoolkit-v2-x/DEV-PLAN.md`
and `dxp-org/devxtoolkit-v2-x/DEV-PATH.md`'s "Phase 2" and "Phase 3"
entries for the full account.

### 4. Environment setup wizard → `CKP.09.04`

**Zero implementation**, but not zero prior art at the component level:
`CKP.07`'s Marlin install-readiness preview (`CKP.07.01`) is a working example
of exactly the pattern a wizard step needs — preview steps, an explicit
apply command, human-approval gating. The locked spec's contract ("guided
installation/verification/configuration flow managed by Cockpit runtime") is
bigger than one panel: a multi-step flow that the Marlin panel could become
*one step inside*, not the wizard itself.

**Done-when:** a defined wizard shell (step sequence, progress state, back/
next navigation) exists in the bundle, with the Marlin install-readiness
preview wired in as its first real step.

**Relative effort:** medium — the hardest new part is the wizard shell/step
framework itself (genuinely new UI architecture, no prior art in this
portfolio); the first step's content already exists.

### 5. Environment emergence UI → blocked, not yet a PASS

**Undefined.** Not described anywhere beyond its name in either
`cockpit-ui-spec.md` or `cockpit/DEV-PLAN.md`. No design decision, no spec,
no prior art anywhere in the portfolio.

**Not schedulable as a PASS right now.** This needs a design/definition
decision from the portfolio owner before it can be scoped at all — a name on
a ladder is not a specification.

## Summary

| Item | State | Next action |
| --- | --- | --- |
| Mode switching | Real prior art (536 lines, 3 registered PASSes) | `CKP.09.01` — extract, same playbook as `CKP.08` |
| Diagnostics dashboard | Partially started (`CKP.08.07`) | `CKP.09.02` — investigate 3 missing data sources, then build |
| Quick-Bar | Zero implementation, upstream blocker cleared 2026-08-19 (see correction note above) | Not blocked on `devxtoolkit-v2-x` anymore; scheduling is a prioritization call, not yet a PASS |
| Environment setup wizard | Zero implementation, one component exists | `CKP.09.04` — build wizard shell, wire in `CKP.07` as step 1 |
| Environment emergence UI | Undefined | Blocked on a design decision — needs definition before scoping |

Three of five items are real, schedulable PASSes. One (environment
emergence UI) is genuinely blocked on a decision only the portfolio owner
can make. Quick-Bar's original blocker (`devxtoolkit-v2-x` maturity) was
cleared 2026-08-19 — see the correction note under item 3 — but it is not
automatically a PASS as a result; it still needs an explicit scheduling
decision. Claiming a full v1.0 estimate today would still mean inventing
numbers for the one item that remains genuinely undefined.

## CKP.09.05 Update — Provider Workflows, Not Authority Transfer

The environment setup wizard is a universal Cockpit shell. The first live
workflow is the Marlin Environment Setup Wizard, rendered in Cockpit. Marlin
remains the authority for package search/install, trust gates, registry
semantics, scaffold/audit/governance behavior, and CLI execution. Cockpit
renders intent and results; it does not become Marlin.

This PASS added:

- Marlin package search and explicit-confirm install UI inside the setup wizard
- structured Marlin CLI JSON consumption instead of table scraping
- read-only Niji provider status/scheme/palette preview

Host mutation boundary: webview JavaScript sends install intent only. The VS Code
host confirms with the human, then spawns the Marlin CLI and returns structured
output to Cockpit.
