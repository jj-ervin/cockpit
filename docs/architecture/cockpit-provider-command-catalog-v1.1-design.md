# Cockpit Provider Command Catalog v1.1 Design

**Status:** DESIGN / NOT IMPLEMENTED  
**Scope:** Cockpit provider command discovery only  
**Baseline:** `cockpit-provider-command-catalog-v1` + `cockpit-provider-v1`

## 1. Purpose

The v1 catalog establishes a single discovery source for provider command presentation metadata. v1.1 should extend that contract only where a generic command surface needs additional information to construct a safe, intelligible command request.

The goal is **discoverability without authority escalation**.

v1.1 must not turn the catalog into an execution policy, permission grant, or second provider runtime.

## 2. Current v1 boundary

v1 currently exposes provider identity, name, version, description, command ID, title, provider action, mutation classification, confirmation requirement, placements, appearance, and capabilities.

Execution remains:

`GUI intent -> host validation -> provider registry -> provider execution`

The catalog is informational and cannot authorize execution.

## 3. v1.1 design principles

### 3.1 Provider-owned metadata

A provider declares the meaning and presentation requirements of its commands. Cockpit may render and validate that metadata, but must not invent command semantics.

### 3.2 Discovery is not authority

Adding metadata to the catalog must never make a command executable by itself. The host continues to validate provider identity, command identity, input, authorization, approval, and provider integrity at execution time.

### 3.3 Schema before UI

A new catalog field is justified only when a concrete generic consumer needs it. Quick-Bar remains deferred; this design does not implement or reopen Quick-Bar.

### 3.4 No duplicated command declarations

Feature workflows may retain command IDs as routing references. They must not maintain a parallel copy of provider titles, actions, placement metadata, confirmation classification, or other provider-owned presentation metadata.

### 3.5 Safe defaults

Unknown optional metadata must degrade to a non-executable discovery state. Cockpit must never infer an input contract from a missing field.

## 4. Proposed v1.1 command metadata

The proposed v1.1 command object adds **descriptive input metadata**, not executable instructions:

`input`:
- `mode`: `none` | `object`
- `fields`: array of field descriptors

Each field descriptor may contain:
- `name` — provider input key;
- `label` — human-readable label;
- `description` — concise help text;
- `type` — `string` | `number` | `integer` | `boolean` | `enum`;
- `required` — boolean;
- `default` — display/input default only;
- `enum` — allowed symbolic values when `type=enum`;
- `secret` — boolean indicating the value must receive secret-handling treatment.

The contract explicitly excludes executable defaults. A default is input-form data; it is never a command-line fragment, shell expression, script, path expansion, or provider invocation.

## 5. What v1.1 must not add

Do not put executable argv, shell commands, arbitrary code, provider executable paths, authorization decisions, approval tokens, credentials, secrets, filesystem access grants, network grants, provider integrity attestations, generated command lines, or execution results into the catalog.

Those remain in their existing trust/execution boundaries.

## 6. Input semantics

The v1.1 catalog describes **what input a provider command expects**, not how the host executes it.

A generic UI may use the metadata to construct a form. The resulting input is still an untrusted request and must pass the existing host/provider validation path.

For `secret=true` fields, Cockpit must not echo values into ordinary discovery UI and the catalog contains no secret value. Host-side execution remains responsible for credential handling and logging/evidence rules.

For `enum` fields, the UI may present declared choices, but the host/provider validates the submitted value independently.

## 7. Versioning

The existing `cockpit-provider-command-catalog-v1` contract remains frozen.

The proposed contracts are:
- `cockpit-provider-command-catalog-v1.1`
- `cockpit-provider-v1.1`

A v1.1 catalog may only contain metadata sourced from a compatible provider manifest.

Compatibility:
- v1 consumer + v1.1 provider/catalog: host may downgrade to the v1 metadata subset;
- v1.1 consumer + v1 catalog: render the v1 subset and treat input metadata as unavailable;
- unsupported schema versions: fail closed for that catalog message rather than guessing.

No in-place semantic change to a v1 field is permitted.

## 8. Validation requirements

Before implementation is complete, tests must prove:
1. v1 catalogs remain accepted unchanged.
2. v1.1 catalogs validate against dedicated schemas.
3. Unknown optional metadata does not become execution authority.
4. Required input fields are represented correctly.
5. Enum choices are represented correctly.
6. Secret fields are represented without secret values.
7. Executable-looking input metadata is rejected by schema.
8. Malformed input descriptors prevent unsafe generic form generation.
9. Existing command-specific workflows continue through the existing intent path.
10. A generic consumer can distinguish no declared input, declared structured input, and unsupported/invalid input metadata.

## 9. Migration strategy

**Phase A — schema design**
- freeze v1;
- define v1.1 provider and catalog schemas;
- document compatibility/downgrade behavior.

**Phase B — provider fixture**
- extend the Niji fixture with one representative structured-input command;
- include an enum and a required field;
- include a secret-marked field only if a real provider use case exists;
- do not make a command executable merely because it is discoverable.

**Phase C — host propagation**
- copy validated provider metadata into the v1.1 catalog;
- preserve the discovery-only boundary;
- add schema validation tests.

**Phase D — generic consumer proof**
- render a metadata-driven input form in a test-only/discovery surface;
- prove the resulting request still enters existing host validation and approval;
- do not build Quick-Bar.

**Phase E — adoption**
Only after the above is green should individual Cockpit workflows migrate from hardcoded input forms where doing so removes real duplication without reducing workflow-specific safety.

## 10. Open decisions

- Nested objects/arrays: default **no** for v1.1.
- `default`: proposed **yes**, input-form data only.
- Secret fields: **defer until a real provider requires them**.
- Field ordering: array order is presentation order.
- Conditional visibility: **no**; avoid embedding UI logic in the protocol.
- Zero-input commands: explicit `mode=none`.
- Generic execution from the catalog consumer: **no**; execution remains an explicit host-mediated operation.

## 11. Acceptance boundary

The catalog should let Cockpit answer:

> What commands exist, what do they mean to a human, where may they be presented, what safety classification do they carry, and what structured input does a generic UI need to collect?

It must still be unable to answer:

> May this command execute right now?

That remains owned by the host execution and authorization boundary.

## 12. Next implementation slice

**Schema-first:** create the two v1.1 schemas, add compatibility tests, add one structured-input fixture, prove host propagation, then run the full Cockpit test/CI suite.

No Quick-Bar implementation and no unrelated eco work are part of this slice.
