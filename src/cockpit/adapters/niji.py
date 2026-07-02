"""Niji adapter — read-only color palette provider surface."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

from cockpit.core.adapter import (
    AdapterResult,
    CockpitAdapter,
    RecordNotFoundError,
    ValidationError,
    WriteNotSupportedError,
)


def _default_niji_root() -> Path:
    sibling = Path(__file__).resolve().parents[4] / "niji"
    if sibling.exists():
        return sibling
    return Path.cwd()


class NijiAdapter(CockpitAdapter):
    """Cockpit adapter for Niji palette generation previews.

    Cockpit hosts the UI. Niji owns palette generation. This adapter is
    intentionally read-only: it exposes provider state and preview records but
    does not save palettes, launch the desktop UI, or mutate Niji's database.
    """

    BACKEND_ID = "niji"
    RECORD_TYPES = frozenset({"scheme", "palette-preview"})

    def __init__(self, workspace_id: str | None = None, node_id: str | None = None) -> None:
        root = Path(workspace_id) if workspace_id else _default_niji_root()
        super().__init__(str(root), node_id)
        self._root = root
        self._src = root / "src"

    @property
    def backend_id(self) -> str:
        return self.BACKEND_ID

    def health(self) -> AdapterResult[dict[str, Any]]:
        api = self._load_api()
        reachable = api is not None
        return AdapterResult(
            data={
                "reachable": reachable,
                "project_root": str(self._root),
                "api_importable": reachable,
                "api_version": getattr(api, "API_VERSION", None) if api else None,
                "status": "ok" if reachable else "degraded",
            },
            origin=self._origin(),
        )

    def get_state(self) -> AdapterResult[dict[str, Any]]:
        api = self._require_api()
        schemes = api.ColorEngine.available_schemes()
        return AdapterResult(
            data={
                "project_root": str(self._root),
                "api_version": getattr(api, "API_VERSION", None),
                "scheme_count": len(schemes),
                "default_base_hex": "#3366ff",
                "default_scheme": schemes[0].key if schemes else None,
            },
            origin=self._origin(),
        )

    def list_records(self, record_type: str, **filters: Any) -> AdapterResult[list[dict[str, Any]]]:
        _assert_record_type(record_type, self.RECORD_TYPES)
        if record_type == "scheme":
            return AdapterResult(data=self._schemes(), origin=self._origin())
        return AdapterResult(data=[self._palette_preview(filters)], origin=self._origin())

    def get_record(self, record_type: str, record_id: str) -> AdapterResult[dict[str, Any]]:
        _assert_record_type(record_type, self.RECORD_TYPES)
        if record_type == "scheme":
            for scheme in self._schemes():
                if scheme["id"] == record_id:
                    return AdapterResult(data=scheme, origin=self._origin())
            raise RecordNotFoundError(f"scheme '{record_id}' does not exist")
        if record_id != "sample":
            raise RecordNotFoundError(f"palette preview '{record_id}' does not exist")
        return AdapterResult(data=self._palette_preview({}), origin=self._origin())

    def submit(self, record_type: str, payload: dict[str, Any]) -> AdapterResult[dict[str, Any]]:
        raise WriteNotSupportedError("niji adapter is read-only; save/export belongs to Niji")

    def update_record(self, record_type: str, record_id: str, payload: dict[str, Any]) -> AdapterResult[dict[str, Any]]:
        raise WriteNotSupportedError("niji adapter is read-only")

    def _schemes(self) -> list[dict[str, Any]]:
        api = self._require_api()
        return [
            {
                "id": scheme.key,
                "display_name": scheme.display_name,
                "description": scheme.description,
                "roles": list(scheme.roles),
            }
            for scheme in api.ColorEngine.available_schemes()
        ]

    def _palette_preview(self, filters: dict[str, Any]) -> dict[str, Any]:
        api = self._require_api()
        base_hex = _string_filter(filters, "base_hex", "#3366ff")
        scheme_key = _string_filter(filters, "scheme", "complementary")
        palette = api.ColorEngine.generate_palette(
            base_color=api.Color.from_hex(base_hex),
            scheme_key=scheme_key,
        )
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
        }

    def _load_api(self) -> Any | None:
        if self._src.exists():
            src = str(self._src)
            if src not in sys.path:
                sys.path.insert(0, src)
        try:
            import niji.api as api  # type: ignore[import-not-found]
            return api
        except Exception:
            return None

    def _require_api(self) -> Any:
        api = self._load_api()
        if api is None:
            raise ValidationError(f"niji API is not importable from {self._root}")
        return api


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
