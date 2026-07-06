"""Headless DOM smoke test for the extracted Cockpit web bundle (CKP.08.06).

Loads `web/cockpit.html` + `cockpit.js` + `cockpit.css` in a real headless
Chromium (Playwright), substituting the host-template placeholders the same
way `eco-vscode`'s `webviewHost.ts` does (see `buildCockpitSnapshot` /
`hostBootstrap`, webviewHost.ts:706-716), but capturing posted messages into
`window.__posted` instead of relaying to a real VS Code host.

This does not re-test eco-vscode's snapshot assembly or any adapter/backend
logic (those have their own test suites) — it only proves the extracted,
host-agnostic bundle itself renders without runtime errors and still posts
the correct `eco.cockpit.*` message for each UI-only operator-parity action
restored in CKP.08.04a.
"""

from __future__ import annotations

import shutil
from pathlib import Path

import pytest

WEB_DIR = Path(__file__).resolve().parents[3] / "web"


def _sample_snapshot() -> dict:
    """Realistic-shaped `eco.cockpit.state` payload, matching the shape
    `buildCockpitSnapshot()` sends in eco-vscode's webviewHost.ts."""
    return {
        "state": {
            "detected": True,
            "adapter": {"backend": "eco", "workspaceId": "smoke-workspace"},
            "workspaceRoot": "C:/fake/workspace",
            "refreshedAt": "2026-07-02T00:00:00Z",
            "backendState": {
                "total_runs": 2,
                "escalation_queue_depth": 1,
                "run_counts": {"open": 1, "closed": 1},
            },
        },
        "health": {"status": "ok", "eco_root_present": True},
        "marlin": {
            "installReadiness": None,
            "error": None,
            "workspaceTree": {
                "id": "root",
                "root": "C:/fake/workspace",
                "truncated": False,
                "nodes": [
                    {"id": ".", "name": "workspace", "path": ".", "kind": "directory", "depth": 0, "skipped": False},
                    {"id": "cockpit", "name": "cockpit", "path": "cockpit", "kind": "directory", "depth": 1, "skipped": False},
                    {"id": "cockpit/README.md", "name": "README.md", "path": "cockpit/README.md", "kind": "file", "depth": 2, "skipped": False},
                ],
            },
            "repoStatus": [],
        },
        "records": {
            "runs": [
                {
                    "id": "run-1",
                    "state": "closed",
                    "updated_at": "2026-07-02T00:00:00Z",
                    "pass_name_or_id": "CKP.08.06",
                },
                {
                    "id": "run-2",
                    "state": "open",
                    "updated_at": "2026-07-01T00:00:00Z",
                    "pass_name_or_id": "CKP.08.05",
                },
            ],
            "escalations": [
                {"id": "esc-1", "reason": "Needs operator sign-off"},
            ],
            "artifacts": [
                {
                    "artifact_path": "C:/fake/workspace/.eco/artifacts/a1.json",
                    "kind": "evidence",
                    "updated_at": "2026-07-02T00:00:00Z",
                },
            ],
            "policies": [
                {"id": "policy-1", "rules": ["no-secrets"]},
            ],
        },
        "governance": {"mode": "enforced", "health": "ok", "hash_match": True, "issues": []},
        "mode": {
            "current_mode": "Navigator",
            "available_modes": ["Navigator", "Builder", "Analyst", "Historian", "Operator"],
            "history": [
                {"previous_mode": None, "current_mode": "Navigator", "time_loc": "2026-07-05T20:00:00Z"},
            ],
        },
        "niji": {
            "health": {"status": "ok"},
            "state": {"scheme_count": 17, "default_base_hex": "#336699"},
            "palettePreview": {"scheme": "triadic", "swatches": []},
        },
    }


