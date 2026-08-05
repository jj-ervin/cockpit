"""Security and discovery tests for the generic provider registry."""

from __future__ import annotations

import hashlib
import json
import os
import subprocess
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
        "provider_version": "1.1.1",
        "manifest_digest": "sha256:" + hashlib.sha256(manifest.read_bytes()).hexdigest(),
        "package_digest": "sha256:" + hashlib.sha256(executable.read_bytes()).hexdigest(),
        "executable": str(executable.resolve()),
        "args": [],
        "installed_at": "2026-08-05T00:00:00Z",
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


def test_package_digest_is_not_verified_against_executable_bytes(tmp_path: Path) -> None:
    """Documents a real, known gap, found via a real Marlin-installed attestation
    (see provider_registry.py's comment on `package_digest`): it is the install
    archive's digest, not the extracted executable's. Registration does not —
    and currently cannot — detect the executable being swapped after install."""
    manifest, attestation, executable = write_registration(tmp_path)
    executable.write_bytes(b"tampered executable bytes")
    provider = ProviderRegistry(ROOT / "schemas").register(manifest, attestation)
    assert provider.provider_id == "niji"


def test_accepts_null_package_digest_for_legacy_attestations(tmp_path: Path) -> None:
    manifest, attestation, _ = write_registration(tmp_path)
    data = json.loads(attestation.read_text(encoding="utf-8"))
    data["package_digest"] = None
    attestation.write_text(json.dumps(data), encoding="utf-8")
    registry = ProviderRegistry(ROOT / "schemas")
    assert registry.register(manifest, attestation).provider_id == "niji"


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


@pytest.mark.skipif(
    not os.environ.get("COCKPIT_REAL_PROVIDER_SMOKE_MARLIN_CLI"),
    reason="opt-in: set COCKPIT_REAL_PROVIDER_SMOKE_MARLIN_CLI to a marlin CLI "
    "entrypoint (e.g. .../marlin/apps/cli/dist/index.js) and authenticate `gh` "
    "for the private niji release, to exercise a real isolated Marlin install "
    "and a real cockpit-provider-v1 stdio round trip against the published package",
)
def test_real_marlin_installed_provider_stdio_roundtrip(tmp_path: Path) -> None:
    """Installs niji through the real, unmodified Marlin CLI into an isolated
    home directory (no C:\\dev, no eco, no sibling checkout on the resolved
    install path), registers the resulting Marlin attestation through
    ProviderRegistry exactly as a host would, and sends one real
    cockpit-operation-request-v1 to the installed niji-provider.exe over stdio.
    Proves stranger-install, attestation/digest agreement, and a real spawn —
    not a fixture standing in for any of the three.
    """
    marlin_cli = os.environ["COCKPIT_REAL_PROVIDER_SMOKE_MARLIN_CLI"]
    home = tmp_path / "isolated-home" / "AppData" / "Roaming"
    home.mkdir(parents=True)
    env = dict(os.environ)
    env["APPDATA"] = str(home)
    token = env.get("GH_TOKEN") or env.get("GITHUB_TOKEN")
    if not token:
        token = subprocess.run(
            ["gh", "auth", "token"], capture_output=True, text=True, check=True
        ).stdout.strip()
    env["GH_TOKEN"] = token

    result = subprocess.run(
        ["node", marlin_cli, "install", "niji", "--trust", "--json"],
        cwd=tmp_path,
        env=env,
        capture_output=True,
        text=True,
        timeout=180,
    )
    assert result.returncode == 0, result.stderr
    install = json.loads(result.stdout.strip().splitlines()[-1])
    assert install["ok"] is True
    provider_info = install["install"]["provider"]

    registry = ProviderRegistry(ROOT / "schemas")
    provider = registry.register(
        Path(provider_info["manifestPath"]), Path(provider_info["attestationPath"])
    )
    assert provider.manifest["version"] == install["package"]["version"]
    assert provider.executable == Path(provider_info["executable"]).resolve()

    request = {
        "schema_version": "cockpit-operation-request-v1",
        "operation_id": "ckp1701-real-smoke",
        "provider_id": "niji",
        "command_id": "niji.palette.preview",
        "input": {
            "base_hex": "#3366CC",
            "scheme_key": "complementary",
            "naming_mode": "natural",
            "swatch_count": 5,
        },
    }
    proc = subprocess.run(
        [str(provider.executable), *provider.args],
        input=json.dumps(request),
        capture_output=True,
        text=True,
        timeout=30,
    )
    response = json.loads(proc.stdout)
    assert response["status"] == "succeeded", proc.stderr
    assert response["data"]["palette"]["scheme"] == "complementary"
