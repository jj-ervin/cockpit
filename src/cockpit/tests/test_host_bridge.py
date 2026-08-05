"""Tests for the host JSON bridge."""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest

import cockpit.host_bridge as host_bridge_module
from cockpit.core.adapter import ValidationError
from cockpit.host_bridge import execute
from cockpit.provider_registry import ProviderRegistry


@pytest.fixture()
def workspace(tmp_path: Path) -> Path:
    path = tmp_path / "workspace"
    path.mkdir()
    return path


def _write_policy(workspace: Path) -> None:
    eco_root = workspace / ".eco"
    eco_root.mkdir()
    (eco_root / "policy.json").write_text(
        json.dumps({
            "version": "1.0",
            "human_escalation": True,
            "validation_rules": [],
            "allowlist": [],
            "denylist": [],
        }),
        encoding="utf-8",
    )


def test_execute_health_returns_adapter_result(workspace: Path) -> None:
    _write_policy(workspace)

    result = execute({
        "backend": "eco",
        "workspace_id": str(workspace),
        "operation": "health",
    })

    assert result["origin"]["backend"] == "eco"
    assert result["origin"]["workspace_id"] == str(workspace)
    assert result["data"]["status"] == "ok"


def test_execute_list_records_passes_record_type(workspace: Path) -> None:
    _write_policy(workspace)

    result = execute({
        "backend": "eco",
        "workspace_id": str(workspace),
        "operation": "list_records",
        "record_type": "policy",
    })

    assert result["data"][0]["version"] == "1.0"


def test_execute_marlin_install_readiness_is_preview(workspace: Path, tmp_path: Path) -> None:
    project_root = tmp_path / "cockpit"
    project_root.mkdir()

    result = execute({
        "backend": "marlin",
        "workspace_id": str(workspace),
        "operation": "list_records",
        "record_type": "install-readiness",
        "filters": {
            "project_root": str(project_root),
            "workspace": str(workspace),
            "python": "python",
        },
    })

    readiness = result["data"][0]
    assert result["origin"]["backend"] == "marlin"
    assert readiness["mode"] == "preview"
    assert readiness["requires_human_apply"] is True
    assert readiness["mutation_allowed_from_bridge"] is False
    assert "--apply" in readiness["apply_command"]


def test_execute_marlin_install_readiness_rejects_apply(workspace: Path) -> None:
    with pytest.raises(ValidationError, match="read-only"):
        execute({
            "backend": "marlin",
            "workspace_id": str(workspace),
            "operation": "list_records",
            "record_type": "install-readiness",
            "filters": {
                "apply": True,
            },
        })


def test_execute_rejects_write_operations(workspace: Path) -> None:
    _write_policy(workspace)

    try:
        execute({
            "backend": "eco",
            "workspace_id": str(workspace),
            "operation": "submit",
            "record_type": "run",
            "payload": {},
        })
    except Exception as exc:
        assert "read-only" in str(exc) or "missing required fields" in str(exc)
    else:
        raise AssertionError("write operation unexpectedly succeeded")


def test_execute_update_policy_uses_existing_adapter_contract(workspace: Path) -> None:
    _write_policy(workspace)

    result = execute({
        "backend": "eco",
        "workspace_id": str(workspace),
        "operation": "update_record",
        "record_type": "policy",
        "record_id": "policy",
        "payload": {
            "version": "2.0",
            "human_escalation": False,
            "validation_rules": [],
            "allowlist": [],
            "denylist": [],
        },
    })

    assert result["origin"]["backend"] == "eco"
    assert result["data"]["version"] == "2.0"
    assert result["data"]["human_escalation"] is False


