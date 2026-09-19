# Four-Layer Boundary Rules

These rules are the architectural boundary for DevXToolkit, Cockpit Core, Cockpit GUI, and the future reusable Application Shell.

## 1. DevXToolkit

**IS:** a reusable developer capability and command layer.

**IS NOT:**
- a GUI
- a Cockpit plugin
- an application shell
- a provider-specific operator console
- an authority broker for human approvals
- a dependency of Cockpit's internal state implementation

**Rule:** DevXToolkit owns command definitions and command execution semantics. Consumers discover them through its published grammar; they do not reach into its implementation.

## 2. Cockpit Core

**IS:** the operational layer that receives intents, routes execution, mediates host/provider boundaries, owns operational state, and returns results.

**IS NOT:**
- a domain provider
- a generic application shell
- a renderer
- a second copy of DevXToolkit
- the owner of provider-domain business rules

**Rule:** operational authority/state belongs here, not in rendering code.

## 3. Cockpit GUI

**IS:** Cockpit's operator-facing presentation and interaction surface.

**IS NOT:**
- the authoritative operational state store
- the command executor
- a provider implementation
- a generic application shell
- a replacement for provider/domain semantics

**Rule:** GUI code renders state and emits intents. It does not silently become the operational authority.

## 4. Application Shell

**IS:** a reusable application structure and registration surface, if/when a second real consumer proves the need.

**IS NOT:**
- Cockpit
- DevXToolkit
- a provider registry
- a command executor
- a governance engine
- a domain model
- an application-specific state store

**Rule:** the shell knows structure, registration, navigation, and generic UI lifecycle; it does not know what an application's tabs or panels mean.

## Dependency direction

The allowed direction is:

`DevXToolkit` — standalone

`Application Shell` — standalone

`Cockpit Core` -> DevXToolkit/provider/host contracts

`Cockpit GUI` -> Cockpit Core

`Application` -> Application Shell

An application may independently consume DevXToolkit. It must not need Cockpit merely to use the shell.

## Enforcement

These rules are architectural constraints, not suggestions. New cross-layer imports or domain-specific shell primitives should be treated as boundary violations and reviewed before merging.

## Cockpit state ownership

The state contract is intentionally narrower than the recovered GUI state bag.

### CockpitState owns
- snapshot: host/backend-derived Cockpit operational snapshot.
- ui.selectedRunId: selected operational record.
- ui.runFilter: current run-view filter.
- ui.wizardStep: Cockpit setup-wizard position.

### Cockpit feature state owns
Feature workflows keep transient command/result state outside the core CockpitState contract:
- Marlin: package search results/errors, install result, package-resolution/approval workflow details.
- Audit: target, active audit stage, approval, errors, and stage results.
- Doctor: target, active command, assessment, operation definitions/inputs, registry digest, approval, and result.
- Agents: active command, templates, detections, roster digest, approval, and result.
- Niji proof: active command, error, and last provider result.
- Sealdex: plan/entry workflow state and pending provider approval.

These are feature-owned because their shape and lifecycle are specific to the feature/provider workflow. They must not be added to the versioned CockpitState schema merely because the Cockpit GUI renders them.

### Presentation-only state
The GUI may keep ephemeral presentation state locally:
- policy editor baseline (policyOriginal)
- artifact-delete undo payload (lastDeletedArtifact)
- selected workspace-tree path (selectedWorkspacePath)
- notice timeout handle (noticeTimer)

These values are interaction mechanics, not Cockpit operational state.

### Ownership rule
A field belongs in CockpitState only when Cockpit itself needs the field as shared operational context or as part of the host/backend snapshot contract. A provider-specific result, workflow-local command status, editor baseline, timer, or view-only selection stays outside the core state contract.

This is an ownership rule, not a recommendation. A new field should be classified before it is added to CockpitState.