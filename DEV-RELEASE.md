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
| v1.0.0 | Marlin Provider Slice | Portable provider registration/commands/views/capabilities/lifecycle; Marlin as first conforming provider; repo discovery → governance status → remediation approval → evidence export | ✅ Entry gates closed through MarlinSetup 2026-08-05; publication pending |
| v1.1.0 | Second-Provider Proof | A second, smaller provider proves the provider contract is generic, not Marlin-specific | ✅ Proof satisfied 2026-08-21 (Niji); additional Sealdex proof 2026-08-21; publication/release packaging remains separate |
| v2.0.0 | Developer OS Controls | Multi-agent orchestration console display, workspace graph, profile management | ⬜ |

---

## v1.0.0 Entry Conditions

These prove the universal-shell architecture works, not just that one
integration was built:

- [x] `cockpit-provider-v1` protocol defined: manifest schema, commands,
      views, capabilities, permissions, lifecycle, transport, structured
      operation results
- [x] Provider registration is portable — not hardcoded to Marlin's specific
      commands/paths
- [x] Existing `MarlinAdapter`/`install_phase1.py` boundary (verified
      2026-07-02: every write path raises `WriteNotSupportedError`, previews
      steps, hands back an `apply_command`) converted into a conforming
      `cockpit-provider-v1` provider, not just left as a special case
- [x] Vertical slice works end to end: discover repository → run GC
      validation through Marlin → render findings → preview remediation →
      request human approval → execute through Marlin → verify → export
      evidence
- [x] Structured JSON operation results only — no screen-scraping,
      hardcoded paths, or duplicated governance decisions in Cockpit itself
- [x] Stranger installs Cockpit through MarlinSetup without the `C:\dev`
      portfolio workspace or eco present
- [x] At least one non-Marlin provider scoped (need not ship in v1.0) to
      confirm the contract isn't accidentally Marlin-specific

### Reconciliation note (2026-08-05, CKP.17)

Checked against real, tested evidence from CKP.17.01–.03 and its corrective
pass (`DEV-PLAN.md`), not intent or plan:

- **Protocol defined** — `schemas/cockpit-provider-v1.schema.json` and the
  operation request/result schemas are real and, as of the corrective pass,
  actually enforced by `host_bridge.py` (request/result validation,
  operation_id/provider_id/command_id correlation) rather than merely
  present on disk.
