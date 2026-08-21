# Cockpit as a Reusable App Shell / Provider Platform — Design Note

Status: framing note, 2026-08-21, updated 2026-08-21 (Cairn truth-sync).
Builds on the locked positioning in `cockpit-platform-boundary.md` (the
authority for modes, boundaries, and current-state detail) — this note
exists to state the platform thesis on its own, with the real proof cases
side by side, for anyone who needs the pitch without reading the full
boundary spec. No implementation proposed here. Proof-case status below
uses CHIPP-Cockpit's proof-boundary vocabulary (`../CHIPP.md`: provider
contract, host experience, installation, release) rather than a single
pass/fail label, since a case can be proven at some boundaries and not
others — see Sealdex's row.

**2026-08-21 addendum:** the provider named "Cairn" below was renamed
Sealdex later the same day; this note is updated in place to the current
name, since it describes present, not historical, proof state.

## Thesis

Cockpit is not a governance product. It is a workspace shell — nav,
command palette, settings, approvals, artifacts, theming, provider
discovery — that any app can either plug into or fork from, the way VS
Code relates to extensions, Shopify admin to its apps, or WordPress admin
to plugins. The shell is the reusable asset; the governance-grade
provider (Marlin) is one tenant of it, not its definition.

The frame/domain split, restated from the boundary doc:

> Cockpit provides the app frame and common UI; each app fills the main
> workspace with its domain UI.

## Proof cases, honestly staged

The platform claim only holds if it's backed by more than one shape of
provider. As of 2026-08-21, three cases exist at different levels of
proof — stated here without rounding any of them up:

| Provider | Mode | Status |
| --- | --- | --- |
| **Marlin** | 1 (hosted panel) + 3 (eco-native) | Full governed loop proven live: discover → validate → remediate → approve → execute → verify → evidence-export, real browser, real subprocess, real downloaded evidence bundle. Its `validate` content (GC-AUDIT) is portfolio-specific — this is the deep-integration ceiling, not the template every provider must hit. |
| **Niji** | 4 (simple provider) | Proven 2026-08-21: a real, Marlin-discovered `niji-provider.exe` invoked over the generic `cockpit-provider-v1` stdio protocol from a live browser click, no governance stages, no `FakeNijiAdapter`. Demonstrates the floor of the platform — a provider needs no governance stack to be useful. (A separate, older, read-only in-process adapter also exists for Niji's health/state card; it predates and is unrelated to this proof.) |
| **Sealdex** | 1 (hosted panel) | Plan (schema design, human-approved before write) and Entry (safe data entry) tabs, both through the same generic provider path. Proven 2026-08-21 at three of CHIPP's four proof boundaries: provider contract (structured commands, propose/apply approval binding, structured failures), host experience (real browser tests, including one against the real compiled `sealdex-provider.exe`), and installation-from-a-local-artifact (real attestation and real executable launch against the real `dist/sealdex-0.1.0.zip`). **Release proof is explicitly not met** — `v0.1.0` is not published, Marlin's registry snapshot was committed locally (not pushed), and no clean-environment install from a hosted registry has been run. See `cockpit-platform-boundary.md`'s dedicated Sealdex section for the full breakdown. |

Read together: Marlin proves the shell can carry the heaviest possible
tenant (full governance loop); Niji proves it can carry the lightest
(status + one action, no governance); Sealdex proves a third shape —
structured propose/approve domain UI over local data — while also being
the clearest illustration of why CHIPP separates proof boundaries at all:
"works" and "installable from a clean environment" are different claims,
and only the first is true for Sealdex today. Three real points is enough
to argue "platform," not enough to claim the platform is broadly proven —
the boundary doc's own open-gaps list (mode 2 unproven, no non-portfolio
external provider yet, no provider with hosted release proof yet) still
stands.

## What this framing changes about how Cockpit gets discussed

- Stop introducing Cockpit as "the governance console" — that's Marlin's
  content, not Cockpit's identity. Cockpit is the shell that happens to
  host it.
- When scoping a new app, the first question is which of the four
  integration modes fits, not how much governance machinery it needs to
  adopt to be taken seriously.
- Mode 2 (Cockpit-derived standalone app — fork the shell, ship
  separately branded) remains the platform's most strategically
  interesting unproven claim: three hosted/simple-provider proofs don't
  substitute for it. Worth keeping visible as a gap, not quietly dropped.
- When citing any provider as "proven," name the CHIPP proof boundary —
  Sealdex is proven at three of four and not installable from a clean
  hosted environment yet; that distinction is the point, not a hedge to
  round away.

## Explicitly out of scope for this note

No implementation, no Sealdex integration work, no mode-2 proof attempt.
This is framing only, per the instruction that queued it.
