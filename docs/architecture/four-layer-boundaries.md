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
