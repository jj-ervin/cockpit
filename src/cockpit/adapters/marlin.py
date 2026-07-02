"""Marlin adapter — reads installed packages and install readiness.

Read-only. Write operations (install, update, remove) require the Marlin CLI
and must not be performed here. Callers that need to install a package should
build the appropriate `marlin install <name>` CLI invocation themselves.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

try:
    import yaml as _yaml
    _YAML_AVAILABLE = True
except ImportError:
    _yaml = None  # type: ignore[assignment]
    _YAML_AVAILABLE = False

from cockpit.core.adapter import (
    AdapterResult,
    CockpitAdapter,
    RecordNotFoundError,
    ValidationError,
    WriteNotSupportedError,
)
from cockpit.install_phase1 import build_steps


def _default_marlin_home() -> Path:
    appdata = os.environ.get("APPDATA")
    if appdata:
        return Path(appdata) / "marlin"
    return Path.home() / ".marlin"


class MarlinAdapter(CockpitAdapter):
    """Cockpit adapter for the Marlin package manager.

    workspace_id is the path to the Marlin home directory.
    Defaults to %APPDATA%/marlin on Windows, ~/.marlin elsewhere.

    node_id is always None — Marlin is single-node per machine.
    For multi-machine use, instantiate one MarlinAdapter per machine
    and aggregate at the host layer.
    """

    BACKEND_ID = "marlin"
    RECORD_TYPES = frozenset({"package", "install-readiness"})

    def __init__(
        self,
        workspace_id: str | None = None,
        node_id: str | None = None,
    ) -> None:
        home = Path(workspace_id) if workspace_id else _default_marlin_home()
        super().__init__(str(home), node_id)
        self._home = home
        self._state_path = home / "state.yaml"

    @property
    def backend_id(self) -> str:
        return self.BACKEND_ID

    # ---------------------------------------------------------------------------
    # Health
    # ---------------------------------------------------------------------------

    def health(self) -> AdapterResult[dict[str, Any]]:
        reachable = self._home.exists()
        state_present = self._state_path.exists()
        status = "ok" if (reachable and state_present and _YAML_AVAILABLE) else "degraded"
        return AdapterResult(
            data={
                "reachable": reachable,
                "marlin_home": str(self._home),
                "state_present": state_present,
                "yaml_parser_available": _YAML_AVAILABLE,
                "status": status,
            },
            origin=self._origin(),
        )

    # ---------------------------------------------------------------------------
    # State snapshot
    # ---------------------------------------------------------------------------

    def get_state(self) -> AdapterResult[dict[str, Any]]:
        packages = self._load_packages()
        timestamps = [p["installed_at"] for p in packages if p.get("installed_at")]
        return AdapterResult(
            data={
                "installed_package_count": len(packages),
                "last_installed_at": max(timestamps) if timestamps else None,
                "marlin_home": str(self._home),
                "packages": [p["name"] for p in packages if "name" in p],
                "install_readiness_available": True,
            },
            origin=self._origin(),
        )

    # ---------------------------------------------------------------------------
    # Record access
    # ---------------------------------------------------------------------------

    def list_records(
        self,
        record_type: str,
        **filters: Any,
    ) -> AdapterResult[list[dict[str, Any]]]:
        _assert_record_type(record_type, self.RECORD_TYPES)
        if record_type == "install-readiness":
            return AdapterResult(
                data=[_build_install_readiness(filters)],
                origin=self._origin(),
            )
        return AdapterResult(data=self._load_packages(), origin=self._origin())

    def get_record(
        self,
        record_type: str,
        record_id: str,
    ) -> AdapterResult[dict[str, Any]]:
        _assert_record_type(record_type, self.RECORD_TYPES)
        if record_type == "install-readiness":
            if record_id != "phase1":
                raise RecordNotFoundError(f"install readiness '{record_id}' does not exist")
            return AdapterResult(data=_build_install_readiness({}), origin=self._origin())
        for pkg in self._load_packages():
            if pkg.get("name") == record_id:
                return AdapterResult(data=pkg, origin=self._origin())
        raise RecordNotFoundError(f"package '{record_id}' is not installed")

    # ---------------------------------------------------------------------------
    # Write operations — not supported; callers must use the Marlin CLI
    # ---------------------------------------------------------------------------

    def submit(self, record_type: str, payload: dict[str, Any]) -> AdapterResult[dict[str, Any]]:
        raise WriteNotSupportedError(
            "marlin adapter is read-only; use `marlin install <name>` to install packages"
        )

    def approve(self, record_id: str, decision: str, reason: str | None = None) -> AdapterResult[dict[str, Any]]:
        raise WriteNotSupportedError("marlin adapter does not support approve")

    def update_record(self, record_type: str, record_id: str, payload: dict[str, Any]) -> AdapterResult[dict[str, Any]]:
        raise WriteNotSupportedError("marlin adapter is read-only")

    # ---------------------------------------------------------------------------
    # Private helpers
    # ---------------------------------------------------------------------------

    def _load_packages(self) -> list[dict[str, Any]]:
        if not self._state_path.exists() or not _YAML_AVAILABLE:
            return []
        try:
            raw = _yaml.safe_load(self._state_path.read_text(encoding="utf-8")) or {}
        except Exception:
            return []
        packages_map = raw.get("packages") or {}
        if not isinstance(packages_map, dict):
            return []
        return [
            {"name": name, **entry}
            for name, entry in packages_map.items()
            if isinstance(entry, dict)
        ]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _assert_record_type(record_type: str, valid: frozenset[str]) -> None:
    if record_type not in valid:
        raise ValidationError(
            f"unknown record type '{record_type}' for marlin adapter; "
            f"valid types: {sorted(valid)}"
        )


def _build_install_readiness(filters: dict[str, Any]) -> dict[str, Any]:
    _reject_apply_request(filters)
    project_root = _path_filter(filters, "project_root", _default_project_root())
    workspace = _path_filter(filters, "workspace", _default_eco_workspace(project_root))
    python = _string_filter(filters, "python", "python")
    include_tests = _bool_filter(filters, "include_tests", True)
    include_bridge = _bool_filter(filters, "include_bridge", True)

    steps = build_steps(
        project_root=project_root,
        workspace=workspace,
        python=python,
        include_tests=include_tests,
        include_bridge=include_bridge,
    )
    preview_steps = [
        {
            "name": step.name,
            "command": step.command,
            "cwd": step.cwd,
            "skipped": True,
        }
        for step in steps
    ]
    apply_command = [
        python,
        "-m",
        "cockpit.install_phase1",
        "--project-root",
        str(project_root),
        "--workspace",
        str(workspace),
        "--apply",
        "--json",
    ]
    if not include_tests:
        apply_command.append("--skip-tests")
    if not include_bridge:
        apply_command.append("--skip-bridge")

    return {
        "id": "phase1",
        "panel": "marlin-governance",
        "kind": "cockpit-phase1-install",
        "mode": "preview",
        "status": "ready",
        "project_root": str(project_root),
        "workspace": str(workspace),
        "requires_human_apply": True,
        "mutation_allowed_from_bridge": False,
        "preview_steps": preview_steps,
        "apply_command": apply_command,
    }


def _reject_apply_request(filters: dict[str, Any]) -> None:
    if filters.get("apply") is True or filters.get("mode") == "apply":
        raise ValidationError(
            "install-readiness is read-only; run the returned apply_command only after human approval"
        )


def _default_project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _default_eco_workspace(project_root: Path) -> Path:
    sibling = project_root.parent / "eco"
    if sibling.exists():
        return sibling
    return project_root


def _path_filter(filters: dict[str, Any], key: str, default: Path) -> Path:
    value = filters.get(key)
    if value is None or value == "":
        return default.resolve()
    if not isinstance(value, str):
        raise ValidationError(f"{key} must be a string path")
    return Path(value).resolve()


def _string_filter(filters: dict[str, Any], key: str, default: str) -> str:
    value = filters.get(key)
    if value is None or value == "":
        return default
    if not isinstance(value, str):
        raise ValidationError(f"{key} must be a string")
    return value


def _bool_filter(filters: dict[str, Any], key: str, default: bool) -> bool:
    value = filters.get(key)
    if value is None:
        return default
    if not isinstance(value, bool):
        raise ValidationError(f"{key} must be a boolean")
    return value
