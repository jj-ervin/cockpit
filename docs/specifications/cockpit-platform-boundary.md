# cockpit-platform-boundary

Status: positioning decision, locked 2026-08-20; mode-4 Niji proof closed 2026-08-21
Authority: user directive, same session as the Cockpit priority-shift
memory and the live Marlin host-web demo; downstream of `cockpit-provider-v1`
Related: `cockpit-provider-v1.md` (the mechanism this boundary governs),
`CKP.v1.0-scoping.md`

## Purpose

Resolve the question the 2026-08-20 live demo raised: if Cockpit's only
proven provider (Marlin) plugs portfolio-specific GC-AUDIT content into a
generically provider-agnostic shell, what does Cockpit offer anyone who
doesn't have that governance stack? Answer: Cockpit is not a governance
product. It is a workspace shell that *can* host governance-grade
providers, and can equally host much lighter ones. This document fixes
that boundary so it stops being re-litigated per provider.

## Core statement

> Cockpit is both a host and a starter shell: apps can plug into it, or
> reuse its shell/components to become their own app, while keeping
> familiar AI, settings, approvals, artifacts, and theme patterns.

Restated as the frame/domain split:

> Cockpit provides the app frame and common UI; each app fills the main
> workspace with its domain UI.

This is the same relationship VS Code has to extensions, Shopify admin
has to its apps, WordPress admin has to plugins, and iOS has to its
apps: wildly different content, instantly recognizable shell. Cockpit
does not require every hosted tool to be an eco app, and it does not
require every hosted tool to even ship inside Cockpit's own process —
reusing its shell and components to become a separately-branded app is
an equally valid outcome, not a fallback.

## The shared Cockpit layer

Identical across every app or panel, whether hosted or derived:

- left nav / top command area
- AI assistant / command palette
- settings
- connection manager
- theme/layout preferences
- approval dialogs
- activity/history
- artifact/export area
- notifications/status
- provider/app identity
- common table/card/form components (a literal reusable UI kit, not
  just an architectural pattern)

## Domain UI — adapted per app

The part Cockpit deliberately does not standardize: Niji's palette
canvas and color tools, Cairn's reference/vault mediation flows,
Kinjuu's budget/deadline model, Marlin's package/doctor panels. Each
app's reason for existing lives here; the shell above exists so none of
them have to rebuild navigation, approvals, or settings to have it.

## Integration modes

Four modes, not a depth ladder — a provider or app picks the mode that
fits, and none is a lesser or intermediate step toward another:

1. **Cockpit-hosted panel** — runs inside the main Cockpit app's own
   process/window. Today's only occupant: Marlin's audit panel.
2. **Cockpit-derived standalone app** — reuses Cockpit's shell and
   component kit but ships as its own branded app, not inside Cockpit's
   process. No current occupant; this is the mode the VS
   Code/Shopify/WordPress analogies point toward and that the platform
   doesn't yet have a proof of.
3. **eco-native app** — deepest integration: memory, provenance, and
   runtime hooks beyond the base provider contract. Marlin's `audit.*`
   chain is the only occupant, and notably it also happens to be a
   hosted panel (mode 1) — the modes are orthogonal, not mutually
   exclusive.
4. **simple provider** — exposes actions/status/artifacts with no
   custom domain UI of its own. Niji occupies this mode twice over: the
   read-only health/state/preview card in `host-web`'s snapshot builder,
   and, proven 2026-08-21, a real discovered-provider command round trip
   through the same generic path Marlin's providers use. See the Niji
   entries below for the distinction.

The choice of mode is about *where the UI ships and how deep the
integration runs*, not a maturity or trust ranking. A simple provider
is not obligated to become an eco-native app to be taken seriously.

## Customization boundary

Customizable — user-facing experience:
themes, layout, density, pinned panels, shortcuts, default views, app
ordering, assistant tone, workspace profiles.

Fixed — trust and security semantics, never themeable, never
per-profile, never provider-overridable:
approval semantics, permission warnings, provenance/evidence meaning,
secret handling rules, provider identity, security errors.

The dividing line: anything about *how it feels* is configuration.
Anything about *what a permission, an approval, or an evidence record
means* is fixed platform behavior, identical for every user and every
provider tier.

## Current state honestly, as of 2026-08-20

This section exists so the document doesn't imply more integration
exists than has actually been proven — update it as tiers get real
occupants, don't let it go stale.

- **Marlin** — the only provider proven through the full governed
  operator loop (discover → validate → remediate → approve → execute →
  verify → evidence-export), live, via `host-web`, against a real
  browser and a real downloaded evidence bundle. Occupies modes 1
  (hosted panel) and 3 (eco-native) simultaneously. Its `validate`
  content (GC-AUDIT/governance-commons) is specific to this portfolio —
  it is not what a simple-provider or derived-app integration is
  expected to look like.
