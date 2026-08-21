"""Real browser -> HTTP host -> Python bridge -> cairn provider vertical
slice, covering both of Cairn's UI surfaces: Plan (propose -> human
approval -> apply) and Entry (add a row, human-approved). Mirrors
test_provider_browser_niji.py's structure: a default fixture-provider
test (no build artifacts required) plus an opt-in real-provider test
gated on the actual compiled cairn-provider.exe existing (built via
`pyinstaller cairn-provider.spec` in the cairn repo, then bundled by
`python scripts/build_release.py` -- see cairn/marlin.pkg.yaml's own
comment on why a compiled binary is the one exception to Cairn's
stdlib-only CLI).

Neither test runs `marlin install cairn` -- both manually stage the
<home>/providers/cairn/<version>/{manifest.json,attestation.json}
directory shape discover_providers() scans, exactly as
test_provider_browser_niji.py's own fixture test does; the real-artifact
extraction -> attestation -> install path itself is proven separately by
marlin/packages/marlin/tests/cairn-real-artifact.test.ts, which is the
more direct place to test that (Marlin's own issueProviderAttestation,
not Cockpit's discovery). The real-provider test here only exercises
Entry (refresh tables, add a row) rather than Plan -- cairn.schema.propose
calls a real LLM (schema_agent.py's kore() stage), which would make this
test flaky/slow/network-dependent; Entry is pure DB/filesystem I/O and
deterministic. Plan's real-provider path is exercised by
provider-attestation.test.ts's sibling (the marlin-side test above) and
by cairn/tests/test_provider.py's own direct process_request() tests
with call_llm stubbed.

The real-provider test extracts the compiled provider straight out of
the real dist/cairn-{version}.zip release archive (built by
`python scripts/build_release.py` in the cairn repo, a single atomic
command that also runs the PyInstaller compile -- see that script's own
docstring). There is no longer a loose, persisted
dist/cairn-provider/ directory to read from directly: build_release.py's
pipeline compiles into a throwaway temp directory and only the finished
zip survives, specifically so nothing here (or anywhere) could ever pick
up a stale executable left over from an earlier, no-longer-current build.
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
import zipfile
from pathlib import Path

import pytest
from playwright.sync_api import expect


COCKPIT_ROOT = Path(__file__).resolve().parents[3]
COCKPIT_PYTHON = COCKPIT_ROOT / ".venv" / "Scripts" / "python.exe"
CAIRN_ROOT = COCKPIT_ROOT.parent / "cairn"
CAIRN_VERSION = "0.1.6"
REAL_CAIRN_MANIFEST = CAIRN_ROOT / "providers" / "cairn.provider.json"
REAL_CAIRN_ZIP = CAIRN_ROOT / "dist" / f"cairn-{CAIRN_VERSION}.zip"


def _free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def _write_fixture_cairn_provider(home: Path) -> None:
    """Stages a small stdio-json script standing in for a real
    `python scripts/provider.py` invocation -- same class of substitute
    as test_host_bridge.py's `fake_provider` fixture and
    test_provider_browser_niji.py's own fixture -- returning deterministic,
    schema-valid cockpit-operation-result-v1 responses per command_id so
    the browser assertions below can check exact rendered values.
    """
    version_dir = home / "providers" / "cairn" / CAIRN_VERSION
    version_dir.mkdir(parents=True)

    manifest_source = COCKPIT_ROOT / "examples" / "providers" / "cairn.provider.json"
    manifest_bytes = manifest_source.read_bytes()
    (version_dir / "manifest.json").write_bytes(manifest_bytes)

    script = version_dir / "fixture_cairn_provider.py"
    script.write_text(
        "import json, sys\n"
        "from datetime import datetime, timezone\n"
        "req = json.loads(sys.stdin.read())\n"
        "cmd = req['command_id']\n"
        "base = {\n"
        "    'schema_version': 'cockpit-operation-result-v1',\n"
        "    'operation_id': req['operation_id'],\n"
        "    'provider_id': req['provider_id'],\n"
        "    'command_id': cmd,\n"
        "    'timestamp': datetime.now(timezone.utc).isoformat(),\n"
        "    'evidence': [],\n"
        "}\n"
        "if cmd == 'cairn.schema.propose':\n"
        "    result = dict(base, status='pending-approval', data={\n"
        "        'plan': {'kind': 'new_table', 'table': 'fixture_table', 'rationale': 'fixture rationale',\n"
        "                 'columns': [{'name': 'fixture_col', 'type': 'TEXT'}]},\n"
        "        'checks': [],\n"
        "    })\n"
        "elif cmd == 'cairn.schema.apply':\n"
        "    result = dict(base, status='succeeded', data={\n"
        "        'migration_path': '0099_fixture_table.sql', 'checks': [],\n"
        "        'ref_checks': ['dry run applied cleanly against a scratch copy of every migration'],\n"
        "    })\n"
        "elif cmd == 'cairn.entry.tables':\n"
        "    result = dict(base, status='succeeded', data={\n"
        "        'tables': {'fixture_table': {'fixture_col': {'type': 'TEXT', 'pk': False}}},\n"
        "    })\n"
        "elif cmd == 'cairn.entry.add':\n"
        "    result = dict(base, status='succeeded', data={'table': 'fixture_table', 'row_id': 1})\n"
        "else:\n"
        "    result = dict(base, status='failed', data={},\n"
        "                  error={'code': 'unknown-command', 'message': 'fixture does not implement ' + cmd, 'retryable': False})\n"
        "print(json.dumps(result))\n",
        encoding="utf-8",
    )

    attestation = {
        "schema_version": "cockpit-provider-attestation-v1",
        "provider_id": "cairn",
        "provider_version": CAIRN_VERSION,
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


def _install_real_cairn_provider(home: Path) -> None:
    """Extracts the real compiled provider bundle straight out of the
    real dist/cairn-{version}.zip release archive (built by
    `python scripts/build_release.py`, a single atomic command that
    compiles fresh via PyInstaller into a throwaway temp directory --
    there is no longer a loose, persisted dist/cairn-provider/ to read
    from directly, deliberately, so nothing can pick up a stale build).
    Then hand-builds an attestation from the real extracted file hashes
    -- same convention as test_provider_browser_niji.py's own
    _install_real_niji_provider, and the same reasoning: hand-built
    rather than produced through a real `marlin install`, since that
    would require a published GitHub release (see cairn/DEV-PLAN.md's
    provider slice entry). Marlin's own issueProviderAttestation() is
    exercised for real, separately, by
    marlin/packages/marlin/tests/cairn-real-artifact.test.ts.
    """
    version_dir = home / "providers" / "cairn" / CAIRN_VERSION
    version_dir.mkdir(parents=True)

    with zipfile.ZipFile(REAL_CAIRN_ZIP) as zf:
        manifest_bytes = zf.read("providers/cairn.provider.json")
        executable_bytes = zf.read("provider/cairn-provider.exe")
        # Every provider/ member (the exe plus its PyInstaller --onedir
        # support files) needs to land on disk alongside the exe for it
        # to actually run.
        for name in zf.namelist():
            if name.startswith("provider/") and not name.endswith("/"):
                target = version_dir / Path(name)
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(zf.read(name))
    (version_dir / "manifest.json").write_bytes(manifest_bytes)

    executable_path = version_dir / "provider" / "cairn-provider.exe"
    attestation = {
        "schema_version": "cockpit-provider-attestation-v1",
        "provider_id": "cairn",
        "provider_version": CAIRN_VERSION,
        "manifest_digest": "sha256:" + hashlib.sha256(manifest_bytes).hexdigest(),
        "package_digest": None,
        "executable": str(executable_path.resolve()),
        "executable_digest": "sha256:" + hashlib.sha256(executable_bytes).hexdigest(),
        "executable_digest_target": str(executable_path.resolve()),
        "args": [],
        "installed_at": "2026-08-21T00:00:00Z",
        "installed_by": "marlin",
        "signature": None,
    }
    (version_dir / "attestation.json").write_text(json.dumps(attestation), encoding="utf-8")


def _run_host(page, tmp_path: Path, marlin_home: Path, cairn_data_dir: Path | None = None):
    port = _free_port()
    env = os.environ.copy()
    env.update({
        "COCKPIT_MARLIN_HOME": str(marlin_home),
        "COCKPIT_PYTHON": str(COCKPIT_PYTHON),
        "PORT": str(port),
    })
    if cairn_data_dir is not None:
        # Inherited by host_bridge.py's subprocess spawn of the real
        # cairn-provider.exe -- isolates test data from a real user's
        # %APPDATA%\cairn.
        env["CAIRN_DATA_DIR"] = str(cairn_data_dir)
    process = subprocess.Popen(
        [shutil.which("node") or "node", "host-web/index.js", "--workspace", str(tmp_path)],
        cwd=COCKPIT_ROOT,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    url = f"http://127.0.0.1:{port}"
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
    page.click(".tab[data-tab='cairn']")
    return process


def _stop_host(process) -> None:
    process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=5)


@pytest.mark.skipif(not COCKPIT_PYTHON.exists(), reason="Cockpit .venv is required")
def test_browser_plan_propose_and_apply_via_fixture_provider(page, tmp_path: Path) -> None:
    """Exercises the real discover_providers() directory scan, the real
    host_bridge subprocess dispatch (including the requires_confirmation +
    bound-approval enforcement for cairn.schema.apply), and the real
    browser rendering path for Cairn's Plan surface end to end."""
    marlin_home = tmp_path / "marlin-home"
    _write_fixture_cairn_provider(marlin_home)
    process = _run_host(page, tmp_path, marlin_home)
    try:
        page.fill("#cairn-plan-need", "track a second free-text note on assets")
        page.click("#cairn-plan-propose")
        expect(page.locator("#cairn-plan-status")).to_have_text("Pending approval", timeout=30_000)
        expect(page.locator("#cairn-plan-summary")).to_contain_text("fixture_table")
        expect(page.locator("#cairn-plan-summary")).to_contain_text("fixture_col")

        page.click("#cairn-plan-approve")
        expect(page.locator("#cairn-approval-dialog")).to_be_visible()
        expect(page.locator("#cairn-approval-scope")).to_contain_text("cairn.schema.apply")
        page.check("#cairn-approval-check")
        page.click("#cairn-confirm-approval")

        # A successful apply clears the need field and the pending plan --
        # the most specific signal available since providerCommandResult
        # success doesn't raise a separate notice (matches the niji Mode 4
        # proof panel's own convention of status-text-only feedback).
        expect(page.locator("#cairn-plan-need")).to_have_value("", timeout=30_000)
        expect(page.locator("#cairn-plan-status")).not_to_contain_text("Failed")
    finally:
        _stop_host(process)


