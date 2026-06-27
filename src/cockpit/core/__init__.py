"""Core contracts and result types."""

from cockpit.core.adapter import (
    AdapterOrigin,
    AdapterResult,
    BackendUnavailableError,
    CockpitAdapter,
    CockpitAdapterError,
    PermissionDeniedError,
    RecordNotFoundError,
    ValidationError,
    WriteNotSupportedError,
)

__all__ = [
    "AdapterOrigin",
    "AdapterResult",
    "BackendUnavailableError",
    "CockpitAdapter",
    "CockpitAdapterError",
    "PermissionDeniedError",
    "RecordNotFoundError",
    "ValidationError",
    "WriteNotSupportedError",
]