@pytest.fixture()
def cockpit_page(page, tmp_path: Path):
    """A loaded Cockpit page with a mocked `window.cockpitHost`.

    `window.__posted` accumulates every message the bundle posts to the host.
    Console errors and uncaught JS exceptions are collected onto `page.cockpit_errors`.
    """
    shutil.copy(WEB_DIR / "cockpit.css", tmp_path / "cockpit.css")
    shutil.copy(WEB_DIR / "cockpit.js", tmp_path / "cockpit.js")

    html = (WEB_DIR / "cockpit.html").read_text(encoding="utf-8")
    bootstrap = (
        '<script nonce="test-nonce">'
        "window.__posted = [];"
        "window.cockpitHost = { postMessage: function(msg) { window.__posted.push(msg); } };"
        "</script>"
    )
    html = html.replace("${cspSource}", "*")
    html = html.replace("${nonce}", "test-nonce")
    html = html.replace("<!-- cockpit-host-bootstrap -->", bootstrap)
    (tmp_path / "cockpit.html").write_text(html, encoding="utf-8")

    errors: list[str] = []
    page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
    page.on("pageerror", lambda exc: errors.append(str(exc)))

    page.goto((tmp_path / "cockpit.html").as_uri())
    page.wait_for_function("window.__posted && window.__posted.length > 0")

    page.cockpit_errors = errors  # type: ignore[attr-defined]
    return page


def _send_state(page, snapshot: dict) -> None:
    page.evaluate(
        "(payload) => window.postMessage({ type: 'eco.cockpit.state', payload }, '*')",
        snapshot,
    )
    page.wait_for_function("document.getElementById('status').textContent !== '-'")


def test_bundle_loads_without_console_errors_and_sends_ready(cockpit_page):
    posted = cockpit_page.evaluate("window.__posted")
    assert posted[0]["type"] == "eco.cockpit.ready"
    assert cockpit_page.cockpit_errors == []


def test_state_snapshot_hydrates_dashboard_summary(cockpit_page):
    _send_state(cockpit_page, _sample_snapshot())

    assert cockpit_page.locator("#status").inner_text() == "Detected"
    assert cockpit_page.locator("#total-runs").inner_text() == "2"
    assert cockpit_page.locator("#escalations").inner_text() == "1"
    assert cockpit_page.locator("#artifacts").inner_text() == "1"
    assert cockpit_page.locator("#backend").inner_text() == "eco"
    assert cockpit_page.cockpit_errors == []


def test_run_table_renders_and_copy_json_posts_correct_run_id(cockpit_page):
    _send_state(cockpit_page, _sample_snapshot())
    cockpit_page.click(".tab[data-tab='runs']")

    rows = cockpit_page.locator("#run-table tr")
    assert rows.count() == 2

    cockpit_page.click("#copy-run")
    posted = cockpit_page.evaluate("window.__posted")
    last = posted[-1]
    assert last["type"] == "eco.cockpit.copyRunJson"
    assert last["runId"] == "run-1"


def test_escalation_approve_posts_decision_and_reason(cockpit_page):
    _send_state(cockpit_page, _sample_snapshot())
    cockpit_page.click(".tab[data-tab='escalations-tab']")

    cockpit_page.fill("#escalation-list input[type='text']", "looks fine")
    cockpit_page.click("#escalation-list button:has-text('Approve')")

    last = cockpit_page.evaluate("window.__posted[window.__posted.length - 1]")
    assert last["type"] == "eco.cockpit.approveEscalation"
    assert last["runId"] == "esc-1"
    assert last["decision"] == "approved"
    assert last["reason"] == "looks fine"


def test_artifact_delete_posts_artifact_path(cockpit_page):
    _send_state(cockpit_page, _sample_snapshot())
    cockpit_page.click(".tab[data-tab='artifacts-tab']")

    cockpit_page.click("#artifact-table button:has-text('Delete')")

    last = cockpit_page.evaluate("window.__posted[window.__posted.length - 1]")
    assert last["type"] == "eco.cockpit.deleteArtifact"
    assert last["artifactPath"] == "C:/fake/workspace/.eco/artifacts/a1.json"


