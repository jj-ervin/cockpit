"""JSON bridge for host adapters such as the VS Code extension.

The bridge exposes the Phase 1 adapter contract through host-mediated requests.
Hosts send a single JSON request on stdin and receive one JSON AdapterResult
envelope on stdout. Individual adapters still decide whether a write is
supported or requires runtime authority.
"""

from __future__ import annotations

import json
import sys
from dataclasses import asdict
from typing import Any

import cockpit.adapters  # noqa: F401 — import for its registration side-effect only
from cockpit.core.adapter import ADAPTER_REGISTRY, CockpitAdapter

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
    }
)


def execute(request: dict[str, Any]) -> dict[str, Any]:
    """Execute one adapter request and return a JSON-safe payload."""
    backend = str(request.get("backend") or "eco")
    workspace_id = request.get("workspace_id")
    node_id = request.get("node_id")
    operation = str(request.get("operation") or "")

    if operation not in _OPERATIONS:
        raise ValueError(f"unsupported bridge operation: {operation}")

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
