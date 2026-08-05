from pathlib import Path

import pytest

from cockpit.adapters.workspace import WorkspaceAdapter
from cockpit.core.adapter import ValidationError


def test_workspace_tree_is_bounded_and_skips_heavy_dirs(tmp_path: Path) -> None:
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "app.py").write_text("pass", encoding="utf-8")
    (tmp_path / "node_modules").mkdir()
    (tmp_path / "node_modules" / "ignored.js").write_text("", encoding="utf-8")
    result = WorkspaceAdapter(str(tmp_path)).list_records("workspace-tree", max_depth=2, max_items=20)
    paths = {node["path"] for node in result.data[0]["nodes"]}
    assert {".", "src", "src/app.py", "node_modules"} <= paths
    assert "node_modules/ignored.js" not in paths
    assert result.origin.backend == "workspace"


def test_workspace_status_and_containment(tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    (repo / ".git").mkdir(parents=True)
    result = WorkspaceAdapter(str(tmp_path)).list_records("repo-status")
    assert result.data[0]["path"] == "repo"
    assert result.data[0]["has_git"] is True
    with pytest.raises(ValidationError, match="outside"):
        WorkspaceAdapter(str(tmp_path)).get_record("repo-status", "../outside")
