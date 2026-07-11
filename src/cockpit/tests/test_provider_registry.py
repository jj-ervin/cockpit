"""Security and discovery tests for the generic provider registry."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest

from cockpit.provider_registry import ProviderRegistrationError, ProviderRegistry


ROOT = Path(__file__).resolve().parents[3]


def write_registration(tmp_path: Path) -> tuple[Path, Path, Path]:
    manifest_source = ROOT / "examples" / "providers" / "niji.provider.json"
    manifest = tmp_path / "niji.provider.json"
    manifest.write_bytes(manifest_source.read_bytes())
    executable = tmp_path / "niji-provider.exe"
    executable.write_bytes(b"test executable identity")
    attestation = tmp_path / "niji.attestation.json"
    attestation.write_text(json.dumps({
        "schema_version": "cockpit-provider-attestation-v1",
        "provider_id": "niji",
        "provider_version": "1.0.0",
        "manifest_digest": "sha256:" + hashlib.sha256(manifest.read_bytes()).hexdigest(),
        "package_digest": None,
        "executable": str(executable.resolve()),
        "args": ["provider", "--stdio"],
        "installed_at": "2026-07-11T00:00:00Z",
        "installed_by": "marlin",
        "signature": None,
    }), encoding="utf-8")
    return manifest, attestation, executable


def test_registers_attested_provider_and_resolves_declared_command(tmp_path: Path) -> None:
    manifest, attestation, executable = write_registration(tmp_path)
    registry = ProviderRegistry(ROOT / "schemas")
    provider = registry.register(manifest, attestation)
    assert provider.executable == executable.resolve()
    assert provider.command("niji.palette.preview")["mutation"] is False
    assert registry.get("niji") is provider


def test_rejects_manifest_changed_after_attestation(tmp_path: Path) -> None:
    manifest, attestation, _ = write_registration(tmp_path)
    data = json.loads(manifest.read_text(encoding="utf-8"))
    data["name"] = "Tampered Niji"
    manifest.write_text(json.dumps(data), encoding="utf-8")
    with pytest.raises(ProviderRegistrationError, match="digest"):
        ProviderRegistry(ROOT / "schemas").register(manifest, attestation)


def test_rejects_missing_or_relative_executable(tmp_path: Path) -> None:
    manifest, attestation, _ = write_registration(tmp_path)
    data = json.loads(attestation.read_text(encoding="utf-8"))
    data["executable"] = "niji-provider.exe"
    attestation.write_text(json.dumps(data), encoding="utf-8")
    with pytest.raises(ProviderRegistrationError, match="existing absolute"):
        ProviderRegistry(ROOT / "schemas").register(manifest, attestation)


def test_unknown_provider_and_command_fail_closed(tmp_path: Path) -> None:
    manifest, attestation, _ = write_registration(tmp_path)
    registry = ProviderRegistry(ROOT / "schemas")
    provider = registry.register(manifest, attestation)
    with pytest.raises(ProviderRegistrationError, match="unknown or untrusted"):
        registry.get("marlin")
    with pytest.raises(ProviderRegistrationError, match="does not declare"):
        provider.command("niji.delete.everything")
