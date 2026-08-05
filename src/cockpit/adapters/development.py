"""Cockpit-native development installation readiness adapter."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from cockpit.core.adapter import AdapterResult, CockpitAdapter, RecordNotFoundError, ValidationError
from cockpit.install_phase1 import build_steps


class CockpitDevelopmentAdapter(CockpitAdapter):
    BACKEND_ID = "cockpit"
    REQUIRES_WORKSPACE_ID = False
    RECORD_TYPES = frozenset({"development-readiness"})

    def __init__(self, workspace_id: str | None = None, node_id: str | None = None) -> None:
        super().__init__(workspace_id or "", node_id)

    @property
    def backend_id(self) -> str:
        return self.BACKEND_ID

    def health(self) -> AdapterResult[dict[str, Any]]:
        root = _project_root({})
        reachable = (root / "pyproject.toml").exists()
        return AdapterResult(data={"reachable": reachable, "project_root": str(root), "status": "ok" if reachable else "degraded"}, origin=self._origin())

    def get_state(self) -> AdapterResult[dict[str, Any]]:
        return AdapterResult(data={"development_readiness_available": True}, origin=self._origin())

    def list_records(self, record_type: str, **filters: Any) -> AdapterResult[list[dict[str, Any]]]:
        _assert_type(record_type)
        return AdapterResult(data=[_build_readiness(filters)], origin=self._origin())

    def get_record(self, record_type: str, record_id: str) -> AdapterResult[dict[str, Any]]:
        _assert_type(record_type)
        if record_id != "phase1":
            raise RecordNotFoundError(f"development readiness '{record_id}' does not exist")
        return AdapterResult(data=_build_readiness({}), origin=self._origin())


def _assert_type(record_type: str) -> None:
    if record_type != "development-readiness":
        raise ValidationError("unknown record type for cockpit adapter; valid types: ['development-readiness']")


def _build_readiness(filters: dict[str, Any]) -> dict[str, Any]:
    if filters.get("apply") is True or filters.get("mode") == "apply":
        raise ValidationError("development-readiness is read-only; run apply_command only after human approval")
    project_root = _project_root(filters)
    sibling_workspace = project_root.parent / "eco"
    workspace = _path(filters, "workspace", sibling_workspace if sibling_workspace.exists() else project_root)
    python = filters.get("python", "python")
    if not isinstance(python, str):
        raise ValidationError("python must be a string")
    include_tests = _bool(filters, "include_tests", True)
    include_bridge = _bool(filters, "include_bridge", True)
    steps = build_steps(
        project_root=project_root, workspace=workspace, python=python,
        include_tests=include_tests, include_bridge=include_bridge,
    )
    apply_command = [python, "-m", "cockpit.install_phase1", "--project-root", str(project_root), "--workspace", str(workspace), "--apply", "--json"]
    if not include_tests:
        apply_command.append("--skip-tests")
    if not include_bridge:
        apply_command.append("--skip-bridge")
    return {
        "id": "phase1", "panel": "cockpit-development", "kind": "cockpit-development-install",
        "mode": "preview", "status": "ready", "project_root": str(project_root),
        "workspace": str(workspace), "requires_human_apply": True,
        "mutation_allowed_from_bridge": False,
        "preview_steps": [{"name": step.name, "command": step.command, "cwd": step.cwd, "skipped": True} for step in steps],
        "apply_command": apply_command,
    }


def _project_root(filters: dict[str, Any]) -> Path:
    return _path(filters, "project_root", Path(__file__).resolve().parents[3])


def _path(filters: dict[str, Any], key: str, default: Path) -> Path:
    value = filters.get(key)
    if value in (None, ""):
        return default.resolve()
    if not isinstance(value, str):
        raise ValidationError(f"{key} must be a string path")
    return Path(value).resolve()


def _bool(filters: dict[str, Any], key: str, default: bool) -> bool:
    value = filters.get(key, default)
    if not isinstance(value, bool):
        raise ValidationError(f"{key} must be a boolean")
    return value
