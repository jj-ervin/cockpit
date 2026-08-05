[CmdletBinding()]
param(
    [switch] $SkipNpmCi,
    [string] $OutputDirectory = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$pyInstaller = Join-Path $repoRoot ".venv\Scripts\pyinstaller.exe"
$desktopRoot = Join-Path $repoRoot "desktop"
if (-not $OutputDirectory) {
    $OutputDirectory = Join-Path $repoRoot "dist\marlin"
}
$payloadDirectory = Join-Path $desktopRoot "release\win-unpacked"
$payloadPath = Join-Path $OutputDirectory "cockpit-core-1.0.0-windows-x64.zip"

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
        if ($LASTEXITCODE -ne 0) { throw "Desktop payload build failed with exit code $LASTEXITCODE." }
    } finally {
        Pop-Location
    }
} finally {
    Pop-Location
}

if (-not (Test-Path -LiteralPath $payloadDirectory -PathType Container)) {
    throw "Expected unpacked Cockpit payload was not produced at $payloadDirectory."
}
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
if (Test-Path -LiteralPath $payloadPath) {
    Remove-Item -LiteralPath $payloadPath -Force
}
Compress-Archive -Path (Join-Path $payloadDirectory "*") -DestinationPath $payloadPath -CompressionLevel Optimal
$hash = (Get-FileHash -LiteralPath $payloadPath -Algorithm SHA256).Hash.ToLowerInvariant()
[pscustomobject]@{
    artifact = $payloadPath
    sha256 = $hash
} | ConvertTo-Json -Compress
