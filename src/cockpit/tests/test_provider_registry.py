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
        "executable_digest": "sha256:" + hashlib.sha256(executable.read_bytes()).hexdigest(),
        "executable_digest_target": str(executable.resolve()),
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


def test_schema_invalid_manifest_raises_registration_error_not_jsonschema_error(
    tmp_path: Path,
) -> None:
    manifest, attestation, _ = write_registration(tmp_path)
    manifest.write_text('{"not": "a valid provider manifest"}', encoding="utf-8")
    with pytest.raises(ProviderRegistrationError, match="schema validation failed"):
        ProviderRegistry(ROOT / "schemas").register(manifest, attestation)


def test_rejects_manifest_changed_after_attestation(tmp_path: Path) -> None:
    manifest, attestation, _ = write_registration(tmp_path)
    data = json.loads(manifest.read_text(encoding="utf-8"))
    data["name"] = "Tampered Niji"
    manifest.write_text(json.dumps(data), encoding="utf-8")
    with pytest.raises(ProviderRegistrationError, match="digest"):
        ProviderRegistry(ROOT / "schemas").register(manifest, attestation)


def test_rejects_executable_tampered_after_attestation(tmp_path: Path) -> None:
    """`package_digest` (see provider_registry.py's comment on it) is the install
    archive's digest, not the extracted executable's, so it can't catch this.
    `executable_digest` closes that gap: registration must detect the
    executable being swapped after Marlin installed it."""
    manifest, attestation, executable = write_registration(tmp_path)
    executable.write_bytes(b"tampered executable bytes")
    with pytest.raises(ProviderRegistrationError, match="does not match its attested digest"):
        ProviderRegistry(ROOT / "schemas").register(manifest, attestation)


def test_rejects_legacy_attestation_missing_executable_digest(tmp_path: Path) -> None:
    manifest, attestation, _ = write_registration(tmp_path)
    data = json.loads(attestation.read_text(encoding="utf-8"))
    del data["executable_digest"]
    attestation.write_text(json.dumps(data), encoding="utf-8")
    with pytest.raises(ProviderRegistrationError, match="Reinstall the provider"):
        ProviderRegistry(ROOT / "schemas").register(manifest, attestation)


def test_rejects_null_executable_digest(tmp_path: Path) -> None:
    manifest, attestation, _ = write_registration(tmp_path)
    data = json.loads(attestation.read_text(encoding="utf-8"))
    data["executable_digest"] = None
    attestation.write_text(json.dumps(data), encoding="utf-8")
    with pytest.raises(ProviderRegistrationError, match="Reinstall the provider"):
        ProviderRegistry(ROOT / "schemas").register(manifest, attestation)


def test_verifies_explicit_target_for_interpreter_plus_script_command(tmp_path: Path) -> None:
    """Mirrors marlin-dxp's self-registration shape: `executable` is a generic
    interpreter, `args` has a real script *plus* an unrelated trailing flag —
    proving the target comes from the attestation's explicit
    `executable_digest_target`, never guessed as `args[-1]` (which would
    resolve to the flag string here, not a file at all)."""
    manifest, attestation, _ = write_registration(tmp_path)
    script = tmp_path / "provider.js"
    script.write_bytes(b"console.log('provider')")
    data = json.loads(attestation.read_text(encoding="utf-8"))
    data["args"] = [str(script.resolve()), "--stdio"]
    data["executable_digest"] = "sha256:" + hashlib.sha256(script.read_bytes()).hexdigest()
    data["executable_digest_target"] = str(script.resolve())
    attestation.write_text(json.dumps(data), encoding="utf-8")
    provider = ProviderRegistry(ROOT / "schemas").register(manifest, attestation)
    assert provider.provider_id == "niji"

    script.write_bytes(b"console.log('tampered')")
    with pytest.raises(ProviderRegistrationError, match="does not match its attested digest"):
        ProviderRegistry(ROOT / "schemas").register(manifest, attestation)


