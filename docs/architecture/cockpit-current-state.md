# Cockpit — Current State & Execution Authority

**Status:** CURRENT / EXECUTION AUTHORITY  
**Updated:** 2026-09-23  
**Repository:** `jj-ervin/cockpit`  
**Default branch:** `main`

## Purpose

This is the current-state normalization layer for Cockpit planning.

It exists because Cockpit has accumulated historical planning documents, corrected PASS identities, superseded implementation assumptions, and later architecture decisions. Those records remain valuable, but they must not be allowed to manufacture current work.

**Current implementation, verified evidence, and explicit later decisions take precedence over stale planning language.**

## Authority order

When sources disagree, use this order:

1. **Current code and verified tests/CI** — what exists and is actually proven.
2. **Latest explicit architecture/product decision** — what Cockpit is currently intended to be.
3. **Current architecture contracts** — schemas, provider contracts, state contracts, and living boundary specifications.
4. **PASS registry** — governed identity/status of work that has actually been registered and accepted.
5. **DEV-PLAN / DEV-PATH / DEV-RELEASE historical entries** — planning and historical evidence, reconciled when stale.
6. **Older embedded or recovered plans** — lineage only unless explicitly re-adopted.

No older document may reopen or redefine a closed PASS by itself.

## Current product boundary

Cockpit is the **universal UI/UX host and application shell**.

Cockpit owns:
- UI shell and application-shell composition
- panels, views, inspectors, dashboards, logs, and interaction design
- human-in-the-loop approval UX
- operator workflow composition
- provider discovery/presentation
- typed host/provider integration surfaces

Cockpit does not absorb provider/domain authority.

In particular:
- **Marlin** owns install, scaffold, audit, package, and governance-setup logic.
- **DevXToolkit** owns semantic command implementation and command semantics.
- **eco runtime** owns governed execution/runtime authority.
- Providers own their domain commands and provider-owned metadata.
- Adapters/host bridges carry typed contracts between those layers.

The durable phrase is:

> **Universal Cockpit, provider surfaces as guests.**

Marlin is the first provider/product surface; it does not define Cockpit.

## Current architecture

The current Cockpit boundary is:

```text
Provider / DevXToolkit capability
        ↓
typed discovery / command contract
        ↓
Cockpit operational core / adapters / host bridge
        ↓
Cockpit GUI
        ↓
reusable application-shell patterns
```

The existing host boundary `window.cockpitHost.postMessage()` remains the GUI-to-host intent seam.

The GUI is not the authority for execution, approvals, provider integrity, or operational state.

### Command catalog

`cockpit-provider-command-catalog-v1` is frozen.

`cockpit-provider-command-catalog-v1.1` is implemented and CI-verified. It adds descriptive structured-input metadata without adding execution authority.

Rules:
- discovery is informational, not executable;
- provider-owned metadata is not duplicated in Cockpit;
- malformed/unsupported catalog versions fail closed;
- generic consumers produce untrusted input that still traverses the existing host validation/approval path;
- Quick-Bar is not reopened merely because the catalog exists.

### Operational state

`CockpitState` is the authoritative operational state layer.

Contract-owned state currently includes:
- provider/host snapshot;
- selected run and run filter;
- wizard progress.

Provider/workflow-specific state remains feature-owned outside the core contract.

The legacy GUI `state.foo.bar` access pattern is a compatibility facade over the state contract, not a second authoritative store.

Unknown core/UI fields are rejected.

## Verified recent hardening

The following are already implemented and were CI-verified before documentation reconciliation:

- provider command catalog v1.1;
- structured command-input metadata;
- catalog compatibility/downgrade behavior;
- host-side catalog schema validation;
- CockpitState field ownership enforcement;
- state-boundary regression tests;
- provider/GUI separation and discovery-vs-execution boundary.

These were reconciled as **CKP.19.00 — Post-CKP.18 Architecture Hardening**. CKP.19.00 is a reconciliation/standards PASS, not an unimplemented feature.

## Release state

- **v0.1.0 Foundation:** closed.
- **v1.0.0 Marlin Provider Slice:** implementation gates were closed through the MarlinSetup work; publication/release packaging remains separate.
- **v1.1.0 Second-Provider Proof:** satisfied by Niji, with additional Sealdex proof. Publication/release packaging remains separate.
- **v2.0.0:** future product scope; not an active implementation PASS.

An open release/publication condition does not create an implementation task by itself.

## Backlog state

There is currently **no authoritative queued, unstarted single Cockpit implementation PASS**.

The recent Marlin Package Search update/remove mutation UI gap belongs to **Marlin INIT.19.06**, not automatically to a new Cockpit PASS.

Therefore the next Cockpit implementation must come from an explicit product/architecture scope decision. Do not invent CKP.20.00 from an old checkbox.

## Planning-document rules

### DEV-PLAN.md
Owns active product scope and milestones, but historical entries inside it remain historical. A dated closure or correction later in the same document supersedes earlier planning assumptions.

### DEV-PATH.md
Owns recovered lineage and decision history. It is not a live task queue.

### DEV-RELEASE.md
Owns release gates and publication conditions. Release readiness is not implementation backlog.

### PASS registry
Owns governed PASS identity and lifecycle. A PASS marked accepted/closed is not reopened by stale prose.

### Living architecture documents
Documents explicitly marked as current/living architecture may be updated to reflect real occupants and current boundaries. Historical closure entries remain append-only.

## Reconciliation rule

When a stale planning statement conflicts with later verified implementation or an explicit later decision:

1. do not follow the stale statement;
2. preserve the historical record;
3. add a dated correction/reconciliation note where necessary;
4. update the current-state authority document;
5. update any genuinely live status table;
6. never create a new PASS merely to make an old document look complete.

## Next-work rule

Before starting new Cockpit implementation:

1. read this document;
2. inspect current code and recent verified evidence;
3. inspect the latest product/architecture discussion;
4. check the PASS registry for genuinely open work;
5. distinguish provider-owned gaps from Cockpit-owned gaps;
6. only then select or create the next PASS.

**No work is considered "next" merely because an old document says "Next."**
