[CmdletBinding()]
param(
    [switch] $SkipNpmCi,
    [string] $OutputDirectory = "",
    [ValidateSet("x64", "arm64")]
    [string] $Architecture = "x64",
    [string] $PythonExecutable = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$desktopRoot = Join-Path $repoRoot "desktop"
if (-not $PythonExecutable) {
    $venvName = if ($Architecture -eq "arm64") { ".venv-arm64" } else { ".venv" }
    $PythonExecutable = Join-Path $repoRoot "$venvName\Scripts\python.exe"
}
$python = (Resolve-Path -LiteralPath $PythonExecutable).Path
$assertPe = Join-Path $PSScriptRoot "assert-pe-architecture.ps1"
if (-not $OutputDirectory) {
    $OutputDirectory = Join-Path $repoRoot "dist\marlin"
}
$unpackedName = if ($Architecture -eq "arm64") { "win-arm64-unpacked" } else { "win-unpacked" }
$payloadDirectory = Join-Path $desktopRoot "release\$Architecture\$unpackedName"
$payloadPath = Join-Path $OutputDirectory "cockpit-core-1.0.0-windows-$Architecture.zip"

& $assertPe -Path $python -Architecture $Architecture | Out-Null
& $python -m PyInstaller --version | Out-Null
if ($LASTEXITCODE -ne 0) { throw "PyInstaller is unavailable from $python. Install Cockpit's package extra first." }

Push-Location $repoRoot
try {
    & $python -m PyInstaller "cockpit-bridge.spec" --noconfirm --clean
    if ($LASTEXITCODE -ne 0) { throw "PyInstaller failed with exit code $LASTEXITCODE." }
    & $assertPe -Path (Join-Path $repoRoot "dist\cockpit-bridge\cockpit-bridge.exe") -Architecture $Architecture | Out-Null

    Push-Location $desktopRoot
    try {
        if (-not $SkipNpmCi) {
            & npm ci
            if ($LASTEXITCODE -ne 0) { throw "npm ci failed with exit code $LASTEXITCODE." }
        }
        & npm run check
        if ($LASTEXITCODE -ne 0) { throw "Desktop syntax checks failed with exit code $LASTEXITCODE." }
        & npm run "build:win:$Architecture"
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
& $assertPe -Path (Join-Path $payloadDirectory "Cockpit.exe") -Architecture $Architecture | Out-Null
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
