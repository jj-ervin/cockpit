# Cockpit Command Interface v0.1

## Status

**Proof implementation — 2026-09-26**

This document records the smallest implementation test of Cockpit as a reusable human command interaction layer. It is intentionally narrower than a full Quick-Bar, natural-language interpreter, or CLI.

## Boundary

The reusable interaction flow is:

`human input -> injected resolver -> structured command request -> host command intent`

Cockpit owns the interaction protocol and transport shape. The application/provider integration owns command resolution and domain semantics.

The proof deliberately does not contain:
- provider-specific command mappings;
- provider implementations;
- command execution;
- credentials, authorization, or approval authority;
- natural-language model inference;
- Cockpit product tabs or workflow state.

## Contract

An injected resolver receives the human-entered string and returns:

- `providerId`
- `commandId`
- optional `parameters`
- optional `requiresConfirmation`

The interface turns that result into the existing `eco.cockpit.invokeProviderCommand` intent and sends it through the injected host adapter.

A failed resolution produces no host message.

## What this proves

A non-Cockpit application can own:
- its own command catalog/resolver;
- its own state;
- its own host adapter;

while reusing Cockpit's human-input-to-command-intent interaction boundary.

This is deliberately a proof, not a claim that the existing Cockpit command palette should be replaced immediately.

## Next experiment

If this boundary survives review, the next step is to attach the existing provider command catalog as one concrete resolver and drive the real command palette through this interface without moving provider semantics into Cockpit.
