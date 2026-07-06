# CKP.12.00 Phase 4 Multi-Tenant Hosting Design

Status: design pass (planning only, no implementation)
Updated: 2026-07-06

## Scope

`DEV-PATH.md` Phase 16 named a genuinely public, multi-tenant hosted Cockpit
(strangers sharing one deployment, no shared trust between them) **Phase 4** —
the third of `CKP.03`'s original packaging forms, now a fourth — and
deliberately deferred it as "a distinct, deliberately deferred, much larger,
security-critical project (auth, per-tenant workspace isolation, subprocess
sandboxing, abuse/resource limits) — planned-not-started."

This document is that planning pass. It designs the architecture; it does
not implement it. A portfolio-wide search turned up no existing precedent
anywhere in `c:\dev` for authentication, multi-tenancy, or subprocess
sandboxing — this is a from-scratch design, not an extension of an existing
pattern. The one directly reusable precedent is the stdin-not-argv
command-injection fix already established in `host-web/marlinCli.js` and
`lasso/src/adapters/spawnAgent.js`.

## Non-Goals

- No changes to `web/cockpit.{html,css,js}` or the `eco.cockpit.*` message
  contract. Phase 4 must work against the bundle exactly as Phase 1-3 hosts
  already do, per `CKP.08-host-loader-contract.md`.
- No changes to `host-web/`'s internal request-handling logic. Phase 4 wraps
  unmodified Phase 3 server instances rather than rewriting them.
- Not a general-purpose container-orchestration platform. Assume Docker (or
  an equivalent container runtime) as the isolation primitive; do not design
  around Kubernetes-scale orchestration unless a dedicated ops pass decides
  that's warranted.
- Production hosting provider, secrets management, billing/quota enforcement
  mechanics, and TLS/domain routing are explicitly out of scope for this doc
  — flagged as a dedicated ops-focused follow-up.

## Current State (Phase 3 baseline this design must change)

Confirmed by reading `host-web/index.js`, `server.js`, `bridgeClient.js`,
`actions.js`, `pathContainment.js`, and `src/cockpit/core/adapter.py` /
`adapters/eco.py`:

- `workspaceRoot`/`pythonExecutable` are resolved once at process start
  (`index.js`) and closed over by every request `createApp()` handles
  (`server.js:66-86`) — there is no per-caller identity anywhere in the
  request path, so nothing distinguishes one caller from another.
- The Python side is fully stateless per call: `host_bridge.py` builds a
  fresh adapter instance from the request's `workspace_id`/`node_id` and
  discards it after one operation. This is good news for Phase 4 — the
  Python layer needs no changes, only the Node host's identity/tenancy model
  does.
- `pathContainment.js`'s `resolveContainedPath` and
  `EcoAdapter._resolve_contained_path` both stop a request-supplied *leaf*
  path from escaping a root that is already trusted. Neither validates the
  root itself, and neither follows symlinks/junctions — both are lexical
  (`path.resolve`/`path.relative`, `Path.resolve`), not filesystem-aware.
- As of the Deliverable-0 fix in this same PASS, `host-web` now binds to
  `127.0.0.1` by default (`COCKPIT_HOST` env override), closing the
  all-interfaces-by-default gap found during this design review. That fix
  is scoped to Phase 3 and doesn't by itself address multi-tenancy — it just
  means Phase 3 fails safe until Phase 4 exists.

## Architecture

**A thin control plane in front of unmodified, one-per-tenant Phase 3
`host-web` instances running in containers.** This directly reuses the
design principle Phase 16 already recorded: "a future Phase 4 control plane
could run one Phase 3 server instance per tenant/container." It avoids
rewriting `host-web` itself — auth, isolation, sandboxing, and abuse limits
all live in the new control-plane component only.

Repo boundary: colocated in `cockpit` as a new `host-cloud/` directory,
sibling to `host-web/` — the same call `host-web/` itself made over a
separate repo. Revisit only if the control plane grows its own independent
release/ops lifecycle.

### Control plane responsibilities

- **Auth verification** at the edge (see Auth Model below).
- **Tenant registry**: tenant id, identity, workspace path, container/session
  state, quota, created/last-active timestamps.
- **Per-tenant container lifecycle**: spawn on first authenticated request,
  idle-timeout teardown, crash restart.
- **Routing**: reverse-proxy an authenticated request to the correct
  tenant's container.
- **Rate limiting / concurrency caps** at the edge, before a request ever
  reaches a tenant container.
- **Audit log** of auth events and proxied requests.

### Per-tenant container

- Runs **unmodified** `host-web/server.js` + the Python `cockpit` package —
  no Phase-3 code changes.
- One bind-mounted, tenant-scoped workspace volume — not a shared
  filesystem root. This is the real isolation boundary, since
  `pathContainment.js`/`_resolve_contained_path` only ever assumed the root
  itself was already trustworthy.
- Non-root user inside the container.
- Container-level resource limits: cpu, memory, pids.
- No network egress beyond what Marlin/Niji provider calls actually require.
- Ephemeral: torn down after an idle timeout; the workspace volume persists
  independently of the container's lifecycle.

## Auth Model — Open Decision

Two options, deliberately left undecided in this design pass:

