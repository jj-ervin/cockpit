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
from pathlib import Path

from cockpit.provider_registry import ProviderRegistrationError, ProviderRegistry


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


def _version_sort_key(name: str) -> tuple[int, ...] | str:
    parts = name.split(".")
    try:
        return tuple(int(part) for part in parts)
    except ValueError:
        return name  # non-semver directory name: falls back to string order


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
        version_dirs = sorted(
            (v for v in provider_dir.iterdir() if v.is_dir()),
            key=lambda p: _version_sort_key(p.name),
        )
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
