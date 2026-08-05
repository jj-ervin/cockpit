"""Cockpit-native workspace tree and repository status adapter."""

from __future__ import annotations

import os
import subprocess
from pathlib import Path
from typing import Any

try:
    import yaml as _yaml
except ImportError:
    _yaml = None  # type: ignore[assignment]

from cockpit.core.adapter import (
    AdapterResult,
    CockpitAdapter,
    RecordNotFoundError,
    ValidationError,
)


class WorkspaceAdapter(CockpitAdapter):
    """Read-only local workspace inventory independent of any provider."""

    BACKEND_ID = "workspace"
    RECORD_TYPES = frozenset({"workspace-tree", "repo-status"})
    SKIP_DIRS = frozenset({
        ".git", "node_modules", ".venv", "dist", "build", "__pycache__",
        ".pytest_cache", ".mypy_cache", ".ruff_cache", "coverage", ".next",
        "out", "target",
    })

    def __init__(self, workspace_id: str, node_id: str | None = None) -> None:
        root = _local_root(Path(workspace_id))
        super().__init__(str(root), node_id)
        self._root = root

    @property
    def backend_id(self) -> str:
        return self.BACKEND_ID

    def health(self) -> AdapterResult[dict[str, Any]]:
        reachable = self._root.is_dir()
        return AdapterResult(
            data={"reachable": reachable, "workspace_root": str(self._root), "status": "ok" if reachable else "degraded"},
            origin=self._origin(),
        )

    def get_state(self) -> AdapterResult[dict[str, Any]]:
        repos = self._list_repo_status({"max_items": 200})
        return AdapterResult(
            data={"workspace_root": str(self._root), "repository_count": sum(1 for item in repos if item["has_git"])},
            origin=self._origin(),
        )

    def list_records(self, record_type: str, **filters: Any) -> AdapterResult[list[dict[str, Any]]]:
        self._assert_type(record_type)
        if record_type == "workspace-tree":
            return AdapterResult(data=[self._build_tree(filters)], origin=self._origin())
        return AdapterResult(data=self._list_repo_status(filters), origin=self._origin())

    def get_record(self, record_type: str, record_id: str) -> AdapterResult[dict[str, Any]]:
        self._assert_type(record_type)
        if record_type == "workspace-tree":
            if record_id != "root":
                raise RecordNotFoundError(f"workspace tree '{record_id}' does not exist")
            return AdapterResult(data=self._build_tree({}), origin=self._origin())
        return AdapterResult(data=self._repo_status(record_id), origin=self._origin())

    def _assert_type(self, record_type: str) -> None:
        if record_type not in self.RECORD_TYPES:
            raise ValidationError(f"unknown record type '{record_type}' for workspace adapter; valid types: {sorted(self.RECORD_TYPES)}")

    def _build_tree(self, filters: dict[str, Any]) -> dict[str, Any]:
        max_depth = _int_filter(filters, "max_depth", 3, 0, 8)
        max_items = _int_filter(filters, "max_items", 500, 1, 5000)
        nodes: list[dict[str, Any]] = []
        truncated = False

        def visit(path: Path, depth: int) -> None:
            nonlocal truncated
            if len(nodes) >= max_items:
                truncated = True
                return
            relative = path.relative_to(self._root).as_posix()
            is_dir = path.is_dir()
            skipped = is_dir and path.name in self.SKIP_DIRS
            nodes.append({
                "id": relative or ".", "name": path.name or str(path),
                "path": relative or ".", "kind": "directory" if is_dir else "file",
                "depth": depth, "skipped": skipped,
            })
            if not is_dir or skipped or depth >= max_depth:
                return
            try:
                children = sorted(path.iterdir(), key=lambda item: (not item.is_dir(), item.name.lower()))
            except OSError:
                return
            for child in children:
                try:
                    contained = _contained(self._root, child)
                except ValidationError:
                    continue
                visit(contained, depth + 1)

        visit(self._root, 0)
        return {
            "id": "root", "root": str(self._root), "max_depth": max_depth,
            "max_items": max_items, "truncated": truncated,
            "skip_dirs": sorted(self.SKIP_DIRS), "nodes": nodes,
        }

    def _list_repo_status(self, filters: dict[str, Any]) -> list[dict[str, Any]]:
        max_items = _int_filter(filters, "max_items", 200, 1, 1000)
        try:
            children = sorted((item for item in self._root.iterdir() if item.is_dir()), key=lambda item: item.name.lower())
        except OSError:
            return []
        return [self._repo_status(item.relative_to(self._root).as_posix()) for item in children[:max_items]]

    def _repo_status(self, record_id: str) -> dict[str, Any]:
        repo = _contained(self._root, record_id)
        if not repo.is_dir():
            raise RecordNotFoundError(f"repo path '{record_id}' does not exist")
        relative = repo.relative_to(self._root).as_posix() or "."
        return {
            "id": relative, "name": repo.name, "path": relative,
            "absolute_path": str(repo), "exists": True,
            "has_git": (repo / ".git").exists(), "git": _git_status(repo),
            "registry": _registry_match(self._root, relative),
        }


def _local_root(path: Path) -> Path:
    resolved = path.resolve()
    if str(resolved).startswith(("\\\\", "//")):
        raise ValidationError("workspace root must be a local path, not a UNC path")
    return resolved


def _contained(root: Path, requested: str | Path) -> Path:
    raw = Path(requested)
    if str(raw).startswith(("\\\\", "//")):
        raise ValidationError("UNC paths are not allowed")
    candidate = (raw if raw.is_absolute() else root / raw).resolve()
    try:
        common = os.path.commonpath([os.path.normcase(str(root)), os.path.normcase(str(candidate))])
    except ValueError as exc:
        raise ValidationError("path is outside the workspace root") from exc
    if common != os.path.normcase(str(root)):
        raise ValidationError("path is outside the workspace root")
    return candidate


def _int_filter(filters: dict[str, Any], key: str, default: int, minimum: int, maximum: int) -> int:
    value = filters.get(key, default)
    if not isinstance(value, int) or isinstance(value, bool) or not minimum <= value <= maximum:
        raise ValidationError(f"{key} must be an integer between {minimum} and {maximum}")
    return value


def _git_status(repo: Path) -> dict[str, Any]:
    if not (repo / ".git").exists():
        return {"present": False, "branch": None, "dirty": None}
    try:
        completed = subprocess.run(
            ["git", "status", "--porcelain=v1", "--branch"], cwd=repo,
            text=True, capture_output=True, timeout=5, check=False,
        )
    except Exception as exc:
        return {"present": True, "branch": None, "dirty": None, "error": str(exc)}
    lines = completed.stdout.splitlines()
    branch = lines[0][3:] if lines and lines[0].startswith("## ") else None
    return {"present": True, "branch": branch, "dirty": any(line and not line.startswith("## ") for line in lines), "exit_code": completed.returncode}


def _registry_match(root: Path, relative: str) -> dict[str, Any] | None:
    registry = root / "projects.yaml"
    if not registry.exists() or _yaml is None:
        return None
    try:
        projects = (_yaml.safe_load(registry.read_text(encoding="utf-8")) or {}).get("projects", [])
    except Exception:
        return None
    for entry in projects if isinstance(projects, list) else []:
        if isinstance(entry, dict) and entry.get("path") == relative:
            return {key: entry.get(key) for key in ("name", "group", "status", "path")}
    return None
