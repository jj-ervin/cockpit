"""Phase 1 package install automation for Cockpit."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Sequence


Runner = Callable[..., subprocess.CompletedProcess[str]]


@dataclass(frozen=True)
class InstallStep:
    """One install automation step."""

    name: str
    command: list[str]
    cwd: str | None = None
    input_text: str | None = None


@dataclass
class StepResult:
    """Serializable result for one install automation step."""

    name: str
    command: list[str]
    exit_code: int
    stdout: str = ""
    stderr: str = ""
    skipped: bool = False
    details: dict[str, Any] = field(default_factory=dict)

    @property
    def ok(self) -> bool:
        return self.skipped or self.exit_code == 0


def build_steps(
    *,
    project_root: Path,
    workspace: Path,
    python: str,
    editable: bool = True,
    include_tests: bool = True,
    include_bridge: bool = True,
) -> list[InstallStep]:
    """Build the Phase 1 install command sequence."""
    install_command = [python, "-m", "pip", "install"]
    if editable:
        install_command.append("-e")
    install_command.append(str(project_root))

    steps = [
        InstallStep(
            name="install",
            command=install_command,
            cwd=str(project_root),
        )
    ]

    if include_tests:
        steps.append(
            InstallStep(
                name="pytest",
                command=[python, "-m", "pytest"],
                cwd=str(project_root),
            )
        )

    if include_bridge:
        request = {
            "backend": "eco",
            "workspace_id": str(workspace),
            "node_id": None,
            "operation": "health",
        }
        steps.append(
            InstallStep(
                name="bridge-smoke",
                command=[python, "-m", "cockpit.host_bridge"],
                cwd=str(project_root),
                input_text=json.dumps(request),
            )
        )

    return steps


def run_install(
    *,
    project_root: Path,
    workspace: Path,
    python: str = sys.executable,
    editable: bool = True,
    include_tests: bool = True,
    include_bridge: bool = True,
    dry_run: bool = True,
    allow_degraded_bridge: bool = False,
    runner: Runner = subprocess.run,
) -> list[StepResult]:
    """Run or preview Phase 1 package install automation."""
    project_root = project_root.resolve()
    workspace = workspace.resolve()
    _validate_project_root(project_root)

    steps = build_steps(
        project_root=project_root,
        workspace=workspace,
        python=python,
        editable=editable,
        include_tests=include_tests,
        include_bridge=include_bridge,
    )

    if dry_run:
        return [
            StepResult(
                name=step.name,
                command=step.command,
                exit_code=0,
                skipped=True,
                details={"cwd": step.cwd},
            )
            for step in steps
        ]

    results: list[StepResult] = []
    for step in steps:
        completed = runner(
            step.command,
            cwd=step.cwd,
            input=step.input_text,
            text=True,
            capture_output=True,
        )
        result = StepResult(
            name=step.name,
            command=step.command,
            exit_code=completed.returncode,
            stdout=completed.stdout,
            stderr=completed.stderr,
        )
        if step.name == "bridge-smoke":
            result = _with_bridge_details(result, allow_degraded_bridge)
        results.append(result)
        if not result.ok:
            break
    return results


def main(argv: Sequence[str] | None = None) -> int:
    args = _parse_args(argv)
    workspace = args.workspace or _default_workspace(args.project_root)
    dry_run = not args.apply
    results = run_install(
        project_root=args.project_root,
        workspace=workspace,
        python=args.python,
        editable=not args.no_editable,
        include_tests=not args.skip_tests,
        include_bridge=not args.skip_bridge,
        dry_run=dry_run,
        allow_degraded_bridge=args.allow_degraded_bridge,
    )

    payload = {
        "ok": all(result.ok for result in results),
        "mode": "apply" if args.apply else "preview",
        "project_root": str(args.project_root.resolve()),
        "workspace": str(workspace.resolve()),
        "steps": [_result_to_dict(result) for result in results],
    }
    if args.json:
        print(json.dumps(payload, indent=2))
    else:
        _print_human(payload)
    return 0 if payload["ok"] else 1


def _parse_args(argv: Sequence[str] | None) -> argparse.Namespace:
    default_root = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser(
        description="Install and smoke-test the Cockpit Phase 1 Python package."
    )
    parser.add_argument("--project-root", type=Path, default=default_root)
    parser.add_argument("--workspace", type=Path)
    parser.add_argument("--python", default=sys.executable)
    parser.add_argument("--no-editable", action="store_true")
    parser.add_argument("--skip-tests", action="store_true")
    parser.add_argument("--skip-bridge", action="store_true")
    parser.add_argument("--allow-degraded-bridge", action="store_true")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--apply",
        action="store_true",
        help="Run the install, test, and bridge smoke steps. Omit for preview.",
    )
    mode.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview the install, test, and bridge smoke steps. This is the default.",
    )
    parser.add_argument("--json", action="store_true")
    return parser.parse_args(argv)


def _default_workspace(project_root: Path) -> Path:
    portfolio_eco = project_root.resolve().parent / "eco"
    if portfolio_eco.exists():
        return portfolio_eco
    return project_root


def _validate_project_root(project_root: Path) -> None:
    pyproject = project_root / "pyproject.toml"
    package_root = project_root / "src" / "cockpit"
    if not pyproject.exists() or not package_root.exists():
        raise ValueError(f"{project_root} is not a Cockpit project root")


def _with_bridge_details(
    result: StepResult,
    allow_degraded_bridge: bool,
) -> StepResult:
    if result.exit_code != 0:
        return result
    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        result.exit_code = 1
        result.details["error"] = f"bridge returned invalid JSON: {exc}"
        return result

    result.details["bridge"] = payload
    status = payload.get("data", {}).get("status")
    if status != "ok" and not allow_degraded_bridge:
        result.exit_code = 1
        result.details["error"] = f"bridge health was {status!r}, expected 'ok'"
    return result


def _result_to_dict(result: StepResult) -> dict[str, Any]:
    return {
        "name": result.name,
        "command": result.command,
        "exit_code": result.exit_code,
        "ok": result.ok,
        "skipped": result.skipped,
        "stdout": result.stdout.strip(),
        "stderr": result.stderr.strip(),
        "details": result.details,
    }


def _print_human(payload: dict[str, Any]) -> None:
    print(f"Cockpit Phase 1 install ({payload['mode']}): {'ok' if payload['ok'] else 'failed'}")
    print(f"Project: {payload['project_root']}")
    print(f"Workspace: {payload['workspace']}")
    for step in payload["steps"]:
        state = "skipped" if step["skipped"] else ("ok" if step["ok"] else "failed")
        print(f"- {step['name']}: {state}")
        if not step["ok"]:
            if step["stderr"]:
                print(step["stderr"])
            elif step["stdout"]:
                print(step["stdout"])


if __name__ == "__main__":
    raise SystemExit(main())
