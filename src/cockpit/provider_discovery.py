"""Discovers Marlin-installed cockpit-provider-v1 providers on disk.

Cockpit does not import Marlin or require it as a Python dependency — it only
knows Marlin's public, documented install-layout contract: one
manifest.json + attestation.json pair per <provider_id>/<version>/ directory
under Marlin's home. Home resolution mirrors
marlin/packages/marlin/src/platform.ts so Cockpit finds the same providers
Marlin installed, without a source or package dependency on it.
"""

from __future__ import annotations

import os
import platform
import re
from pathlib import Path

from cockpit.provider_registry import ProviderRegistrationError, ProviderRegistry

#: Mirrors the manifest schema's own version pattern
#: (schemas/cockpit-provider-v1.schema.json's `version` property), so a
#: directory name is only ever treated as a version if a real provider
#: manifest could declare it.
_SEMVER_RE = re.compile(
    r"^(?P<major>\d+)\.(?P<minor>\d+)\.(?P<patch>\d+)"
    r"(?:-(?P<prerelease>[0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$"
)


def default_marlin_home() -> Path:
    """``COCKPIT_MARLIN_HOME`` overrides; otherwise mirrors Marlin's own
    per-platform home resolution."""
    override = os.environ.get("COCKPIT_MARLIN_HOME")
    if override:
        return Path(override)
    system = platform.system()
    if system == "Windows":
        base = os.environ.get("APPDATA") or str(Path.home() / "AppData" / "Roaming")
        return Path(base) / "marlin"
    if system == "Darwin":
        return Path.home() / "Library" / "Application Support" / "marlin"
    base = os.environ.get("XDG_DATA_HOME") or str(Path.home() / ".local" / "share")
    return Path(base) / "marlin"


def _version_sort_key(name: str) -> tuple[int, int, int, int, tuple[str, ...]] | None:
    """A totally-ordered SemVer precedence key, or ``None`` if ``name``
    isn't a valid version per the manifest schema's own pattern.

    Real bug this replaced: the previous implementation returned a tuple
    of ints for an ordinary version but fell back to the bare *string* for
    anything int()-incompatible — including schema-valid prereleases like
    "1.2.0-beta.1" (`"0-beta"` isn't an int). Sorting a directory listing
    containing both shapes crashed with `TypeError: '<' not supported
    between instances of 'str' and 'tuple'`. This always returns the same
    shape (or None, filtered out by the caller before sorting — never
    compared against a tuple).

    Precedence follows SemVer: a release outranks a prerelease of the same
    major.minor.patch; build metadata is ignored for ordering, matching the
    SemVer spec. Prerelease identifiers are compared as plain strings
    (not SemVer's full numeric-aware identifier comparison) — sufficient to
    pick a reasonable newest-installed version without crashing; exact
    prerelease-vs-prerelease ranking is not a real requirement here.
    """
    match = _SEMVER_RE.match(name)
    if not match:
        return None
    major, minor, patch = int(match["major"]), int(match["minor"]), int(match["patch"])
    prerelease = match["prerelease"]
    if prerelease is None:
        return (major, minor, patch, 1, ())
    return (major, minor, patch, 0, tuple(prerelease.split(".")))


def discover_providers(
    marlin_home: Path | None = None,
    schema_root: Path | None = None,
) -> tuple[ProviderRegistry, dict[str, str]]:
    """Scans ``<marlin_home>/providers/<id>/<version>/`` for attested
    providers and registers the newest version directory found per provider
    ID. Returns the populated registry plus a ``{version_dir: error}`` map
    for any registration that failed validation — one broken provider
    install does not take down discovery for the others.
    """
    home = marlin_home if marlin_home is not None else default_marlin_home()
    registry = ProviderRegistry(schema_root) if schema_root is not None else ProviderRegistry()
    errors: dict[str, str] = {}

    providers_root = home / "providers"
    if not providers_root.is_dir():
        return registry, errors

    for provider_dir in sorted(p for p in providers_root.iterdir() if p.is_dir()):
        keyed = [
            (key, v) for v in provider_dir.iterdir() if v.is_dir() and (key := _version_sort_key(v.name)) is not None
        ]
        version_dirs = [v for _key, v in sorted(keyed, key=lambda pair: pair[0])]
        for version_dir in reversed(version_dirs):
            manifest_path = version_dir / "manifest.json"
            attestation_path = version_dir / "attestation.json"
            if not manifest_path.is_file() or not attestation_path.is_file():
                continue
            try:
                registry.register(manifest_path, attestation_path)
            except ProviderRegistrationError as exc:
                errors[str(version_dir)] = str(exc)
            break  # only the newest usable version directory per provider

    return registry, errors
