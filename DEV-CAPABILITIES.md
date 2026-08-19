# DEV-CAPABILITIES

## Identity

**Name:** `cockpit`
**Type:** application — operator UI/UX host
**Version:** v0.1.0 done (2026-07-02); v1.0.0 "Marlin Provider Slice" — entry gates closed 2026-08-05, publication pending. No git tags cut yet.
**Status:** active (scaffold / active product direction)

## Primary Responsibility

Cockpit is eco's operator command surface — a universal UI/UX host for the portfolio. It presents state and readiness gathered from registered provider adapters (`eco`, `cockpit`/development, `niji`, `system`, `workspace`). It never independently decides conformance, and it never executes a mutating operation through its own query surface.

## Capabilities Provided

### `development-readiness`

**Provides:** read-only readiness/status query for portfolio components — currently Marlin's install/audit readiness.
**Interface:** Python import / query bridge — `src/cockpit/adapters/development.py` (backend id `cockpit`)
**Consumers:** eco/operator UI, any future consumer needing readiness state
**Side Effects:** none. `apply=True` / `mode="apply"` raises `ValidationError` — this path is read-only by design, not by convention.
**Authority Required:** none to query. Any actual mutation requires a human to separately run the `apply_command` string the adapter returns (e.g. `python -m cockpit.install_phase1 ... --apply`) — Cockpit does not run it.

### provider status (`eco`, `niji`, `system`, `workspace`)

**Provides:** read-only status/state query per backend, following the same adapter pattern as `development.py`.
**Interface:** Python import / query bridge — `src/cockpit/adapters/{eco,niji,system,workspace}.py`
**Consumers:** eco/operator UI
**Side Effects:** not independently verified per-adapter beyond `development.py`; treat as read-only until confirmed otherwise for a specific adapter.
**Authority Required:** none for query.

## Capabilities Consumed

- **Marlin readiness state** — consumed via `development.py`'s own readiness logic, not a dedicated Marlin adapter. (A `marlin.py` adapter existed previously and was deleted in commit `c23fb22`; its responsibility was folded into `development.py`. Any doc or memory still citing `src/cockpit/adapters/marlin.py` as live is stale — `cockpit/README.md` currently has this error.) — **required, replaceable** if a dedicated adapter is reintroduced later.
- **eco backend state** — via `eco.py` — required.
- **niji backend state** — via `niji.py` — optional.
- **system / workspace backend state** — via `system.py` / `workspace.py` — optional.

## Interaction Benefits

- one UI surface for portfolio operator visibility instead of N separate CLIs
- a consistent read-only/human-approval boundary enforced at the adapter layer, not left to each provider to reimplement

## Allowed Interactions

- Cockpit MAY query any registered provider adapter for read-only state
- Cockpit MAY surface an `apply_command` string for a human to run manually, outside Cockpit's own process
- Cockpit MAY add new provider adapters following the existing `BACKEND_ID` + read-only-query pattern

## Prohibited Interactions

- Cockpit MUST NOT execute a mutating or destructive command through its query/bridge surface — enforced today: `development.py` raises `ValidationError` on `apply=True`/`mode="apply"`
- Cockpit MUST NOT independently decide conformance, correctness, or pass/fail for any provider — it displays decisions and evidence produced elsewhere, never originates them
- No provider (Marlin, niji, etc.) MUST be assumed to require Cockpit's presence — providers must remain fully functional standalone without Cockpit

## Authority Boundaries

**Owns:** its own adapter-bridge layer and the read-only query results it returns
**May modify:** nothing outside its own process/display state through this surface
**May read:** registered provider backends (`eco`, `cockpit`/development, `niji`, `system`, `workspace`)
**Must not control:** any provider's actual install/audit/mutation logic — Cockpit can request and display, never execute

## Extension Points

- **adapter** — new provider backends, following the `BACKEND_ID` + read-only-query convention established by `development.py`

## Integration Surface

**CLI:** none declared in this doc
**API:** Python import / query bridge (adapter modules under `src/cockpit/adapters/`)
**SDK:** none
**Events:** none
**Files:** none beyond adapter source
**Schemas:** none declared yet (no `capabilities.yaml`)

## Invariants

- `apply=True` / `mode="apply"` never succeeds through Cockpit's query path — it always raises `ValidationError`
- Every mutating action Cockpit surfaces is returned as a command string for a human to run, never executed by Cockpit itself

## Trust Assumptions

- A provider's readiness data is informational, not an authority grant — Cockpit displaying "ready" does not mean an action is permitted
- Human approval is required before any `apply_command` Cockpit returns is actually run
- Absence of an adapter for a component means Cockpit has no integration with it — do not assume one exists because the component is in the portfolio

## Compatibility

**Backward compatibility expectation:** not yet formally declared — no tagged release exists.
**Versioning policy:** not yet formally declared.
**Breaking-change policy:** not yet formally declared.

## Known Integrations

| Component | Relationship | Capability Used | Interface |
|---|---|---|---|
| `marlin` | provider (readiness data only) | Marlin install/audit readiness | `development.py` adapter; returns `apply_command` for human execution, never invoked by Cockpit |
| `eco` | provider | eco backend state | `eco.py` adapter |
| `niji` | provider | niji backend state | `niji.py` adapter |

## Explicit Non-Goals

- Cockpit is not a policy or conformance engine — it never independently decides pass/fail for a provider's state
- Cockpit does not execute destructive or mutating operations through its own query/bridge surface, under any adapter

## Capability Discovery Rule

Agents SHOULD inspect this file, and check `dev-docs/_root/contracts/` for the shared capability vocabulary, before wiring any new provider adapter into or out of Cockpit.

## Machine-Readable Companion

Not yet implemented. Cockpit has not adopted `.governance/contracts/capabilities.yaml`. If/when it does, read `dev-docs/_root/contracts/CAPABILITY-CONTRACT-SPEC.md` first — do not invent a parallel vocabulary for Cockpit's existing adapter pattern.
