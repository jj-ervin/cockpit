"""Base adapter contract for all Cockpit backends."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Generic, TypeVar

T = TypeVar("T")


# ---------------------------------------------------------------------------
# Provenance
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class AdapterOrigin:
    """Provenance metadata attached to every adapter result.

    workspace_id and node_id together form the address of the source.
    node_id is None for single-node backends (DCP, GC, HELM, DXP, DVP).
    node_id is required for multi-node backends (eco-edge, DGX).
    """

    backend: str
    workspace_id: str
    node_id: str | None
    timestamp: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


# ---------------------------------------------------------------------------
# Result envelope
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class AdapterResult(Generic[T]):
    """Typed result with provenance. Every adapter method returns this."""

    data: T
    origin: AdapterOrigin


# ---------------------------------------------------------------------------
# Error hierarchy
# ---------------------------------------------------------------------------

class CockpitAdapterError(Exception):
    """Base for all adapter errors."""


class BackendUnavailableError(CockpitAdapterError):
    """Backend is unreachable or not configured for this workspace."""


class RecordNotFoundError(CockpitAdapterError):
    """Requested record does not exist in this workspace."""


class PermissionDeniedError(CockpitAdapterError):
    """Caller lacks permission for this operation in this workspace."""


class ValidationError(CockpitAdapterError):
    """Payload or parameters failed backend validation."""


class WriteNotSupportedError(CockpitAdapterError):
    """This adapter does not support write operations."""


# ---------------------------------------------------------------------------
# Base adapter
# ---------------------------------------------------------------------------

#: Registry of every concrete adapter, keyed by BACKEND_ID. Populated
#: automatically by __init_subclass__ below — a new adapter registers itself
#: just by declaring BACKEND_ID and being imported (see adapters/__init__.py),
#: with no edit required anywhere else (previously host_bridge.py's
#: _build_adapter needed a new if/elif branch per adapter).
ADAPTER_REGISTRY: dict[str, type["CockpitAdapter"]] = {}


class CockpitAdapter(ABC):
    """Abstract base for all Cockpit backend adapters.

    One instance = one workspace (and optionally one node within it).
    For multi-agent use, instantiate one adapter per workspace_id.
    Phase 1 callers pass a single workspace_id.
    Phase 2+ callers instantiate multiple adapters and aggregate results
    at the host layer — not here.
    """

    #: Stable lowercase identifier this adapter registers under. Subclasses
    #: must set this (enforced in __init_subclass__, not just by convention).
    BACKEND_ID: str = ""

    #: Whether this backend requires a real, non-empty workspace_id to
    #: construct (eco reads from a real .eco/ filesystem layout and cannot
    #: function without one). Backends with a sensible default location
    #: (marlin, niji, system) override this to False.
    REQUIRES_WORKSPACE_ID: bool = True

    def __init_subclass__(cls, **kwargs: Any) -> None:
        super().__init_subclass__(**kwargs)
        if not cls.BACKEND_ID:
            return  # allow intermediate abstract subclasses with no BACKEND_ID
        if cls.BACKEND_ID in ADAPTER_REGISTRY and ADAPTER_REGISTRY[cls.BACKEND_ID] is not cls:
            raise ValueError(
                f"BACKEND_ID {cls.BACKEND_ID!r} already registered to "
                f"{ADAPTER_REGISTRY[cls.BACKEND_ID].__name__}, cannot reuse for {cls.__name__}"
            )
        ADAPTER_REGISTRY[cls.BACKEND_ID] = cls

    def __init__(self, workspace_id: str, node_id: str | None = None) -> None:
        self._workspace_id = workspace_id
        self._node_id = node_id

    @property
    def workspace_id(self) -> str:
        return self._workspace_id

    @property
    def node_id(self) -> str | None:
        return self._node_id

    @property
    @abstractmethod
    def backend_id(self) -> str:
        """Stable lowercase identifier for this backend.

        Examples: 'eco', 'eco-edge', 'helm', 'dcp', 'dxp', 'dvp', 'gc'
        """

    def _origin(self) -> AdapterOrigin:
        return AdapterOrigin(
            backend=self.backend_id,
            workspace_id=self._workspace_id,
            node_id=self._node_id,
        )

    # --- Required: health --------------------------------------------------

    @abstractmethod
    def health(self) -> AdapterResult[dict[str, Any]]:
        """Return backend reachability and configuration status.

        Must not raise — return degraded health state instead.
        Callers use this to decide whether to surface a backend at all.
        """

    # --- Required: state snapshot ------------------------------------------

    @abstractmethod
    def get_state(self) -> AdapterResult[dict[str, Any]]:
        """Return current top-level state snapshot for this workspace/node.

        This is the data that populates Cockpit's dashboard view.
        Each backend defines what 'state' means for its domain.
        """

    # --- Required: record access -------------------------------------------

    @abstractmethod
    def list_records(
        self,
        record_type: str,
        **filters: Any,
    ) -> AdapterResult[list[dict[str, Any]]]:
        """List records of a given type, optionally filtered.

        record_type values are backend-specific (e.g. 'run', 'escalation',
        'artifact', 'command', 'profile'). Filters are backend-specific kwargs.
        """

    @abstractmethod
    def get_record(
        self,
        record_type: str,
        record_id: str,
    ) -> AdapterResult[dict[str, Any]]:
        """Fetch a single record by type and ID.

        Raises RecordNotFoundError if the record does not exist.
        """

    # --- Optional: write operations ----------------------------------------
    # Override in adapters that support writes. Default raises immediately
    # so callers get a clear error rather than silent no-op.

    def submit(
        self,
        record_type: str,
        payload: dict[str, Any],
    ) -> AdapterResult[dict[str, Any]]:
        """Submit a new record or action to this backend.

        Used for: launching a PASS run (eco), submitting a vault scan (dvp),
        requesting a mode switch (helm).
        """
        raise WriteNotSupportedError(
            f"'{self.backend_id}' adapter does not support submit"
        )

    def approve(
        self,
        record_id: str,
        decision: str,
        reason: str | None = None,
    ) -> AdapterResult[dict[str, Any]]:
        """Approve or deny a human-gated record.

        Used for: escalation queue decisions (eco), restructure approvals (dvp).
        decision must be 'approved' or 'denied'.
        """
        raise WriteNotSupportedError(
            f"'{self.backend_id}' adapter does not support approve"
        )

    def update_record(
        self,
        record_type: str,
        record_id: str,
        payload: dict[str, Any],
    ) -> AdapterResult[dict[str, Any]]:
        """Update an existing record in this backend.

        Used for: editing policy.json (eco), updating agent config (dvp).
        """
        raise WriteNotSupportedError(
            f"'{self.backend_id}' adapter does not support update_record"
        )

    def delete_record(
        self,
        record_type: str,
        record_id: str,
    ) -> AdapterResult[dict[str, Any]]:
        """Soft-delete a record: move it to a recoverable trash location, not
        a hard delete. Must return enough information (e.g. an original
        location and a trash location) for a matching restore_record call to
        undo it.

        Used for: artifact trash (eco).
        """
        raise WriteNotSupportedError(
            f"'{self.backend_id}' adapter does not support delete_record"
        )

    def restore_record(
        self,
        record_type: str,
        record_id: str,
        trash_ref: str,
    ) -> AdapterResult[dict[str, Any]]:
        """Undo a prior delete_record call. record_id is the original
        location/identifier; trash_ref is the trash-side reference returned
        by delete_record.

        Used for: artifact undo-delete (eco).
        """
        raise WriteNotSupportedError(
            f"'{self.backend_id}' adapter does not support restore_record"
        )
