"""Tests for the host JSON bridge."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest

from cockpit.host_bridge import execute


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
    except ValueError as exc:
        assert "unsupported bridge operation" in str(exc)
    else:
        raise AssertionError("write operation was not rejected")


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
