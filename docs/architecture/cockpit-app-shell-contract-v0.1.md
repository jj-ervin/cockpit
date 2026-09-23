# Cockpit App Shell Contract v0.1

**Status:** PROPOSED CONTRACT / PHASE 2 ARCHITECTURE  
**Date:** 2026-09-23  
**Authority:** `docs/architecture/cockpit-current-state.md`  
**Input:** `docs/architecture/cockpit-app-shell-inventory.md` Phase 1

## Purpose

Define the smallest contract surface required to extract a reusable App Shell from the existing Cockpit GUI without redesigning Cockpit or moving provider/domain authority into the shell.

The App Shell is a reusable UI/application composition layer. It is not an execution runtime, provider authority, approval authority, credential store, or domain framework.

## Contract boundary

```text
Application Definition
        │
        ▼
┌───────────────────────────┐
│       Reusable App Shell  │
│ frame / nav / primitives  │
│ workflow / presentation   │
└─────────────┬─────────────┘
              │
       ┌──────┴──────┐
       ▼             ▼
 Host Adapter    Feature Surfaces
       │             │
       ▼             ▼
 host/runtime     app/provider
 authority        domain logic
```

The shell consumes typed descriptions and callbacks. It does not decide what a provider command means or whether an operation is authorized.

## Minimal interfaces

### 1. Application Definition

The application definition describes what an app wants the shell to compose.

Conceptual shape:

```js
{
  id,
  title,
  brand,
  navigation,
  features,
  initialView,
  settings
}
```

Required:
- `id`: stable application identifier
- `title`: display name
- `navigation`: ordered navigation entries
- `features`: injected feature/surface definitions

Optional:
- `brand`
- `initialView`
- `settings`

The shell must not infer domain behavior from application IDs.

### 2. Navigation Item

```js
{
  id,
  label,
  icon,
  view
}
```

Required:
- stable `id`
- display `label`
- target `view`

Optional:
- `icon`
- grouping/presentation metadata

Navigation is a shell concern. The meaning and implementation of the destination view belong to the injected application/feature.

### 3. Feature Surface

```js
{
  id,
  mount(context),
  unmount(context)
}
```

A feature surface owns its domain UI and local workflow state.

The shell supplies a context containing only shell capabilities:

```js
{
  host,
  state,
  ui,
  lifecycle
}
```

A feature does not receive shell internals, arbitrary DOM authority, approval authority, credentials, or runtime execution authority.

### 4. Host Adapter

The existing `window.cockpitHost.postMessage()` seam is the starting implementation boundary.

Conceptual contract:

```js
{
  post(message),
  subscribe(listener),
  getConnectionState()
}
```

The shell may:
- send typed intents;
- receive typed host messages;
- present connection state.

The shell may not:
- execute commands directly;
- mint approval tokens;
- decide authorization;
- access credentials/secrets;
- bypass host validation.

Provider execution remains behind the existing typed host/provider contract.

### 5. State Adapter

The existing `CockpitState` implementation supplies the proven foundation.

Minimal shell-facing contract:

```js
{
  get(),
  setUi(key, value),
  replaceSnapshot(snapshot),
  subscribe(listener)
}
```

The App Shell owns shell/UI state such as:
- selected navigation/view;
- shell layout/preferences;
- transient presentation state;
- wizard position when the wizard itself is shell-owned.

Application/provider workflow state remains feature-owned.

The legacy `state.foo.bar` compatibility proxy is explicitly excluded.

### 6. Approval Presentation

Approval is a presentation capability, not an authority interface.

Minimal shape:

```js
{
  present(request),
  close(),
  onDecision(callback)
}
```

The request may contain displayable scope/operation information supplied by the authoritative host/provider path.

The shell may collect a human decision and return it to the caller. It must not:
- generate or validate authority tokens;
- determine whether approval is required;
- reinterpret provider permissions;
- grant execution authority.

### 7. Lifecycle

Minimal lifecycle hooks:

```js
{
  start(),
  stop(),
  refresh()
}
```

These describe shell lifecycle only. Their host/runtime effects are supplied by the host adapter.

## Generic UI primitive boundary

The following are intentionally primitives rather than domain contracts:

- panel
- card
- list
- table
- form
- field
- notice
- empty/error state
- status display
- dialog
- wizard/stepper
- navigation
- command-palette presentation
- workspace/tree selection presentation

Primitives receive data and callbacks. They do not import Marlin, Niji, Sealdex, LASSO, eco, GC, or provider-specific command semantics.

## Provider command catalog boundary

The App Shell may render a command-discovery UI using the existing provider command catalog v1/v1.1.

It must consume:
- provider identity;
- command identity;
- descriptive metadata;
- structured input metadata.

It must not convert discovery metadata into executable authority.

The existing host validation, approval, provider-integrity, and execution path remains authoritative.

## Non-goals

App Shell v0.1 does **not** define:
- a new runtime;
- a new command protocol;
- a new provider protocol;
- a new approval protocol;
- credentials/authentication;
- execution semantics;
- eco integration;
- Cockpit domain models;
- provider-specific UI contracts;
- a plugin marketplace;
- a standalone derived application yet.

## Dependency rule

The intended dependency direction is:

```text
App Shell primitives
        ↓
Shell infrastructure
        ↓
Application definition
        ↓
Feature/provider surfaces
        ↓
Host/provider authority
```

A reusable shell must not depend upward on a provider feature.

## Extraction acceptance criteria

Before implementation is considered complete:

1. A shell can render without Marlin/Niji/Sealdex/LASSO code imported into the shell core.
2. Navigation definitions are injected rather than hardcoded.
3. Host interaction occurs through the host adapter.
4. Shell state is isolated from provider workflow state.
5. Approval UI contains no authority/token-generation logic.
6. Generic UI primitives contain no provider/domain semantics.
7. Existing Cockpit can consume the shell without changing its provider contracts.
8. A minimal separately branded derived app can later consume the same shell contract.
9. Existing Cockpit behavior remains covered by its current tests.
10. No new execution authority is introduced by shell extraction.

## Phase 2 decision

This contract is intentionally minimal. It defines **interfaces, not implementation structure**.

The next implementation step, if explicitly authorized, is to create the smallest shell seam around these contracts and migrate one low-risk primitive at a time. Do not extract the large `renderSnapshot` composition or provider workflows first.

No CKP.20.00 implementation PASS is created by this contract document alone.