def test_launcher_form_submit_posts_pass_run_payload(cockpit_page):
    _send_state(cockpit_page, _sample_snapshot())
    cockpit_page.click(".tab[data-tab='launcher']")

    cockpit_page.fill("#launcher-pass", "CKP.08.06")
    cockpit_page.fill("#launcher-artifact-type", "evidence")
    cockpit_page.fill("#launcher-objective", "Smoke-test the launcher form.")
    cockpit_page.click("#launcher-form button[type='submit']")

    last = cockpit_page.evaluate("window.__posted[window.__posted.length - 1]")
    assert last["type"] == "eco.cockpit.submitRun"
    assert last["payload"]["pass_name_or_id"] == "CKP.08.06"
    assert last["payload"]["artifact_type"] == "evidence"


def test_policy_save_posts_parsed_json_payload(cockpit_page):
    _send_state(cockpit_page, _sample_snapshot())
    cockpit_page.click(".tab[data-tab='policy']")

    cockpit_page.fill("#policy-editor", '{"id": "policy-1", "rules": ["no-secrets", "no-plaintext-keys"]}')
    cockpit_page.click("#save-policy")

    last = cockpit_page.evaluate("window.__posted[window.__posted.length - 1]")
    assert last["type"] == "eco.cockpit.savePolicy"
    assert last["payload"]["rules"] == ["no-secrets", "no-plaintext-keys"]


def test_niji_provider_panel_renders_without_error(cockpit_page):
    _send_state(cockpit_page, _sample_snapshot())
    cockpit_page.click(".tab[data-tab='niji']")

    assert cockpit_page.locator("#niji-schemes").inner_text() == "17"
    assert cockpit_page.locator("#niji-base").inner_text() == "#336699"
    assert cockpit_page.cockpit_errors == []


def test_workspace_explorer_renders_and_posts_structured_intents(cockpit_page):
    _send_state(cockpit_page, _sample_snapshot())
    cockpit_page.click(".tab[data-tab='workspace-tab']")

    cockpit_page.click(".workspace-node:has-text('cockpit')")
    assert cockpit_page.locator("#workspace-selected-title").inner_text() == "cockpit"

    cockpit_page.click("#workspace-reveal")
    reveal = cockpit_page.evaluate("window.__posted[window.__posted.length - 1]")
    assert reveal["type"] == "eco.cockpit.workspaceReveal"
    assert reveal["workspaceId"] == "smoke-workspace"
    assert reveal["path"] == "cockpit"

    cockpit_page.click("#workspace-status-action")
    status = cockpit_page.evaluate("window.__posted[window.__posted.length - 1]")
    assert status["type"] == "eco.cockpit.workspaceStatus"
    assert status["workspaceId"] == "smoke-workspace"
    assert status["path"] == "cockpit"


def test_refresh_button_posts_refresh_message(cockpit_page):
    cockpit_page.click("#refresh")
    last = cockpit_page.evaluate("window.__posted[window.__posted.length - 1]")
    assert last["type"] == "eco.cockpit.refresh"


def test_helm_mode_renders_current_mode_and_status_tile(cockpit_page):
    _send_state(cockpit_page, _sample_snapshot())

    assert cockpit_page.locator("#ep-mode-state").inner_text() == "Navigator"

    cockpit_page.click(".tab[data-tab='governance']")
    assert cockpit_page.locator("#mode-current").inner_text() == "Navigator"
    assert cockpit_page.locator("#mode-select option").count() == 5
    assert cockpit_page.cockpit_errors == []


def test_helm_mode_activate_posts_set_helm_mode(cockpit_page):
    _send_state(cockpit_page, _sample_snapshot())
    cockpit_page.click(".tab[data-tab='governance']")

    cockpit_page.select_option("#mode-select", "Builder")
    cockpit_page.click("#mode-activate")

    last = cockpit_page.evaluate("window.__posted[window.__posted.length - 1]")
    assert last["type"] == "eco.cockpit.setHelmMode"
    assert last["mode"] == "Builder"