@pytest.mark.skipif(not COCKPIT_PYTHON.exists(), reason="Cockpit .venv is required")
def test_browser_entry_add_via_fixture_provider(page, tmp_path: Path) -> None:
    """Exercises the real discovery/dispatch/approval/render path for
    Cairn's Entry surface: refresh tables, fill a field, approve, add."""
    marlin_home = tmp_path / "marlin-home"
    _write_fixture_cairn_provider(marlin_home)
    process = _run_host(page, tmp_path, marlin_home)
    try:
        page.click("#cairn-entry-refresh-tables")
        expect(page.locator("#cairn-entry-table")).to_have_value("fixture_table", timeout=30_000)
        expect(page.locator("[data-field='fixture_col']")).to_be_visible()

        page.fill("[data-field='fixture_col']", "hello")
        page.click("#cairn-entry-add")
        expect(page.locator("#cairn-approval-dialog")).to_be_visible()
        expect(page.locator("#cairn-approval-scope")).to_contain_text("cairn.entry.add")
        page.check("#cairn-approval-check")
        page.click("#cairn-confirm-approval")

        expect(page.locator("#cairn-entry-status")).to_have_text(
            "Inserted row id 1 into fixture_table.", timeout=30_000
        )
    finally:
        _stop_host(process)


@pytest.mark.skipif(
    not (REAL_CAIRN_ZIP.exists() and REAL_CAIRN_MANIFEST.exists() and COCKPIT_PYTHON.exists()),
    reason="a real built dist/cairn-{version}.zip (run `python scripts/build_release.py "
    f"{CAIRN_VERSION}` in the cairn repo) and Cockpit .venv are required",
)
def test_browser_entry_add_via_real_provider(page, tmp_path: Path) -> None:
    """Opt-in real-provider smoke gate: the actual compiled
    cairn-provider.exe, discovered through the real directory shape and
    driven through the real browser panel -- not a fixture. Entry only
    (not Plan): cairn.schema.propose calls a real LLM, which would make
    this test flaky/slow/network-dependent; Entry is deterministic
    DB/filesystem I/O. Complements (does not replace)
    cairn-real-artifact.test.ts, which proves the same executable also
    works through a real extracted release zip and issueProviderAttestation."""
    cairn_data_dir = tmp_path / "cairn-data"
    cairn_data_dir.mkdir()
    subprocess.run(
        [sys.executable, "scripts/apply_migrations.py"],
        cwd=CAIRN_ROOT, check=True, capture_output=True, text=True,
        env={**os.environ, "CAIRN_DATA_DIR": str(cairn_data_dir)},
    )

    marlin_home = tmp_path / "marlin-home"
    _install_real_cairn_provider(marlin_home)
    process = _run_host(page, tmp_path, marlin_home, cairn_data_dir=cairn_data_dir)
    try:
        page.click("#cairn-entry-refresh-tables")
        # list_tables() returns every writable table sorted alphabetically;
        # "accounts" (not "entities") is auto-selected first, so select
        # explicitly rather than assuming which one the panel lands on.
        expect(page.locator("#cairn-entry-table option")).to_have_count(7, timeout=30_000)
        page.select_option("#cairn-entry-table", "entities")
        expect(page.locator("[data-field='slug']")).to_be_visible()

        page.fill("[data-field='slug']", "acme")
        page.fill("[data-field='name']", "Acme")
        page.fill("[data-field='kind']", "personal")
        page.click("#cairn-entry-add")
        expect(page.locator("#cairn-approval-dialog")).to_be_visible()
        page.check("#cairn-approval-check")
        page.click("#cairn-confirm-approval")

        expect(page.locator("#cairn-entry-status")).to_have_text(
            "Inserted row id 1 into entities.", timeout=30_000
        )
    finally:
        _stop_host(process)
