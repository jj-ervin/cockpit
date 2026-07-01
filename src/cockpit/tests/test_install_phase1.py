"""Tests for Phase 1 install automation."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

import pytest

from cockpit.install_phase1 import build_steps, run_install


@pytest.fixture()
def project_root(tmp_path: Path) -> Path:
    root = tmp_path / "cockpit"
    (root / "src" / "cockpit").mkdir(parents=True)
    (root / "pyproject.toml").write_text("[project]\nname = \"cockpit\"\n", encoding="utf-8")
    return root


@pytest.fixture()
def workspace(tmp_path: Path) -> Path:
    root = tmp_path / "eco"
    (root / ".eco").mkdir(parents=True)
    return root


def test_build_steps_defaults_to_editable_install(tmp_path: Path) -> None:
    project_root = tmp_path / "cockpit"
    workspace = tmp_path / "eco"

    steps = build_steps(
        project_root=project_root,
        workspace=workspace,
        python="python",
    )

    assert [step.name for step in steps] == ["install", "pytest", "bridge-smoke"]
    assert steps[0].command == ["python", "-m", "pip", "install", "-e", str(project_root)]
    assert steps[1].command == ["python", "-m", "pytest"]
    assert steps[2].command == ["python", "-m", "cockpit.host_bridge"]
    assert json.loads(steps[2].input_text or "{}")["workspace_id"] == str(workspace)


def test_dry_run_returns_skipped_results(project_root: Path, workspace: Path) -> None:
    results = run_install(
        project_root=project_root,
        workspace=workspace,
        python="python",
        dry_run=True,
    )

    assert all(result.skipped for result in results)
    assert all(result.ok for result in results)


def test_run_install_stops_on_failed_step(project_root: Path, workspace: Path) -> None:
    calls: list[list[str]] = []

    def runner(command: list[str], **_: object) -> subprocess.CompletedProcess[str]:
        calls.append(command)
        return subprocess.CompletedProcess(command, 1, "", "pip failed")

    results = run_install(
        project_root=project_root,
        workspace=workspace,
        python="python",
        runner=runner,
    )

    assert len(calls) == 1
    assert results[0].name == "install"
    assert results[0].ok is False


def test_bridge_smoke_requires_ok_health(project_root: Path, workspace: Path) -> None:
    def runner(command: list[str], **_: object) -> subprocess.CompletedProcess[str]:
        if command[-1] == "cockpit.host_bridge":
            stdout = json.dumps({"data": {"status": "degraded"}, "origin": {"backend": "eco"}})
            return subprocess.CompletedProcess(command, 0, stdout, "")
        return subprocess.CompletedProcess(command, 0, "", "")

    results = run_install(
        project_root=project_root,
        workspace=workspace,
        python="python",
        runner=runner,
    )

    assert results[-1].name == "bridge-smoke"
    assert results[-1].ok is False
    assert "expected 'ok'" in results[-1].details["error"]


def test_bridge_smoke_can_allow_degraded_health(project_root: Path, workspace: Path) -> None:
    def runner(command: list[str], **_: object) -> subprocess.CompletedProcess[str]:
        if command[-1] == "cockpit.host_bridge":
            stdout = json.dumps({"data": {"status": "degraded"}, "origin": {"backend": "eco"}})
            return subprocess.CompletedProcess(command, 0, stdout, "")
        return subprocess.CompletedProcess(command, 0, "", "")

    results = run_install(
        project_root=project_root,
        workspace=workspace,
        python="python",
        runner=runner,
        allow_degraded_bridge=True,
    )

    assert all(result.ok for result in results)
