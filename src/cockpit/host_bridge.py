"""JSON bridge for host adapters such as the VS Code extension.

The bridge exposes the Phase 1 adapter contract through host-mediated requests.
Hosts send a single JSON request on stdin and receive one JSON AdapterResult
envelope on stdout. Individual adapters still decide whether a write is
supported or requires runtime authority.
"""

from __future__ import annotations

import json
import subprocess
import sys
import uuid
from dataclasses import asdict
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError as JsonSchemaValidationError

import cockpit.adapters  # noqa: F401 — import for its registration side-effect only
from cockpit.core.adapter import ADAPTER_REGISTRY, CockpitAdapter
from cockpit.provider_discovery import discover_providers
from cockpit.provider_registry import ProviderRegistry

_SCHEMA_ROOT = Path(__file__).resolve().parents[2] / "schemas"

_OPERATIONS = frozenset(
    {
        "health",
        "get_state",
        "list_records",
        "get_record",
        "submit",
        "approve",
        "update_record",
        "delete_record",
        "restore_record",
        "activate",
        "close",
        "invoke_provider_command",
    }
)

_PROVIDER_TIMEOUT_SECONDS = 30

#: Lazily populated on first invoke_provider_command call, not at import
#: time — discovery touches disk (Marlin's home directory) and every other
#: bridge operation must keep working with no Marlin installation present.
_provider_registry: ProviderRegistry | None = None


def _get_provider_registry() -> ProviderRegistry:
    global _provider_registry
    if _provider_registry is None:
        _provider_registry, _ = discover_providers()
    return _provider_registry


_operation_request_validator: Draft202012Validator | None = None
_operation_result_validator: Draft202012Validator | None = None


def _load_validator(schema_name: str) -> Draft202012Validator:
    schema = json.loads((_SCHEMA_ROOT / schema_name).read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema, format_checker=Draft202012Validator.FORMAT_CHECKER)


def _operation_request_schema() -> Draft202012Validator:
    global _operation_request_validator
    if _operation_request_validator is None:
        _operation_request_validator = _load_validator("cockpit-operation-request-v1.schema.json")
    return _operation_request_validator


def _operation_result_schema() -> Draft202012Validator:
    global _operation_result_validator
    if _operation_result_validator is None:
        _operation_result_validator = _load_validator("cockpit-operation-result-v1.schema.json")
    return _operation_result_validator


def execute(request: dict[str, Any]) -> dict[str, Any]:
    """Execute one adapter request and return a JSON-safe payload."""
    backend = str(request.get("backend") or "eco")
    workspace_id = request.get("workspace_id")
    node_id = request.get("node_id")
    operation = str(request.get("operation") or "")

    if operation not in _OPERATIONS:
        raise ValueError(f"unsupported bridge operation: {operation}")

    if operation == "invoke_provider_command":
        return _execute_provider_command(request)

    adapter = _build_adapter(backend, workspace_id, node_id)

    if operation == "health":
        return _serialize_result(adapter.health())
    if operation == "get_state":
        return _serialize_result(adapter.get_state())
    if operation == "list_records":
        record_type = _require_string(request, "record_type")
        filters = request.get("filters") or {}
        if not isinstance(filters, dict):
            raise ValueError("filters must be an object")
        return _serialize_result(adapter.list_records(record_type, **filters))
    if operation == "get_record":
        record_type = _require_string(request, "record_type")
        record_id = _require_string(request, "record_id")
        return _serialize_result(adapter.get_record(record_type, record_id))
    if operation == "submit":
        record_type = _require_string(request, "record_type")
        payload = _require_object(request, "payload")
        return _serialize_result(adapter.submit(record_type, payload))
    if operation == "approve":
        record_id = _require_string(request, "record_id")
        decision = _require_string(request, "decision")
        reason = request.get("reason")
        if reason is not None and not isinstance(reason, str):
            raise ValueError("reason must be a string when provided")
        return _serialize_result(adapter.approve(record_id, decision, reason))
    if operation == "update_record":
        record_type = _require_string(request, "record_type")
        record_id = _require_string(request, "record_id")
        payload = _require_object(request, "payload")
        return _serialize_result(adapter.update_record(record_type, record_id, payload))
    if operation == "delete_record":
        record_type = _require_string(request, "record_type")
        record_id = _require_string(request, "record_id")
        return _serialize_result(adapter.delete_record(record_type, record_id))
    if operation == "restore_record":
        record_type = _require_string(request, "record_type")
        record_id = _require_string(request, "record_id")
        trash_ref = _require_string(request, "trash_ref")
        return _serialize_result(
            adapter.restore_record(record_type, record_id, trash_ref)
        )
    if operation == "activate":
        context = request.get("context") or {}
        if not isinstance(context, dict):
            raise ValueError("context must be an object")
        return _serialize_result(adapter.activate(context))
    if operation == "close":
        return _serialize_result(adapter.close())

    raise AssertionError(f"unhandled operation: {operation}")


