# Cockpit App Shell candidate verification

After building a release candidate from a reviewed source checkout, run:

```sh
node web/scripts/prepare-app-shell-release.js 0.1.0-rc.1
node web/scripts/verify-app-shell-release.js 0.1.0-rc.1
```

The verifier checks the versioned artifact name, repository/source identity, recorded source commit shape, SHA-256 digest, exact equality with the canonical source file, and explicitly unapproved distribution status. It performs no network or publication actions.

**Limits:** This verifies the candidate relative to the local checkout. It does not independently attest the recorded commit, validate a clean Git tree, sign provenance, establish licensing, or prove real-browser compatibility. An independently reproducible CI build and maintainer-approved license decision are still required before publication or GC Portal consumption.

The Portal must not ship this candidate simply because the verifier passes.
