# Cockpit App Shell distribution v1 — proposed contract

**Status:** Proposed / not a release authorization
**Consumer:** Governance Commons Portal (`governancecommons/governance-commons-portal`)
**Owner:** Cockpit (`jj-ervin/cockpit`)

## Source and exports

The canonical current source is `web/appShell.js`. It is UMD:
- CommonJS: `require('./appShell.js')` returns `createAppShell(documentRef)`, a factory.
- Browser: loading the script initializes `window.AppShell` to an **instance** using `window.document`.

The exposed shell primitives include `createApplicationDefinition`, `createPanel`, `createStatusBadge`, and `setActiveTab`. GC Portal's adapter supports the browser instance and an explicitly injected factory. The shell is presentation only; it does not authorize actions or run models.

## Proposed artifact

Produce a **versioned, immutable** browser artifact from the exact reviewed `web/appShell.js` commit. An approved release must record:
1. repository and source commit SHA;
2. release version and artifact name;
3. SHA-256 digest for the published bytes;
4. build/release workflow provenance and review approvals;
5. license/redistribution permission and attribution obligations;
6. CSP-compatible delivery plan, rollback procedure, and compatibility tests.

Do **not** treat this specification as a license grant. No redistribution, CDN injection, npm publication, or Portal bundling is authorized by this document alone. Cockpit's repository owner must approve the distribution/license decision separately.

## Consumer contract

- Browser loads the reviewed artifact through an approved, pinned build.
- Consumer checks shell shape; malformed/unknown versions fail closed to UI-only fallback.
- Host/workspace identity and permissions are resolved by a trusted server, not shell or browser state.
- Shell approval dialogs are presentation only. The backend verifies bound, expiring, single-use authorization artifacts for mutations.
- No secrets, vault access, or provider credentials cross into the shell.
- Independent browser and security tests are required before deployment.

## Compatibility and versioning

Treat changes to public factory/instance shape, method names, or semantic behavior as contract-affecting. Add a contract test before publication. The first released artifact must be pinned by the consumer; `main`, mutable tags, and unverified remote scripts are not valid release identifiers.

## Acceptance gate

This proposal becomes a release contract only after owner review of licensing, packaging, integrity/provenance, consumer compatibility, and CI. The present PR adds no publication workflow and makes no production-readiness claim.
