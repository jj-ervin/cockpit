# Cockpit Provider Command Discovery v1

## Purpose

Cockpit discovers provider command metadata from the installed provider manifest rather than maintaining a second presentation catalog in the web bundle.

The host exposes the discovered data as `cockpit-provider-command-catalog-v1`.

## Source of truth

The provider's `cockpit-provider-v1` manifest owns:

- provider identity, name, version, and description;
- command ID;
- command title;
- provider action name;
- mutation classification;
- confirmation requirement;
- command placements;
- provider appearance metadata such as its icon.

Cockpit GUI code may keep a command ID as a workflow routing reference when a particular feature has behavior attached to that command. That is not a metadata declaration and does not authorize execution.

## Boundary

`eco.cockpit.listProviderCommands` is read-only discovery.

The returned catalog:

- does not grant execution authority;
- does not replace `eco.cockpit.invokeProviderCommand`;
- does not bypass host validation, approval, authorization, or provider integrity checks.

The execution path remains:

`GUI intent -> host validation -> provider registry -> provider execution`.

## Parameters

Provider manifests currently do not define command input schemas or argument metadata. Therefore Cockpit does not invent parameter definitions here.

If provider command input schemas are added to `cockpit-provider-v1`, the catalog can expose them without changing the execution boundary.

DevXToolkit's command grammar remains independent. Its `title`, `description`, `icon`, input, and output metadata describe DevXToolkit capabilities; they are not implicitly substituted for provider metadata.

## Current migration

The web bundle now requests the catalog during startup and consumes discovered command titles for provider-facing UI.

Feature workflows retain their routing IDs while the catalog migration proceeds incrementally. This avoids a broad GUI rewrite and preserves existing behavior.

The next natural consumer is a generic command palette/Quick-Bar, which can enumerate commands from this catalog rather than introducing another hardcoded command list.
