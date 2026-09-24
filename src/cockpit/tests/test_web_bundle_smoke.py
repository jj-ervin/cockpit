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
import time
from pathlib import Path

import pytest

WEB_DIR = Path(__file__).resolve().parents[3] / "web"

def _wait_for_js_condition(page, expression: str, timeout_ms: int = 5000) -> None:
    deadline = time.monotonic() + (timeout_ms / 1000)
    while time.monotonic() < deadline:
        if page.evaluate(expression):
            return
        page.wait_for_timeout(50)
    raise AssertionError(f"Timed out waiting for JavaScript condition: {expression}")



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
        "development": {"installReadiness": None, "error": None},
        "workspace": {
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
            "repoStatus": [
                {"name": "demo", "path": "demo", "absolute_path": "C:/fake/workspace/demo", "has_git": True},
            ],
        },
        "marlin": {"health": {"status": "ok", "reachable": True}, "error": None},
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
        "diagnostics": {
            "integrations": {
                "eco": {"status": "ok", "reachable": True},
                "marlin": {"status": "ok", "reachable": True},
                "niji": {"status": "degraded", "reachable": False},
            },
            "environment": {
                "python": {"version": "3.14.3", "cockpit_version": "0.1.0"},
                "node": {"available": True, "version": "v24.14.1"},
            },
            "agentPipeline": {
                "source_present": True,
                "total_entries": 2,
                "agents": [
                    {"agent": "codex", "pass_count": 2, "last_play_id": "ckp-play-smoke-002", "last_status": "closed", "last_declared_at": "2026-07-02T00:00:00Z"},
                ],
            },
        },
    }


@pytest.fixture()
def cockpit_page(page, tmp_path: Path):
    """A loaded Cockpit page with a mocked `window.cockpitHost`.

    `window.__posted` accumulates every message the bundle posts to the host.
    Console errors and uncaught JS exceptions are collected onto `page.cockpit_errors`.
    """
    shutil.copy(WEB_DIR / "cockpit.css", tmp_path / "cockpit.css")
    shutil.copy(WEB_DIR / "cockpitState.js", tmp_path / "cockpitState.js")
    shutil.copy(WEB_DIR / "appShell.js", tmp_path / "appShell.js")
    shutil.copy(WEB_DIR / "cockpitApplication.js", tmp_path / "cockpitApplication.js")
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
    _wait_for_js_condition(page, "Boolean(window.__posted && window.__posted.length > 0)")

    page.cockpit_errors = errors  # type: ignore[attr-defined]
    return page


def _send_state(page, snapshot: dict) -> None:
    page.evaluate(
        "(payload) => window.postMessage({ type: 'eco.cockpit.state', payload }, '*')",
        snapshot,
    )
    _wait_for_js_condition(page, "document.getElementById('status').textContent !== '-'")


def test_bundle_loads_without_console_errors_and_sends_ready(cockpit_page):
    posted = cockpit_page.evaluate("window.__posted")
    assert posted[0]["type"] == "eco.cockpit.ready"
    assert cockpit_page.cockpit_errors == []


def test_state_snapshot_hydrates_dashboard_summary(cockpit_page):
    _send_state(cockpit_page, _sample_snapshot())
    assert cockpit_page.locator(".tab[data-tab='hygiene-tab']").count() == 0

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


def test_providers_tile_reflects_marlin_and_niji_reachability(cockpit_page):
    snapshot = _sample_snapshot()
    _send_state(cockpit_page, snapshot)
    assert cockpit_page.locator("#providers-status").inner_text() == "2/2 ok"

    snapshot["marlin"]["error"] = "bridge unreachable"
    cockpit_page.evaluate(
        "(payload) => window.postMessage({ type: 'eco.cockpit.state', payload }, '*')",
        snapshot,
    )
    _wait_for_js_condition(cockpit_page, "document.getElementById('providers-status').textContent === '1/2 ok'")
    assert cockpit_page.locator("#providers-status").inner_text() == "1/2 ok"


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


