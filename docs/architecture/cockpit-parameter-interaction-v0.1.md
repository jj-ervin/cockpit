# Cockpit Parameter Interaction v0.1

## Status
**Proof implementation — 2026-09-26**

This proof establishes the next seam after deterministic command resolution:

`command metadata -> declared parameter schema -> parameter interaction -> validated parameter data`

## Boundary
Parameter interaction owns the human-facing contract for collecting and validating values against a command-declared parameter schema.

It may expose field IDs and labels, field types, required/optional status, enumerated options, and defaults. It may validate required values, declared primitive types, declared options, and rejection of undeclared parameters.

It does not own provider command semantics, provider execution, authorization or approval authority, credentials or secrets, arbitrary parameter generation, command action names, host transport, or execution policy.

## Contract
The proof uses a deliberately small object schema:
`{ type: "object", fields: [{ id, label?, type, required?, options?, default? }] }`

Supported field types are `string`, `number`, and `boolean`.

A valid interaction result is `{ ok: true, parameters: {...} }`. Invalid input returns `{ ok: false, errors: [{ field, error }] }`. Undeclared input is rejected rather than silently forwarded.

## Catalog relationship
The provider catalog may carry this declaration as command `input` metadata. The catalog resolver exposes that metadata as `parameterSchema`, but still returns an empty `parameters` object until an interaction supplies values.

Discovery therefore remains distinct from execution authority.

## Deliberate limitations
This is not a full form renderer or JSON Schema implementation. It does not define provider-specific widgets, secret-entry behavior, coercion, ranges/patterns, nested objects/arrays, default application, dynamic parameter dependencies, natural-language parameter extraction, authorization, or approval.

## Next experiment
Use the parameter interaction contract in one real command-palette flow, stopping at a review/approval boundary before execution.
