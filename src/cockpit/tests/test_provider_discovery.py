"""Tests for scanning a Marlin home directory for installed providers."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from cockpit.provider_discovery import discover_providers
from cockpit.provider_registry import ProviderRegistry


ROOT = Path(__file__).resolve().parents[3]


def _install_fixture(
    marlin_home: Path,
    provider_id: str,
    version: str,
    *,
    manifest_overrides: dict | None = None,
) -> Path:
    version_dir = marlin_home / "providers" / provider_id / version
    version_dir.mkdir(parents=True)

    manifest_source = ROOT / "examples" / "providers" / "niji.provider.json"
    manifest = json.loads(manifest_source.read_text(encoding="utf-8"))
    manifest["id"] = provider_id
    manifest["version"] = version
    if manifest_overrides:
        manifest.update(manifest_overrides)
    manifest_path = version_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    executable = version_dir / f"{provider_id}-provider.exe"
    executable.write_bytes(b"fixture executable")

    attestation_path = version_dir / "attestation.json"
    attestation_path.write_text(json.dumps({
        "schema_version": "cockpit-provider-attestation-v1",
        "provider_id": provider_id,
        "provider_version": version,
        "manifest_digest": "sha256:" + hashlib.sha256(manifest_path.read_bytes()).hexdigest(),
        "package_digest": None,
        "executable": str(executable.resolve()),
        "args": [],
        "installed_at": "2026-08-05T00:00:00Z",
        "installed_by": "marlin",
        "signature": None,
    }), encoding="utf-8")
    return version_dir


def test_returns_empty_registry_when_marlin_home_has_no_providers_dir(tmp_path: Path) -> None:
    registry, errors = discover_providers(tmp_path, ROOT / "schemas")
    assert isinstance(registry, ProviderRegistry)
    assert registry.list() == ()
    assert errors == {}


def test_discovers_and_registers_an_installed_provider(tmp_path: Path) -> None:
    _install_fixture(tmp_path, "niji", "1.1.1")
    registry, errors = discover_providers(tmp_path, ROOT / "schemas")
    assert errors == {}
    provider = registry.get("niji")
    assert provider.manifest["version"] == "1.1.1"


def test_picks_the_newest_version_directory_per_provider(tmp_path: Path) -> None:
    _install_fixture(tmp_path, "niji", "1.0.0")
    _install_fixture(tmp_path, "niji", "1.1.1")
    _install_fixture(tmp_path, "niji", "1.9.0")
    registry, errors = discover_providers(tmp_path, ROOT / "schemas")
    assert errors == {}
    assert registry.get("niji").manifest["version"] == "1.9.0"


def test_broken_provider_install_is_reported_not_fatal(tmp_path: Path) -> None:
    version_dir = _install_fixture(tmp_path, "niji", "1.1.1")
    (version_dir / "manifest.json").write_text('{"not": "a valid manifest"}', encoding="utf-8")
    _install_fixture(tmp_path, "other", "2.0.0")

    registry, errors = discover_providers(tmp_path, ROOT / "schemas")
    assert len(errors) == 1
    assert "niji" in next(iter(errors))
    assert registry.get("other").manifest["version"] == "2.0.0"