def test_diagnostics_tab_renders_integrations_environment_and_pipeline(cockpit_page):
    _send_state(cockpit_page, _sample_snapshot())
    cockpit_page.click(".tab[data-tab='diagnostics-tab']")

    assert cockpit_page.locator("#diag-integration-eco").inner_text() == "ok"
    assert cockpit_page.locator("#diag-integration-marlin").inner_text() == "ok"
    assert cockpit_page.locator("#diag-integration-niji").inner_text() == "degraded"

    assert cockpit_page.locator("#diag-env-python-version").inner_text() == "3.14.3"
    assert cockpit_page.locator("#diag-env-cockpit-version").inner_text() == "0.1.0"
    assert cockpit_page.locator("#diag-env-node-version").inner_text() == "v24.14.1"
    assert cockpit_page.locator("#diag-env-node-available").inner_text() == "yes"

    assert cockpit_page.locator("#diag-pipeline-status").inner_text() == "2 entries"
    rows = cockpit_page.locator("#diag-pipeline-table tr")
    assert rows.count() == 1
    assert "codex" in rows.nth(0).inner_text()
    assert cockpit_page.cockpit_errors == []


def test_diagnostics_tab_handles_missing_diagnostics_gracefully(cockpit_page):
    snapshot = _sample_snapshot()
    del snapshot["diagnostics"]
    _send_state(cockpit_page, snapshot)
    cockpit_page.click(".tab[data-tab='diagnostics-tab']")

    assert cockpit_page.locator("#diag-integration-eco").inner_text() == "-"
    assert cockpit_page.locator("#diag-pipeline-table tr").count() == 1  # empty-state row
    assert cockpit_page.cockpit_errors == []


def _provider_result(command_id: str, operation_id: str, status: str = "succeeded") -> dict:
    severity = "pass" if status == "succeeded" else "error"
    bundle = {
        "bundle_id": f"bundle-{operation_id}",
        "operation": command_id,
        "findings": [{
            "id": f"finding-{operation_id}",
            "severity": severity,
            "description": f"{command_id} structured finding",
            "remediation": "Apply the previewed normalization." if severity == "error" else None,
        }],
    }
    return {
        "schema_version": "cockpit-operation-result-v1",
        "operation_id": operation_id,
        "provider_id": "marlin",
        "command_id": command_id,
        "status": status,
        "timestamp": "2026-08-05T00:00:00Z",
        "data": {"message": f"{command_id} completed", "evidence_bundle": bundle},
        "evidence": [{"kind": "gc-audit.evidence-bundle", "ref": bundle["bundle_id"], "digest": "sha256:" + "a" * 64}],
    }


def _send_provider_result(page, result: dict) -> None:
    page.evaluate(
        "(payload) => window.postMessage({ type: 'eco.cockpit.providerCommandResult', payload }, '*')",
        result,
    )
    # `window.postMessage()` dispatches asynchronously. Give the browser event
    # loop a turn before assertions inspect the rendered provider state.
    page.wait_for_timeout(25)


def test_marlin_audit_ui_binds_approval_executes_verifies_and_exports(cockpit_page):
    _send_state(cockpit_page, _sample_snapshot())
    cockpit_page.click(".tab[data-tab='marlin-audit']")
    cockpit_page.select_option("#audit-repository", "C:/fake/workspace/demo")

    cockpit_page.click("#audit-validate")
    request = cockpit_page.evaluate("window.__posted[window.__posted.length - 1]")
    assert request["commandId"] == "marlin.audit.validate"
    assert request["input"] == {"target": "C:/fake/workspace/demo"}
    assert request["confirm"] is False

    _send_provider_result(cockpit_page, _provider_result("marlin.audit.validate", "validate-1", "failed"))
    assert cockpit_page.locator("#audit-findings-count").inner_text() == "1 findings"
    assert "structured finding" in cockpit_page.locator("#audit-validation-result").inner_text()

    cockpit_page.click("#audit-preview")
    _send_provider_result(cockpit_page, _provider_result("marlin.audit.normalize.preview", "preview-1"))
    cockpit_page.click("#audit-request-approval")
    assert cockpit_page.locator("#audit-approval-dialog").is_visible()
    scope_text = cockpit_page.locator("#audit-approval-scope").inner_text()
    assert "marlin.audit.normalize.apply" in scope_text
    assert "C:/fake/workspace/demo" in scope_text
    assert "preview-1" in scope_text

    cockpit_page.check("#audit-approval-check")
    cockpit_page.click("#audit-confirm-approval")
    apply_request = cockpit_page.evaluate("window.__posted[window.__posted.length - 1]")
    assert apply_request["commandId"] == "marlin.audit.normalize.apply"
    assert apply_request["confirm"] is True
    assert apply_request["approval"]["token"]
    assert apply_request["approval"]["scope"] == '{"command_id":"marlin.audit.normalize.apply","input":{"target":"C:/fake/workspace/demo"},"provider_id":"marlin"}'

    _send_provider_result(cockpit_page, _provider_result("marlin.audit.normalize.apply", "apply-1"))
    verify_request = cockpit_page.evaluate("window.__posted[window.__posted.length - 1]")
    assert verify_request["commandId"] == "marlin.audit.verify"
    assert verify_request["confirm"] is False

    _send_provider_result(cockpit_page, _provider_result("marlin.audit.verify", "verify-1"))
    assert cockpit_page.locator("#audit-evidence-status").inner_text() == "Ready to export"
    with cockpit_page.expect_download() as download_info:
        cockpit_page.click("#audit-export-evidence")
    assert download_info.value.suggested_filename == "bundle-verify-1.json"
    assert cockpit_page.cockpit_errors == []


