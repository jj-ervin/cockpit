"""Real browser -> HTTP host -> Python bridge -> niji provider vertical slice.

Mirrors test_provider_browser_e2e.py's structure exactly, but for the niji
Mode 4 proof panel (web/cockpit.js's "Real Provider (Mode 4 proof)" section
in the niji tab) instead of the Marlin Audit tab.

Neither test here runs `marlin install` — both manually stage the
<home>/providers/<id>/<version>/{manifest.json,attestation.json} directory
shape discover_providers() scans, exactly as _install_marlin_provider does in
test_provider_browser_e2e.py. This is deliberate, not a shortcut: it proves
the real discovery -> host_bridge -> subprocess -> browser-render path
without depending on the Marlin CLI, so these tests are unaffected by the
separate, tracked marlin-registry/bundled-local-registry shadowing issue
documented in test_provider_registry.py's opt-in smoke test.
"""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

import pytest
from playwright.sync_api import expect


COCKPIT_ROOT = Path(__file__).resolve().parents[3]
COCKPIT_PYTHON = COCKPIT_ROOT / ".venv" / "Scripts" / "python.exe"
NIJI_ROOT = COCKPIT_ROOT.parent / "niji"
REAL_NIJI_MANIFEST = NIJI_ROOT / "dist" / "niji-release" / "providers" / "niji.provider.json"
REAL_NIJI_EXECUTABLE = NIJI_ROOT / "dist" / "niji-release" / "provider" / "niji-provider.exe"


def _free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def _write_fixture_provider(home: Path) -> None:
    """Stages a small stdio-json script standing in for niji-provider.exe —
    same class of substitute as test_host_bridge.py's `fake_provider`
    fixture — returning a schema-valid cockpit-operation-result-v1 with
    real-shaped (not real-computed) palette swatches, deterministic so the
    browser assertion below can check exact rendered values.
    """
    version_dir = home / "providers" / "niji" / "1.1.1"
    version_dir.mkdir(parents=True)

    manifest_source = COCKPIT_ROOT / "examples" / "providers" / "niji.provider.json"
    manifest = json.loads(manifest_source.read_text(encoding="utf-8"))
    manifest["schema_version"] = "cockpit-provider-v1.1"
    manifest["transport"]["protocol"] = "cockpit-provider-v1.1"
    manifest["commands"][0]["input"] = {
        "mode": "object",
        "fields": [
            {
                "name": "base_hex",
                "label": "Base color",
                "description": "Hex color used as the palette base.",
                "type": "string",
                "required": True,
            },
            {
                "name": "scheme_key",
                "label": "Scheme",
                "description": "Palette relationship to generate.",
                "type": "enum",
                "required": True,
                "enum": ["complementary", "analogous"],
            },
        ],
    }
    manifest_bytes = json.dumps(manifest, separators=(",", ":")).encode("utf-8")
    manifest_path = version_dir / "manifest.json"
    manifest_path.write_bytes(manifest_bytes)

    script = version_dir / "fixture_niji_provider.py"
    script.write_text(
        "import json, sys\n"
        "from datetime import datetime, timezone\n"
        "req = json.loads(sys.stdin.read())\n"
        "result = {\n"
        "    'schema_version': 'cockpit-operation-result-v1',\n"
        "    'operation_id': req['operation_id'],\n"
        "    'provider_id': req['provider_id'],\n"
        "    'command_id': req['command_id'],\n"
        "    'status': 'succeeded',\n"
        "    'timestamp': datetime.now(timezone.utc).isoformat(),\n"
        "    'data': {'palette': {'palette_id': None, 'name': 'Fixture Palette',\n"
        "        'base_color': '#3366cc', 'scheme': 'complementary',\n"
        "        'swatches': [\n"
        "            {'name': 'Fixture Core', 'role': 'Base', 'hex': '#2952a3'},\n"
        "            {'name': 'Fixture Amber', 'role': 'Complement', 'hex': '#dbaf57'},\n"
        "        ]}},\n"
        "    'evidence': [],\n"
        "}\n"
        "print(json.dumps(result))\n",
        encoding="utf-8",
    )

    attestation = {
        "schema_version": "cockpit-provider-attestation-v1",
        "provider_id": "niji",
        "provider_version": "1.1.1",
        "manifest_digest": "sha256:" + hashlib.sha256(manifest_bytes).hexdigest(),
        "package_digest": None,
        "executable": str(Path(sys.executable).resolve()),
        "executable_digest": "sha256:" + hashlib.sha256(script.read_bytes()).hexdigest(),
        "executable_digest_target": str(script),
        "args": [str(script)],
        "installed_at": "2026-08-21T00:00:00Z",
        "installed_by": "marlin",
        "signature": None,
    }
    (version_dir / "attestation.json").write_text(json.dumps(attestation), encoding="utf-8")