- **Niji** — occupies mode 4 (simple provider) in two distinct, both-real,
  deliberately unmerged ways:
  - The older in-process `CockpitAdapter` (`src/cockpit/adapters/niji.py`),
    wired into `host-web`'s snapshot builder (`niji('health')`,
    `niji('get_state')`, `niji('get_record', ...)`), rendered as a
    read-only diagnostics/status card in the "Niji Provider" panel. Real,
    shipped code, not a mock in production — but still read-only, no
    approve/execute/verify/evidence stages, and its own test suite
    (`test_niji_adapter.py`) exercises a `FakeNijiAdapter`, not the real
    `niji` package. Unchanged by the proof below; kept exactly as it was.
  - **Proven 2026-08-21 — a real mode-4 provider round trip**, in the
    "Real Provider (Mode 4 proof)" panel directly below it. This does
    **not** go through `niji.py`'s in-process adapter or
    `FakeNijiAdapter` at all: it is the same generic
    `discover_providers()` → `host_bridge._execute_provider_command()` →
    real subprocess-over-stdio path Marlin's providers use, driven from a
    real browser click. Confirmed on this machine: a real Marlin-attested
    `niji-provider.exe` (Windows arm64, running under x64 emulation —
    `marlin-registry` commit `a38f9c7`) discovered from the real
    `<marlin_home>/providers/niji/1.1.1/` layout, invoked with a real
    `cockpit-operation-request-v1`, returning a real, schema-valid
    `cockpit-operation-result-v1` with real computed swatches that render
    as actual color tiles in the browser. Covered by
    `test_provider_browser_niji.py`: a default test using a fixture stdio
    script standing in for the binary (runs everywhere, no build
    required), and an opt-in test using the real
    `niji-provider.exe` (skipped unless a local build exists). This is a
    normal creative/tool provider proof, not a governance claim — it does
    not exercise approve/execute/verify/evidence and should not be read
    as such.
- **Cairn** — no Cockpit adapter or provider manifest exists yet. Its
  domain-UI placement (reference/vault mediation flows) is a design
  intent from the priority-shift memory, not an implementation.
- **Kinjuu** — named as a future domain-UI example (budget/deadline
  model); no Cockpit integration work has started.
- No app exists yet in mode 2 (Cockpit-derived standalone app) — i.e.
  there is currently zero proof that Cockpit's shell/components can be
  reused to ship a separately-branded app. That proof, and proof that a
  genuinely external, non-portfolio tool can onboard as a mode-4 simple
  provider, are the two actual open gaps this boundary exists to
  eventually close.

## Niji as a real mode-4 provider — proven 2026-08-21

Was queued immediately after Cairn v1.5 closed (see `DEV-PLAN.md`'s
cross-repo note and the root `c:\dev\DEV-PLAN.md` "QUEUED IDEAS" entry,
2026-08-20); executed as a gated, step-by-step sequence and closed the
same window it was authorized in.

Goal (met): prove Cockpit can host a real, non-governance provider that
is useful without GC-AUDIT, Marlin Doctor, PASS/PLAY, or the portfolio
control plane — closing the gap this document previously admitted to
bluffing on.

What was actually done, in order: (1) verified the existing x64
`niji-provider.exe` runs correctly on this Windows arm64 machine under
x64 emulation, in isolation, outside Marlin; (2) corrected
`marlin-registry`'s niji manifest to declare `windows.arm64` support via
that same artifact (commit `a38f9c7`), verified with the registry's own
validator and a real isolated install → discover → invoke round trip;
(3) added the "Real Provider (Mode 4 proof)" panel to the Niji tab
(`web/cockpit.html`/`cockpit.js`), invoking `providerId: niji`,
`commandId: niji.palette.preview`, `confirm: false` through the same
generic `invoke_provider_command` path Marlin's panels use — no new
backend plumbing was needed, since that path was already provider-agnostic;
(4) added `test_provider_browser_niji.py`: a default fixture-backed
browser test (stages the real `providers/<id>/<version>/` directory
shape with a stand-in stdio script, runs everywhere) and an opt-in
real-provider browser test (stages the real `niji-provider.exe`, skipped
unless a local build exists) — both drive a real Chromium browser
through Playwright and assert real rendered swatch tiles.

Scope was kept exactly as authorized: Niji's real installed/provider
path throughout, never `FakeNijiAdapter`; the older in-process
`niji.py` adapter and its snapshot card were left untouched, not
replaced or rewritten; no mode 2 work was done or implied.

Known follow-up, tracked separately, not fixed as part of this proof:
the private `marlin` repo's own bundled local dev-registry snapshot
(`packages/marlin/registry/manifests/niji.yaml`) still has the old
flat x64-only shape and shadows the corrected `marlin-registry` entry
for niji specifically when installing through the real, published
`marlin install` CLI — see `test_provider_registry.py`'s
`test_real_marlin_installed_provider_stdio_roundtrip` for the exact
current failure this causes. This proof's own tests are unaffected
because they stage the provider directory directly rather than
depending on `marlin install`, matching how `test_provider_browser_e2e.py`
already proves Marlin's own provider.

Acceptance, checked against what was authorized: no `FakeNijiAdapter`
anywhere in the proof path — met. A stranger-readable demo note stating
plainly this is not governance, this is a normal creative/tool provider
— met, see the Niji entry above. A real test or smoke proof that
Cockpit loads the real Niji provider and renders useful data — met,
both the default and opt-in tests in `test_provider_browser_niji.py`
pass locally. Docs updated only enough to mark mode 4 proven, not mode
2 — this section.

Why mode 4 first: cheap, and it removed the one place this document
admitted to bluffing. Mode 2 remains strategically interesting but
still needs a real provider/app underneath it, and stays a separate,
later decision.

## How to apply

When onboarding a new provider or app, or discussing Cockpit UI/settings
work, ask which of the four integration modes fits before assuming
integration depth or hosting shape. Do not require GC-AUDIT/PASS/PLAY
participation from a mode-4 simple provider. Do not let a read-only
status/diagnostics wiring (Niji's current shape) be described as proof
of the governed approve/execute/evidence loop — that claim is earned
only by providers that actually go through it, live, the way Marlin's
did. Do not assume mode 1 (hosted panel) is the default or preferred
outcome for a new app — mode 2 (derived standalone app) is an equally
legitimate target and is currently unproven, so it deserves deliberate
consideration, not neglect by default.
