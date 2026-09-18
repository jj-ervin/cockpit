# Application Registration Contract v1

> **Status: design contract — not a standalone shell implementation.**

This contract defines the boundary we will use if a second real application needs the reusable application shell. It is deliberately being specified before extraction so a future shell is an actual platform surface rather than a copy-paste template.

## Registration model

An application registers a manifest containing:

- identity: `id`, `name`, `version`
- tabs: ordered navigable application views
- commands: application-local actions exposed to generic shell surfaces
- settings: optional application preferences

The machine-readable contract is `schemas/application-registration-v1.schema.json`.

## Panel ownership

The shell knows that a tab has:

- an id
- a title
- optional presentation metadata
- a panel identifier

The shell does **not** know what a panel means.

A Cockpit application may register a Runs panel. i2o might register a Candidate panel. Reddit Publisher might register a Queue panel. Those domain meanings remain outside the shell.

## Rendering boundary

The shell supplies structure and lifecycle:

- application frame
- navigation/tabs
- panel mounting
- command-palette mechanics
- generic dialogs/wizards when they are eventually extracted
- layout/theme primitives that are actually implemented

The registered application supplies domain rendering and behavior.

## What the shell is NOT

- not Cockpit
- not DevXToolkit
- not a provider registry
- not a command executor
- not a governance engine
- not a domain model
- not a replacement for application state
- not a requirement for every application

## Dependency direction

`DevXToolkit -> no Cockpit dependency`

`Application Shell -> no Cockpit/domain dependency`

`Cockpit -> may consume DevXToolkit and may later consume the shell`

`Application -> may consume the shell without consuming Cockpit or DevXToolkit`

The shell therefore cannot import Cockpit-specific types, provider names, or domain semantics.

## Extraction trigger

Do not create a standalone shell package merely because this schema exists.

The trigger is a second real consumer. When i2o, Reddit Publisher, or another independent application needs this registration contract, extract the proven primitives and validate the contract against both consumers.