| Option | Pro | Con |
| --- | --- | --- |
| GitHub OAuth | No credential storage to leak; fits a dev-tooling audience; delegates identity entirely | External dependency on GitHub's availability/API |
| Email + magic link | No third-party dependency; works for non-GitHub users | You own email delivery and token issuance/expiry |

**Recommendation:** GitHub OAuth, given the audience is developers who
already have GitHub accounts and it avoids owning credential storage
entirely. **Not locked in** — a dedicated decision should close this before
any implementation PASS starts, since it changes what the tenant registry's
identity column looks like and what the session token issuance flow is.

## Session Handling

A signed, stateless token maps to `tenant_id`, verified at the control-plane
edge before any request is proxied. Critically: **`workspaceRoot` for a
proxied `host-web` instance is derived only from the authenticated tenant,
never from client-supplied input.** This is the direct fix for the Phase 3
gap identified above — no request field, header, or body value may ever
select or override which workspace a request is served from. A request
carries an opaque, server-issued identity; it never carries a workspace path
or id that the server trusts at face value.

## Subprocess Sandboxing

The container boundary is the primary sandbox — not merely today's
per-request Python subprocess spawn, which was designed for a single trusted
local user, not adversarial multi-tenant input. Any CLI invocation running
inside a tenant container must still follow the existing stdin-not-argv
precedent (`host-web/marlinCli.js`, `lasso/src/adapters/spawnAgent.js`) as
defense in depth — the container boundary and the stdin-not-argv discipline
are complementary, neither replaces the other.

**Config invariant carried forward:** `bridgeClient.js:30-31` uses
`shell: true` on Windows for `.cmd`/`.bat` compatibility, which is safe only
because `pythonExecutable` is fixed control-plane/process config today, never
attacker-influenced input. Phase 4 must not regress this: `pythonExecutable`
(and any future per-container interpreter/binary path) must remain
control-plane-owned configuration, never request- or tenant-supplied, in any
implementation.

## Path Containment Carryover

`pathContainment.js` and `EcoAdapter._resolve_contained_path` remain useful
as defense-in-depth inside each container, but the container filesystem
boundary (a bind-mounted, tenant-scoped volume) becomes the real tenant
isolation boundary — neither helper today validates the root itself, only a
requested leaf path against an already-trusted root.

Both helpers are also lexical-only: `path.resolve`/`path.relative` in Node,
`Path.resolve` in Python. Neither follows symlinks or junctions. A symlink
placed inside a tenant's workspace pointing outside it would pass today's
check (the computed path string looks contained) while the actual filesystem
access escapes. **Any Phase 4 implementation PASS must resolve through
`fs.realpath` (Node) / `Path.resolve(strict=True)` (Python) before the
containment comparison**, not just normalize `..` segments as the current
helpers do.

## Capability Boundaries, Not Just Tenancy Boundaries

Read-only provider panels (dashboard, Marlin/Niji status, workspace
explorer) and mutating actions (submit run, approve escalation, save policy,
delete/restore artifact, set HELM mode, OS open/reveal) are different risk
classes. The design should scope session tokens/capabilities per action
class, not just per tenant, so that a compromised or narrowly-scoped
integration limited to read-only panels cannot reach mutating actions. This
is a refinement to design into the auth/session model above, not a separate
system — e.g. a session token's claims should include which action classes
it is permitted to invoke, checked at the control-plane edge before
proxying.

## Abuse / Resource Limits

- Per-tenant rate limit and concurrency cap, enforced at the control plane
  before a request reaches a tenant container.
- Container-level cpu/memory/pids/disk-quota limits.
- Idle-timeout container teardown.
- Global cap on concurrently running tenant containers.
- Request body size limits.
- Subprocess timeouts (the existing `DEFAULT_TIMEOUT_MS` pattern in
  `bridgeClient.js` generalizes directly — no new mechanism needed, just
  applied per-tenant-container rather than assumed single-user).

## Recommended Next Bounded PASS

Do not attempt Phase 4 as one unbounded PASS. The smallest next slice, once
this design is reviewed, is: **auth model decision + tenant-registry
skeleton** (closing the GitHub-OAuth-vs-magic-link decision above, then
building the minimal tenant registry data model and session issuance flow,
with no container orchestration yet).

That PASS's test plan should include the concrete cases surfaced during this
design's review:

- Two distinct `workspaceRoot` values exercised within one control-plane
  process, proving no cross-tenant state leaks.
- A loopback-only default assertion, mirroring the `resolveHost` test added
  in this PASS's Deliverable 0 (`host-web/tests/index.test.js`).
- Symlink/junction containment escape attempts against the strengthened
  `fs.realpath`/`Path.resolve(strict=True)` containment check.
- An explicit "a request cannot override workspaceRoot/tenant" regression
  test — the core invariant this whole design protects.

## Related

- `CKP.03` (`docs/specifications/CKP.05-packaging-checklist.md` and
  `DEV-PATH.md`'s Phase 0-3 history) — the three-phase rule this design
  must not violate: the Python package is host-agnostic; VS Code, standalone
  web, and any future host are adapters on top of it, not separate APIs.
- `CKP.08-host-loader-contract.md` — the host-agnostic bundle contract every
  host, including a future Phase 4 control plane, must satisfy unmodified.
- `CKP.11.00` — Phase 3's standalone web host, the unmodified unit this
  design proposes running one-per-tenant.
