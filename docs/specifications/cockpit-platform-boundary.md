# cockpit-platform-boundary

Status: positioning decision, locked 2026-08-20; reconciled 2026-09-23.
Mode-4 Niji proof and Sealdex mode-1 local/artifact proof are closed. Sealdex hosted release proof remains a release/publication gap; it does not create a Cockpit implementation PASS by itself.

**Current-state authority:** `docs/architecture/cockpit-current-state.md`

**2026-08-21 addendum:** the provider referenced throughout this document
was renamed Cairn → Sealdex the same day the proof below was closed. The
proof events, command ids, executable, and artifact described here are
stated under the current name Sealdex; the local repo directory (`cairn/`)
and its own historical planning docs were not renamed and keep the name
Cairn where they describe past decisions — see `cairn/DEV-PLAN.md`'s
rename entry for the full rationale.

Authority: user directive, same session as the Cockpit priority-shift
memory and the live Marlin host-web demo; downstream of `cockpit-provider-v1`
Related: `cockpit-provider-v1.md` (the mechanism this boundary governs),
`CKP.v1.0-scoping.md`, `../CHIPP.md` (host-neutral integration/packaging/
proof playbook — this document's "current state" section below is written
in CHIPP-Cockpit's four proof-boundary vocabulary: provider contract,
host experience, installation, release)

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
canvas and color tools, Sealdex's reference/vault mediation flows,
Kinjuu's budget/deadline model, Marlin's package/doctor panels. Each
app's reason for existing lives here; the shell above exists so none of
them have to rebuild navigation, approvals, or settings to have it.

## Integration modes

Four modes, not a depth ladder — a provider or app picks the mode that
fits, and none is a lesser or intermediate step toward another:

1. **Cockpit-hosted panel** — runs inside the main Cockpit app's own
   process/window. Occupants: Marlin's audit panel, and, proven
   2026-08-21, Sealdex's Plan and Entry tabs (see below).
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
- **Sealdex** — occupies mode 1 (hosted panel), proven 2026-08-21 at the
  provider-contract, host-experience, and local-installation proof
  boundaries; release proof (a published, hosted, clean-install artifact)
  is explicitly not yet done. See the dedicated section below for the
  full breakdown. Its domain UI is Plan (schema design via Sealdex's
  existing schema-agent pipeline, human-approved before write) and Entry
  (safe data entry via Sealdex's existing data-entry logic) — narrower than
  the "reference/vault mediation flows" originally named in the
  priority-shift memory; vault mediation itself remains unbuilt and
  explicitly out of scope for this slice.
- **Kinjuu** — named as a future domain-UI example (budget/deadline
  model); no Cockpit integration work has started.
- No separately branded app has yet been proven from the reusable Cockpit
  shell/component boundary. This remains a **future reusable App Shell proof**,
  aligned with the current product direction, but it is not current
  implementation backlog and does not imply that Cockpit itself must become
  the app.
- A genuinely external, non-portfolio mode-4 provider remains a useful future
  provider-contract validation exercise. It is separate from the reusable App
  Shell proof and must not introduce Cockpit-owned domain logic.
- Sealdex hosted release proof is a release/publication concern and is tracked
  separately from Cockpit implementation.

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

## Sealdex as a real mode-1 hosted domain UI — proven 2026-08-21 (local/artifact proof only)

Built per the four-round Codex review arc recorded in full in
`cockpit/DEV-PLAN.md`'s "Cairn's First Cockpit Provider Slice" entry and
`cairn/DEV-PLAN.md`'s matching entries — both written and titled under
the name Cairn, the product's name at the time; the product was renamed
Sealdex the same day this section was last updated. Stated here using
CHIPP-Cockpit's proof-boundary vocabulary (`../CHIPP.md`) so this
section doesn't imply more than has actually been exercised.

**Provider contract proof — met.** `cairn/scripts/provider.py` implements
`cockpit-provider-v1` with five commands (`sealdex.schema.propose`/`apply`,
`sealdex.entry.tables`/`add`/`import`), a propose → human-approve → revalidate
→ apply split for schema mutation (stale-proposal rejection if the schema
moved under the plan between propose and apply), and structured failure
codes for invalid input, LLM/network, database, and filesystem errors
instead of process crashes. Covered by 22 cases in `cairn/tests/test_provider.py`.

**Host experience proof — met.** `web/cockpit.html`/`cockpit.js` add a
Sealdex tab with Plan and Entry panels through the same generic
`invoke_provider_command` path Marlin's and Niji's panels use — no new
host plumbing beyond two command-timeout entries (`sealdex.schema.propose`
calls a real LLM). Covered by
`src/cockpit/tests/test_provider_browser_sealdex.py`: two fixture-based
browser tests (Plan propose→approve→apply, Entry add) and one opt-in test
that drives a real compiled `sealdex-provider.exe` through a real
refresh-tables → fill → approve → add round trip.

**Installation proof — met, against a local artifact, not a hosted
download.** Sealdex now ships a real compiled `sealdex-provider.exe`
(PyInstaller, mirroring `niji-provider.spec`), built by one atomic release
command (`cairn/scripts/build_release.py`) that compiles from source into
a scratch directory, fingerprints the packaged source into a
`provider/BUILD-MANIFEST.json` sidecar, and only atomically replaces the
release zip once assembly fully succeeds. `cairn/scripts/verify_release.py`
mandatorily checks packaged sources against the workspace byte-for-byte,
schema-validates the archived provider manifest, and rejects a stale or
tampered executable. `marlin/packages/marlin/tests/sealdex-real-artifact.test.ts`
extracts the real `dist/sealdex-0.2.1.zip` (first public version was
0.2.0, moved there from 0.1.0 the same day, to resolve a tag/release-name
collision with the retired Cairn v0.1.0 release on this repo's GitHub
history — see `cairn/DEV-PLAN.md`'s dedicated collision-resolution entry;
0.2.1 is a later, unrelated fresh-install schema-bootstrap fix, not a
second collision), calls the real
`issueProviderAttestation()` against the real extracted files, and invokes
the real compiled provider over stdio — asserting a real `succeeded`
result. This proves resolution-from-a-local-file, extraction, attestation,
registration, and executable launch all work from the packaged form. It
does **not** exercise a `marlin install sealdex` fetch from a live hosted
registry, because no hosted `v0.2.0` release exists yet (next paragraph).

**Release proof — not met, and known to be open.** `v0.2.0` has not been
published as a GitHub release. Marlin's registry snapshot
(`packages/marlin/registry/manifests/sealdex.yaml` +
`registry/index.yaml`'s `sealdex` entry) was committed locally (`marlin`
commit `fe584bb`, not pushed) with the real build's checksum — per CHIPP's
own sequencing track (build/verify → publish → retrieve/verify hosted →
clean install → push registry only after hosted proof passes), a
registry declaration must not be **pushed** ahead of the artifact it points
to actually existing at a public URL. No clean-environment
`marlin install sealdex` has been run against a real hosted registry.
Publishing the release is a real, external, hard-to-reverse action
reserved for explicit owner authorization, not something this proof
performs unilaterally.

**Do not round this up.** "Sealdex works in Cockpit" is true at the
provider-contract, host-experience, and local-installation boundaries.
"Sealdex is installable in Cockpit" is not yet true for a clean environment
pulling from the public registry — that claim waits on release proof.

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
consideration, not neglect by default. When citing proof for any
provider, name the specific CHIPP proof boundary (provider contract,
host experience, installation, release) rather than a bare "it works" —
Sealdex's own entry above is the reference example of why that distinction
matters: three boundaries proven, one (release) explicitly still open.
