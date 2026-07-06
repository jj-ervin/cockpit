"""Tests for EcoAdapter."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock

import pytest

from cockpit.adapters.eco import EcoAdapter
from cockpit.core.adapter import RecordNotFoundError, ValidationError, WriteNotSupportedError


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _write_run(runs_dir: Path, run_id: str, final_state: str, **extra: Any) -> Path:
    payload: dict[str, Any] = {"run_id": run_id, "pass_id": "INIT.01.00", "final_state": final_state}
    payload.update(extra)
    path = runs_dir / f"run-{run_id}.json"
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


def _write_policy(eco_dir: Path, **overrides: Any) -> None:
    policy = {
        "version": "1.0",
        "human_escalation": True,
        "validation_rules": [],
        "allowlist": [],
        "denylist": [],
        **overrides,
    }
    (eco_dir / "policy.json").write_text(json.dumps(policy), encoding="utf-8")


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def workspace(tmp_path: Path) -> Path:
    ws = tmp_path / "workspace"
    ws.mkdir()
    return ws


@pytest.fixture()
def eco_dir(workspace: Path) -> Path:
    d = workspace / ".eco"
    d.mkdir()
    return d


@pytest.fixture()
def runs_dir(eco_dir: Path) -> Path:
    d = eco_dir / "runs"
    d.mkdir()
    return d


@pytest.fixture()
def artifacts_dir(eco_dir: Path) -> Path:
    d = eco_dir / "artifacts"
    d.mkdir()
    return d


@pytest.fixture()
def adapter(workspace: Path) -> EcoAdapter:
    return EcoAdapter(workspace_id=str(workspace))


@pytest.fixture()
def full_workspace(workspace: Path, eco_dir: Path, runs_dir: Path, artifacts_dir: Path) -> Path:
    _write_policy(eco_dir)
    return workspace


@pytest.fixture()
def runtime_client() -> MagicMock:
    client = MagicMock()
    client.resume_run = MagicMock(return_value=None)
    client.build_run_request = MagicMock(return_value=MagicMock(run_id="new-run-001"))
    client.execute_run = MagicMock(return_value=MagicMock())
    return client


# ---------------------------------------------------------------------------
# health()
# ---------------------------------------------------------------------------

def test_health_ok(full_workspace: Path) -> None:
    a = EcoAdapter(workspace_id=str(full_workspace))
    result = a.health()
    assert result.data["status"] == "ok"
    assert result.data["reachable"] is True
    assert result.data["eco_root_present"] is True
    assert result.data["runs_root_present"] is True
    assert result.data["artifacts_root_present"] is True
    assert result.data["policy_present"] is True
    assert result.data["runtime_client_configured"] is False
    assert result.origin.backend == "eco"


def test_health_degraded_no_workspace(tmp_path: Path) -> None:
    a = EcoAdapter(workspace_id=str(tmp_path / "nonexistent"))
    result = a.health()
    assert result.data["status"] == "degraded"
    assert result.data["reachable"] is False


def test_health_degraded_no_eco_dir(workspace: Path) -> None:
    a = EcoAdapter(workspace_id=str(workspace))
    result = a.health()
    assert result.data["status"] == "degraded"
    assert result.data["eco_root_present"] is False


def test_health_runtime_client_configured(full_workspace: Path, runtime_client: MagicMock) -> None:
    a = EcoAdapter(workspace_id=str(full_workspace), runtime_client=runtime_client)
    assert a.health().data["runtime_client_configured"] is True


# ---------------------------------------------------------------------------
# get_state()
# ---------------------------------------------------------------------------

def test_get_state_empty_workspace(full_workspace: Path) -> None:
    a = EcoAdapter(workspace_id=str(full_workspace))
    result = a.get_state()
    assert result.data["total_runs"] == 0
    assert result.data["escalation_queue_depth"] == 0
    assert result.data["average_duration_s"] is None
    assert result.data["policy_violation_rate"] == 0.0


def test_get_state_run_counts(full_workspace: Path, runs_dir: Path) -> None:
    _write_run(runs_dir, "r1", "COMPLETE")
    _write_run(runs_dir, "r2", "COMPLETE")
    _write_run(runs_dir, "r3", "FAILED")
    a = EcoAdapter(workspace_id=str(full_workspace))
    result = a.get_state()
    assert result.data["total_runs"] == 3
    assert result.data["run_counts"]["COMPLETE"] == 2
    assert result.data["run_counts"]["FAILED"] == 1


def test_get_state_escalation_depth_only_unresolved(full_workspace: Path, runs_dir: Path) -> None:
    _write_run(runs_dir, "e1", "ESCALATED", escalation={})
    _write_run(runs_dir, "e2", "ESCALATED", escalation={"decision": "approved", "resolution": "approved"})
    _write_run(runs_dir, "e3", "ESCALATED", escalation={"resolution": "aborted"})
    a = EcoAdapter(workspace_id=str(full_workspace))
    result = a.get_state()
    assert result.data["escalation_queue_depth"] == 1


def test_get_state_average_duration(full_workspace: Path, runs_dir: Path) -> None:
    _write_run(runs_dir, "d1", "COMPLETE", result={"timings": {"duration_s": 10.0}})
    _write_run(runs_dir, "d2", "COMPLETE", result={"timings": {"duration_s": 30.0}})
    a = EcoAdapter(workspace_id=str(full_workspace))
    result = a.get_state()
    assert result.data["average_duration_s"] == pytest.approx(20.0)


def test_get_state_policy_info(full_workspace: Path, eco_dir: Path) -> None:
    _write_policy(eco_dir, version="2.0", human_escalation=False)
    a = EcoAdapter(workspace_id=str(full_workspace))
    result = a.get_state()
    assert result.data["policy_version"] == "2.0"
    assert result.data["human_escalation_enabled"] is False


def test_get_state_policy_violation_rate(full_workspace: Path, runs_dir: Path) -> None:
    _write_run(runs_dir, "c1", "COMPLETE")
    _write_run(runs_dir, "c2", "COMPLETE")
    _write_run(runs_dir, "e1", "ESCALATED")
    a = EcoAdapter(workspace_id=str(full_workspace))
    result = a.get_state()
    assert result.data["policy_violation_rate"] == pytest.approx(1 / 3)


# ---------------------------------------------------------------------------
# list_records()
# ---------------------------------------------------------------------------

def test_list_records_all_runs(full_workspace: Path, runs_dir: Path) -> None:
    _write_run(runs_dir, "r1", "COMPLETE")
    _write_run(runs_dir, "r2", "FAILED")
    a = EcoAdapter(workspace_id=str(full_workspace))
    result = a.list_records("run")
    assert len(result.data) == 2
    states = {r["final_state"] for r in result.data}
    assert states == {"COMPLETE", "FAILED"}


def test_list_records_escalation_excludes_resolved(full_workspace: Path, runs_dir: Path) -> None:
    _write_run(runs_dir, "e1", "ESCALATED", escalation={})
    _write_run(runs_dir, "e2", "ESCALATED", escalation={"decision": "denied"})
    _write_run(runs_dir, "e3", "COMPLETE")
    a = EcoAdapter(workspace_id=str(full_workspace))
    result = a.list_records("escalation")
    assert len(result.data) == 1
    assert result.data[0]["run_id"] == "e1"


def test_list_records_artifacts(full_workspace: Path, artifacts_dir: Path) -> None:
    (artifacts_dir / "output.json").write_text('{"key": "val"}', encoding="utf-8")
    (artifacts_dir / "report.md").write_text("# Report", encoding="utf-8")
    a = EcoAdapter(workspace_id=str(full_workspace))
    result = a.list_records("artifact")
    assert len(result.data) == 2
    paths = {Path(e["artifact_path"]).name for e in result.data}
    assert paths == {"output.json", "report.md"}


def test_list_records_artifact_has_hash(full_workspace: Path, artifacts_dir: Path) -> None:
    (artifacts_dir / "file.txt").write_text("hello", encoding="utf-8")
    a = EcoAdapter(workspace_id=str(full_workspace))
    result = a.list_records("artifact")
    assert result.data[0]["hash"]  # non-empty sha256


def test_list_records_policy(full_workspace: Path, eco_dir: Path) -> None:
    _write_policy(eco_dir, version="1.5")
    a = EcoAdapter(workspace_id=str(full_workspace))
    result = a.list_records("policy")
    assert len(result.data) == 1
    assert result.data[0]["version"] == "1.5"


def test_list_records_unknown_type_raises(full_workspace: Path) -> None:
    a = EcoAdapter(workspace_id=str(full_workspace))
    with pytest.raises(ValidationError, match="unknown record type"):
        a.list_records("invoice")


def test_list_records_empty_runs_dir(full_workspace: Path) -> None:
    a = EcoAdapter(workspace_id=str(full_workspace))
    result = a.list_records("run")
    assert result.data == []


# ---------------------------------------------------------------------------
# get_record()
# ---------------------------------------------------------------------------

def test_get_record_run_found(full_workspace: Path, runs_dir: Path) -> None:
    _write_run(runs_dir, "abc123", "COMPLETE")
    a = EcoAdapter(workspace_id=str(full_workspace))
    result = a.get_record("run", "abc123")
    assert result.data["run_id"] == "abc123"
    assert result.data["final_state"] == "COMPLETE"


def test_get_record_run_not_found(full_workspace: Path) -> None:
    a = EcoAdapter(workspace_id=str(full_workspace))
    with pytest.raises(RecordNotFoundError, match="not found"):
        a.get_record("run", "nonexistent")


def test_get_record_artifact_found(full_workspace: Path, artifacts_dir: Path) -> None:
    p = artifacts_dir / "out.json"
    p.write_text('{}', encoding="utf-8")
    a = EcoAdapter(workspace_id=str(full_workspace))
    result = a.get_record("artifact", str(p))
    assert Path(result.data["artifact_path"]) == p


def test_get_record_artifact_not_found(full_workspace: Path) -> None:
    a = EcoAdapter(workspace_id=str(full_workspace))
    with pytest.raises(RecordNotFoundError):
        a.get_record("artifact", "/nonexistent/path/file.json")


def test_get_record_policy(full_workspace: Path, eco_dir: Path) -> None:
    _write_policy(eco_dir, version="3.0")
    a = EcoAdapter(workspace_id=str(full_workspace))
    result = a.get_record("policy", "policy")
    assert result.data["version"] == "3.0"


def test_get_record_unknown_type_raises(full_workspace: Path) -> None:
    a = EcoAdapter(workspace_id=str(full_workspace))
    with pytest.raises(ValidationError):
        a.get_record("invoice", "123")


# ---------------------------------------------------------------------------
# governance record type
# ---------------------------------------------------------------------------

def test_governance_defaults_when_no_sources_present(full_workspace: Path) -> None:
    a = EcoAdapter(workspace_id=str(full_workspace))
    result = a.get_record("governance", "diagnostics")
    assert result.data["governance_mode"] == "unknown"
    assert result.data["diagnostics_present"] is False
    assert result.data["issues"] == []
    assert result.data["health_score"] is None


def test_governance_reads_diagnostics_file(workspace: Path) -> None:
    diagnostics = {
        "governance_mode": "full",
        "governance_state_hash": "abc",
        "computed_hash": "abc",
        "hash_match": True,
        "issues": [{"severity": "ERROR", "message": "bad thing", "file": "x.py", "line": 3, "rule": "R1"}],
    }
    (workspace / "governance-diagnostics.json").write_text(json.dumps(diagnostics), encoding="utf-8")
    a = EcoAdapter(workspace_id=str(workspace))
    result = a.get_record("governance", "diagnostics")
    assert result.data["diagnostics_present"] is True
    assert result.data["hash_match"] is True
    assert result.data["issues"][0]["rule"] == "R1"


def test_governance_reads_mode_from_project_yaml(workspace: Path) -> None:
    (workspace / "project.yaml").write_text('name: demo\ngovernance_mode: "soft"\n', encoding="utf-8")
    a = EcoAdapter(workspace_id=str(workspace))
    result = a.get_record("governance", "diagnostics")
    assert result.data["governance_mode"] == "soft"


def test_governance_mode_defaults_to_full_when_key_missing(workspace: Path) -> None:
    (workspace / "project.yaml").write_text("name: demo\n", encoding="utf-8")
    a = EcoAdapter(workspace_id=str(workspace))
    result = a.get_record("governance", "diagnostics")
    assert result.data["governance_mode"] == "full"


def test_governance_reads_health_score(workspace: Path) -> None:
    (workspace / "health-report.json").write_text(json.dumps({"overall_score": 92.5}), encoding="utf-8")
    a = EcoAdapter(workspace_id=str(workspace))
    result = a.get_record("governance", "diagnostics")
    assert result.data["health_score"] == 92.5


def test_governance_health_score_ignores_non_numeric(workspace: Path) -> None:
    (workspace / "health-report.json").write_text(json.dumps({"overall_score": "not-a-number"}), encoding="utf-8")
    a = EcoAdapter(workspace_id=str(workspace))
    result = a.get_record("governance", "diagnostics")
    assert result.data["health_score"] is None


def test_governance_malformed_diagnostics_json_treated_as_absent(workspace: Path) -> None:
    (workspace / "governance-diagnostics.json").write_text("not json", encoding="utf-8")
    a = EcoAdapter(workspace_id=str(workspace))
    result = a.get_record("governance", "diagnostics")
    assert result.data["diagnostics_present"] is False


def test_list_records_governance_returns_single_item(full_workspace: Path) -> None:
    a = EcoAdapter(workspace_id=str(full_workspace))
    result = a.list_records("governance")
    assert len(result.data) == 1
    assert "governance_mode" in result.data[0]


# ---------------------------------------------------------------------------
# mode record type — read
# ---------------------------------------------------------------------------

def test_mode_defaults_when_absent(full_workspace: Path) -> None:
    a = EcoAdapter(workspace_id=str(full_workspace))
    result = a.get_record("mode", "current")
    assert result.data["current_mode"] is None
    assert result.data["history"] == []
    assert result.data["available_modes"] == [
        "Navigator", "Builder", "Analyst", "Historian", "Operator",
    ]


def test_mode_reads_history_file(workspace: Path, eco_dir: Path) -> None:
    helm_dir = eco_dir / "helm"
    helm_dir.mkdir()
    history = [
        {"previous_mode": None, "current_mode": "Navigator", "time_loc": "2026-07-01T00:00:00+00:00"},
        {"previous_mode": "Navigator", "current_mode": "Builder", "time_loc": "2026-07-02T00:00:00+00:00"},
    ]
    (helm_dir / "mode_history.json").write_text(json.dumps(history), encoding="utf-8")
    a = EcoAdapter(workspace_id=str(workspace))
    result = a.get_record("mode", "current")
    assert result.data["current_mode"] == "Builder"
    assert len(result.data["history"]) == 2


def test_mode_current_is_latest_history_entry(workspace: Path, eco_dir: Path) -> None:
    helm_dir = eco_dir / "helm"
    helm_dir.mkdir()
    history = [
        {"previous_mode": None, "current_mode": "Navigator", "time_loc": "2026-07-01T00:00:00+00:00"},
        {"previous_mode": "Navigator", "current_mode": "Analyst", "time_loc": "2026-07-03T00:00:00+00:00"},
    ]
    (helm_dir / "mode_history.json").write_text(json.dumps(history), encoding="utf-8")
    a = EcoAdapter(workspace_id=str(workspace))
    result = a.get_record("mode", "current")
    assert result.data["current_mode"] == "Analyst"


def test_mode_malformed_json_treated_as_absent(workspace: Path, eco_dir: Path) -> None:
    helm_dir = eco_dir / "helm"
    helm_dir.mkdir()
    (helm_dir / "mode_history.json").write_text("not json", encoding="utf-8")
    a = EcoAdapter(workspace_id=str(workspace))
    result = a.get_record("mode", "current")
    assert result.data["current_mode"] is None
    assert result.data["history"] == []


def test_list_records_mode_returns_single_item(full_workspace: Path) -> None:
    a = EcoAdapter(workspace_id=str(full_workspace))
    result = a.list_records("mode")
    assert len(result.data) == 1
    assert "available_modes" in result.data[0]


# ---------------------------------------------------------------------------
# approve()
# ---------------------------------------------------------------------------

def test_approve_without_runtime_client_raises(full_workspace: Path, runs_dir: Path) -> None:
    _write_run(runs_dir, "e1", "ESCALATED")
    a = EcoAdapter(workspace_id=str(full_workspace))
    with pytest.raises(WriteNotSupportedError, match="read-only"):
        a.approve("e1", "approved")


def test_approve_invalid_decision_raises(full_workspace: Path, runtime_client: MagicMock) -> None:
    a = EcoAdapter(workspace_id=str(full_workspace), runtime_client=runtime_client)
    with pytest.raises(ValidationError, match="'approved' or 'denied'"):
        a.approve("e1", "maybe")


def test_approve_calls_runtime_client(full_workspace: Path, runs_dir: Path, runtime_client: MagicMock) -> None:
    _write_run(runs_dir, "e1", "ESCALATED", escalation={})
    a = EcoAdapter(workspace_id=str(full_workspace), runtime_client=runtime_client)
    result = a.approve("e1", "approved", reason="looks good")
    assert result.data["decision"] == "approved"
    runtime_client.resume_run.assert_called_once()


def test_approve_persists_decision_to_run_file(full_workspace: Path, runs_dir: Path, runtime_client: MagicMock) -> None:
    _write_run(runs_dir, "e1", "ESCALATED", escalation={})
    a = EcoAdapter(workspace_id=str(full_workspace), runtime_client=runtime_client)
    a.approve("e1", "approved", reason="ok")
    updated = json.loads((runs_dir / "run-e1.json").read_text(encoding="utf-8"))
    assert updated["escalation"]["decision"] == "approved"
    assert updated["escalation"]["resolution"] == "approved"


def test_deny_sets_final_state_aborted(full_workspace: Path, runs_dir: Path, runtime_client: MagicMock) -> None:
    _write_run(runs_dir, "e2", "ESCALATED", escalation={})
    a = EcoAdapter(workspace_id=str(full_workspace), runtime_client=runtime_client)
    a.approve("e2", "denied", reason="nope")
    updated = json.loads((runs_dir / "run-e2.json").read_text(encoding="utf-8"))
    assert updated["final_state"] == "ABORTED"
    assert updated["escalation"]["resolution"] == "aborted"


# ---------------------------------------------------------------------------
# submit()
# ---------------------------------------------------------------------------

def test_submit_without_runtime_client_raises(full_workspace: Path) -> None:
    a = EcoAdapter(workspace_id=str(full_workspace))
    with pytest.raises(WriteNotSupportedError):
        a.submit("run", {"pass_name_or_id": "X", "artifact_type": "y", "objective": "z"})


def test_submit_wrong_record_type_raises(full_workspace: Path, runtime_client: MagicMock) -> None:
    a = EcoAdapter(workspace_id=str(full_workspace), runtime_client=runtime_client)
    with pytest.raises(WriteNotSupportedError, match="'run', 'mode'"):
        a.submit("policy", {})


def test_submit_missing_fields_raises(full_workspace: Path, runtime_client: MagicMock) -> None:
    a = EcoAdapter(workspace_id=str(full_workspace), runtime_client=runtime_client)
    with pytest.raises(ValidationError, match="missing required fields"):
        a.submit("run", {"pass_name_or_id": "X"})


def test_submit_calls_runtime_client(full_workspace: Path, runtime_client: MagicMock) -> None:
    a = EcoAdapter(workspace_id=str(full_workspace), runtime_client=runtime_client)
    result = a.submit("run", {
        "pass_name_or_id": "INIT.01.00",
        "artifact_type": "analysis",
        "objective": "test run",
    })
    assert result.data["run_id"] == "new-run-001"
    runtime_client.build_run_request.assert_called_once()
    runtime_client.execute_run.assert_called_once()


# ---------------------------------------------------------------------------
# submit() — mode (no runtime_client required; pure file I/O)
# ---------------------------------------------------------------------------

def test_submit_mode_rejects_unknown_mode(full_workspace: Path) -> None:
    a = EcoAdapter(workspace_id=str(full_workspace))
    with pytest.raises(ValidationError, match="mode must be one of"):
        a.submit("mode", {"mode": "Rogue"})


def test_submit_mode_requires_no_runtime_client(full_workspace: Path) -> None:
    a = EcoAdapter(workspace_id=str(full_workspace))
    result = a.submit("mode", {"mode": "Navigator"})
    assert result.data["current_mode"] == "Navigator"


def test_submit_mode_creates_history_file(full_workspace: Path, eco_dir: Path) -> None:
    a = EcoAdapter(workspace_id=str(full_workspace))
    a.submit("mode", {"mode": "Builder"})
    history_path = eco_dir / "helm" / "mode_history.json"
    assert history_path.exists()
    history = json.loads(history_path.read_text(encoding="utf-8"))
    assert history[-1]["current_mode"] == "Builder"
    assert history[-1]["previous_mode"] is None


def test_submit_mode_appends_and_tracks_previous(full_workspace: Path) -> None:
    a = EcoAdapter(workspace_id=str(full_workspace))
    a.submit("mode", {"mode": "Navigator"})
    result = a.submit("mode", {"mode": "Analyst"})
    assert result.data["current_mode"] == "Analyst"
    assert len(result.data["history"]) == 2
    assert result.data["history"][-1]["previous_mode"] == "Navigator"


def test_submit_mode_writes_real_time_loc_v1_2_shape(full_workspace: Path) -> None:
    a = EcoAdapter(workspace_id=str(full_workspace))
    result = a.submit("mode", {"mode": "Navigator"})
    time_loc = result.data["history"][-1]["time_loc"]
    assert time_loc["version"] == "time.loc/1.2"
    assert time_loc["geo.source"] == "unavailable"
    assert time_loc["sig"] == "unsigned"
    assert "stamp.utc" in time_loc
    assert "seq" in time_loc


# ---------------------------------------------------------------------------
# update_record() — policy only
# ---------------------------------------------------------------------------

def test_update_record_wrong_type_raises(full_workspace: Path) -> None:
    a = EcoAdapter(workspace_id=str(full_workspace))
    with pytest.raises(WriteNotSupportedError, match="record_type='policy'"):
        a.update_record("run", "r1", {})


def test_update_record_invalid_policy_raises(full_workspace: Path) -> None:
    a = EcoAdapter(workspace_id=str(full_workspace))
    with pytest.raises(ValidationError, match="version is required"):
        a.update_record("policy", "policy", {"human_escalation": True})


def test_update_record_writes_policy(full_workspace: Path, eco_dir: Path) -> None:
    a = EcoAdapter(workspace_id=str(full_workspace))
    new_policy = {
        "version": "2.0",
        "human_escalation": False,
        "validation_rules": ["rule-a"],
        "allowlist": [],
        "denylist": [],
    }
    result = a.update_record("policy", "policy", new_policy)
    assert result.data["version"] == "2.0"
    assert result.data["human_escalation"] is False
    on_disk = json.loads((eco_dir / "policy.json").read_text(encoding="utf-8"))
    assert on_disk["version"] == "2.0"
    assert on_disk["validation_rules"] == ["rule-a"]


def test_update_record_creates_eco_dir_if_missing(workspace: Path) -> None:
    a = EcoAdapter(workspace_id=str(workspace))
    policy = {
        "version": "1.0",
        "human_escalation": True,
        "validation_rules": [],
        "allowlist": [],
        "denylist": [],
    }
    a.update_record("policy", "policy", policy)
    assert (workspace / ".eco" / "policy.json").exists()


# ---------------------------------------------------------------------------
# delete_record() / restore_record()
# ---------------------------------------------------------------------------

def _write_artifact(artifacts_dir: Path, name: str, content: str = "data") -> Path:
    path = artifacts_dir / name
    path.write_text(content, encoding="utf-8")
    return path


def test_delete_record_wrong_type_raises(full_workspace: Path) -> None:
    a = EcoAdapter(workspace_id=str(full_workspace))
    with pytest.raises(WriteNotSupportedError):
        a.delete_record("run", "some-run")


def test_delete_record_missing_artifact_raises(full_workspace: Path) -> None:
    a = EcoAdapter(workspace_id=str(full_workspace))
    with pytest.raises(RecordNotFoundError):
        a.delete_record("artifact", "does-not-exist.txt")


def test_delete_record_moves_file_to_trash(full_workspace: Path, artifacts_dir: Path, eco_dir: Path) -> None:
    artifact = _write_artifact(artifacts_dir, "report.txt")
    a = EcoAdapter(workspace_id=str(full_workspace))
    result = a.delete_record("artifact", str(artifact))

    assert not artifact.exists()
    trash_path = Path(result.data["trash_path"])
    assert trash_path.exists()
    assert trash_path.parent == eco_dir / ".trash" / "artifacts"
    assert result.data["original_path"] == str(artifact)


def test_delete_record_accepts_relative_path(full_workspace: Path, artifacts_dir: Path) -> None:
    _write_artifact(artifacts_dir, "report.txt")
    a = EcoAdapter(workspace_id=str(full_workspace))
    result = a.delete_record("artifact", "report.txt")
    assert Path(result.data["trash_path"]).exists()


def test_delete_record_collision_gets_suffixed_name(full_workspace: Path, artifacts_dir: Path, eco_dir: Path) -> None:
    a = EcoAdapter(workspace_id=str(full_workspace))
    trash_dir = eco_dir / ".trash" / "artifacts"
    trash_dir.mkdir(parents=True)
    (trash_dir / "report.txt").write_text("already here", encoding="utf-8")

    artifact = _write_artifact(artifacts_dir, "report.txt", "new content")
    result = a.delete_record("artifact", str(artifact))

    trash_path = Path(result.data["trash_path"])
    assert trash_path.name == "report-1.txt"
    assert trash_path.read_text(encoding="utf-8") == "new content"


def test_delete_record_rejects_path_outside_artifacts_root(full_workspace: Path, eco_dir: Path) -> None:
    outside = eco_dir / "policy.json"
    outside.write_text("{}", encoding="utf-8")
    a = EcoAdapter(workspace_id=str(full_workspace))
    with pytest.raises(ValidationError):
        a.delete_record("artifact", str(outside))


def test_restore_record_wrong_type_raises(full_workspace: Path) -> None:
    a = EcoAdapter(workspace_id=str(full_workspace))
    with pytest.raises(WriteNotSupportedError):
        a.restore_record("run", "some-run", "trash-ref")


def test_restore_record_missing_trash_entry_raises(full_workspace: Path, artifacts_dir: Path) -> None:
    a = EcoAdapter(workspace_id=str(full_workspace))
    with pytest.raises(RecordNotFoundError):
        a.restore_record("artifact", str(artifacts_dir / "report.txt"), "never-deleted.txt")


def test_restore_record_moves_file_back(full_workspace: Path, artifacts_dir: Path) -> None:
    artifact = _write_artifact(artifacts_dir, "report.txt")
    a = EcoAdapter(workspace_id=str(full_workspace))
    deleted = a.delete_record("artifact", str(artifact))

    restored = a.restore_record(
        "artifact", deleted.data["original_path"], deleted.data["trash_path"]
    )

    assert artifact.exists()
    assert artifact.read_text(encoding="utf-8") == "data"
    assert restored.data["restored_path"] == str(artifact)
    assert not Path(deleted.data["trash_path"]).exists()


def test_restore_record_refuses_when_original_path_occupied(full_workspace: Path, artifacts_dir: Path) -> None:
    artifact = _write_artifact(artifacts_dir, "report.txt")
    a = EcoAdapter(workspace_id=str(full_workspace))
    deleted = a.delete_record("artifact", str(artifact))
    _write_artifact(artifacts_dir, "report.txt", "someone recreated this")

    with pytest.raises(ValidationError):
        a.restore_record("artifact", deleted.data["original_path"], deleted.data["trash_path"])


def test_restore_record_rejects_trash_ref_outside_trash_root(full_workspace: Path, artifacts_dir: Path, eco_dir: Path) -> None:
    outside = eco_dir / "policy.json"
    outside.write_text("{}", encoding="utf-8")
    a = EcoAdapter(workspace_id=str(full_workspace))
    with pytest.raises(ValidationError):
        a.restore_record("artifact", str(artifacts_dir / "report.txt"), str(outside))


def test_delete_then_restore_round_trip_preserves_content(full_workspace: Path, artifacts_dir: Path) -> None:
    artifact = _write_artifact(artifacts_dir, "notes.md", "important content")
    a = EcoAdapter(workspace_id=str(full_workspace))
    deleted = a.delete_record("artifact", str(artifact))
    a.restore_record("artifact", deleted.data["original_path"], deleted.data["trash_path"])
    assert artifact.read_text(encoding="utf-8") == "important content"


# ---------------------------------------------------------------------------
# Provenance
# ---------------------------------------------------------------------------

def test_origin_on_all_read_methods(full_workspace: Path, runs_dir: Path, artifacts_dir: Path, eco_dir: Path) -> None:
    _write_run(runs_dir, "r1", "COMPLETE")
    (artifacts_dir / "f.txt").write_text("x", encoding="utf-8")
    _write_policy(eco_dir)
    a = EcoAdapter(workspace_id=str(full_workspace), node_id=None)

    for result in [
        a.health(),
        a.get_state(),
        a.list_records("run"),
        a.list_records("artifact"),
        a.list_records("policy"),
        a.get_record("run", "r1"),
        a.get_record("policy", "policy"),
    ]:
        assert result.origin.backend == "eco"
        assert result.origin.workspace_id == str(full_workspace)
        assert result.origin.node_id is None
        assert result.origin.timestamp


def test_node_id_flows_to_origin(full_workspace: Path) -> None:
    a = EcoAdapter(workspace_id=str(full_workspace), node_id="node-42")
    assert a.health().origin.node_id == "node-42"