def test_execute_delete_and_restore_record_round_trip(workspace: Path) -> None:
    _write_policy(workspace)
    artifacts_dir = workspace / ".eco" / "artifacts"
    artifacts_dir.mkdir()
    artifact = artifacts_dir / "report.txt"
    artifact.write_text("data", encoding="utf-8")

    deleted = execute({
        "backend": "eco",
        "workspace_id": str(workspace),
        "operation": "delete_record",
        "record_type": "artifact",
        "record_id": str(artifact),
    })
    assert not artifact.exists()
    assert deleted["data"]["trash_path"]

    restored = execute({
        "backend": "eco",
        "workspace_id": str(workspace),
        "operation": "restore_record",
        "record_type": "artifact",
        "record_id": deleted["data"]["original_path"],
        "trash_ref": deleted["data"]["trash_path"],
    })
    assert artifact.exists()
    assert restored["data"]["restored_path"] == str(artifact)


def test_execute_delete_record_missing_record_id_raises(workspace: Path) -> None:
    _write_policy(workspace)
    with pytest.raises(ValueError, match="record_id"):
        execute({
            "backend": "eco",
            "workspace_id": str(workspace),
            "operation": "delete_record",
            "record_type": "artifact",
        })


def test_execute_restore_record_missing_trash_ref_raises(workspace: Path) -> None:
    _write_policy(workspace)
    with pytest.raises(ValueError, match="trash_ref"):
        execute({
            "backend": "eco",
            "workspace_id": str(workspace),
            "operation": "restore_record",
            "record_type": "artifact",
            "record_id": "report.txt",
        })


def test_execute_get_governance_record(workspace: Path) -> None:
    _write_policy(workspace)
    (workspace / "health-report.json").write_text(json.dumps({"overall_score": 88}), encoding="utf-8")

    result = execute({
        "backend": "eco",
        "workspace_id": str(workspace),
        "operation": "get_record",
        "record_type": "governance",
        "record_id": "diagnostics",
    })

    assert result["data"]["health_score"] == 88
    assert result["data"]["governance_mode"] == "unknown"


def test_module_entrypoint_outputs_json(workspace: Path) -> None:
    _write_policy(workspace)
    request: dict[str, Any] = {
        "backend": "eco",
        "workspace_id": str(workspace),
        "operation": "get_state",
    }

    completed = subprocess.run(
        [sys.executable, "-m", "cockpit.host_bridge"],
        input=json.dumps(request),
        text=True,
        capture_output=True,
        check=True,
    )

    payload = json.loads(completed.stdout)
    assert payload["origin"]["backend"] == "eco"
    assert payload["data"]["total_runs"] == 0


def test_execute_system_backend_health() -> None:
    result = execute({"backend": "system", "operation": "health"})
    assert result["origin"]["backend"] == "system"
    assert result["data"]["reachable"] is True


def test_execute_system_backend_get_state() -> None:
    result = execute({"backend": "system", "operation": "get_state"})
    assert "python" in result["data"]
    assert "node" in result["data"]


# ---------------------------------------------------------------------------
# invoke_provider_command — external cockpit-provider-v1 dispatch
# ---------------------------------------------------------------------------
#
# ADAPTER_REGISTRY dispatch above (eco/marlin/system) is untouched by this
# path. These tests inject a fake provider directly into the module-level
# registry singleton so they exercise the real ProviderRegistry + subprocess
# spawn without depending on a real Marlin install or the network — the real
# Marlin-installed round trip is covered separately in
# test_provider_registry.py's opt-in real smoke test.


