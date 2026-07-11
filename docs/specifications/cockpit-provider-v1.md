# cockpit-provider-v1

Status: draft implementation contract  
Authority: Cockpit `DEV-RELEASE.md` v1.0 entry condition  
Schemas: manifest, request, result, and Marlin installation attestation under
`schemas/cockpit-*-v1.schema.json`.

## Purpose

`cockpit-provider-v1` is the portable boundary between Cockpit hosts and
product-owned domain logic. Cockpit owns navigation, rendering, approvals and
lifecycle. Providers own their commands, data and mutations. Adapters translate
between them. A host must not hardcode a provider's executable, paths, views or
governance meaning.

## Manifest

Every provider declares a stable ID and semantic version; one transport;
commands; views; capabilities; and permissions. Command IDs and view IDs are
globally namespaced by provider ID. Mutating commands MUST declare
`mutation: true`; commands needing human approval MUST also declare
`requires_confirmation: true`. Hosts fail closed when either declaration is
missing or contradictory.

Transport v1 requires `stdio-json`. For stdio,
one JSON request is written to stdin and exactly one JSON result is read from
stdout. Prompts, secrets and arbitrary user data must never be interpolated
into shell command arguments. The manifest never selects an executable.
Marlin's separate installed-provider attestation resolves the verified
executable and fixed arguments; Cockpit verifies its manifest digest before
launch.

## Request

```json
{
  "schema_version": "cockpit-operation-request-v1",
  "operation_id": "01J...",
  "provider_id": "marlin",
  "command_id": "marlin.governance.validate",
  "workspace_id": "file:///workspace/project",
  "input": {}
}
```

The host checks the manifest before dispatch. It refuses unknown commands,
undeclared capabilities, and mutation without approval. Workspace identity is
host-resolved; a provider must not accept an untrusted request field as an
authority boundary.

## Result

Every operation returns `cockpit-operation-result-v1`. Results have one of four
states: `succeeded`, `failed`, `cancelled`, or `pending-approval`. Evidence is
an array of references, optionally content-digested. Providers never report
success for a partially applied mutation; partial state is a failed result with
evidence and recovery detail in `data`.

## Lifecycle

1. Discover manifest.
2. Validate schema and compatibility.
3. Ask for declared permissions only when a surface needs them.
4. Start or connect transport.
5. Run health before enabling commands.
6. Dispatch only declared commands.
7. Stop transport and release resources when disabled or uninstalled.

## Compatibility

Additive optional fields are minor-version compatible. Removing or changing a
command, view, capability, permission, transport behavior, or result meaning is
breaking and requires a new protocol major version. Provider implementation
versions remain independent from the protocol version.

## Appearance and customization

Providers may declare a validated icon, semantic accent token, and preferred
view. They may render a contained `custom-canvas`, but may not inject global
CSS or replace Cockpit trust chrome. Cockpit owns semantic theme tokens,
layouts, density, typography, accessibility, and host mappings. Users may
customize appearance and workspace layout; organizations may provide defaults.
Provider identity, permissions, secret prompts, mutation approval, provenance,
evidence verification, and security errors remain non-customizable in
structure and meaning.

## Security invariants

- Deny unknown providers, commands, capabilities and result states.
- Mutations require explicit manifest declaration and host approval policy.
- Secrets use host secure storage and are injected only into the authorized
  provider process; they never appear in manifests, requests, results or logs.
- Hosts enforce workspace containment and do not trust provider-returned paths.
- Providers emit structured results; hosts do not scrape terminal text.
- Evidence and errors must redact credentials and sensitive values.
- A valid checksum or signature proves integrity, not permission. Every
  operation is still capability-checked and every declared mutation follows
  Cockpit approval policy.

## v1 proof

Marlin is the first full provider. Niji is the independent second-provider
proof. Neither may require Cockpit-side special-casing beyond generic view
renderers or an explicitly declared `custom-canvas`.
