# Cockpit Catalog Resolver v0.1

Status: proof implementation — 2026-09-26

## Purpose

This proof tests the next boundary in Cockpit's reusable human interaction layer:

`provider command catalog -> catalog resolver -> CommandInterface -> host command intent`

The catalog resolver is an injected adapter. It converts a discovered command identifier into the neutral request shape already accepted by `CommandInterface`.

## Boundary

The resolver owns only catalog lookup and translation into the CommandInterface request fields:

- `providerId`
- `commandId`
- empty/default `parameters`
- confirmation classification derived from existing catalog metadata

It does not own provider behavior, command implementation, authorization, credentials, execution, or arbitrary command input generation.

The provider catalog remains discovery metadata. Discovery does not grant execution authority.

## Proof

A catalog containing a real provider-style command can be injected into `CommandInterface`. Human input matching the discovered command ID produces the existing `eco.cockpit.invokeProviderCommand` intent.

Unknown input fails closed and produces no host message.

Commands with input schemas do not cause the resolver to invent parameter values. Parameter collection remains a separate Cockpit interaction concern.

## Deliberate limitation

This is not yet a full natural-language resolver. It intentionally proves deterministic catalog lookup first. Alias, fuzzy, natural-language, or AI-assisted resolution can be added later as separate resolver implementations without changing `CommandInterface`.

## Next boundary

Parameter interaction: take a resolved catalog command with declared input metadata and collect/validate human-provided parameters before producing the invocation request.
