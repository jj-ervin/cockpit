"""Tests for SystemAdapter."""

from __future__ import annotations

import sys

import pytest

from cockpit.adapters.system import SystemAdapter
from cockpit.core.adapter import RecordNotFoundError, ValidationError


def test_backend_id() -> None:
    a = SystemAdapter()
    assert a.backend_id == "system"


def test_health_reports_ok_when_cockpit_importable() -> None:
    a = SystemAdapter()
    result = a.health()
    assert result.data["reachable"] is True
    assert result.data["status"] == "ok"


def test_get_state_reports_real_python_executable() -> None:
    a = SystemAdapter()
    result = a.get_state()
    assert result.data["python"]["executable"] == sys.executable
    assert result.data["python"]["cockpit_importable"] is True


def test_get_state_reports_node_availability() -> None:
    a = SystemAdapter()
    result = a.get_state()
    node = result.data["node"]
    assert "available" in node
    assert "executable" in node
    assert "version" in node


def test_list_records_environment_returns_single_item() -> None:
    a = SystemAdapter()
    result = a.list_records("environment")
    assert len(result.data) == 1
    assert result.data[0]["id"] == "current"


def test_get_record_environment_current() -> None:
    a = SystemAdapter()
    result = a.get_record("environment", "current")
    assert "python" in result.data
    assert "node" in result.data


def test_get_record_rejects_unknown_id() -> None:
    a = SystemAdapter()
    with pytest.raises(RecordNotFoundError):
        a.get_record("environment", "not-current")


def test_list_records_rejects_unknown_record_type() -> None:
    a = SystemAdapter()
    with pytest.raises(ValidationError):
        a.list_records("something-else")


def test_origin_reflects_system_workspace_id() -> None:
    a = SystemAdapter()
    result = a.health()
    assert result.origin.backend == "system"
    assert result.origin.workspace_id == "system"