def test_marlin_doctor_ui_lists_binds_approval_registers_and_removes_operations(cockpit_page):
    registry_digest = "sha256:" + "b" * 64
    _send_state(cockpit_page, _sample_snapshot())
    cockpit_page.click(".tab[data-tab='marlin-doctor']")
    cockpit_page.select_option("#doctor-repository", "C:/fake/workspace/demo")

    cockpit_page.click("#doctor-health-refresh")
    health_request = cockpit_page.evaluate("window.__posted[window.__posted.length - 1]")
    assert health_request["providerId"] == "marlin"
    assert health_request["commandId"] == "marlin.doctor.health"
    assert health_request["input"] == {"target": "C:/fake/workspace/demo", "agent_detections": []}
    assert health_request["confirm"] is False
    _send_provider_result(cockpit_page, {
        "schema_version": "cockpit-operation-result-v1",
        "operation_id": "doctor-health-1",
        "provider_id": "marlin",
        "command_id": "marlin.doctor.health",
        "status": "succeeded",
        "timestamp": "2026-08-12T00:00:00Z",
        "data": {"assessment": {
            "schema_version": "marlin.doctor.assessment.v1",
            "assessed_at": "2026-08-12T00:00:00Z",
            "discovery": {
                "target_path": "C:/fake/workspace/demo",
                "is_git_repo": True,
                "dirty": True,
                "default_branch": "main",
                "project_kind": "node",
                "package_manager": "npm",
                "gc_governed": True,
                "policy_pack_path": "C:/fake/workspace/governance-commons/gc-audit/GC-AUDIT-REGISTRY.yaml",
            },
            "tests": {"last_known_status": "pass"},
            "operations": {"registered_count": 1, "enabled_count": 1, "registry_digest": registry_digest},
            "docs": {"dev_path_exists": True, "dev_plan_exists": True, "stale": False},
            "agents": {"detected_count": 0},
            "summary": {"conformance": "unknown", "health": "attention", "flags": ["dirty"]},
        }},
        "evidence": [],
    })
    assert cockpit_page.locator("#doctor-health-status").inner_text() == "Attention needed"
    assert cockpit_page.locator("#doctor-health-project").inner_text() == "node"
    assert cockpit_page.locator("#doctor-health-git").inner_text() == "Dirty"
    assert cockpit_page.locator("#doctor-health-governance").inner_text() == "GC governed"
    assert cockpit_page.locator("#doctor-health-tests").inner_text() == "pass"
    assert "dirty" in cockpit_page.locator("#doctor-health-flags").inner_text()
    assert registry_digest in cockpit_page.locator("#doctor-health-details").inner_text()

    cockpit_page.click("#doctor-refresh")
    request = cockpit_page.evaluate("window.__posted[window.__posted.length - 1]")
    assert request["providerId"] == "marlin"
    assert request["commandId"] == "marlin.doctor.operations.list"
    assert request["input"] == {"target": "C:/fake/workspace/demo"}
    assert request["confirm"] is False

    _send_provider_result(cockpit_page, {
        "schema_version": "cockpit-operation-result-v1",
        "operation_id": "doctor-list-1",
        "provider_id": "marlin",
        "command_id": "marlin.doctor.operations.list",
        "status": "succeeded",
        "timestamp": "2026-08-12T00:00:00Z",
        "data": {
            "target_path": "C:/fake/workspace/demo",
            "registry_path": "C:/fake/workspace/demo/.marlin/doctor.operations.json",
            "registry_digest": None,
            "operations": [],
            "count": 0,
        },
        "evidence": [],
    })
    assert cockpit_page.locator("#doctor-operation-count").inner_text() == "0 operations"

    cockpit_page.fill("#doctor-operation-id", "tests.run")
    cockpit_page.fill("#doctor-operation-title", "Run tests")
    cockpit_page.fill("#doctor-command-json", '["npm","test"]')
    cockpit_page.check("#doctor-operation-preview")
    cockpit_page.fill("#doctor-preview-command-json", '["npm","test","--","--dry-run"]')
    cockpit_page.click("#doctor-add-operation")
    assert cockpit_page.locator("#doctor-approval-dialog").is_visible()
    register_scope_text = cockpit_page.locator("#doctor-approval-scope").inner_text()
    assert "marlin.doctor.operations.register" in register_scope_text
    assert "C:/fake/workspace/demo" in register_scope_text
    assert "tests.run" in register_scope_text

    cockpit_page.check("#doctor-approval-check")
    cockpit_page.click("#doctor-confirm-approval")
    assert not cockpit_page.locator("#doctor-approval-dialog").is_visible()
    register = cockpit_page.evaluate("window.__posted[window.__posted.length - 1]")
    assert register["commandId"] == "marlin.doctor.operations.register"
    assert register["confirm"] is True
    assert register["input"]["target"] == "C:/fake/workspace/demo"
    assert register["input"]["replace"] is True
    assert register["input"]["operation"]["id"] == "tests.run"
    assert register["input"]["operation"]["command"] == ["npm", "test"]
    assert register["input"]["operation"]["preview_command"] == ["npm", "test", "--", "--dry-run"]
    assert register["approval"]["token"]
    assert register["approval"]["scope"] == '{"command_id":"marlin.doctor.operations.register","input":{"operation":{"command":["npm","test"],"id":"tests.run","mutates":false,"output":"auto","preview_command":["npm","test","--","--dry-run"],"requires_confirmation":false,"supports_preview":true,"title":"Run tests"},"replace":true,"target":"C:/fake/workspace/demo"},"provider_id":"marlin"}'

    _send_provider_result(cockpit_page, {
        "schema_version": "cockpit-operation-result-v1",
        "operation_id": "doctor-register-1",
        "provider_id": "marlin",
        "command_id": "marlin.doctor.operations.register",
        "status": "succeeded",
        "timestamp": "2026-08-12T00:00:00Z",
        "data": {
            "target_path": "C:/fake/workspace/demo",
            "registry_path": "C:/fake/workspace/demo/.marlin/doctor.operations.json",
            "registry_digest": registry_digest,
            "operation_id": "tests.run",
            "operations": [{
                "id": "tests.run",
                "title": "Run tests",
                "command": ["npm", "test"],
                "preview_command": ["npm", "test", "--", "--dry-run"],
                "mutates": False,
                "supports_preview": True,
                "inputs": [
                    {"id": "repo", "label": "Repository", "type": "string", "required": True},
                    {"id": "visibility", "label": "Visibility", "type": "choice", "required": True, "choices": ["public", "private"]},
                ],
                "enabled": True,
            }],
            "count": 1,
        },
        "evidence": [],
    })
    assert cockpit_page.locator("#doctor-operation-count").inner_text() == "1 operations"
    assert "tests.run" in cockpit_page.locator("#doctor-operation-table").inner_text()
    assert cockpit_page.locator("#doctor-operation-table button:has-text('Preview')").is_disabled()
    cockpit_page.fill("#doctor-operation-table [data-doctor-input='repo']", "marlin")
    cockpit_page.select_option("#doctor-operation-table [data-doctor-input='visibility']", "private")

    cockpit_page.click("#doctor-operation-table button:has-text('Preview')")
    assert cockpit_page.locator("#doctor-approval-dialog").is_visible()
    assert "preview" in cockpit_page.locator("#doctor-approval-scope").inner_text()
    assert registry_digest in cockpit_page.locator("#doctor-approval-scope").inner_text()
    cockpit_page.check("#doctor-approval-check")
    cockpit_page.click("#doctor-confirm-approval")
    preview = cockpit_page.evaluate("window.__posted[window.__posted.length - 1]")
    assert preview["commandId"] == "marlin.doctor.operations.preview"
    assert preview["confirm"] is True
    assert preview["input"] == {"target": "C:/fake/workspace/demo", "operation_id": "tests.run", "registry_digest": registry_digest, "operation_input": {"repo": "marlin", "visibility": "private"}}
    assert preview["approval"]["scope"] == '{"command_id":"marlin.doctor.operations.preview","input":{"operation_id":"tests.run","operation_input":{"repo":"marlin","visibility":"private"},"registry_digest":"' + registry_digest + '","target":"C:/fake/workspace/demo"},"provider_id":"marlin"}'
    _send_provider_result(cockpit_page, _provider_result("marlin.doctor.operations.preview", "doctor-preview-1"))

    cockpit_page.click("#doctor-operation-table button:has-text('Run')")
    assert cockpit_page.locator("#doctor-approval-dialog").is_visible()
    assert "apply" in cockpit_page.locator("#doctor-approval-scope").inner_text()
    cockpit_page.check("#doctor-approval-check")
    cockpit_page.click("#doctor-confirm-approval")
    apply = cockpit_page.evaluate("window.__posted[window.__posted.length - 1]")
    assert apply["commandId"] == "marlin.doctor.operations.apply"
    assert apply["confirm"] is True
    assert apply["input"] == {"target": "C:/fake/workspace/demo", "operation_id": "tests.run", "registry_digest": registry_digest, "operation_input": {"repo": "marlin", "visibility": "private"}}
    assert apply["approval"]["scope"] == '{"command_id":"marlin.doctor.operations.apply","input":{"operation_id":"tests.run","operation_input":{"repo":"marlin","visibility":"private"},"registry_digest":"' + registry_digest + '","target":"C:/fake/workspace/demo"},"provider_id":"marlin"}'
    _send_provider_result(cockpit_page, _provider_result("marlin.doctor.operations.apply", "doctor-apply-1"))

    cockpit_page.click("#doctor-operation-table button:has-text('Remove')")
    assert cockpit_page.locator("#doctor-approval-dialog").is_visible()
    remove_scope_text = cockpit_page.locator("#doctor-approval-scope").inner_text()
    assert "marlin.doctor.operations.unregister" in remove_scope_text
    assert "tests.run" in remove_scope_text

    cockpit_page.check("#doctor-approval-check")
    cockpit_page.click("#doctor-confirm-approval")
    assert not cockpit_page.locator("#doctor-approval-dialog").is_visible()
    remove = cockpit_page.evaluate("window.__posted[window.__posted.length - 1]")
    assert remove["commandId"] == "marlin.doctor.operations.unregister"
    assert remove["confirm"] is True
    assert remove["input"] == {"target": "C:/fake/workspace/demo", "operation_id": "tests.run"}
    assert remove["approval"]["token"]
    assert remove["approval"]["scope"] == '{"command_id":"marlin.doctor.operations.unregister","input":{"operation_id":"tests.run","target":"C:/fake/workspace/demo"},"provider_id":"marlin"}'
    assert cockpit_page.cockpit_errors == []


