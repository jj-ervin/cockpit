"""Eco backend adapter.

Reads run records, escalation queue, artifact index, and policy
directly from the .eco/ filesystem layout.

Write operations (approve escalation, submit run, update policy)
require a runtime_client. Without one, the adapter is read-only.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from cockpit.core.adapter import (
    AdapterResult,
    CockpitAdapter,
    RecordNotFoundError,
    ValidationError,
    WriteNotSupportedError,
)

_VALID_DECISIONS = frozenset({"approved", "denied"})

_DEFAULT_POLICY: dict[str, Any] = {
    "version": "1.0",
    "human_escalation": True,
    "validation_rules": [],
    "allowlist": [],
    "denylist": [],
}

_RUN_STATES = frozenset({
    "PENDING", "VALIDATING", "EXECUTING",
    "RECORDING", "COMPLETE", "FAILED", "ESCALATED",
})


class EcoAdapter(CockpitAdapter):
    """Cockpit adapter for the eco backend.

    workspace_id is the workspace root path (the directory containing .eco/).
    node_id is None — eco is single-node; eco-edge has its own adapter.

    One instance = one workspace. For multi-agent use, instantiate one
    EcoAdapter per workspace root and aggregate at the host layer.
    """

    BACKEND_ID = "eco"
    RECORD_TYPES = frozenset({"run", "escalation", "artifact", "policy"})

    def __init__(
        self,
        workspace_id: str,
        node_id: str | None = None,
        runtime_client: Any | None = None,
    ) -> None:
        super().__init__(workspace_id, node_id)
        self._root = Path(workspace_id)
        self._eco_root = self._root / ".eco"
        self._runs_root = self._eco_root / "runs"
        self._artifacts_root = self._eco_root / "artifacts"
        self._policy_path = self._eco_root / "policy.json"
        self._runtime_client = runtime_client

    @property
    def backend_id(self) -> str:
        return self.BACKEND_ID

    # ---------------------------------------------------------------------------
    # Health
    # ---------------------------------------------------------------------------

    def health(self) -> AdapterResult[dict[str, Any]]:
        """Returns health without raising. Callers use this to decide panel visibility."""
        reachable = self._root.exists()
        eco_present = self._eco_root.exists()
        return AdapterResult(
            data={
                "reachable": reachable,
                "eco_root_present": eco_present,
                "runs_root_present": self._runs_root.exists(),
                "artifacts_root_present": self._artifacts_root.exists(),
                "policy_present": self._policy_path.exists(),
                "runtime_client_configured": self._runtime_client is not None,
                "status": "ok" if (reachable and eco_present) else "degraded",
            },
            origin=self._origin(),
        )

    # ---------------------------------------------------------------------------
    # State snapshot
    # ---------------------------------------------------------------------------

    def get_state(self) -> AdapterResult[dict[str, Any]]:
        """Dashboard-ready snapshot: run counts, escalation depth, policy state."""
        runs = self._load_runs()
        policy = self._read_policy()

        counts: dict[str, int] = {s: 0 for s in _RUN_STATES}
        durations: list[float] = []
        for run in runs:
            state = run.get("final_state", "FAILED")
            if state in counts:
                counts[state] += 1
            d = _extract_duration(run)
            if d is not None:
                durations.append(d)

        total = sum(counts.values())
        avg_duration = (sum(durations) / len(durations)) if durations else None
        escalation_depth = sum(
            1 for r in runs
            if r.get("final_state") == "ESCALATED"
            and not _escalation_resolved(r)
        )

        return AdapterResult(
            data={
                "run_counts": counts,
                "total_runs": total,
                "escalation_queue_depth": escalation_depth,
                "average_duration_s": avg_duration,
                "policy_violation_rate": (counts.get("ESCALATED", 0) / total) if total else 0.0,
                "policy_version": policy.get("version"),
                "human_escalation_enabled": policy.get("human_escalation", True),
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
        match record_type:
            case "run":
                data = self._load_runs()
            case "escalation":
                data = [
                    r for r in self._load_runs()
                    if r.get("final_state") == "ESCALATED"
                    and not _escalation_resolved(r)
                ]
            case "artifact":
                data = self._load_artifacts()
            case "policy":
                data = [self._read_policy()]
        return AdapterResult(data=data, origin=self._origin())

    def get_record(
        self,
        record_type: str,
        record_id: str,
    ) -> AdapterResult[dict[str, Any]]:
        _assert_record_type(record_type, self.RECORD_TYPES)
        match record_type:
            case "run" | "escalation":
                record = self._load_run_by_id(record_id)
                if record is None:
                    raise RecordNotFoundError(
                        f"run '{record_id}' not found in workspace"
                    )
                return AdapterResult(data=record, origin=self._origin())
            case "artifact":
                artifact = self._load_artifact_by_path(record_id)
                if artifact is None:
                    raise RecordNotFoundError(
                        f"artifact '{record_id}' not found"
                    )
                return AdapterResult(data=artifact, origin=self._origin())
            case "policy":
                return AdapterResult(data=self._read_policy(), origin=self._origin())

    # ---------------------------------------------------------------------------
    # Write operations
    # ---------------------------------------------------------------------------

    def approve(
        self,
        record_id: str,
        decision: str,
        reason: str | None = None,
    ) -> AdapterResult[dict[str, Any]]:
        """Approve or deny an escalated run. decision must be 'approved' or 'denied'."""
        if decision not in _VALID_DECISIONS:
            raise ValidationError(
                f"decision must be 'approved' or 'denied', got '{decision}'"
            )
        self._require_runtime_client("approve")

        bridge_decision = "approve" if decision == "approved" else "deny"
        payload = {
            "runId": record_id,
            "decision": bridge_decision,
            "comment": reason,
            "user": "cockpit",
        }
        if not hasattr(self._runtime_client, "resume_run"):
            raise AttributeError("runtime client does not support resume_run")
        self._runtime_client.resume_run(payload)

        self._write_escalation_decision(record_id, decision, reason)

        return AdapterResult(
            data={"run_id": record_id, "decision": decision, "reason": reason},
            origin=self._origin(),
        )

    def submit(
        self,
        record_type: str,
        payload: dict[str, Any],
    ) -> AdapterResult[dict[str, Any]]:
        """Launch a PASS run. record_type must be 'run'."""
        if record_type != "run":
            raise WriteNotSupportedError(
                f"eco adapter submit only supports record_type='run', got '{record_type}'"
            )
        self._require_runtime_client("submit")

        missing = {"pass_name_or_id", "artifact_type", "objective"} - payload.keys()
        if missing:
            raise ValidationError(
                f"submit payload missing required fields: {sorted(missing)}"
            )

        if not hasattr(self._runtime_client, "build_run_request"):
            raise AttributeError("runtime client does not support build_run_request")

        request = self._runtime_client.build_run_request(
            workspace_root=self._root,
            pass_name_or_id=payload["pass_name_or_id"],
            artifact_type=payload["artifact_type"],
            objective=payload["objective"],
            active_file=payload.get("active_file"),
            open_folders=payload.get("open_folders"),
        )
        result = self._runtime_client.execute_run(request)
        return AdapterResult(
            data={"run_id": request.run_id, "result": str(result)},
            origin=self._origin(),
        )

    def update_record(
        self,
        record_type: str,
        record_id: str,
        payload: dict[str, Any],
    ) -> AdapterResult[dict[str, Any]]:
        """Update policy.json. record_type must be 'policy'."""
        if record_type != "policy":
            raise WriteNotSupportedError(
                "eco adapter update_record only supports record_type='policy'"
            )
        issues = _validate_policy(payload)
        if issues:
            raise ValidationError("invalid policy: " + "; ".join(issues))

        normalized: dict[str, Any] = {
            "version": str(payload.get("version", "1.0")),
            "human_escalation": bool(payload.get("human_escalation", True)),
            "validation_rules": list(payload.get("validation_rules", [])),
            "allowlist": list(payload.get("allowlist", [])),
            "denylist": list(payload.get("denylist", [])),
        }
        self._policy_path.parent.mkdir(parents=True, exist_ok=True)
        self._policy_path.write_text(
            json.dumps(normalized, indent=2), encoding="utf-8"
        )
        return AdapterResult(data=normalized, origin=self._origin())

    # ---------------------------------------------------------------------------
    # Private helpers
    # ---------------------------------------------------------------------------

    def _require_runtime_client(self, operation: str) -> None:
        if self._runtime_client is None:
            raise WriteNotSupportedError(
                f"eco adapter '{operation}' requires a runtime_client; "
                "adapter is currently read-only"
            )

    def _load_runs(self) -> list[dict[str, Any]]:
        if not self._runs_root.exists():
            return []
        runs = []
        for path in sorted(
            self._runs_root.glob("*.json"),
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        ):
            try:
                runs.append(json.loads(path.read_text(encoding="utf-8")))
            except (json.JSONDecodeError, OSError):
                continue
        return runs

    def _load_run_by_id(self, run_id: str) -> dict[str, Any] | None:
        for candidate in (
            self._runs_root / f"run-{run_id}.json",
            self._runs_root / f"{run_id}.json",
        ):
            if candidate.exists():
                try:
                    return json.loads(candidate.read_text(encoding="utf-8"))
                except (json.JSONDecodeError, OSError):
                    return None
        return None

    def _load_artifacts(self) -> list[dict[str, Any]]:
        if not self._artifacts_root.exists():
            return []
        entries = []
        for path in sorted(
            self._artifacts_root.rglob("*"),
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        ):
            if not path.is_file():
                continue
            entries.append({
                "artifact_path": str(path),
                "size": path.stat().st_size,
                "created_at": path.stat().st_mtime,
                "hash": _sha256(path),
            })
        return entries

    def _load_artifact_by_path(self, artifact_path: str) -> dict[str, Any] | None:
        path = Path(artifact_path)
        if not path.is_absolute():
            path = self._artifacts_root / path
        if not path.exists() or not path.is_file():
            return None
        return {
            "artifact_path": str(path),
            "size": path.stat().st_size,
            "created_at": path.stat().st_mtime,
            "hash": _sha256(path),
        }

    def _read_policy(self) -> dict[str, Any]:
        if not self._policy_path.exists():
            return dict(_DEFAULT_POLICY)
        try:
            return json.loads(self._policy_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return dict(_DEFAULT_POLICY)

    def _write_escalation_decision(
        self,
        run_id: str,
        decision: str,
        reason: str | None,
    ) -> None:
        record_path = self._runs_root / f"run-{run_id}.json"
        if not record_path.exists():
            return
        try:
            payload = json.loads(record_path.read_text(encoding="utf-8"))
            escalation = payload.get("escalation")
            if not isinstance(escalation, dict):
                escalation = {}
            escalation["decision"] = decision
            escalation["comment"] = reason
            escalation["resolved_by"] = "cockpit"
            escalation["resolution"] = (
                "approved" if decision == "approved" else "aborted"
            )
            payload["escalation"] = escalation
            if decision == "denied":
                payload["final_state"] = "ABORTED"
            record_path.write_text(
                json.dumps(payload, indent=2), encoding="utf-8"
            )
        except (json.JSONDecodeError, OSError):
            pass


# ---------------------------------------------------------------------------
# Module-level helpers (no self needed)
# ---------------------------------------------------------------------------

def _assert_record_type(record_type: str, valid: frozenset[str]) -> None:
    if record_type not in valid:
        raise ValidationError(
            f"unknown record type '{record_type}' for eco adapter; "
            f"valid types: {sorted(valid)}"
        )


def _validate_policy(payload: dict[str, Any]) -> list[str]:
    issues: list[str] = []
    if not str(payload.get("version", "")).strip():
        issues.append("version is required")
    if not isinstance(payload.get("human_escalation", True), bool):
        issues.append("human_escalation must be boolean")
    for key in ("validation_rules", "allowlist", "denylist"):
        if not isinstance(payload.get(key, []), list):
            issues.append(f"{key} must be a list")
    return issues


def _extract_duration(record: dict[str, Any]) -> float | None:
    result = record.get("result")
    if not isinstance(result, dict):
        return None
    timings = result.get("timings")
    if not isinstance(timings, dict):
        return None
    for key in ("duration", "duration_s", "total_s", "elapsed_s"):
        value = timings.get(key)
        if isinstance(value, (int, float)):
            return float(value)
    return None


def _escalation_resolved(record: dict[str, Any]) -> bool:
    escalation = record.get("escalation")
    if not isinstance(escalation, dict):
        return False
    return bool(escalation.get("decision") or escalation.get("resolution"))


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            digest.update(chunk)
    return digest.hexdigest()
