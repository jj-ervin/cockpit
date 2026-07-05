"""Tests for MarlinAdapter."""

from __future__ import annotations

import yaml
from pathlib import Path

import pytest

from cockpit.adapters.marlin import MarlinAdapter
from cockpit.core.adapter import RecordNotFoundError, ValidationError, WriteNotSupportedError


@pytest.fixture()
def marlin_home(tmp_path: Path) -> Path:
    return tmp_path / "marlin"


@pytest.fixture()
def populated_home(marlin_home: Path) -> Path:
    marlin_home.mkdir()
    state = {
        "version": "1",
        "packages": {
            "niji": {
                "name": "niji",
                "version": "1.0.0",
                "platform": "windows",
                "installed_at": "2026-07-01T08:46:45.828Z",
                "install_dir": str(marlin_home / "apps" / "niji" / "1.0.0"),
                "bins": ["niji"],
            },
            "widget": {
                "name": "widget",
                "version": "0.2.1",
                "platform": "windows",
                "installed_at": "2026-06-15T10:00:00.000Z",
                "install_dir": str(marlin_home / "apps" / "widget" / "0.2.1"),
                "bins": ["widget"],
            },
        },
    }
    (marlin_home / "state.yaml").write_text(yaml.dump(state), encoding="utf-8")
    return marlin_home


# ---------------------------------------------------------------------------
# health()
# ---------------------------------------------------------------------------

def test_health_ok(populated_home: Path) -> None:
    adapter = MarlinAdapter(workspace_id=str(populated_home))
    result = adapter.health()
    assert result.data["status"] == "ok"
    assert result.data["reachable"] is True
    assert result.data["state_present"] is True
    assert result.origin.backend == "marlin"


def test_health_degraded_missing_home(marlin_home: Path) -> None:
    adapter = MarlinAdapter(workspace_id=str(marlin_home))
    result = adapter.health()
    assert result.data["status"] == "degraded"
    assert result.data["reachable"] is False


def test_health_degraded_missing_state(marlin_home: Path) -> None:
    marlin_home.mkdir()
    adapter = MarlinAdapter(workspace_id=str(marlin_home))
    result = adapter.health()
    assert result.data["status"] == "degraded"
    assert result.data["state_present"] is False


# ---------------------------------------------------------------------------
# get_state()
# ---------------------------------------------------------------------------

def test_get_state_counts_packages(populated_home: Path) -> None:
    adapter = MarlinAdapter(workspace_id=str(populated_home))
    result = adapter.get_state()
    assert result.data["installed_package_count"] == 2
    assert set(result.data["packages"]) == {"niji", "widget"}


def test_get_state_last_installed(populated_home: Path) -> None:
    adapter = MarlinAdapter(workspace_id=str(populated_home))
    result = adapter.get_state()
    assert result.data["last_installed_at"] == "2026-07-01T08:46:45.828Z"


def test_get_state_empty(marlin_home: Path) -> None:
    marlin_home.mkdir()
    adapter = MarlinAdapter(workspace_id=str(marlin_home))
    result = adapter.get_state()
    assert result.data["installed_package_count"] == 0
    assert result.data["packages"] == []
    assert result.data["last_installed_at"] is None


# ---------------------------------------------------------------------------
# list_records()
# ---------------------------------------------------------------------------

def test_list_records_packages(populated_home: Path) -> None:
    adapter = MarlinAdapter(workspace_id=str(populated_home))
    result = adapter.list_records("package")
    assert len(result.data) == 2
    names = {p["name"] for p in result.data}
    assert names == {"niji", "widget"}


def test_list_records_unknown_type(populated_home: Path) -> None:
    adapter = MarlinAdapter(workspace_id=str(populated_home))
    with pytest.raises(ValidationError, match="unknown record type"):
        adapter.list_records("run")


def test_list_records_install_readiness_preview(populated_home: Path, tmp_path: Path) -> None:
    project_root = tmp_path / "cockpit"
    workspace = tmp_path / "eco"
    project_root.mkdir()
    workspace.mkdir()
    adapter = MarlinAdapter(workspace_id=str(populated_home))

    result = adapter.list_records(
        "install-readiness",
        project_root=str(project_root),
        workspace=str(workspace),
        python="python",
    )

    readiness = result.data[0]
    assert readiness["id"] == "phase1"
    assert readiness["panel"] == "marlin-governance"
    assert readiness["mode"] == "preview"
    assert readiness["requires_human_apply"] is True
    assert readiness["mutation_allowed_from_bridge"] is False
    assert [step["name"] for step in readiness["preview_steps"]] == [
        "install",
        "pytest",
        "bridge-smoke",
    ]
    assert "--apply" in readiness["apply_command"]
    assert str(project_root.resolve()) in readiness["apply_command"]
    assert str(workspace.resolve()) in readiness["apply_command"]