def test_rejects_digest_target_not_part_of_the_spawned_command(tmp_path: Path) -> None:
    """An attestation cannot claim to have verified some unrelated file while
    the actually-spawned executable/args go unchecked — the target must be
    `executable` itself or a literal entry in `args`."""
    manifest, attestation, _ = write_registration(tmp_path)
    decoy = tmp_path / "decoy.txt"
    decoy.write_bytes(b"unrelated file")
    data = json.loads(attestation.read_text(encoding="utf-8"))
    data["executable_digest_target"] = str(decoy.resolve())
    data["executable_digest"] = "sha256:" + hashlib.sha256(decoy.read_bytes()).hexdigest()
    attestation.write_text(json.dumps(data), encoding="utf-8")
    with pytest.raises(ProviderRegistrationError, match="not `executable` or a declared entry"):
        ProviderRegistry(ROOT / "schemas").register(manifest, attestation)


def test_rejects_nonexistent_digest_target_without_crashing(tmp_path: Path) -> None:
    """A missing/invalid integrity target must fail as an ordinary
    ProviderRegistrationError, not an uncaught FileNotFoundError from
    Path.resolve(strict=True) — discover_providers only catches
    ProviderRegistrationError, so anything else would crash discovery for
    every other provider too, not just this broken one. `executable` itself
    stays valid here so the failure is isolated to the target's own
    resolve/read, not the earlier `executable.is_file()` check."""
    manifest, attestation, _ = write_registration(tmp_path)
    missing_script = tmp_path / "provider.js"  # declared, never created
    data = json.loads(attestation.read_text(encoding="utf-8"))
    data["args"] = [str(missing_script)]
    data["executable_digest_target"] = str(missing_script)
    attestation.write_text(json.dumps(data), encoding="utf-8")
    with pytest.raises(ProviderRegistrationError, match="could not be read"):
        ProviderRegistry(ROOT / "schemas").register(manifest, attestation)


def test_rejects_digest_target_missing_when_digest_present(tmp_path: Path) -> None:
    manifest, attestation, _ = write_registration(tmp_path)
    data = json.loads(attestation.read_text(encoding="utf-8"))
    del data["executable_digest_target"]
    attestation.write_text(json.dumps(data), encoding="utf-8")
    with pytest.raises(ProviderRegistrationError, match="Reinstall the provider"):
        ProviderRegistry(ROOT / "schemas").register(manifest, attestation)


def test_verify_integrity_rejects_executable_swapped_after_registration(tmp_path: Path) -> None:
    """The core TOCTOU fix: registration alone only proves the file was
    intact *at registration time*. A caller (host_bridge, before every
    spawn) must call verify_integrity() again immediately before use."""
    manifest, attestation, executable = write_registration(tmp_path)
    provider = ProviderRegistry(ROOT / "schemas").register(manifest, attestation)
    provider.verify_integrity()  # intact right after registration

    executable.write_bytes(b"swapped after registration, before first use")
    with pytest.raises(ProviderRegistrationError, match="modified after registration"):
        provider.verify_integrity()


def test_verify_integrity_rejects_executable_deleted_after_registration(tmp_path: Path) -> None:
    manifest, attestation, executable = write_registration(tmp_path)
    provider = ProviderRegistry(ROOT / "schemas").register(manifest, attestation)
    executable.unlink()
    with pytest.raises(ProviderRegistrationError, match="no longer readable"):
        provider.verify_integrity()


def test_documents_narrowed_threat_model_unauthenticated_digest(tmp_path: Path) -> None:
    """Honest limitation, not a bug: `signature` is always null (see
    installer.ts/selfProvider.ts), so this digest authenticates the
    executable against attestation.json's own claim, not against Marlin as
    an issuer. Anyone able to overwrite the executable can equally overwrite
    attestation.json with a matching digest for the new bytes — registration
    (correctly) does not detect that combined swap. This test records that
    known, narrowed scope rather than letting it silently pass as "secure"."""
    manifest, attestation, executable = write_registration(tmp_path)
    tampered = b"attacker-controlled replacement binary"
    executable.write_bytes(tampered)
    data = json.loads(attestation.read_text(encoding="utf-8"))
    data["executable_digest"] = "sha256:" + hashlib.sha256(tampered).hexdigest()
    data["package_digest"] = "sha256:" + hashlib.sha256(tampered).hexdigest()
    attestation.write_text(json.dumps(data), encoding="utf-8")
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
