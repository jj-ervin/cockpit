"""Niji adapter — read-only, lifecycle-aware color palette provider surface."""

from __future__ import annotations

from collections.abc import Callable, Mapping
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from cockpit.core.adapter import (
    AdapterResult,
    CockpitAdapter,
    RecordNotFoundError,
    ValidationError,
    WriteNotSupportedError,
)


class _NijiSessionEventSink:
    """Cockpit-owned projection of Niji's synchronous event protocol."""

    def __init__(self, events: list[dict[str, Any]]) -> None:
        self._events = events

    def on_palette_generated(self, palette: Any) -> None:
        self._record(
            "palette_generated",
            scheme=palette.scheme,
            swatch_count=len(palette.swatches),
        )

    def on_export_written(self, path: str, export_format: str) -> None:
        self._record("export_written", path=path, export_format=export_format)

    def on_library_updated(self, count: int) -> None:
        self._record("library_updated", count=count)

    def _record(self, event_type: str, **details: Any) -> None:
        self._events.append(
            {
                "type": event_type,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                **details,
            }
        )


class _NijiHostedSession:
    """One Cockpit-hosted Niji session, owned by one adapter instance."""

    def __init__(self, niji: Any, session_id: str, context: Mapping[str, Any]) -> None:
        self._niji = niji
        self.session_id = session_id
        self._context = dict(context)
        self.events: list[dict[str, Any]] = []
        self.active = True
        self._sink = _NijiSessionEventSink(self.events)
        self._niji.register_sink(self._sink)
        self.events.append(
            {
                "type": "activated",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )

    def generate(self, base_hex: str, scheme_key: str) -> Any:
        if not self.active:
            raise ValidationError("niji hosted session is closed")
        return self._niji.generate(base_hex, scheme_key)

    def close(self) -> None:
        if self.active:
            self.active = False
            self.events.append(
                {
                    "type": "closed",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            )

    def snapshot(self) -> dict[str, Any]:
        return {
            "id": self.session_id,
            "active": self.active,
            "context_keys": sorted(self._context),
            "events": list(self.events),
        }


class NijiAdapter(CockpitAdapter):
    """Cockpit adapter for Niji palette generation previews.

    Cockpit hosts the UI. Niji owns palette generation. This adapter is
    intentionally read-only: it exposes provider state and preview records but
    does not save palettes, launch the desktop UI, or mutate Niji's database.
    """

    BACKEND_ID = "niji"
    REQUIRES_WORKSPACE_ID = False
    RECORD_TYPES = frozenset({"scheme", "palette-preview"})

    def __init__(
        self,
        workspace_id: str | None = None,
        node_id: str | None = None,
        niji_adapter_factory: Callable[[], Any] | None = None,
    ) -> None:
        root = Path(workspace_id) if workspace_id else Path.cwd()
        super().__init__(str(root), node_id)
        self._root = root
        self._niji_adapter_factory = niji_adapter_factory
        self._session: _NijiHostedSession | None = None

    @property
    def backend_id(self) -> str:
        return self.BACKEND_ID

    def health(self) -> AdapterResult[dict[str, Any]]:
        niji = self._load_niji()
        reachable = niji is not None
        return AdapterResult(
            data={
                "reachable": reachable,
                "project_root": str(self._root),
                "api_importable": reachable,
                "api_version": self._api_version(niji) if niji else None,
                "dependency": "installed" if reachable else "missing",
                "status": "ok" if reachable else "degraded",
            },
            origin=self._origin(),
        )

    def get_state(self) -> AdapterResult[dict[str, Any]]:
        niji = self._require_niji()
        schemes = niji.get_schemes()
        session = self._ensure_session()
        return AdapterResult(
            data={
                "project_root": str(self._root),
                "api_version": self._api_version(niji),
                "scheme_count": len(schemes),
                "default_base_hex": "#3366ff",
                "default_scheme": schemes[0].key if schemes else None,
                "session": session.snapshot(),
            },
            origin=self._origin(),
        )

    def list_records(
        self, record_type: str, **filters: Any
    ) -> AdapterResult[list[dict[str, Any]]]:
        _assert_record_type(record_type, self.RECORD_TYPES)
        if record_type == "scheme":
            return AdapterResult(data=self._schemes(), origin=self._origin())
        return AdapterResult(
            data=[self._palette_preview(filters)], origin=self._origin()
        )

    def get_record(
        self, record_type: str, record_id: str
    ) -> AdapterResult[dict[str, Any]]:
        _assert_record_type(record_type, self.RECORD_TYPES)
        if record_type == "scheme":
            for scheme in self._schemes():
                if scheme["id"] == record_id:
                    return AdapterResult(data=scheme, origin=self._origin())
            raise RecordNotFoundError(f"scheme '{record_id}' does not exist")
        if record_id != "sample":
            raise RecordNotFoundError(f"palette preview '{record_id}' does not exist")
        return AdapterResult(data=self._palette_preview({}), origin=self._origin())

    def submit(
        self, record_type: str, payload: dict[str, Any]
    ) -> AdapterResult[dict[str, Any]]:
        raise WriteNotSupportedError(
            "niji adapter is read-only; save/export belongs to Niji"
        )

    def update_record(
        self, record_type: str, record_id: str, payload: dict[str, Any]
    ) -> AdapterResult[dict[str, Any]]:
        raise WriteNotSupportedError("niji adapter is read-only")

    def activate(
        self, context: dict[str, Any] | None = None
    ) -> AdapterResult[dict[str, Any]]:
        """Start a host-scoped, read-only Niji session and hand off context."""
        if context is not None and not isinstance(context, dict):
            raise ValidationError("niji session context must be an object")
        if self._session is not None:
            self._session.close()
        niji = self._require_niji()
        session_id = self.node_id or str(uuid4())
        self._session = _NijiHostedSession(niji, session_id, context or {})
        return AdapterResult(data=self._session.snapshot(), origin=self._origin())

    def close(self) -> AdapterResult[dict[str, Any]]:
        """Close the current host session without mutating Niji-owned data."""
        session = self._ensure_session()
        session.close()
        return AdapterResult(data=session.snapshot(), origin=self._origin())

    def _schemes(self) -> list[dict[str, Any]]:
        niji = self._require_niji()
        return [
            {
                "id": scheme.key,
                "display_name": scheme.display_name,
                "description": scheme.description,
                "roles": list(scheme.roles),
            }
            for scheme in niji.get_schemes()
        ]

    def _palette_preview(self, filters: dict[str, Any]) -> dict[str, Any]:
        base_hex = _string_filter(filters, "base_hex", "#3366ff")
        scheme_key = _string_filter(filters, "scheme", "complementary")
        context = filters.get("context")
        if context is not None and not isinstance(context, dict):
            raise ValidationError("context must be an object")
        session = self._ensure_session(context)
        palette = session.generate(base_hex, scheme_key)
        return {
            "id": "sample",
            "base_hex": base_hex,
            "scheme": palette.scheme,
            "swatches": [
                {
                    "name": swatch.name,
                    "role": swatch.role,
                    "hex": swatch.color.to_hex(),
                }
                for swatch in palette.swatches
            ],
            "session": session.snapshot(),
        }

    def _load_niji(self) -> Any | None:
        try:
            if self._niji_adapter_factory is not None:
                return self._niji_adapter_factory()
            from niji.integration import NijiAdapter as NijiIntegrationAdapter  # type: ignore[import-not-found]

            return NijiIntegrationAdapter()
        except ImportError:
            return None

    def _require_niji(self) -> Any:
        niji = self._load_niji()
        if niji is None:
            raise ValidationError(
                "niji is not installed; install the Niji provider before activating it in Cockpit"
            )
        return niji

    def _ensure_session(
        self, context: Mapping[str, Any] | None = None
    ) -> _NijiHostedSession:
        if self._session is None or not self._session.active:
            self.activate(dict(context or {}))
        elif context is not None:
            self.activate(dict(context))
        assert self._session is not None
        return self._session

    @staticmethod
    def _api_version(niji: Any) -> str | None:
        try:
            from niji.api import API_VERSION  # type: ignore[import-not-found]

            return API_VERSION
        except ImportError:
            return None


def _assert_record_type(record_type: str, valid: frozenset[str]) -> None:
    if record_type not in valid:
        raise ValidationError(
            f"unknown record type '{record_type}' for niji adapter; "
            f"valid types: {sorted(valid)}"
        )


def _string_filter(filters: dict[str, Any], key: str, default: str) -> str:
    value = filters.get(key)
    if value is None or value == "":
        return default
    if not isinstance(value, str):
        raise ValidationError(f"{key} must be a string")
    return value