def _execute_provider_command(request: dict[str, Any]) -> dict[str, Any]:
    """Routes to a Marlin-installed external cockpit-provider-v1 provider
    instead of a local Python ADAPTER_REGISTRY class. Separate from
    ``execute()``'s dispatch above so local adapters keep their existing,
    unmodified request/response shape; this path speaks the provider wire
    protocol (``cockpit-operation-request-v1`` / ``-result-v1``) instead of
    the adapter contract's fixed health/get_state/list_records/... vocabulary.
    """
    provider_id = str(request.get("backend") or "")
    command_id = _require_string(request, "command_id")
    workspace_id = _require_string(request, "workspace_id")
    payload = request.get("input") or {}
    if not isinstance(payload, dict):
        raise ValueError("input must be an object")

    # Strict identity check, not bool(...): bool("false") is True in Python,
    # so a bridge caller sending the JSON string "false" (a plausible bug in
    # a host that stringifies form values) would silently authorize a
    # mutating command. Only the literal JSON boolean true may confirm.
    confirm = request.get("confirm", False) is True

    registry = _get_provider_registry()
    provider = registry.get(provider_id)
    command = provider.command(command_id)
    if command.get("requires_confirmation") and not confirm:
        raise ValueError(
            f"command '{command_id}' requires_confirmation and needs confirm: true"
        )

    operation_id = str(uuid.uuid4())
    operation_request = {
        "schema_version": "cockpit-operation-request-v1",
        "operation_id": operation_id,
        "provider_id": provider_id,
        "command_id": command_id,
        "workspace_id": workspace_id,
        "input": payload,
    }
    try:
        _operation_request_schema().validate(operation_request)
    except JsonSchemaValidationError as exc:
        # A bug in this function's own construction, not caller input —
        # every field above is already validated individually.
        raise AssertionError(f"constructed provider request failed schema validation: {exc.message}") from exc

    try:
        completed = subprocess.run(
            [str(provider.executable), *provider.args],
            input=json.dumps(operation_request),
            capture_output=True,
            text=True,
            timeout=_PROVIDER_TIMEOUT_SECONDS,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise ValueError(f"provider '{provider_id}' failed to run: {exc}") from exc

    if completed.returncode != 0:
        raise ValueError(
            f"provider '{provider_id}' exited {completed.returncode}: "
            f"{completed.stderr.strip()[:500]}"
        )
    try:
        result = json.loads(completed.stdout)
    except json.JSONDecodeError as exc:
        raise ValueError(f"provider '{provider_id}' returned invalid JSON: {exc}") from exc
    if not isinstance(result, dict):
        raise ValueError(f"provider '{provider_id}' result must be a JSON object")

    try:
        _operation_result_schema().validate(result)
    except JsonSchemaValidationError as exc:
        raise ValueError(
            f"provider '{provider_id}' returned a result that fails schema validation: {exc.message}"
        ) from exc

    # Schema validation proves shape; it cannot prove this result is actually
    # the answer to *this* request. A malformed or compromised provider could
    # return a well-formed but spoofed/stale result otherwise.
    if result.get("operation_id") != operation_id:
        raise ValueError(
            f"provider '{provider_id}' result operation_id "
            f"{result.get('operation_id')!r} does not match request {operation_id!r}"
        )
    if result.get("provider_id") != provider_id:
        raise ValueError(
            f"provider '{provider_id}' result provider_id "
            f"{result.get('provider_id')!r} does not match requested provider {provider_id!r}"
        )
    result_command_id = result.get("command_id")
    if result_command_id is not None and result_command_id != command_id:
        raise ValueError(
            f"provider '{provider_id}' result command_id {result_command_id!r} "
            f"does not match requested command {command_id!r}"
        )

    return result


def main() -> int:
    try:
        request = json.loads(sys.stdin.read() or "{}")
        if not isinstance(request, dict):
            raise ValueError("request must be a JSON object")
        sys.stdout.write(json.dumps(execute(request), separators=(",", ":")))
        sys.stdout.write("\n")
        return 0
    except Exception as exc:
        sys.stdout.write(
            json.dumps(
                {
                    "error": {
                        "type": exc.__class__.__name__,
                        "message": str(exc),
                    }
                },
                separators=(",", ":"),
            )
        )
        sys.stdout.write("\n")
        return 1


def _build_adapter(
    backend: str,
    workspace_id: Any,
    node_id: Any,
) -> CockpitAdapter:
    """Looks up the adapter class registered under `backend` and constructs
    it. No branch here names a specific adapter — adding one (see
    adapters/__init__.py's docstring) never requires touching this function.
    """
    adapter_cls = ADAPTER_REGISTRY.get(backend)
    if adapter_cls is None:
        raise ValueError(f"unknown backend: {backend}")

    normalized_node_id = str(node_id) if node_id is not None else None
    if adapter_cls.REQUIRES_WORKSPACE_ID:
        normalized_workspace: str | None = _require_string_value(
            workspace_id, "workspace_id"
        )
    else:
        normalized_workspace = str(workspace_id) if workspace_id else None

    return adapter_cls(workspace_id=normalized_workspace, node_id=normalized_node_id)


def _serialize_result(result: Any) -> dict[str, Any]:
    return asdict(result)


def _require_string(request: dict[str, Any], key: str) -> str:
    return _require_string_value(request.get(key), key)


def _require_string_value(value: Any, key: str) -> str:
    if not isinstance(value, str) or not value:
        raise ValueError(f"{key} is required")
    return value


def _require_object(request: dict[str, Any], key: str) -> dict[str, Any]:
    value = request.get(key)
    if not isinstance(value, dict):
        raise ValueError(f"{key} must be an object")
    return value


if __name__ == "__main__":
    raise SystemExit(main())
