# CKP.05 Packaging Checklist

Status: active checklist  
Updated: 2026-07-01

## Scope

CKP.05 covers the first packageable Cockpit shape:

- Phase 1: `cockpit` Python package owns adapter behavior.
- Phase 2: VS Code host consumes the Python package through `cockpit.host_bridge`.
- Phase 3: standalone shell is out of scope for this checklist.

## Python Package

- Build backend: Hatchling via `pyproject.toml`.
- Package import: `cockpit`.
- Host bridge entrypoint: `python -m cockpit.host_bridge`.
- Required bridge operations: `health`, `get_state`, `list_records`, `get_record`.
- Prohibited bridge operations for v0.1 packaging: writes, installs, approvals, policy edits.

Local development install:

```powershell
cd C:\dev\cockpit
python -m pip install -e .
python -m pytest
```

Automated Phase 1 install:

```powershell
cd C:\dev\cockpit
python -m cockpit.install_phase1 --workspace C:\dev\eco
```

The automation performs editable package install, Python tests, and a read-only
`cockpit.host_bridge` health smoke against the selected eco workspace. It does not
perform Marlin package writes or Cockpit policy/run mutations.

Bridge smoke:

```powershell
$env:PYTHONPATH = "C:\dev\cockpit\src"
'{"backend":"eco","workspace_id":"C:\\dev\\eco","node_id":null,"operation":"health"}' | python -m cockpit.host_bridge
```

## VS Code Host

The VS Code extension resolves Cockpit in this order:

1. `eco.cockpit.packageRoot` setting.
2. Sibling `cockpit` checkout beside `eco-vscode`.
3. Active Python environment import.

Required settings:

- `eco.cockpit.pythonPath`
- `eco.cockpit.packageRoot`
- `eco.cockpit.bridgeTimeoutMs`

Required commands:

- `eco: Open Cockpit`
- `eco: Cockpit Bridge Health`

VS Code build:

```powershell
cd C:\dev\eco-vscode
npm run build
```

Compiled bridge smoke:

```powershell
cd C:\dev\eco-vscode
node -e "const { createPythonEcoCockpitApi } = require('./out/cockpitApi.js'); const api = createPythonEcoCockpitApi('C:\\dev\\eco', null, { pythonPath: 'python', packageRoot: 'C:\\dev\\cockpit', timeoutMs: 10000 }); Promise.all([api.health(), api.getState(), api.listRecords('run')]).then(([h,s,r]) => console.log(JSON.stringify({health:h.data.status,totalRuns:s.data.total_runs,runs:r.data.length,backend:s.origin.backend}))).catch(err => { console.error(err); process.exit(1); });"
```

## Visual Smoke

Launch Extension Development Host against an eco-governed workspace:

```powershell
code --new-window --extensionDevelopmentPath=C:\dev\eco-vscode C:\dev\eco --command eco.openCockpit
```

Expected panel state:

- `Status`: `Detected`
- `Health`: `ok`
- `.eco Root`: `yes`
- `Total Runs`: matches `.eco/runs/*.json`
- Footer has no bridge error.

## Release Exclusions

VSIX packaging must exclude:

- `AGENTS.md`
- `CLAUDE.md`
- `CHATGPT.md`
- `DEV-PATH.md`
- `DEV-PLAN.md`
- `DEV-RELEASE.md`
- `DEV-TRACKS.md`
- `REVIEW-GRAMMAR.md`
- source TypeScript files and scripts after build
- local `.venv`, cache, and generated test folders

## Done Criteria

- Python tests pass.
- `python -m cockpit.install_phase1 --workspace C:\dev\eco` passes.
- VS Code extension build passes.
- `eco: Cockpit Bridge Health` reports OK.
- `eco: Open Cockpit` visually loads against `C:\dev\eco`.
- No private dev docs are included in VSIX packaging.
