[CmdletBinding()]
param(
    [switch] $SkipNpmCi
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$pyInstaller = Join-Path $repoRoot ".venv\Scripts\pyinstaller.exe"
$desktopRoot = Join-Path $repoRoot "desktop"

if (-not (Test-Path -LiteralPath $pyInstaller -PathType Leaf)) {
    throw "PyInstaller is unavailable at $pyInstaller. Install Cockpit's package extra first."
}

Push-Location $repoRoot
try {
    & $pyInstaller "cockpit-bridge.spec" --noconfirm --clean
    if ($LASTEXITCODE -ne 0) { throw "PyInstaller failed with exit code $LASTEXITCODE." }

    Push-Location $desktopRoot
    try {
        if (-not $SkipNpmCi) {
            & npm ci
            if ($LASTEXITCODE -ne 0) { throw "npm ci failed with exit code $LASTEXITCODE." }
        }
        & npm run check
        if ($LASTEXITCODE -ne 0) { throw "Desktop syntax checks failed with exit code $LASTEXITCODE." }
        & npm run build:win
        if ($LASTEXITCODE -ne 0) { throw "Desktop installer build failed with exit code $LASTEXITCODE." }
    } finally {
        Pop-Location
    }
} finally {
    Pop-Location
}

$installer = Join-Path $desktopRoot "release\Cockpit-1.0.0-windows-x64-setup.exe"
if (-not (Test-Path -LiteralPath $installer -PathType Leaf)) {
    throw "Expected installer was not produced at $installer."
}
Write-Output $installer
