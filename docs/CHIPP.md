# CHIPP: Cross-Host Integration, Packaging, and Proof

Status: discussion draft, 2026-08-21

First profile: CHIPP-Cockpit

Related Cockpit documents:

- `specifications/cockpit-platform-boundary.md`
- `specifications/cockpit-provider-v1.md`
- `specifications/cockpit-shell-platform-design-note.md`

## Purpose

CHIPP is a host-neutral playbook for moving an application across host,
integration, packaging, trust, runtime, and release boundaries with evidence
appropriate to every claim.

It applies to providers, plugins, connectors, extensions, hosted panels, and
standalone applications derived from a shared shell. Cockpit is its first
implementation profile, not a requirement built into the core playbook.

CHIPP exists because an integration can be correct in source and still fail as
an installed product. A passing unit suite does not prove packaging; a valid
package does not prove host discovery; a browser fixture does not prove the
compiled provider; and a local artifact does not prove a public release. CHIPP
keeps those claims separate and makes the handoffs between them explicit.

This draft records lessons from the Marlin, Niji, and Sealdex Cockpit work
(Sealdex was named Cairn until a same-day rename, 2026-08-21) for further
discussion and development. It is not yet a normative release gate or a
claim that every proposed tool below exists.

## Stable Core And Profiles

The CHIPP name and core proof model remain stable across environments. A
profile supplies the host-specific contracts, commands, schemas, and evidence.

Candidate profiles include:

- **CHIPP-Cockpit**: Cockpit provider contracts, domain UI, approvals, Marlin
  installation, discovery, attestation, and browser proof.
- **CHIPP-External**: integration with a host or repository outside this
  portfolio, including foreign packaging and publication rules.
- **CHIPP-Provider**: a transport-neutral provider or plugin implementation
  profile.
- **CHIPP-Release**: artifact provenance, publication sequencing, hosted
  retrieval, and clean-install proof.

Profiles may strengthen the core requirements. They must not collapse distinct
proof boundaries or silently weaken trust, approval, or evidence semantics.

## Proof Boundaries

CHIPP separates four proof boundaries:

1. **Provider contract proof**: commands, inputs, results, permissions,
   mutation declarations, and structured failure behavior are valid.
2. **Host experience proof**: discovery, rendering, navigation, approvals,
   accessibility, and real browser behavior work through the host.
3. **Installation proof**: resolution, download, extraction, attestation,
   registration, executable launch, and removal work from the packaged form.
4. **Release proof**: the hosted artifact is current, provenance-linked,
   retrievable, checksum-valid, and installable in a clean environment.

Evidence belongs to the boundary it actually exercises. No boundary inherits a
green status merely because an earlier boundary passed.

### One-Click App Install Requirement

For an app/provider release, "installable" means a normal user can find one
obvious install or download action, start a clickable installer or platform
bootstrap, review approval/checksum/provider metadata inside that flow, and
end with the app installed and runnable without using a CLI, manually
unpacking a zip, or knowing how the host package manager works.

Technical package-manager proof is necessary but not sufficient for a
public-user-ready release. A clean `marlin install <package>` path proves the
installer engine; it does not prove the release has a user-facing front door.
CHIPP release records should target a path from release page to
installed/runnable app in under five minutes, unless the omission is explicit,
accepted, and recorded as a limitation.

## UI Proportion And Window-Shape Guidance (2026-08-21)

Design guidance for Cockpit-hosted and Cockpit-derived window shapes.
This is guidance for designers and implementers, not a normative gate —
no implementation is proposed by this note.

- **Full app shells** (the full Cockpit workspace, or a Cockpit-derived
  standalone shell) default to a 16:10 window proportion.
- **Installer/wizard windows** use 5:3 or a near-golden horizontal
  proportion (e.g. 800x480) — compact and task-focused, not shell-shaped.
- **Splash screens** use 16:9 or 5:3 and stay on screen only briefly.
- **Approval dialogs** stay compact, never full-shell-sized — an approval
  is a focused decision, not a workspace.
- The golden ratio (~1.618:1) is a useful default across the above for
  near-square-to-wide proportions; it is guidance, not dogma. Departing
  from it for a concrete layout reason (content density, platform
  convention, accessibility) needs no special justification.

A Marlin per-package installer window (see INIT.19.06's constrained
install-mode window, and Marlin's own `DEV-RELEASE.md` for the fuller
wizard-stage guidance) is the clearest current example of the
installer/wizard row above, and reinforces the existing CHIPP-Cockpit
ownership boundary: full Cockpit nav, tabs, and the Setup Wizard must
never be exposed as part of a package-installer flow unless the user
takes an explicit action to open Cockpit itself.

## Installer Identity Transition Model (2026-08-21)

Design guidance for how visual identity moves between Marlin and a
managed package across an installer flow, paired with the same-dated
guidance in `marlin/DEV-RELEASE.md` (which carries the full reusable
branding-contract field list). No implementation is proposed by this
note.