def test_list_records_workspace_tree_is_bounded_and_skips_heavy_dirs(populated_home: Path, tmp_path: Path) -> None:
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    (workspace / "src").mkdir()
    (workspace / "src" / "app.py").write_text("print('hi')", encoding="utf-8")
    (workspace / "node_modules").mkdir()
    (workspace / "node_modules" / "pkg.js").write_text("ignored", encoding="utf-8")
    adapter = MarlinAdapter(workspace_id=str(populated_home))

    result = adapter.list_records(
        "workspace-tree",
        workspace_root=str(workspace),
        max_depth=2,
        max_items=20,
    )

    tree = result.data[0]
    paths = {node["path"] for node in tree["nodes"]}
    assert "." in paths
    assert "src" in paths
    assert "src/app.py" in paths
    assert "node_modules" in paths
    assert "node_modules/pkg.js" not in paths
    skipped = [node for node in tree["nodes"] if node["path"] == "node_modules"][0]
    assert skipped["skipped"] is True
    assert tree["max_depth"] == 2
    assert tree["max_items"] == 20


def test_workspace_tree_rejects_path_escape(populated_home: Path, tmp_path: Path) -> None:
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    adapter = MarlinAdapter(workspace_id=str(populated_home))

    with pytest.raises(ValidationError, match="outside the workspace root"):
        adapter.get_record("repo-status", "../outside")


def test_list_records_repo_status_reports_git_and_registry(populated_home: Path, tmp_path: Path) -> None:
    workspace = tmp_path / "workspace"
    repo = workspace / "cockpit"
    repo.mkdir(parents=True)
    (repo / ".git").mkdir()
    (workspace / "projects.yaml").write_text(
        "\n".join([
            "projects:",
            "  - name: cockpit",
            "    path: cockpit",
            "    group: ui",
            "    status: active",
            "",
        ]),
        encoding="utf-8",
    )
    adapter = MarlinAdapter(workspace_id=str(populated_home))

    result = adapter.list_records("repo-status", workspace_root=str(workspace))

    status = result.data[0]
    assert status["path"] == "cockpit"
    assert status["has_git"] is True
    assert status["git"]["present"] is True
    assert status["registry"]["name"] == "cockpit"


def test_install_readiness_rejects_apply_filter(populated_home: Path) -> None:
    adapter = MarlinAdapter(workspace_id=str(populated_home))

    with pytest.raises(ValidationError, match="read-only"):
        adapter.list_records("install-readiness", apply=True)


def test_install_readiness_can_preview_without_tests(populated_home: Path, tmp_path: Path) -> None:
    project_root = tmp_path / "cockpit"
    workspace = tmp_path / "eco"
    project_root.mkdir()
    workspace.mkdir()
    adapter = MarlinAdapter(workspace_id=str(populated_home))

    result = adapter.list_records(
        "install-readiness",
        project_root=str(project_root),
        workspace=str(workspace),
        include_tests=False,
    )

    readiness = result.data[0]
    assert [step["name"] for step in readiness["preview_steps"]] == [
        "install",
        "bridge-smoke",
    ]
    assert "--skip-tests" in readiness["apply_command"]


# ---------------------------------------------------------------------------
# get_record()
# ---------------------------------------------------------------------------

def test_get_record_found(populated_home: Path) -> None:
    adapter = MarlinAdapter(workspace_id=str(populated_home))
    result = adapter.get_record("package", "niji")
    assert result.data["name"] == "niji"
    assert result.data["version"] == "1.0.0"


def test_get_record_not_found(populated_home: Path) -> None:
    adapter = MarlinAdapter(workspace_id=str(populated_home))
    with pytest.raises(RecordNotFoundError, match="not installed"):
        adapter.get_record("package", "does-not-exist")


def test_get_record_install_readiness(populated_home: Path) -> None:
    adapter = MarlinAdapter(workspace_id=str(populated_home))
    result = adapter.get_record("install-readiness", "phase1")
    assert result.data["id"] == "phase1"
    assert result.data["requires_human_apply"] is True


def test_get_record_install_readiness_not_found(populated_home: Path) -> None:
    adapter = MarlinAdapter(workspace_id=str(populated_home))
    with pytest.raises(RecordNotFoundError, match="does not exist"):
        adapter.get_record("install-readiness", "unknown")


# ---------------------------------------------------------------------------
# Write operations — all must raise WriteNotSupportedError
# ---------------------------------------------------------------------------

def test_submit_raises(populated_home: Path) -> None:
    adapter = MarlinAdapter(workspace_id=str(populated_home))
    with pytest.raises(WriteNotSupportedError):
        adapter.submit("package", {"name": "new-pkg"})


def test_approve_raises(populated_home: Path) -> None:
    adapter = MarlinAdapter(workspace_id=str(populated_home))
    with pytest.raises(WriteNotSupportedError):
        adapter.approve("niji", "approved")


def test_update_record_raises(populated_home: Path) -> None:
    adapter = MarlinAdapter(workspace_id=str(populated_home))
    with pytest.raises(WriteNotSupportedError):
        adapter.update_record("package", "niji", {"version": "2.0.0"})


# ---------------------------------------------------------------------------
# Provenance
# ---------------------------------------------------------------------------

def test_origin_provenance(populated_home: Path) -> None:
    adapter = MarlinAdapter(workspace_id=str(populated_home))
    result = adapter.get_state()
    assert result.origin.backend == "marlin"
    assert result.origin.workspace_id == str(populated_home)
    assert result.origin.node_id is None
    assert result.origin.timestamp  # non-empty ISO string
