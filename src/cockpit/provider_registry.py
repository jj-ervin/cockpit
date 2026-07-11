"""Zero-trust discovery registry for cockpit-provider-v1 providers."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator


REPO_ROOT = Path(__file__).resolve().parents[2]
SCHEMA_ROOT = REPO_ROOT / "schemas"


class ProviderRegistrationError(ValueError):
    """A provider failed schema, integrity, or executable verification."""


@dataclass(frozen=True)
class RegisteredProvider:
    manifest: dict[str, Any]
    attestation: dict[str, Any]
    executable: Path
    args: tuple[str, ...]

    @property
    def provider_id(self) -> str:
        return str(self.manifest["id"])

    def command(self, command_id: str) -> dict[str, Any]:
        for command in self.manifest["commands"]:
            if command["id"] == command_id:
                return command
        raise ProviderRegistrationError(
            f"provider '{self.provider_id}' does not declare command '{command_id}'"
        )


class ProviderRegistry:
    """Validated provider registrations keyed by stable manifest ID."""

    def __init__(self, schema_root: Path = SCHEMA_ROOT) -> None:
        self._manifest_validator = _validator(schema_root / "cockpit-provider-v1.schema.json")
        self._attestation_validator = _validator(schema_root / "cockpit-provider-attestation-v1.schema.json")
        self._providers: dict[str, RegisteredProvider] = {}

    def register(self, manifest_path: Path, attestation_path: Path) -> RegisteredProvider:
        manifest_bytes = manifest_path.read_bytes()
        manifest = _json_object(manifest_bytes, "provider manifest")
        attestation = _json_object(attestation_path.read_bytes(), "provider attestation")
        self._manifest_validator.validate(manifest)
        self._attestation_validator.validate(attestation)

        if attestation["provider_id"] != manifest["id"]:
            raise ProviderRegistrationError("attestation provider_id does not match manifest id")
        if attestation["provider_version"] != manifest["version"]:
            raise ProviderRegistrationError("attestation provider_version does not match manifest version")

        actual_digest = "sha256:" + hashlib.sha256(manifest_bytes).hexdigest()
        if attestation["manifest_digest"].lower() != actual_digest:
            raise ProviderRegistrationError("provider manifest digest does not match Marlin attestation")

        executable = Path(attestation["executable"])
        if not executable.is_absolute() or not executable.is_file():
            raise ProviderRegistrationError("attested provider executable must be an existing absolute file")

        provider = RegisteredProvider(
            manifest=manifest,
            attestation=attestation,
            executable=executable.resolve(strict=True),
            args=tuple(attestation.get("args") or ()),
        )
        self._providers[provider.provider_id] = provider
        return provider

    def get(self, provider_id: str) -> RegisteredProvider:
        try:
            return self._providers[provider_id]
        except KeyError as exc:
            raise ProviderRegistrationError(f"unknown or untrusted provider '{provider_id}'") from exc

    def list(self) -> tuple[RegisteredProvider, ...]:
        return tuple(self._providers[key] for key in sorted(self._providers))


def _validator(path: Path) -> Draft202012Validator:
    schema = json.loads(path.read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema, format_checker=Draft202012Validator.FORMAT_CHECKER)


def _json_object(raw: bytes, label: str) -> dict[str, Any]:
    try:
        value = json.loads(raw)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ProviderRegistrationError(f"{label} is not valid UTF-8 JSON") from exc
    if not isinstance(value, dict):
        raise ProviderRegistrationError(f"{label} must be a JSON object")
    return value
