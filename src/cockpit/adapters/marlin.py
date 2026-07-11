"""Marlin adapter — reads installed packages and install readiness.

Read-only. Write operations (install, update, remove) require the Marlin CLI
and must not be performed here. Callers that need to install a package should
build the appropriate `marlin install <name>` CLI invocation themselves.
"""

from __future__ import annotations

import os
import subprocess
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
    REQUIRES_WORKSPACE_ID = False  # falls back to _default_marlin_home() when omitted
    RECORD_TYPES = frozenset({"package", "install-readiness", "workspace-tree", "repo-status"})
    WORKSPACE_SKIP_DIRS = frozenset({
        ".git",
        "node_modules",
        ".venv",
        "dist",
        "build",
        "__pycache__",
        ".pytest_cache",
        ".mypy_cache",
        ".ruff_cache",
        "coverage",
        ".next",
        "out",
        "target",
    })
    DEFAULT_TREE_DEPTH = 3
    DEFAULT_TREE_ITEMS = 500

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
        if record_type == "workspace-tree":
            return AdapterResult(
                data=[self._build_workspace_tree(filters)],
                origin=self._origin(),
            )
        if record_type == "repo-status":
            return AdapterResult(
                data=self._list_repo_status(filters),
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
        if record_type == "workspace-tree":
            if record_id != "root":
                raise RecordNotFoundError(f"workspace tree '{record_id}' does not exist")
            return AdapterResult(data=self._build_workspace_tree({}), origin=self._origin())
        if record_type == "repo-status":
            return AdapterResult(
                data=self._repo_status_for_path(_workspace_root_filter({}), record_id),
                origin=self._origin(),
            )
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

    def _build_workspace_tree(self, filters: dict[str, Any]) -> dict[str, Any]:
        root = _workspace_root_filter(filters)
        max_depth = _int_filter(filters, "max_depth", self.DEFAULT_TREE_DEPTH, minimum=0, maximum=8)
        max_items = _int_filter(filters, "max_items", self.DEFAULT_TREE_ITEMS, minimum=1, maximum=5000)
        nodes: list[dict[str, Any]] = []
        truncated = False

        def add_node(path: Path, depth: int) -> None:
            nonlocal truncated
            if len(nodes) >= max_items:
                truncated = True
                return
            relative = _relative_path(root, path)
            is_dir = path.is_dir()
            nodes.append({
                "id": relative or ".",
                "name": path.name or str(path),
                "path": relative or ".",
                "kind": "directory" if is_dir else "file",
                "depth": depth,
                "skipped": is_dir and path.name in self.WORKSPACE_SKIP_DIRS,
            })
            if not is_dir or depth >= max_depth or path.name in self.WORKSPACE_SKIP_DIRS:
                return
            try:
                children = sorted(
                    path.iterdir(),
                    key=lambda p: (not p.is_dir(), p.name.lower()),
                )
            except OSError:
                return
            for child in children:
                if len(nodes) >= max_items:
                    truncated = True
                    return
                try:
                    contained = _resolve_contained_path(root, child)
                except ValidationError:
                    continue
                add_node(contained, depth + 1)

        add_node(root, 0)
        return {
            "id": "root",
            "root": str(root),
            "max_depth": max_depth,
            "max_items": max_items,
            "truncated": truncated,
            "skip_dirs": sorted(self.WORKSPACE_SKIP_DIRS),
            "nodes": nodes,
        }

    def _list_repo_status(self, filters: dict[str, Any]) -> list[dict[str, Any]]:
        root = _workspace_root_filter(filters)
        tree = self._build_workspace_tree({
            "workspace_root": str(root),
            "max_depth": 1,
            "max_items": _int_filter(filters, "max_items", 200, minimum=1, maximum=1000),
        })
        statuses = []
        for node in tree["nodes"]:
            if node["kind"] != "directory" or node["path"] == ".":
                continue
            statuses.append(self._repo_status_for_path(root, node["path"]))
        return statuses

    def _repo_status_for_path(self, root: Path, record_id: str) -> dict[str, Any]:
        repo_path = _resolve_contained_path(root, record_id)
        if not repo_path.is_dir():
            raise RecordNotFoundError(f"repo path '{record_id}' does not exist")
        git = _git_status(repo_path)
        registry = _registry_match(root, repo_path)
        return {
            "id": _relative_path(root, repo_path) or ".",
            "name": repo_path.name,
            "path": _relative_path(root, repo_path) or ".",
            "absolute_path": str(repo_path),
            "exists": repo_path.exists(),
            "has_git": (repo_path / ".git").exists(),
            "git": git,
            "registry": registry,
        }


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


def _workspace_root_filter(filters: dict[str, Any]) -> Path:
    return _contained_root(_path_filter(filters, "workspace_root", Path.cwd()))


def _contained_root(path: Path) -> Path:
    resolved = path.resolve()
    if _is_unc_path(resolved):
        raise ValidationError("workspace_root must be a local path, not a UNC path")
    return resolved


def _resolve_contained_path(root: Path, requested: str | Path) -> Path:
    resolved_root = _contained_root(root)
    raw = Path(requested)
    if _is_unc_path(raw):
        raise ValidationError("UNC paths are not allowed")
    candidate = raw if raw.is_absolute() else resolved_root / raw
    resolved_candidate = candidate.resolve()
    if _is_unc_path(resolved_candidate):
        raise ValidationError("UNC paths are not allowed")
    try:
        common = os.path.commonpath([os.path.normcase(str(resolved_root)), os.path.normcase(str(resolved_candidate))])
    except ValueError as exc:
        raise ValidationError("path is outside the workspace root") from exc
    if common != os.path.normcase(str(resolved_root)):
        raise ValidationError("path is outside the workspace root")
    return resolved_candidate


def _relative_path(root: Path, path: Path) -> str:
    return path.relative_to(root).as_posix()


def _is_unc_path(path: Path) -> bool:
    text = str(path)
    return text.startswith("\\\\") or text.startswith("//")


def _int_filter(
    filters: dict[str, Any],
    key: str,
    default: int,
    *,
    minimum: int,
    maximum: int,
) -> int:
    value = filters.get(key)
    if value is None:
        return default
    if not isinstance(value, int) or isinstance(value, bool):
        raise ValidationError(f"{key} must be an integer")
    if value < minimum or value > maximum:
        raise ValidationError(f"{key} must be between {minimum} and {maximum}")
    return value


def _git_status(repo_path: Path) -> dict[str, Any]:
    if not (repo_path / ".git").exists():
        return {"present": False, "branch": None, "dirty": None}
    try:
        completed = subprocess.run(
            ["git", "status", "--porcelain=v1", "--branch"],
            cwd=repo_path,
            text=True,
            capture_output=True,
            timeout=5,
            check=False,
        )
    except Exception as exc:
        return {"present": True, "branch": None, "dirty": None, "error": str(exc)}
    lines = completed.stdout.splitlines()
    branch = None
    if lines and lines[0].startswith("## "):
        branch = lines[0][3:]
    return {
        "present": True,
        "branch": branch,
        "dirty": any(line and not line.startswith("## ") for line in lines),
        "exit_code": completed.returncode,
    }


def _registry_match(root: Path, repo_path: Path) -> dict[str, Any] | None:
    projects_yaml = root / "projects.yaml"
    if not projects_yaml.exists() or not _YAML_AVAILABLE:
        return None
    try:
        raw = _yaml.safe_load(projects_yaml.read_text(encoding="utf-8")) or {}
    except Exception:
        return None
    projects = raw.get("projects")
    if not isinstance(projects, list):
        return None
    relative = _relative_path(root, repo_path)
    for entry in projects:
        if not isinstance(entry, dict):
            continue
        if entry.get("path") == relative:
            return {
                "name": entry.get("name"),
                "group": entry.get("group"),
                "status": entry.get("status"),
                "path": entry.get("path"),
            }
    return None


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
