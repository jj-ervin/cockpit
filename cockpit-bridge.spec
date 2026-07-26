# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec for Cockpit's local JSON host bridge."""

from pathlib import Path

SRC = Path("src")

a = Analysis(
    [str(SRC / "cockpit" / "host_bridge.py")],
    pathex=[str(SRC)],
    binaries=[],
    datas=[],
    hiddenimports=["cockpit.adapters.eco", "cockpit.adapters.marlin", "yaml", "jsonschema"],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["pytest"],
    noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz, a.scripts, [], exclude_binaries=True, name="cockpit-bridge",
    debug=False, bootloader_ignore_signals=False, strip=False, upx=True,
    console=True, disable_windowed_traceback=False,
)
coll = COLLECT(exe, a.binaries, a.datas, strip=False, upx=True, upx_exclude=[], name="cockpit-bridge")
