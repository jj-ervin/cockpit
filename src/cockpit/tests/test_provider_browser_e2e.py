"""Real browser -> HTTP host -> Python bridge -> Marlin provider vertical slice."""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import socket
import subprocess
import time
import urllib.request
from pathlib import Path

import pytest
from playwright.sync_api import expect


COCKPIT_ROOT = Path(__file__).resolve().parents[3]
MARLIN_ROOT = COCKPIT_ROOT.parent / "marlin"
MARLIN_MANIFEST = MARLIN_ROOT / "packages" / "marlin-dxp" / "provider" / "marlin.provider.json"
MARLIN_PROVIDER = MARLIN_ROOT / "packages" / "marlin-dxp" / "dist" / "provider.js"
COCKPIT_PYTHON = COCKPIT_ROOT / ".venv" / "Scripts" / "python.exe"


def _free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def _write_portfolio(root: Path) -> Path:
    target = root / "sample-repo"
    target.mkdir(parents=True)
    (target / ".git").mkdir()
    tools = root / "governance-commons" / "gc-audit" / "tools"
    tools.mkdir(parents=True)
    (root / "governance-commons" / "gc-audit" / "GC-AUDIT-REGISTRY.yaml").write_text(
        """schema: gc-audit.registry.v1
authority: browser-e2e
tools:
  - id: validate-e2e
    verb: validate
    category: test
    status: active
    title: Validate
    description: browser e2e
    mutates: false
    steps:
      - script: governance-commons/gc-audit/tools/check.ps1
        targetArg: Target
  - id: normalize-e2e
    verb: normalize
    category: test
    status: active
    title: Normalize
    description: browser e2e
    mutates: true
    requiresExplicitApply: true
    steps:
      - script: governance-commons/gc-audit/tools/normalize.ps1
        targetArg: Target
        supportsDryRun: true
  - id: verify-e2e
    verb: verify
    category: test
    status: active
    title: Verify
    description: browser e2e
    mutates: false
    steps:
      - script: governance-commons/gc-audit/tools/check.ps1
        targetArg: Target
""",
        encoding="utf-8",
    )
    (tools / "check.ps1").write_text(
        'param([string]$Target)\nif (Test-Path (Join-Path $Target "normalized.marker")) { exit 0 }\nexit 1\n',
        encoding="utf-8",
    )
    (tools / "normalize.ps1").write_text(
        'param([string]$Target, [switch]$DryRun)\nif (-not $DryRun) { Set-Content (Join-Path $Target "normalized.marker") "applied" }\nexit 0\n',
        encoding="utf-8",
    )
    return target


def _install_marlin_provider(home: Path) -> None:
    version_dir = home / "providers" / "marlin" / "0.1.0"
    version_dir.mkdir(parents=True)
    manifest_bytes = MARLIN_MANIFEST.read_bytes()
    (version_dir / "manifest.json").write_bytes(manifest_bytes)
    node = shutil.which("node")
    assert node
    attestation = {
        "schema_version": "cockpit-provider-attestation-v1",
        "provider_id": "marlin",
        "provider_version": "0.1.0",
        "manifest_digest": "sha256:" + hashlib.sha256(manifest_bytes).hexdigest(),
        "package_digest": None,
        "executable": str(Path(node).resolve()),
        "executable_digest": "sha256:" + hashlib.sha256(MARLIN_PROVIDER.read_bytes()).hexdigest(),
        "executable_digest_target": str(MARLIN_PROVIDER.resolve()),
        "args": [str(MARLIN_PROVIDER.resolve())],
        "installed_at": "2026-08-05T00:00:00Z",
        "installed_by": "marlin",
        "signature": None,
    }
    (version_dir / "attestation.json").write_text(json.dumps(attestation), encoding="utf-8")


@pytest.mark.skipif(
    not (MARLIN_PROVIDER.exists() and MARLIN_MANIFEST.exists() and COCKPIT_PYTHON.exists()),
    reason="built Marlin provider and Cockpit .venv are required",
)
def test_real_browser_runs_marlin_remediation_and_exports_evidence(page, tmp_path: Path) -> None:
    portfolio = tmp_path / "portfolio"
    target = _write_portfolio(portfolio)
    marlin_home = tmp_path / "marlin-home"
    _install_marlin_provider(marlin_home)
    port = _free_port()
    env = os.environ.copy()
    env.update({
        "COCKPIT_MARLIN_HOME": str(marlin_home),
        "GC_AUDIT_ROOT": str(portfolio),
        "COCKPIT_PYTHON": str(COCKPIT_PYTHON),
        "PORT": str(port),
    })
    process = subprocess.Popen(
        [shutil.which("node") or "node", "host-web/index.js", "--workspace", str(target)],
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
        page.click(".tab[data-tab='marlin-audit']")
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline and not page.locator("#audit-repository").input_value():
            time.sleep(0.1)
        assert page.locator("#audit-repository").input_value() == str(target)
        page.click("#audit-validate")
        expect(page.locator("#audit-validate-status")).to_have_text("failed", timeout=30_000)
        assert "Remediation:" in page.locator("#audit-validation-result").inner_text()

        page.click("#audit-preview")
        expect(page.locator("#audit-preview-status")).to_have_text("succeeded", timeout=30_000)
        page.click("#audit-request-approval")
        assert page.locator("#audit-approval-dialog").is_visible()
        assert str(target) in page.locator("#audit-approval-scope").inner_text()
        page.check("#audit-approval-check")
        page.click("#audit-confirm-approval")

        expect(page.locator("#audit-verify-status")).to_have_text("succeeded", timeout=30_000)
        assert (target / "normalized.marker").read_text(encoding="utf-8").strip() == "applied"
        assert page.locator("#audit-evidence-status").inner_text() == "Ready to export"
        with page.expect_download() as download_info:
            page.click("#audit-export-evidence")
        downloaded = Path(download_info.value.path())
        exported = json.loads(downloaded.read_text(encoding="utf-8"))
        assert exported["operation"] == "audit-verify"
        assert exported["findings"][0]["severity"] == "pass"
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)