**Core principle.** Treat install as a deliberate identity handoff: the
installer visually belongs to Marlin until authorization is granted, then
visually belongs to the package being installed.

**Stages.**

1. **Marlin splash** — Marlin visually dominant. "Preparing installer" /
   "Preparing Sealdex." Minimal loading indicator. The package is not yet
   featured prominently.
2. **Marlin authorization query** — Marlin remains visually dominant.
   Heading: "Install Sealdex?" Explains that Marlin will guide the
   installation. Shows the package's name/version in body text, not as
   the dominant visual. Cancel / Continue. A concise trust indicator
   (e.g. checksum/attestation status) where available.
3. **Package installation wizard** — after Continue, visual dominance
   shifts to the package: its icon/name/version become prominent. Marlin
   becomes a quiet footer attribution ("Installed with Marlin"), never
   co-branded equally. Window dimensions and navigation stay stable
   across the shift — it is a branding change, not a resize or a
   different window.
4. **Completion** — the package remains visually dominant. "Sealdex
   installed successfully," installed version and location, a Launch/Open
   option only when a real launch target exists, a Finish button, and
   quiet Marlin attribution.

**Boundary**, restated from CHIPP-Cockpit's ownership split above: Marlin
(and, where Cockpit's install-mode window implements a stage, Cockpit)
controls layout, navigation, accessibility, safety messaging, approval
controls, and install status throughout every stage. A package supplies
identity content only (see the branding contract in `marlin/DEV-RELEASE.md`)
— it cannot override trusted controls or compromise readability.

**Boundary tests** (a design-review checklist, not automated tests) —
check every design or implementation against all four, since they pull in
opposite directions: too much Marlin (the user believes they are
installing Marlin itself); too little Marlin (the user does not know
which installer is acting); too much package too early (authorization is
unclear); too little package after authorization (the user loses
confidence about what they are configuring).

Design guidance only; no implementation is proposed or approved by this
note.

## Marlin One-Click Installer Base Template (2026-08-21)

Promotes the Installer Identity Transition Model above from guidance to
the required base template for Marlin's generated Windows one-click
package installers (full detail, including the Install-Time Choices vs.
Post-Install Walkthrough split, lives in `marlin/DEV-RELEASE.md`). This is
the design target for the next implementation slice — no implementation
is authorized by this note alone.

- Per-package installers must use the Marlin One-Click Installer Template
  — not a single-card page, and not the full Cockpit shell. Where
  Cockpit's constrained install-mode window is the implementing surface,
  it must conform to this template rather than exposing shell chrome.
- Required flow: Marlin Splash -> Marlin Authorization -> App Wizard ->
  Progress -> Complete.
- Marlin (and Cockpit, where it hosts a stage) owns layout, navigation,
  accessibility, trust messaging, approval controls, status/progress,
  checksum/source display, and attestation reporting; the package
  supplies identity/content only, through the branding contract, with
  required fallbacks for missing metadata.
- The App Wizard stage is scoped to install-time decisions only
  (footprint, trust, privileged changes, required dependencies, first
  launch); onboarding, tutorials, and optional configuration belong to a
  post-install walkthrough the app owns, not the installer.

## Eight Development Tracks

### 1. Keep Proof Boundaries Separate

**Lesson.** Provider, host, installation, and release correctness are different
claims with different failure modes.

**Development direction.** Define a standard integration evidence matrix that
names the target, environment, artifact, command, result, and unproven next
boundary for every check.

**Questions to resolve.** Which evidence is mandatory for each integration
mode? Which checks may use fixtures, and which require compiled or hosted
artifacts? How should partial proof appear in Cockpit and release records?

### 2. Preserve The Host And Domain Ownership Boundary

**Lesson.** A reusable shell does not require generic-looking applications.
The host owns common interaction and trust behavior; the provider owns its
domain language, data, commands, and workflows.

**Development direction.** Formalize a host/provider responsibility matrix and
component boundary. Standardize navigation, settings, approvals, status,
artifacts, identity, and lifecycle while leaving domain workspaces adaptable.

**Questions to resolve.** Which UI primitives belong in a shared kit? When is a
custom canvas appropriate? How can derived standalone apps preserve fixed trust
semantics while adopting their own brand?

### 3. Standardize Two-Phase AI Mutations

**Lesson.** AI-assisted mutation needs a protocol-level separation between
proposal and execution. Human approval must bind to the exact proposed payload,
and the provider must revalidate state immediately before applying it.

**Development direction.** Define a reusable propose -> inspect -> approve ->
revalidate -> apply result pattern, including stale-proposal rejection,
structured checks, recovery evidence, and cancellation.

**Questions to resolve.** Which fields form the approval digest? What context
must be repeated or recomputed? How should a host present changed checks without
encouraging automatic reapproval?

### 4. Return Expected Failures As Structured Data

**Lesson.** Filesystem, database, validation, model, and network failures are
normal operational outcomes. They should not crash a provider process or force
the host to scrape terminal text.

**Development direction.** Establish a portable error taxonomy with stable
codes, safe messages, retry guidance, recovery detail, and redaction rules.

**Questions to resolve.** Which codes belong to the cross-host core and which
remain provider-specific? What distinguishes retryable failure, user action,
stale state, cancellation, partial mutation, and provider defect?

### 5. Treat Installation Metadata As Executable Behavior

**Lesson.** Manifests, registry entries, architecture declarations, paths,
checksums, and attestation targets drive real installer and host behavior. They
are contracts, not descriptive documentation.

**Development direction.** Provide shared schemas, semantic validators, parity
tests, and producer/consumer contract tests. Centralize resolution and
attestation behavior so entry points cannot recreate lookup or trust rules.

**Questions to resolve.** Which aliases and platform claims need explicit
tests? How should hosted registries and bundled snapshots expose provenance and
fallback? Which manifest changes require a protocol or package version bump?

### 6. Verify Integrity At The Final Use Boundary

**Lesson.** Registration-time verification alone leaves a gap before process
launch. A host must verify the attested target immediately before invoking it.

**Development direction.** Standardize final-use integrity checks, executable
containment, target declaration, and clean failure behavior across hosts.

**Questions to resolve.** What caching is acceptable without reopening a
time-of-check/time-of-use gap? How should drift appear to users? Which profile
requires signatures or a stronger trust root?

CHIPP must use accurate threat language: an unauthenticated digest and adjacent
attestation detect post-install drift. They do not stop an attacker who can
replace both the executable and its attestation.

### 7. Require Artifact Provenance, Not Checksums Alone

**Lesson.** A checksum proves that references identify the same bytes. It does
not prove those bytes came from current source or the intended build.

**Development direction.** Prefer one clean, atomic release command that builds
from source into temporary outputs, records source fingerprints, validates
embedded manifests, compares packaged source with the workspace, and replaces
the final artifact only after success.

**Questions to resolve.** What belongs in a portable build manifest? Which
builds need reproducibility rather than freshness alone? How should source,
toolchain, dependency, and signing provenance be represented and verified?

### 8. Make Cross-Repository Sequencing Part Of Correctness

**Lesson.** A registry declaration can be syntactically valid while pointing to
an asset that does not exist. Commit, push, tag, publish, and verify are separate
state transitions with different authority and reversibility.

**Development direction.** Define an explicit release handoff sequence:

1. Commit provider and host support.
2. Build and verify the release artifact.
3. Publish the provider release through an authorized owner-side action.
4. Retrieve and verify the hosted artifact independently.
5. Perform a clean installation through the real resolver.
6. Commit and push registry declarations only after the hosted proof passes.
7. Record exact public evidence and remaining limitations.

**Questions to resolve.** Which steps can be automated without collapsing owner
gates? How are corrections recorded when a downstream registry was published
too early? What evidence closes each repository independently?

## CHIPP-Cockpit Profile

CHIPP-Cockpit applies the core playbook using these ownership boundaries:

- **Cockpit owns** navigation, rendering, approvals, permissions, trust chrome,
  themes, settings, activity, artifacts, provider identity, and lifecycle.
- **Providers own** domain commands, views, terminology, data, validation,
  mutations, and domain-specific recovery behavior.
- **Marlin owns** package resolution, installation, executable containment,
  provider attestation production, registration, and removal.
- **The release owner owns** irreversible publication and the evidence that a
  hosted artifact exists and installs through the public path.

The normative protocol remains `cockpit-provider-v1`; CHIPP-Cockpit explains
how to prove an implementation of that protocol across the full product path.
It does not grant execution authority or replace Cockpit's approval policy.

## Candidate Conformance Kit

The repeated work suggests a future CHIPP conformance kit rather than more
provider-specific release scripts. Candidate components are:

- provider scaffold and manifest templates
- shared protocol and package schemas
- structured-result fixture runner
- host/provider contract tests
- approval-binding and stale-state test helpers
- package and embedded-manifest validator
- atomic build and provenance-manifest helper
- real-artifact browser harness
- clean-install and hosted-release verifier
- a `provider doctor` command that reports proof by boundary

These are development candidates, not current capabilities. Each should be
adopted only when it removes demonstrated duplication or closes a demonstrated
failure class.

## Discussion Record

The eight tracks above are intentionally open. A future CHIPP decision pass
should determine:

1. Which statements become normative core requirements.
2. Which requirements belong only to CHIPP-Cockpit or CHIPP-Release.
3. The evidence matrix and vocabulary for local, artifact, hosted, and public
   proof.
4. The minimum conformance kit worth building before onboarding another app.
5. Whether the next proof should be a Cockpit-derived standalone app or a truly
   external provider outside this portfolio.

Until that pass occurs, CHIPP is guidance and a development agenda. Existing
provider contracts and repository release rules remain authoritative.