- **Registration is portable** — `provider_discovery.py` + `ProviderRegistry`
  carry zero Marlin-specific code and were proven against two independent
  real providers (Niji, and Marlin's own new governance provider).
- **Structured JSON only** — true across both the adapter and provider
  paths; the corrective pass's schema enforcement closes the gap that would
  have let a malformed result through unnoticed.
- **Non-Marlin provider scoped** — Niji already satisfies this; not new
  today, but never checked off.

**Still open, honestly:**

- **MarlinAdapter conversion** — not done. CKP.17.03 built a *new*,
  separate `cockpit-provider-v1` provider for Marlin's governance surface
  (`marlin-dxp/src/provider.ts`) — it did not touch or convert
  `src/cockpit/adapters/marlin.py` (untouched since `c3d3752`). The old
  install-readiness special case and the new governance provider currently
  coexist; the old one was not converted or removed.
- **Vertical slice end to end** — the *backend* chain is real and proven
  live (discover via the existing workspace-tree/repo-status adapter data,
  validate/preview/approve-gate/execute/verify/evidence-export all real
  through the Marlin provider), reachable over real HTTP via host-web's
  `/api/bridge`. No UI renders any of it yet — `web/cockpit.js` was not
  touched by CKP.17. "Vertical slice works end to end" is true at the API
  layer, not yet true as something a human can click through.
- **Stranger installs Cockpit** — not attempted. CKP.17 proved provider
  *discovery* has no `C:\dev`/eco coupling (isolated-home installs of both
  Niji and Marlin's provider), but never tested installing Cockpit itself
  outside this portfolio workspace.

### CKP.18.01 ownership closure (2026-08-05)

The former `MarlinAdapter` special case is now removed. Marlin's installed
package state, registry search, and confirmation-gated install are provider
commands (`marlin.package.list/search/install`) implemented by Marlin itself.
Cockpit's own development-install preview is exposed by the `cockpit` adapter,
and generic tree/repository status is exposed by the `workspace` adapter.
Both host-web and eco-vscode use the same provider request/result protocol and
retain no direct Marlin CLI spawn or resolution path. This closes the first of
the three CKP.18 release actions; the clickable browser vertical slice and
stranger installation remain open.

### CKP.18.02 browser vertical-slice closure (2026-08-05)

The shared Cockpit bundle now has a Marlin Audit workflow that selects a
discovered repository, renders structured validation findings, runs a dry-run
remediation preview, presents an exact-scope human approval dialog, executes
the confirmation-gated Marlin normalization, automatically verifies the
result, and downloads Marlin's final evidence bundle unchanged as JSON.

The bridge requires literal `confirm: true` plus an approval token whose
canonical scope exactly matches the provider ID, command ID, and input.
Missing or mismatched scope fails before provider spawn. Both host-web and
eco-vscode relay the same generic provider command/result envelope. A real
Chromium test proves the complete browser → HTTP host → Python bridge → built
Marlin provider → PowerShell GC-AUDIT → file mutation → verification →
evidence-download path against an isolated portfolio. The only remaining
v1.0.0 entry gate is the stranger installation of Cockpit itself.

### CKP.18.04 Marlin-owned stranger-install closure (2026-08-05)

CKP.18.03's Cockpit-owned NSIS decision was architecturally wrong and is
superseded. Cockpit supplies a checksum-pinned Windows x64 `cockpit-core` ZIP;
`MarlinSetup.exe` is the sole bootstrap installer. Its embedded Marlin engine
verifies the payload, executes the manifest, records package state, places the
runtime under Marlin's managed app directory, and launches Cockpit.

The corrected release exercise copied MarlinSetup to `C:\sandbox`, installed
the bootstrapper silently, and let Marlin install `cockpit-core@1.0.0` into an
isolated `MARLIN_HOME`. `state.yaml` records the package and `cockpit` bin;
the launched shell resolved all resources and its bridge beneath
`marlin-home\apps\cockpit-core\1.0.0`, opened an ordinary repository outside
the portfolio, and rendered all 13 tabs. MarlinSetup SHA-256:
`6df57d9266f87fe9a49082ff2913b493d236b1deca88a6137ad574e4fe35e9e9`.
Cockpit payload SHA-256:
`af79263b367db790f68ff9d340d282ba7a0309a8b561e8df4104cb39062ff6cc`.

This closes every v1.0.0 entry condition. Artifact publication and Marlin
registry publication remain explicit release operations; no publication is
claimed by this closure.

## v1.1.0 Entry Conditions

- [x] A second, smaller provider (Niji) implements `cockpit-provider-v1` with no Cockpit-side special-casing — real provider proof closed 2026-08-21
- [x] The provider contract generalizes beyond Marlin — Sealdex provides an additional real external-provider proof through the same generic path
- [ ] v1.1.0 publication/release packaging and external artifact publication remain separate release operations

---

## What ships in v1.0.0

- Portable provider contract (`cockpit-provider-v1`) as real, versioned schema/code — not just prose in a scoping doc
- Cockpit development readiness plus Marlin provider package/audit operations → approval → execution → evidence, rendered inside Cockpit's shell
- Common shell primitives needed to prove portability: navigation, panels, command palette, approval/confirmation UX, evidence/history viewer
- Marlin-managed `cockpit-core` desktop payload wrapping the loopback web host
  and Cockpit JSON bridge, with no VS Code or target-machine Python dependency.

## What does not ship in v1.0.0 (deferred, not abandoned)

- Full "universal OS shell" breadth (identity/permissions federation, extension marketplace, cross-app messaging, multi-tenant)
- CXP, Lasso, or eco providers (each gets its own adapter later, once the Marlin slice proves the contract)
- Enterprise SSO, compliance profiles, hosted control plane (Cockpit Organization tier — commercial scope, not v1.0 architecture)

---

## Definition of Done (v1.0.0)

A stranger with no portfolio context:

1. Installs Cockpit through MarlinSetup (no eco, no `C:\dev` workspace)
2. Connects an ordinary repository
3. Runs GC validation through the Marlin provider
4. Reviews findings, approves a remediation, sees it execute through Marlin
5. Exports an evidence bundle
6. Does all of this without needing to understand Marlin's CLI directly — Cockpit renders the workflow, Marlin performs and verifies it

---

*Cross-reference: `docs/specifications/CKP.v1.0-scoping.md` (durable boundary, authoritative) | `DEV-PLAN.md` (current execution state) | `../marlin/DEV-RELEASE.md` (provider-side release contract)*

## Windows Architecture Addendum — Marlin INIT.23 (2026-08-05)

The earlier CKP.18.04 closure proved only the x64 artifact. Cockpit v1.0.0 now
has separately checksum-pinned Windows x64 and ARM64 `cockpit-core` payloads,
installed exclusively through architecture-matched MarlinSetup builds. Real
copied-installer stranger tests passed for both variants on Windows ARM64:
installed MarlinSetup, Cockpit, and bridge PE types were `0xAA64` for ARM64 and
`0x8664` for x64. The outer NSIS launcher remains a thin x86 extraction stub.
This addendum proves local release candidates; publication remains a separate
release operation.

## 2026-09-23 — Post-CKP.18 Release Reconciliation

CKP.19.00 reconciles the command-catalog v1.1 and CockpitState boundary-hardening work landed after CKP.18.04. The v1.1.0 second-provider proof condition is already satisfied by the real Niji provider proof, with Sealdex providing an additional generic-provider proof. No new Cockpit implementation PASS is currently queued by the governed release/backlog documents. Publication and artifact-release operations remain separate from implementation closure.

