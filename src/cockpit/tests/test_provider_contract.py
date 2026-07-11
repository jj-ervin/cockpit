"""Executable contract checks for cockpit-provider-v1 schemas and examples."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator, ValidationError


ROOT = Path(__file__).resolve().parents[3]
SCHEMAS = ROOT / "schemas"
EXAMPLES = ROOT / "examples" / "providers"


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def validator(name: str) -> Draft202012Validator:
    schema = load(SCHEMAS / name)
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema, format_checker=Draft202012Validator.FORMAT_CHECKER)


def reject_duplicate_keys(pairs: list[tuple[str, object]]) -> dict:
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def test_contract_schemas_contain_no_duplicate_json_keys() -> None:
    for path in SCHEMAS.glob("cockpit-*-v1.schema.json"):
        json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=reject_duplicate_keys)


@pytest.mark.parametrize("example", ["marlin.provider.json", "niji.provider.json"])
def test_provider_examples_validate(example: str) -> None:
    validator("cockpit-provider-v1.schema.json").validate(load(EXAMPLES / example))


def test_marlin_attestation_validates() -> None:
    validator("cockpit-provider-attestation-v1.schema.json").validate(
        load(EXAMPLES / "marlin.attestation.json")
    )


def test_manifest_cannot_choose_an_executable() -> None:
    manifest = load(EXAMPLES / "niji.provider.json")
    manifest["transport"]["command"] = "malicious.exe"
    with pytest.raises(ValidationError):
        validator("cockpit-provider-v1.schema.json").validate(manifest)


def test_mutation_requires_explicit_confirmation_declaration() -> None:
    manifest = load(EXAMPLES / "marlin.provider.json")
    command = next(item for item in manifest["commands"] if item["mutation"])
    command.pop("requires_confirmation")
    with pytest.raises(ValidationError):
        validator("cockpit-provider-v1.schema.json").validate(manifest)


def test_request_and_result_envelopes_validate() -> None:
    validator("cockpit-operation-request-v1.schema.json").validate({
        "schema_version": "cockpit-operation-request-v1",
        "operation_id": "01JTEST",
        "provider_id": "marlin",
        "command_id": "marlin.governance.validate",
        "workspace_id": "file:///workspace/project",
        "input": {},
    })
    validator("cockpit-operation-result-v1.schema.json").validate({
        "schema_version": "cockpit-operation-result-v1",
        "operation_id": "01JTEST",
        "provider_id": "marlin",
        "command_id": "marlin.governance.validate",
        "status": "succeeded",
        "timestamp": "2026-07-11T00:00:00Z",
        "data": {"blocking_findings": 0},
        "error": None,
        "evidence": [],
    })
