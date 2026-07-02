"""Cockpit — portable operator control surface.

Public API surface for Phase 1 (Python package).
VS Code extension and standalone shell adapters are Phase 2/3.
"""

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
from cockpit.adapters.eco import EcoAdapter
from cockpit.adapters.marlin import MarlinAdapter
from cockpit.adapters.niji import NijiAdapter

__all__ = [
    # Adapter contract
    "CockpitAdapter",
    "AdapterResult",
    "AdapterOrigin",
    # Errors
    "CockpitAdapterError",
    "BackendUnavailableError",
    "RecordNotFoundError",
    "PermissionDeniedError",
    "ValidationError",
    "WriteNotSupportedError",
    # Adapters
    "EcoAdapter",
    "MarlinAdapter",
    "NijiAdapter",
]
