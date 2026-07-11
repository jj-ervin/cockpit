"""System adapter — runtime/toolchain environment checks.

Not scoped to any workspace's `.eco/` data; this reports on the runtime the
cockpit.host_bridge process itself is executing under (Python interpreter,
the cockpit package, and Node, if reachable). Read-only: there is nothing
here to write.

This is the "environment checks" category CKP.v1.0-scoping.md's Diagnostics
panel item named but never defined a data source for — confirmed by
research that no environment/doctor-style check existed anywhere in this
portfolio before this adapter.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from importlib import metadata
from typing import Any

from cockpit.core.adapter import (
    AdapterResult,
    CockpitAdapter,
    RecordNotFoundError,
    ValidationError,
)


class SystemAdapter(CockpitAdapter):
    """Cockpit adapter for host-runtime environment checks.

    workspace_id/node_id are accepted for provenance/origin consistency
    with every other adapter, but carry no meaning here — there is exactly
    one "system" per running cockpit.host_bridge process.
    """

    BACKEND_ID = "system"
    REQUIRES_WORKSPACE_ID = False  # defaults to the literal "system" when omitted
    RECORD_TYPES = frozenset({"environment"})

    def __init__(self, workspace_id: str | None = None, node_id: str | None = None) -> None:
        super().__init__(workspace_id or "system", node_id)

    @property
    def backend_id(self) -> str:
        return self.BACKEND_ID

    def health(self) -> AdapterResult[dict[str, Any]]:
        env = _check_environment()
        status = "ok" if env["python"]["cockpit_importable"] else "degraded"
        return AdapterResult(
            data={"reachable": True, "status": status},
            origin=self._origin(),
        )

    def get_state(self) -> AdapterResult[dict[str, Any]]:
        return AdapterResult(data=_check_environment(), origin=self._origin())

    def list_records(self, record_type: str, **filters: Any) -> AdapterResult[list[dict[str, Any]]]:
        _assert_record_type(record_type)
        return AdapterResult(data=[_check_environment()], origin=self._origin())

    def get_record(self, record_type: str, record_id: str) -> AdapterResult[dict[str, Any]]:
        _assert_record_type(record_type)
        if record_id != "current":
            raise RecordNotFoundError(f"environment record '{record_id}' does not exist")
        return AdapterResult(data=_check_environment(), origin=self._origin())


def _assert_record_type(record_type: str) -> None:
    if record_type not in SystemAdapter.RECORD_TYPES:
        raise ValidationError(
            f"unknown record type '{record_type}' for system adapter; "
            f"valid types: {sorted(SystemAdapter.RECORD_TYPES)}"
        )


def _check_environment() -> dict[str, Any]:
    return {
        "id": "current",
        "python": _check_python(),
        "node": _check_node(),
    }


def _check_python() -> dict[str, Any]:
    try:
        cockpit_version = metadata.version("cockpit")
    except metadata.PackageNotFoundError:
        cockpit_version = None
    return {
        "executable": sys.executable,
        "version": sys.version.split()[0],
        "cockpit_importable": True,  # this module only runs inside the cockpit package
        "cockpit_version": cockpit_version,
    }


def _check_node() -> dict[str, Any]:
    node_path = shutil.which("node")
    if not node_path:
        return {"available": False, "executable": None, "version": None}
    try:
        completed = subprocess.run(
            [node_path, "--version"],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
    except Exception as exc:  # pragma: no cover - defensive, platform-dependent
        return {"available": False, "executable": node_path, "version": None, "error": str(exc)}
    version = completed.stdout.strip() or None
    return {"available": completed.returncode == 0, "executable": node_path, "version": version}
