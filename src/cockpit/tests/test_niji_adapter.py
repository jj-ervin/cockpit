"""Tests for NijiAdapter."""

from __future__ import annotations

import pytest

from cockpit.adapters.niji import NijiAdapter
from cockpit.core.adapter import (
    RecordNotFoundError,
    ValidationError,
    WriteNotSupportedError,
)


class Color:
    def __init__(self, value: str) -> None:
        self.value = value

    def to_hex(self) -> str:
        return self.value


class Swatch:
    def __init__(self, name: str, role: str, color: Color) -> None:
        self.name = name
        self.role = role
        self.color = color


class Palette:
    def __init__(self, scheme: str, swatches: list[Swatch]) -> None:
        self.scheme = scheme
        self.swatches = tuple(swatches)


class Scheme:
    key = "complementary"
    display_name = "Complementary"
    description = "Opposite hue pairing"
    roles = ("base", "accent")


class FakeNijiAdapter:
    def __init__(self) -> None:
        self.sinks = []

    def register_sink(self, sink) -> None:
        self.sinks.append(sink)

    def get_schemes(self):
        return (Scheme(),)

    def generate(self, base_hex: str, scheme_key: str) -> Palette:
        palette = Palette(
            scheme_key,
            [
                Swatch("Base", "base", Color(base_hex)),
                Swatch("Accent", "accent", Color("#ff6633")),
            ],
        )
        for sink in self.sinks:
            sink.on_palette_generated(palette)
        return palette


@pytest.fixture()
def adapter() -> NijiAdapter:
    return NijiAdapter(
        workspace_id="/workspace/niji", niji_adapter_factory=FakeNijiAdapter
    )


def test_health_ok(adapter: NijiAdapter) -> None:
    result = adapter.health()
    assert result.data["status"] == "ok"
    assert result.data["dependency"] == "installed"
    assert result.origin.backend == "niji"


def test_list_schemes(adapter: NijiAdapter) -> None:
    result = adapter.list_records("scheme")
    assert result.data[0]["id"] == "complementary"


def test_palette_preview(adapter: NijiAdapter) -> None:
    result = adapter.get_record("palette-preview", "sample")
    assert result.data["scheme"] == "complementary"
    assert result.data["swatches"][0]["hex"] == "#3366ff"
    assert [event["type"] for event in result.data["session"]["events"]] == [
        "activated",
        "palette_generated",
    ]


def test_unknown_record_type(adapter: NijiAdapter) -> None:
    with pytest.raises(ValidationError, match="unknown record type"):
        adapter.list_records("package")


def test_missing_scheme(adapter: NijiAdapter) -> None:
    with pytest.raises(RecordNotFoundError):
        adapter.get_record("scheme", "missing")


def test_submit_raises(adapter: NijiAdapter) -> None:
    with pytest.raises(WriteNotSupportedError):
        adapter.submit("palette-preview", {})


def test_host_session_accepts_context_and_closes(adapter: NijiAdapter) -> None:
    active = adapter.activate({"workspace": "rainforest", "host": "cockpit"})
    assert active.data["active"] is True
    assert active.data["context_keys"] == ["host", "workspace"]

    closed = adapter.close()
    assert closed.data["active"] is False
    assert closed.data["events"][-1]["type"] == "closed"
