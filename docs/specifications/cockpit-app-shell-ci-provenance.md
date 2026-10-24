# Cockpit App Shell — CI release-candidate verification

The `App Shell Release Candidate` workflow runs on relevant pull requests and by manual dispatch. It checks out source, runs contract tests, prepares the `0.1.0-rc.1` candidate, verifies exact byte equality and SHA-256, prints the digest and source commit, and retains a short-lived inspection artifact.

**This is not a published or licensed distribution.** Workflow artifacts are for maintainer inspection only. The workflow has read-only repository permissions and no package registry or release publishing step.

## Evidence and limitations

- CI will independently execute the builder and verifier on a GitHub runner, subject to GitHub Actions configuration.
- This is not cryptographic signing or SLSA provenance, and the source checkout SHA alone does not prove a clean release process.
- GitHub Actions actions currently use major version tags; pinning to reviewed immutable action commit SHAs is a separate supply-chain hardening gate.
- A maintainer must review licensing/redistribution rights before GC Portal includes any generated artifact.
- A genuine browser integration test with the exact approved artifact remains outstanding.

Do not mark the release as authorized based solely on a green workflow.
