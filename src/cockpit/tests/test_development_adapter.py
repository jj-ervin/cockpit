from pathlib import Path

import pytest

from cockpit.adapters.development import CockpitDevelopmentAdapter
from cockpit.core.adapter import ValidationError


def test_readiness_is_cockpit_owned_and_preview_only(tmp_path: Path) -> None:
    project = tmp_path / "cockpit"
    workspace = tmp_path / "eco"
    project.mkdir()
    workspace.mkdir()
    result = CockpitDevelopmentAdapter().list_records(
        "development-readiness", project_root=str(project), workspace=str(workspace), python="python"
    )
    readiness = result.data[0]
    assert readiness["panel"] == "cockpit-development"
    assert readiness["kind"] == "cockpit-development-install"
    assert readiness["mutation_allowed_from_bridge"] is False
    assert result.origin.backend == "cockpit"


def test_readiness_rejects_apply() -> None:
    with pytest.raises(ValidationError, match="read-only"):
        CockpitDevelopmentAdapter().list_records("development-readiness", apply=True)


def test_readiness_preserves_optional_test_and_bridge_steps(tmp_path: Path) -> None:
    project = tmp_path / "cockpit"
    project.mkdir()
    readiness = CockpitDevelopmentAdapter().list_records(
        "development-readiness", project_root=str(project), include_tests=False, include_bridge=False
    ).data[0]
    assert [step["name"] for step in readiness["preview_steps"]] == ["install"]
    assert "--skip-tests" in readiness["apply_command"]
    assert "--skip-bridge" in readiness["apply_command"]