def _install_real_niji_provider(home: Path) -> None:
    version_dir = home / "providers" / "niji" / "1.1.1"
    version_dir.mkdir(parents=True)
    manifest_bytes = REAL_NIJI_MANIFEST.read_bytes()
    (version_dir / "manifest.json").write_bytes(manifest_bytes)
    attestation = {
        "schema_version": "cockpit-provider-attestation-v1",
        "provider_id": "niji",
        "provider_version": "1.1.1",
        "manifest_digest": "sha256:" + hashlib.sha256(manifest_bytes).hexdigest(),
        "package_digest": None,
        "executable": str(REAL_NIJI_EXECUTABLE.resolve()),
        "executable_digest": "sha256:" + hashlib.sha256(REAL_NIJI_EXECUTABLE.read_bytes()).hexdigest(),
        "executable_digest_target": str(REAL_NIJI_EXECUTABLE.resolve()),
        "args": [],
        "installed_at": "2026-08-21T00:00:00Z",
        "installed_by": "marlin",
        "signature": None,
    }
    (version_dir / "attestation.json").write_text(json.dumps(attestation), encoding="utf-8")


def _run_host_and_click_niji_proof(
    page,
    tmp_path: Path,
    marlin_home: Path,
    expected_input_summary: str,
):
    port = _free_port()
    env = os.environ.copy()
    env.update({
        "COCKPIT_MARLIN_HOME": str(marlin_home),
        "COCKPIT_PYTHON": str(COCKPIT_PYTHON),
        "PORT": str(port),
    })
    process = subprocess.Popen(
        [shutil.which("node") or "node", "host-web/index.js", "--workspace", str(tmp_path)],
        cwd=COCKPIT_ROOT,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    url = f"http://127.0.0.1:{port}"
    try:
        deadline = time.monotonic() + 15
        while time.monotonic() < deadline:
            try:
                with urllib.request.urlopen(url, timeout=1):
                    break
            except OSError:
                if process.poll() is not None:
                    raise AssertionError(process.stdout.read() if process.stdout else "host-web exited")
                time.sleep(0.1)
        else:
            raise AssertionError("host-web did not become ready")

        page.goto(url)
        page.evaluate("""() => window.cockpitHost.postMessage({
            type: 'eco.cockpit.listProviderCommands',
            catalogVersion: 'v1.1',
        })""")
        page.wait_for_timeout(100)
        page.click("#command-palette-toggle")
        expect(page.locator("#command-palette")).to_be_visible()
        expect(page.locator("#command-palette-list")).to_contain_text("Niji — Preview palette")
        expect(page.locator("#command-palette-list")).to_contain_text("niji.palette.preview")
        expect(page.locator("#command-palette-list")).to_contain_text("Action: palette.preview")
        expect(page.locator("#command-palette-list")).to_contain_text("Read-only")
        expect(page.locator("#command-palette-list")).to_contain_text(expected_input_summary)
        page.locator("#command-palette-filter").fill("niji.palette.preview")
        expect(page.locator("#command-palette-list")).to_contain_text("Niji — Preview palette")
        page.locator("#command-palette-filter").fill("does-not-exist")
        expect(page.locator("#command-palette-list")).to_contain_text("No discovered commands match the filter.")
        page.click("#command-palette-close")
        page.click(".tab[data-tab='niji']")
        page.click("#niji-proof-run")
        expect(page.locator("#niji-proof-status")).to_have_text("succeeded", timeout=30_000)
        return page.locator("#niji-proof-swatches .swatch").all_inner_texts()
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)


@pytest.mark.skipif(not COCKPIT_PYTHON.exists(), reason="Cockpit .venv is required")
def test_browser_renders_real_swatches_from_fixture_provider(page, tmp_path: Path) -> None:
    """Default test, runs without any real niji build. Exercises the real
    discover_providers() directory scan, the real host_bridge subprocess
    dispatch, and the real browser rendering path end to end — only the
    palette computation itself is a fixture standing in for niji-provider.exe.
    """
    marlin_home = tmp_path / "marlin-home"
    _write_fixture_provider(marlin_home)
    tiles = _run_host_and_click_niji_proof(
        page,
        tmp_path,
        marlin_home,
        "Input: 2 fields",
    )
    assert len(tiles) == 2
    assert "Fixture Core" in tiles[0]
    assert "#2952a3" in tiles[0]
    assert "Fixture Amber" in tiles[1]
    assert "#dbaf57" in tiles[1]


@pytest.mark.skipif(
    not (REAL_NIJI_EXECUTABLE.exists() and REAL_NIJI_MANIFEST.exists() and COCKPIT_PYTHON.exists()),
    reason="a real built niji-provider.exe (c:/dev/niji/dist/niji-release) and Cockpit .venv are required",
)
def test_browser_renders_real_swatches_from_real_niji_provider(page, tmp_path: Path) -> None:
    """Opt-in real-provider smoke gate: the actual niji-provider.exe binary,
    discovered through the real directory shape and driven through the real
    browser panel, not a fixture. Complements (does not replace)
    test_provider_registry.py's Python-level opt-in smoke test, which proves
    the same executable also works through a real `marlin install`.
    """
    marlin_home = tmp_path / "marlin-home"
    _install_real_niji_provider(marlin_home)
    tiles = _run_host_and_click_niji_proof(
        page,
        tmp_path,
        marlin_home,
        "Input: unavailable (v1 catalog)",
    )
    assert len(tiles) >= 1
    for tile in tiles:
        assert "#" in tile