@pytest.fixture()
def fake_provider(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Registers a fake stdio provider (a small Python script standing in for
    a real provider executable) with one read command and one mutating
    command, and points the bridge's provider registry singleton at it for
    the duration of the test.

    Reads FAKE_PROVIDER_MISBEHAVE from its environment so individual tests
    can make it return a spoofed/malformed result without needing a
    separate script per failure mode — a real subprocess boundary is the
    point (matching how a real compromised or buggy provider would behave),
    not an in-process mock standing in for one.
    """
    script = tmp_path / "fake_provider.py"
    script.write_text(
        "import json, os, sys\n"
        "from datetime import datetime, timezone\n"
        "req = json.loads(sys.stdin.read())\n"
        "misbehave = os.environ.get('FAKE_PROVIDER_MISBEHAVE')\n"
        "result = {\n"
        "    'schema_version': 'cockpit-operation-result-v1',\n"
        "    'operation_id': req['operation_id'],\n"
        "    'provider_id': req['provider_id'],\n"
        "    'command_id': req['command_id'],\n"
        "    'status': 'succeeded',\n"
        "    'timestamp': datetime.now(timezone.utc).isoformat(),\n"
        "    'data': {'echo': req['input']},\n"
        "    'evidence': [],\n"
        "}\n"
        "if misbehave == 'wrong_operation_id':\n"
        "    result['operation_id'] = 'spoofed-operation-id'\n"
        "elif misbehave == 'wrong_provider_id':\n"
        "    result['provider_id'] = 'other-provider'\n"
        "elif misbehave == 'missing_command_id':\n"
        "    del result['command_id']\n"
        "elif misbehave == 'schema_violation':\n"
        "    result['evidence'] = [{'kind': 'x', 'ref': 'y', 'bundle': {'not': 'allowed'}}]\n"
        "print(json.dumps(result))\n",
        encoding="utf-8",
    )

    manifest = {
        "schema_version": "cockpit-provider-v1",
        "id": "fake",
        "name": "Fake",
        "version": "1.0.0",
        "transport": {"kind": "stdio-json", "protocol": "cockpit-provider-v1"},
        "commands": [
            {
                "id": "fake.read",
                "title": "Read",
                "action": "read",
                "mutation": False,
                "placements": ["command-palette"],
            },
            {
                "id": "fake.mutate",
                "title": "Mutate",
                "action": "mutate",
                "mutation": True,
                "requires_confirmation": True,
                "placements": ["command-palette"],
            },
        ],
        "views": [],
        "capabilities": ["read", "write"],
        "permissions": [],
    }
    manifest_path = tmp_path / "fake.provider.json"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    attestation = {
        "schema_version": "cockpit-provider-attestation-v1",
        "provider_id": "fake",
        "provider_version": "1.0.0",
        "manifest_digest": "sha256:" + hashlib.sha256(manifest_path.read_bytes()).hexdigest(),
        "package_digest": None,
        "executable": sys.executable,
        "args": [str(script)],
        "installed_at": "2026-08-05T00:00:00Z",
        "installed_by": "marlin",
        "signature": None,
    }
    attestation_path = tmp_path / "fake.attestation.json"
    attestation_path.write_text(json.dumps(attestation), encoding="utf-8")

    registry = ProviderRegistry()
    registry.register(manifest_path, attestation_path)
    monkeypatch.setattr(host_bridge_module, "_provider_registry", registry)
    return script


def test_invoke_provider_command_round_trips_through_real_stdio_spawn(fake_provider: Path) -> None:
    result = execute({
        "backend": "fake",
        "workspace_id": "ws-1",
        "operation": "invoke_provider_command",
        "command_id": "fake.read",
        "input": {"hello": "world"},
    })
    assert result["status"] == "succeeded"
    assert result["provider_id"] == "fake"
    assert result["data"]["echo"] == {"hello": "world"}


def test_invoke_provider_command_requires_workspace_id(fake_provider: Path) -> None:
    with pytest.raises(ValueError, match="workspace_id"):
        execute({
            "backend": "fake",
            "operation": "invoke_provider_command",
            "command_id": "fake.read",
            "input": {},
        })


def test_invoke_provider_command_rejects_unconfirmed_mutation(fake_provider: Path) -> None:
    with pytest.raises(ValueError, match="requires_confirmation"):
        execute({
            "backend": "fake",
            "workspace_id": "ws-1",
            "operation": "invoke_provider_command",
            "command_id": "fake.mutate",
            "input": {},
        })


def test_invoke_provider_command_rejects_stringly_typed_confirm(fake_provider: Path) -> None:
    """Real bug this guards: bool("false") is True in Python. A caller
    sending the JSON string "false" (e.g. a host that stringifies form
    values) must not silently authorize a mutating command."""
    with pytest.raises(ValueError, match="requires_confirmation"):
        execute({
            "backend": "fake",
            "workspace_id": "ws-1",
            "operation": "invoke_provider_command",
            "command_id": "fake.mutate",
            "input": {},
            "confirm": "false",
        })


def test_invoke_provider_command_rejects_truthy_non_boolean_confirm(fake_provider: Path) -> None:
    with pytest.raises(ValueError, match="requires_confirmation"):
        execute({
            "backend": "fake",
            "workspace_id": "ws-1",
            "operation": "invoke_provider_command",
            "command_id": "fake.mutate",
            "input": {},
            "confirm": 1,
        })


def test_invoke_provider_command_allows_confirmed_mutation(fake_provider: Path) -> None:
    result = execute({
        "backend": "fake",
        "workspace_id": "ws-1",
        "operation": "invoke_provider_command",
        "command_id": "fake.mutate",
        "input": {},
        "confirm": True,
    })
    assert result["status"] == "succeeded"


def test_invoke_provider_command_unknown_provider_fails_closed(fake_provider: Path) -> None:
    with pytest.raises(ValueError, match="unknown or untrusted"):
        execute({
            "backend": "not-registered",
            "workspace_id": "ws-1",
            "operation": "invoke_provider_command",
            "command_id": "fake.read",
            "input": {},
        })


def test_invoke_provider_command_unknown_command_fails_closed(fake_provider: Path) -> None:
    with pytest.raises(ValueError, match="does not declare"):
        execute({
            "backend": "fake",
            "workspace_id": "ws-1",
            "operation": "invoke_provider_command",
            "command_id": "fake.delete.everything",
            "input": {},
        })


def test_invoke_provider_command_rejects_spoofed_operation_id(
    fake_provider: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A malformed or compromised provider returning a well-formed but
    spoofed/stale result (wrong operation_id) must not be trusted just
    because it passes schema validation — schema shape is not identity."""
    monkeypatch.setenv("FAKE_PROVIDER_MISBEHAVE", "wrong_operation_id")
    with pytest.raises(ValueError, match="operation_id"):
        execute({
            "backend": "fake",
            "workspace_id": "ws-1",
            "operation": "invoke_provider_command",
            "command_id": "fake.read",
            "input": {},
        })


def test_invoke_provider_command_rejects_spoofed_provider_id(
    fake_provider: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("FAKE_PROVIDER_MISBEHAVE", "wrong_provider_id")
    with pytest.raises(ValueError, match="provider_id"):
        execute({
            "backend": "fake",
            "workspace_id": "ws-1",
            "operation": "invoke_provider_command",
            "command_id": "fake.read",
            "input": {},
        })


def test_invoke_provider_command_rejects_missing_command_id(
    fake_provider: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The result schema permits an omitted command_id, but dispatch must
    still correlate every provider result to the exact command requested."""
    monkeypatch.setenv("FAKE_PROVIDER_MISBEHAVE", "missing_command_id")
    with pytest.raises(ValueError, match="command_id"):
        execute({
            "backend": "fake",
            "workspace_id": "ws-1",
            "operation": "invoke_provider_command",
            "command_id": "fake.read",
            "input": {},
        })


def test_invoke_provider_command_rejects_schema_invalid_result(
    fake_provider: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Real bug this guards: an evidence item with an extra property (the
    exact shape Marlin's provider produced before its own corrective fix)
    must be rejected, not passed through as an untyped dict."""
    monkeypatch.setenv("FAKE_PROVIDER_MISBEHAVE", "schema_violation")
    with pytest.raises(ValueError, match="schema validation"):
        execute({
            "backend": "fake",
            "workspace_id": "ws-1",
            "operation": "invoke_provider_command",
            "command_id": "fake.read",
            "input": {},
        })


def test_adapter_registry_dispatch_is_unaffected_by_provider_registry(
    fake_provider: Path, workspace: Path
) -> None:
    """Confirms this PASS is additive: local ADAPTER_REGISTRY backends still
    work exactly as before even with a provider registry populated."""
    result = execute({"backend": "system", "operation": "health"})
    assert result["origin"]["backend"] == "system"
