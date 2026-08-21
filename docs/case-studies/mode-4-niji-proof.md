# Case study seed — Cockpit Mode 4, proven with Niji

Status: seed only — a case study is a stranger-facing proof story; this is
the raw material for one, not the finished piece. No publishing/marketing
pass has happened.

## The claim this proves

Cockpit can host a real, non-portfolio, non-governance tool as a mode-4
"simple provider" — install it, discover it, invoke one of its commands,
render what it returns — with zero custom backend work, because the
provider-dispatch path was already generic.

## What actually ran

A real Marlin-attested `niji-provider.exe` (Windows arm64, running under
x64 emulation), discovered from a real `<marlin_home>/providers/niji/1.1.1/`
directory, invoked from a real browser click through
`discover_providers()` → `host_bridge._execute_provider_command()` → real
subprocess stdio, using the real `cockpit-provider-v1` schemas. The
response rendered as real color swatch tiles in the Niji tab's
"Real Provider (Mode 4 proof)" panel. Not `FakeNijiAdapter`, not the older
in-process `niji.py` adapter — those are untouched.

## Why it's a good story

- Zero new backend/bridge code — the dispatch path Marlin already proved
  turned out to already be provider-agnostic. That's the actual headline:
  the second real provider was nearly free.
- Deliberately not a governance claim. Niji's round trip doesn't go
  through approve/execute/verify/evidence — this proves the shell can host
  an ordinary creative tool, which is a different (and for most outside
  adopters, more relevant) claim than "Cockpit can govern GC-AUDIT."
- Surfaced and fixed a real cross-repo bug along the way (windows/arm64
  missing from the hosted `marlin-registry` niji manifest — see
  `marlin-registry` commit `a38f9c7`) rather than working around it
  silently.
- Surfaced, but deliberately did not fix, a second real bug (marlin's
  bundled local registry snapshot shadowing the hosted registry) — logged
  as its own task rather than blurred into this proof's scope. See
  `marlin/DEV-PLAN.md`'s "Queued — bundled local registry shadows the
  hosted registry for niji" entry, 2026-08-21.

## Source of record

Full narrative, acceptance checklist, and honest current-state accounting:
`docs/specifications/cockpit-platform-boundary.md` ("Niji as a real mode-4
provider — proven 2026-08-21"). Implementation commit: `9fde263`
("Prove Cockpit Mode 4 with a real Niji provider round trip").

## Still open before this could become a real published case study

- A second, genuinely external (non-portfolio) mode-4 provider — one
  example only proves the path exists, not that a stranger could use it.
- Mode 2 (Cockpit-derived standalone app) remains completely unproven;
  don't imply otherwise in any future write-up drawn from this seed.
- No screenshots/recording captured yet.