def test_marlin_doctor_agent_roster_ui_detects_registers_and_removes_templates(cockpit_page):
    _send_state(cockpit_page, _sample_snapshot())
    cockpit_page.click(".tab[data-tab='marlin-doctor']")
    roster_digest_1 = "sha256:" + "a" * 64
    roster_digest_2 = "sha256:" + "b" * 64

    # detect is disabled until a roster digest is known -- there is nothing
    # yet to bind an approval to.
    assert cockpit_page.locator("#agent-roster-detect").is_disabled()

    # list: read-only, no approval dialog.
    cockpit_page.click("#agent-roster-list")
    list_request = cockpit_page.evaluate("window.__posted[window.__posted.length - 1]")
    assert list_request["providerId"] == "marlin"
    assert list_request["commandId"] == "marlin.doctor.agents.list"
    assert list_request["input"] == {}
    assert list_request["confirm"] is False
    assert not cockpit_page.locator("#agent-approval-dialog").is_visible()

    _send_provider_result(cockpit_page, {
        "schema_version": "cockpit-operation-result-v1",
        "operation_id": "agents-list-1",
        "provider_id": "marlin",
        "command_id": "marlin.doctor.agents.list",
        "status": "succeeded",
        "timestamp": "2026-08-12T00:00:00Z",
        "data": {
            "roster_path": "C:/fake/marlin-home/doctor-agents.json",
            "roster_digest": roster_digest_1,
            "templates": [
                {
                    "id": "codex", "name": "Codex CLI", "capabilities": ["diagnose", "patch"],
                    "builtin": True, "detect": {"command": ["codex", "--version"]},
                },
            ],
            "count": 1,
        },
        "evidence": [],
    })
    assert cockpit_page.locator("#agent-roster-count").inner_text() == "1 templates"
    assert "codex" in cockpit_page.locator("#agent-roster-table").inner_text()
    # Built-in row has no Remove button.
    assert cockpit_page.locator("#agent-roster-table button:has-text('Remove')").count() == 0
    assert not cockpit_page.locator("#agent-roster-detect").is_disabled()

    # detect: mutating (spawns a real bounded process per template), must
    # bind approval the same as register/unregister -- not a silent read --
    # and the approval must be bound to the exact roster digest just loaded,
    # with the real detect argv visible, not a vague "all templates" label.
    cockpit_page.click("#agent-roster-detect")
    assert cockpit_page.locator("#agent-approval-dialog").is_visible()
    detect_scope_text = cockpit_page.locator("#agent-approval-scope").inner_text()
    assert "marlin.doctor.agents.detect" in detect_scope_text
    assert roster_digest_1 in detect_scope_text
    assert "codex --version" in detect_scope_text
    cockpit_page.check("#agent-approval-check")
    cockpit_page.click("#agent-confirm-approval")
    assert not cockpit_page.locator("#agent-approval-dialog").is_visible()
    detect_request = cockpit_page.evaluate("window.__posted[window.__posted.length - 1]")
    assert detect_request["commandId"] == "marlin.doctor.agents.detect"
    assert detect_request["confirm"] is True
    assert detect_request["input"] == {"roster_digest": roster_digest_1}
    assert detect_request["approval"]["token"]
    assert detect_request["approval"]["scope"] == (
        '{"command_id":"marlin.doctor.agents.detect","input":{"roster_digest":"' + roster_digest_1 + '"},"provider_id":"marlin"}'
    )

    _send_provider_result(cockpit_page, {
        "schema_version": "cockpit-operation-result-v1",
        "operation_id": "agents-detect-1",
        "provider_id": "marlin",
        "command_id": "marlin.doctor.agents.detect",
        "status": "succeeded",
        "timestamp": "2026-08-12T00:00:00Z",
        "data": {
            "roster_digest": roster_digest_1,
            "results": [{"id": "codex", "name": "Codex CLI", "detected": False, "version_output": "", "exit_code": None}],
            "detected_count": 0,
            "count": 1,
        },
        "evidence": [],
    })
    assert "not detected" in cockpit_page.locator("#agent-roster-table").inner_text()

    # register a custom template through the approval dialog.
    cockpit_page.fill("#agent-template-id", "lmstudio")
    cockpit_page.fill("#agent-template-name", "LM Studio (local)")
    cockpit_page.fill("#agent-detect-command-json", '["lms","--version"]')
    cockpit_page.fill("#agent-run-command-json", '["lms","chat"]')
    cockpit_page.fill("#agent-template-capabilities", "diagnose, explain")
    cockpit_page.click("#agent-roster-add")
    assert cockpit_page.locator("#agent-approval-dialog").is_visible()
    register_scope_text = cockpit_page.locator("#agent-approval-scope").inner_text()
    assert "marlin.doctor.agents.register" in register_scope_text
    assert "lmstudio" in register_scope_text

    cockpit_page.check("#agent-approval-check")
    cockpit_page.click("#agent-confirm-approval")
    register_request = cockpit_page.evaluate("window.__posted[window.__posted.length - 1]")
    assert register_request["commandId"] == "marlin.doctor.agents.register"
    assert register_request["confirm"] is True
    assert register_request["input"]["template"]["id"] == "lmstudio"
    assert register_request["input"]["template"]["detect"]["command"] == ["lms", "--version"]
    assert register_request["input"]["template"]["run"]["command"] == ["lms", "chat"]
    assert register_request["input"]["template"]["capabilities"] == ["diagnose", "explain"]
    assert register_request["input"]["replace"] is True

    _send_provider_result(cockpit_page, {
        "schema_version": "cockpit-operation-result-v1",
        "operation_id": "agents-register-1",
        "provider_id": "marlin",
        "command_id": "marlin.doctor.agents.register",
        "status": "succeeded",
        "timestamp": "2026-08-12T00:00:00Z",
        "data": {
            "roster_path": "C:/fake/marlin-home/doctor-agents.json",
            "roster_digest": roster_digest_2,
            "template_id": "lmstudio",
            "templates": [
                {"id": "codex", "name": "Codex CLI", "capabilities": ["diagnose", "patch"], "builtin": True},
                {
                    "id": "lmstudio", "name": "LM Studio (local)", "capabilities": ["diagnose", "explain"],
                    "builtin": False, "detect": {"command": ["lms", "--version"]},
                },
            ],
            "count": 2,
        },
        "evidence": [],
    })
    assert cockpit_page.locator("#agent-roster-count").inner_text() == "2 templates"
    # Custom row has a Remove button; built-in row still does not.
    assert cockpit_page.locator("#agent-roster-table button:has-text('Remove')").count() == 1

    # Registering changed the roster -- a subsequent detect must bind to the
    # *new* digest, not the stale one captured before the mutation. This is
    # the actual TOCTOU protection: prove the client doesn't silently reuse
    # an old digest after the roster it describes no longer exists.
    cockpit_page.click("#agent-roster-detect")
    assert cockpit_page.locator("#agent-approval-scope").inner_text().count(roster_digest_2) >= 1
    assert "lms --version" in cockpit_page.locator("#agent-approval-scope").inner_text()
    cockpit_page.check("#agent-approval-check")
    cockpit_page.click("#agent-confirm-approval")
    second_detect_request = cockpit_page.evaluate("window.__posted[window.__posted.length - 1]")
    assert second_detect_request["input"] == {"roster_digest": roster_digest_2}
    _send_provider_result(cockpit_page, {
        "schema_version": "cockpit-operation-result-v1",
        "operation_id": "agents-detect-2",
        "provider_id": "marlin",
        "command_id": "marlin.doctor.agents.detect",
        "status": "succeeded",
        "timestamp": "2026-08-12T00:00:00Z",
        "data": {
            "roster_digest": roster_digest_2,
            "results": [
                {"id": "codex", "name": "Codex CLI", "detected": False, "version_output": "", "exit_code": None},
                {"id": "lmstudio", "name": "LM Studio (local)", "detected": False, "version_output": "", "exit_code": None},
            ],
            "detected_count": 0,
            "count": 2,
        },
        "evidence": [],
    })

    # remove the custom template.
    cockpit_page.click("#agent-roster-table button:has-text('Remove')")
    assert cockpit_page.locator("#agent-approval-dialog").is_visible()
    remove_scope_text = cockpit_page.locator("#agent-approval-scope").inner_text()
    assert "marlin.doctor.agents.unregister" in remove_scope_text
    assert "lmstudio" in remove_scope_text

    cockpit_page.check("#agent-approval-check")
    cockpit_page.click("#agent-confirm-approval")
    remove_request = cockpit_page.evaluate("window.__posted[window.__posted.length - 1]")
    assert remove_request["commandId"] == "marlin.doctor.agents.unregister"
    assert remove_request["confirm"] is True
    assert remove_request["input"] == {"template_id": "lmstudio"}
    assert remove_request["approval"]["scope"] == '{"command_id":"marlin.doctor.agents.unregister","input":{"template_id":"lmstudio"},"provider_id":"marlin"}'
    assert cockpit_page.cockpit_errors == []
