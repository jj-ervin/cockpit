# Cockpit Provider Command Intent v1

## Purpose

Cockpit GUI code does not execute provider commands. It constructs a neutral **command intent** and sends it across the existing `cockpitHost.postMessage(...)` boundary.

The machine-readable contract is `schemas/cockpit-command-intent-v1.schema.json`.

## Shape

A provider command intent contains:

- `type`: `eco.cockpit.invokeProviderCommand`
- `providerId`: selected provider identity
- `commandId`: command identity supplied by the provider/DevXToolkit command contract
- `input`: command input payload
- `confirm`: whether the operation requires the host's confirmation path
- optional `approval`: the exact approval token/scope when a human has already approved the action

## Boundary

The GUI is responsible for:
1. collecting operator input;
2. selecting the command requested by the current feature;
3. constructing the intent;
4. rendering returned state/results.

The host/core is responsible for:
1. resolving whether the provider and command are available;
2. validating the command against the provider's published command contract;
3. enforcing authorization and approval;
4. executing the command;
5. returning the result/state.

The GUI must not import provider implementations or infer execution semantics from presentation metadata.

## Relationship to DevXToolkit

DevXToolkit's command grammar describes **what a command is** and provides stable command identity plus metadata.

Cockpit's command intent describes **a request to invoke one discovered command**.

They are deliberately separate:

`DevXToolkit command grammar` → discovery/description

`Cockpit command intent` → invocation request

`Host/provider boundary` → authorization/execution


Discovery metadata never grants execution authority.

## Compatibility

The existing `eco.cockpit.invokeProviderCommand` message type is retained. This contract formalizes the message rather than introducing a new transport or execution path.
