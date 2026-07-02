"""Tests for NijiAdapter."""

from __future__ import annotations

from pathlib import Path

import pytest

from cockpit.adapters.niji import NijiAdapter
from cockpit.core.adapter import RecordNotFoundError, ValidationError, WriteNotSupportedError


@pytest.fixture()
def niji_root(tmp_path: Path) -> Path:
    package = tmp_path / "src" / "niji"
    package.mkdir(parents=True)
    (package / "__init__.py").write_text("", encoding="utf-8")
    (package / "api.py").write_text(
        """
API_VERSION = "1.0"

class Color:
    def __init__(self, value):
        self.value = value
    @classmethod
    def from_hex(cls, value):
        return cls(value)
    def to_hex(self):
        return self.value

class Swatch:
    def __init__(self, name, role, color):
        self.name = name
        self.role = role
        self.color = color

class Palette:
    def __init__(self, scheme, swatches):
        self.scheme = scheme
        self.swatches = tuple(swatches)

class Scheme:
    key = "complementary"
    display_name = "Complementary"
    description = "Opposite hue pairing"
    roles = ("base", "accent")

class ColorEngine:
    @staticmethod
    def available_schemes():
        return (Scheme(),)
    @staticmethod
    def generate_palette(base_color, scheme_key):
        return Palette(scheme_key, [Swatch("Base", "base", base_color), Swatch("Accent", "accent", Color("#ff6633"))])
""",
        encoding="utf-8",
    )
    return tmp_path


def test_health_ok(niji_root: Path) -> None:
    adapter = NijiAdapter(workspace_id=str(niji_root))
    result = adapter.health()
    assert result.data["status"] == "ok"
    assert result.data["api_version"] == "1.0"
    assert result.origin.backend == "niji"


def test_list_schemes(niji_root: Path) -> None:
    adapter = NijiAdapter(workspace_id=str(niji_root))
    result = adapter.list_records("scheme")
    assert result.data[0]["id"] == "complementary"


def test_palette_preview(niji_root: Path) -> None:
    adapter = NijiAdapter(workspace_id=str(niji_root))
    result = adapter.get_record("palette-preview", "sample")
    assert result.data["scheme"] == "complementary"
    assert result.data["swatches"][0]["hex"] == "#3366ff"


def test_unknown_record_type(niji_root: Path) -> None:
    adapter = NijiAdapter(workspace_id=str(niji_root))
    with pytest.raises(ValidationError, match="unknown record type"):
        adapter.list_records("package")


def test_missing_scheme(niji_root: Path) -> None:
    adapter = NijiAdapter(workspace_id=str(niji_root))
    with pytest.raises(RecordNotFoundError):
        adapter.get_record("scheme", "missing")


def test_submit_raises(niji_root: Path) -> None:
    adapter = NijiAdapter(workspace_id=str(niji_root))
    with pytest.raises(WriteNotSupportedError):
        adapter.submit("palette-preview", {})
