# Cockpit Operational State Contract v1

## Ownership

Operational state is owned by Cockpit's operational core/state layer.

The GUI is a **consumer and renderer** of that state. It may issue intents, but it must not become the authoritative store for approvals, wizard progress, selected operational context, or execution lifecycle.

## State categories

Contract-owned state includes:

- provider/host snapshot
- selected run and run filter
- wizard progress

Feature-owned workflow state remains outside the core contract when its shape and lifecycle are specific to a provider or workflow, including approval dialogs, command status, operation inputs/results, and provider-specific errors.

Pure presentation state may remain local to the GUI when it has no operational meaning.

## Update model

The intended flow is:

`host/provider result -> state store -> state change -> render`

and:

`user interaction -> intent -> Cockpit operational core -> state change`

The renderer must not mutate operational state directly.

## Contract

`schemas/cockpit-state-v1.schema.json` defines the minimum stable envelope:

- `schema_version`
- monotonic `revision`
- `snapshot`
- `ui` operational selections

The existing snapshot payload may evolve independently behind the envelope; fields become contractually stable when promoted into the schema.

## Approval rule

Approval workflow details may remain feature-owned and transient, but approval authority is never owned by the GUI. The host/core validates the exact provider, command, input, confirmation, and approval scope before execution. Closing a dialog without approval must not silently authorize anything.

## Dependency rule

**Cockpit GUI MUST NOT become the authority for operational state.**

The GUI may depend on Cockpit state contracts. Cockpit core may depend on provider/host contracts. Neither depends on an application shell.
