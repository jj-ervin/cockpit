# DEV-RELEASE — Cockpit

**AUTHORITY LEVEL: AL:1**
**Status:** Active
**Created:** 2026-07-11

Relationship to other docs:
`DEV-PLAN.md` owns what is being built and in what order.
`DEV-PATH.md` owns recovered lineage, decisions, and source pointers.
`docs/specifications/CKP.v1.0-scoping.md` owns the durable architecture boundary (locked, portfolio owner, 2026-07-02).
**This file owns:** what ships externally, under what conditions, and what each release unlocks.

---

## Product identity and v1 release slice (read this before scoping any release)

These two statements are locked together and must never be separated:

> **Product identity:** Cockpit is the portable, universal UI/UX host and
> application shell. It hosts product experiences through portable provider
> contracts without absorbing their domain logic. This is Cockpit's identity
> and scope — it does not narrow to any single provider's UI, and must not be
> narrowed by any future PASS, agent, or doc.
>
> **v1 release slice:** Cockpit's first release proves that architecture
> through the Marlin provider — repository discovery, governance status,
> remediation approval, and evidence export. Marlin is the priority provider
> to build first because it is the most concrete, ready-to-build v1.0 item —
> not because Cockpit's scope narrows to it.

**Do not describe v1 as "a governance console."** That phrasing invites
future architectural drift back toward "Cockpit is Marlin's UI" — the exact
misreading `CKP.v1.0-scoping.md` already had to correct once. The correct
phrase is **"Universal Cockpit, Marlin provider first."**

The durable boundary, verbatim from `CKP.v1.0-scoping.md`:

> Cockpit owns: UI shell, panels, interaction design, human approval UX,
> operator workflows, view composition.
> Marlin owns: install/scaffold/audit/package/governance setup logic.
> Adapters own: typed contract between them.

---

## Release Table

| Version | Name | Description | Status |
| --- | --- | --- | --- |
| v0.1.0 | Foundation | VS Code WebviewPanel host, five CK.01 surfaces, workspace-local governance | ✅ Done 2026-07-02 (`CKP.05`-`CKP.08.10`) |
| v1.0.0 | Marlin Provider Slice | Portable provider registration/commands/views/capabilities/lifecycle; Marlin as first conforming provider; repo discovery → governance status → remediation approval → evidence export | ⬜ In progress |
| v1.1.0 | Second-Provider Proof | A second, smaller provider (e.g. Niji status/launch/export) proves the provider contract is generic, not Marlin-specific | ⬜ |
| v2.0.0 | Developer OS Controls | Multi-agent orchestration console display, workspace graph, profile management | ⬜ |

---

## v1.0.0 Entry Conditions

These prove the universal-shell architecture works, not just that one
integration was built:

- [ ] `cockpit-provider-v1` protocol defined: manifest schema, commands,
      views, capabilities, permissions, lifecycle, transport, structured
      operation results
- [ ] Provider registration is portable — not hardcoded to Marlin's specific
      commands/paths
- [ ] Existing `MarlinAdapter`/`install_phase1.py` boundary (verified
      2026-07-02: every write path raises `WriteNotSupportedError`, previews
      steps, hands back an `apply_command`) converted into a conforming
      `cockpit-provider-v1` provider, not just left as a special case
- [ ] Vertical slice works end to end: discover repository → run GC
      validation through Marlin → render findings → preview remediation →
      request human approval → execute through Marlin → verify → export
      evidence
- [ ] Structured JSON operation results only — no screen-scraping,
      hardcoded paths, or duplicated governance decisions in Cockpit itself
- [ ] Stranger installs Cockpit without the `C:\dev` portfolio workspace or
      eco present
- [ ] At least one non-Marlin provider scoped (need not ship in v1.0) to
      confirm the contract isn't accidentally Marlin-specific

## v1.1.0 Entry Conditions

- [ ] A second, smaller provider (candidate: Niji status/launch/export)
      implements `cockpit-provider-v1` with no Cockpit-side special-casing
- [ ] Confirms the provider contract genuinely generalizes before any third
      provider (CXP, Lasso) is attempted

---

## What ships in v1.0.0

- Portable provider contract (`cockpit-provider-v1`) as real, versioned schema/code — not just prose in a scoping doc
- Marlin provider: install-readiness preview → approval → execution → evidence, rendered inside Cockpit's shell
- Common shell primitives needed to prove portability: navigation, panels, command palette, approval/confirmation UX, evidence/history viewer
- Electron desktop host that wraps the existing standalone loopback web host;
  it is packaged with the Cockpit JSON bridge and has no VS Code dependency.

## What does not ship in v1.0.0 (deferred, not abandoned)

- Full "universal OS shell" breadth (identity/permissions federation, extension marketplace, cross-app messaging, multi-tenant)
- CXP, Lasso, or eco providers (each gets its own adapter later, once the Marlin slice proves the contract)
- Enterprise SSO, compliance profiles, hosted control plane (Cockpit Organization tier — commercial scope, not v1.0 architecture)

---

## Definition of Done (v1.0.0)

A stranger with no portfolio context:

1. Installs Cockpit standalone (no eco, no `C:\dev` workspace)
2. Connects an ordinary repository
3. Runs GC validation through the Marlin provider
4. Reviews findings, approves a remediation, sees it execute through Marlin
5. Exports an evidence bundle
6. Does all of this without needing to understand Marlin's CLI directly — Cockpit renders the workflow, Marlin performs and verifies it

---

*Cross-reference: `docs/specifications/CKP.v1.0-scoping.md` (durable boundary, authoritative) | `DEV-PLAN.md` (current execution state) | `../marlin/DEV-RELEASE.md` (provider-side release contract)*
