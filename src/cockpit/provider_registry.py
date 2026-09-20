"""Zero-trust discovery registry for cockpit-provider-v1 providers."""

from __future__ import annotations

import hashlib
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError as JsonSchemaValidationError


def _schema_root() -> Path:
    """Resolve schemas from source or PyInstaller's extracted data root."""
    frozen_root = getattr(sys, "_MEIPASS", None)
    if frozen_root:
        return Path(frozen_root) / "schemas"
    return Path(__file__).resolve().parents[2] / "schemas"


SCHEMA_ROOT = _schema_root()


class ProviderRegistrationError(ValueError):
    """A provider failed schema, integrity, or executable verification."""


@dataclass(frozen=True)
class RegisteredProvider:
    manifest: dict[str, Any]
    attestation: dict[str, Any]
    executable: Path
    args: tuple[str, ...]
    integrity_target: Path
    executable_digest: str

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

    def verify_integrity(self) -> None:
        """Re-hashes `integrity_target` against the digest captured at
        registration time. Registration alone only proves the file was
        intact *then* — a caller must call this again immediately before
        every spawn, since the file on disk can change at any point after
        registration (the registry is typically built once and reused for
        the life of a host_bridge process). Raises ProviderRegistrationError,
        never lets a mismatch or a now-missing file through silently."""
        try:
            actual_digest = "sha256:" + hashlib.sha256(self.integrity_target.read_bytes()).hexdigest()
        except OSError as exc:
            raise ProviderRegistrationError(
                f"provider '{self.provider_id}' integrity target is no longer "
                f"readable ({self.integrity_target}): {exc}. Reinstall the provider."
            ) from exc
        if actual_digest != self.executable_digest:
            raise ProviderRegistrationError(
                f"provider '{self.provider_id}' executable no longer matches its "
                "attested digest — it was modified after registration. Reinstall "
                "the provider before invoking it again."
            )


class ProviderRegistry:
    """Validated provider registrations keyed by stable manifest ID."""

    def __init__(self, schema_root: Path = SCHEMA_ROOT) -> None:
        self._schema_root = schema_root
        self._manifest_validators = {
            "cockpit-provider-v1": _validator(schema_root / "cockpit-provider-v1.schema.json"),
            "cockpit-provider-v1.1": _validator(schema_root / "cockpit-provider-v1.1.schema.json"),
        }
        self._attestation_validator = _validator(schema_root / "cockpit-provider-attestation-v1.schema.json")
        self._providers: dict[str, RegisteredProvider] = {}

    def register(self, manifest_path: Path, attestation_path: Path) -> RegisteredProvider:
        manifest_bytes = manifest_path.read_bytes()
        manifest = _json_object(manifest_bytes, "provider manifest")
        attestation = _json_object(attestation_path.read_bytes(), "provider attestation")
        try:
            schema_version = manifest.get("schema_version")
            validator = self._manifest_validators.get(schema_version)
            if validator is None:
                if schema_version is None:
                    validator = self._manifest_validators["cockpit-provider-v1"]
                else:
                    raise ProviderRegistrationError(
                        f"unsupported provider manifest schema_version: {schema_version!r}"
                    )
            try:
                validator.validate(manifest)
            except Exception as exc:
                raise ProviderRegistrationError(f"schema validation failed: {exc}") from exc
            self._attestation_validator.validate(attestation)
        except JsonSchemaValidationError as exc:
            raise ProviderRegistrationError(f"schema validation failed: {exc.message}") from exc

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
        resolved_executable = executable.resolve(strict=True)
        args = tuple(attestation.get("args") or ())

        # `package_digest`, when present, is the digest of the downloaded install
        # archive that Marlin verified against the registry's declared checksum
        # *before* extraction (see marlin/packages/marlin/src/installer.ts,
        # verifyChecksum). It is not a digest of `executable` itself — the
        # archive is gone by the time this registration runs — so it is
        # install-time provenance only, not integrity verification.
        #
        # `executable_digest`/`executable_digest_target` are what actually
        # protect against the installed file being swapped after Marlin wrote
        # it — checked both here at registration and again by
        # RegisteredProvider.verify_integrity() immediately before every
        # spawn, since registration alone cannot catch a file changed later
        # in the same process's lifetime. `executable_digest_target` is an
        # explicit choice written by the attester (see
        # marlin/packages/marlin/src/installer.ts's issueProviderAttestation
        # and marlin-dxp/src/core/selfProvider.ts) — never inferred here by
        # position in `args`, which breaks the moment a real command has
        # trailing flags after its script path.
        #
        # THREAT MODEL NOTE: this authenticates the executable against
        # attestation.json's own claim, not against Marlin as an issuer —
        # `signature` is still always null. Anyone able to overwrite the
        # executable on disk can equally overwrite attestation.json with a
        # matching digest. This catches accidental drift, corruption, and
        # partial/interrupted installs, not a fully compromised local write
        # path. Real authentication would need Marlin to sign attestation.json
        # with a key Cockpit verifies — a distinct, larger, not-yet-started
        # PASS, not implied by this check.
        executable_digest = attestation.get("executable_digest")
        digest_target_str = attestation.get("executable_digest_target")
        if not executable_digest or not digest_target_str:
            raise ProviderRegistrationError(
                f"provider '{attestation['provider_id']}' has no executable_digest — "
                "it was installed by a Marlin build that predates executable "
                "integrity checking. Reinstall the provider with a current Marlin "
                "(e.g. `marlin install <package>`, or restart Marlin itself for its "
                "own self-registration) to regenerate a trusted attestation."
            )
        if digest_target_str != str(executable) and digest_target_str not in args:
            raise ProviderRegistrationError(
                f"provider '{attestation['provider_id']}' executable_digest_target "
                "is not `executable` or a declared entry in `args` — the attestation "
                "does not cover a file that is actually part of the spawned command."
            )
        digest_target_path = Path(digest_target_str)
        if not digest_target_path.is_absolute():
            raise ProviderRegistrationError(
                f"provider '{attestation['provider_id']}' executable_digest_target "
                "must be an absolute path"
            )
        try:
            resolved_target = digest_target_path.resolve(strict=True)
            if not resolved_target.is_file():
                raise ProviderRegistrationError(
                    f"provider '{attestation['provider_id']}' executable_digest_target "
                    f"is not a file: {digest_target_str}"
                )
            actual_digest = "sha256:" + hashlib.sha256(resolved_target.read_bytes()).hexdigest()
        except OSError as exc:
            raise ProviderRegistrationError(
                f"provider '{attestation['provider_id']}' executable_digest_target "
                f"could not be read ({digest_target_str}): {exc}"
            ) from exc
        if executable_digest.lower() != actual_digest:
            raise ProviderRegistrationError(
                f"provider '{attestation['provider_id']}' executable does not match its "
                "attested digest — the installed file may have been modified since "
                "Marlin installed it. Reinstall the provider to restore a trusted copy."
            )

        provider = RegisteredProvider(
            manifest=manifest,
            attestation=attestation,
            executable=resolved_executable,
            args=args,
            integrity_target=resolved_target,
            executable_digest=executable_digest.lower(),
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
