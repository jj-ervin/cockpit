# Cockpit Command Surface — Consideration Note

**Status:** Consideration only. No PASS assigned, nothing scheduled to build.
**Recorded:** 2026-07-08
**Origin:** Cross-checked against a three-way Claude/ChatGPT design discussion about
Cockpit becoming a unified command plane over DevX/Niji/GC/eco.ai/LASSO. This note
keeps the part that survived scrutiny and discards the part that didn't.

---

## The principle

**Cockpit gets a local command/routing manifest. It does not get a shared
cross-repo action registry.**

The discussion that produced this note originally proposed a schema shared by
Cockpit, DevX, Niji, GC, eco.ai, and LASSO — one action definition, consumed by
five other repos. That's a real dependency: it means DevX/Niji/GC/LASSO would
each need to import or conform to a Cockpit-owned format. That's the exact
shape of coupling the portfolio's modularity rule exists to prevent (every repo
self-contained/portable; nothing depends outward on Cockpit).

What Cockpit already does instead, correctly, is the opposite direction:
Cockpit depends inward on each backend's own stable surface, and nothing else
depends on Cockpit.

## Precedent already in this repo

This isn't a new pattern to invent — it's already implemented four times over
in `cockpit/src/cockpit/adapters/`:

| Adapter | Backend owns | Cockpit's role |
| --- | --- | --- |
| `niji.py` | palette generation, `niji.api` | read-only preview via `sys.path` import of a sibling checkout |
| `marlin.py` | package install/state | read-only status + **preview/apply boundary** (below) |
| `eco.py` | eco workspace/mode state | read via `EcoAdapter` record types |
| `system.py` | local toolchain/env | read-only environment checks |

No adapter lets Cockpit mutate the backend it's reading. Where Cockpit
proposes an action, it hands back a **preview**, never executes it:

`marlin.py::_build_install_readiness` returns `preview_steps` (each marked
`skipped: true`), an `apply_command` string the human runs themselves, and
explicit flags — `requires_human_apply: true`, `mutation_allowed_from_bridge:
false`. `_reject_apply_request` rejects any filter that tries to trigger
`apply` through the adapter call itself. This is the preview/apply boundary
the discussion asked for — it already exists, one place, working.

So the command-surface manifest, when it's built, should route mutating
`/slash` actions through this same preview → human-apply pattern, not invent
a new one.

## What "local manifest" means concretely

- Cockpit maintains its own mapping (e.g. `/niji palette preview` →
  `NijiAdapter.list_records(...)`, `/marlin install-readiness` → the existing
  preview/apply adapter call, `/devx mkproj` → a subprocess call into DevX's
  own CLI once it has one).
- DevX, Niji, GC, LASSO never import or conform to Cockpit's manifest format.
  They just need a stable CLI/API surface, which some already have and some
  don't (see blockers below).
- Natural-language routing resolves to the same manifest entries — it's a
  second way to reach the same mapping, not a separate action system.

## Two live blockers (already recorded, not new findings)

Both of these are already decided in `cockpit/DEV-PATH.md`, Phase 15
(`CKP.09.01`, recorded 2026-07-05) — this note just carries them forward into
the command-surface conversation so they don't get silently re-opened:

1. **Quick-Bar is blocked on `devxtoolkit-v2-x`.** The locked spec
   (`docs/specifications/CKP.v1.0-scoping.md:119-121,165`) defines Quick-Bar as
   routing DevXToolkit v2.x commands. Checked directly: `dxp-org/devxtoolkit-v2-x`
   is a Phase-0 scaffold — its own `DEV-PATH.md` still lists "define v1
   compatibility matrix" as *planned*, not done. There is nothing to route to
   yet. A narrower Cockpit-only substitute was explicitly considered and
   rejected in the same decision (throwaway work or a permanent unofficial
   stand-in for scope DevXToolkit should own). **Any command-surface manifest
   built now should leave a `devx` namespace stubbed, not populated.**

   **2026-08-19 correction:** `devxtoolkit-v2-x` is no longer a Phase-0
   scaffold. A scope-correction migration gave it the command-registry/
   alias-grammar/introspection pillars `devxtoolkit-v1-x`'s v1.5/v1.6 had
   built despite v2's own architecture brief reserving them, plus
   `Write-DevStatus` (output styling) the same day. It is `status: active`,
   `ModuleVersion 2.1.0`, 12 real exported commands (`Get-DevCommand`/
   `Show-DevGrammar` for introspection into all of them), 46/46 Pester
   passing — not yet published to GitHub/PowerShell Gallery. There is now
   something a `devx` namespace could route to. This does not by itself
   authorize populating the namespace — that's still a scheduling decision
   for whoever builds the command-surface manifest — but the "nothing to
   route to yet" reasoning above no longer holds. See
   `dxp-org/devxtoolkit-v2-x/DEV-PLAN.md`/`DEV-PATH.md`'s "Phase 2"/
   "Phase 3" entries and `cockpit/DEV-PATH.md`'s Phase 15 Decision 2
   correction note for the full account.

2. **LASSO has no callable surface; Cockpit's "Lasso" tab is client-only.**
   `cockpit/DEV-PATH.md:702-719` (Decision 1): the real multi-agent product is
   `c:\dev\lasso`, a separate pre-build/vision-phase repo with no engine yet.
   Cockpit's tab was relabeled "Compose Scratchpad" specifically so it stops
   implying it previews the real LASSO product. Confirmed on disk: no
   `lasso.py` adapter exists in `cockpit/src/cockpit/adapters/`, and `lasso`'s
   own `DEV-PATH.md` confirms no engine is built. **The command-surface
   manifest should have no `lasso` namespace at all until LASSO ships a real
   CLI/API to point at.**

There is also no dedicated GC (governance-commons) adapter today — `system.py`
covers local toolchain/env checks, but portfolio-wide governance diagnostics
aren't wired through an adapter yet. Worth knowing before assuming a `/gc`
namespace has anywhere real to route to either.

## What this note is not

- Not a commitment to build the manifest now.
- Not a PASS — no `CKP.NN.NN` assigned. Per the portfolio's PASS numbering
  rule, that gets assigned when this is actually scheduled, not while it's a
  consideration.
- Not a reason to write the earlier six-system "Cockpit Architecture & Command
  Plane Blueprint" doc. That doc becomes worth writing once DevXToolkit v2.x
  or LASSO actually expose something to route to — right now roughly half its
  sections would describe namespaces with nothing behind them.
