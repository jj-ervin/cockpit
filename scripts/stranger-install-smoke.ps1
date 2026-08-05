[CmdletBinding()]
param(
    [string] $InstallerPath = "",
    [switch] $KeepProof
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
if (-not $InstallerPath) {
    $InstallerPath = Join-Path $repoRoot "desktop\release\Cockpit-1.0.0-windows-x64-setup.exe"
}
$installer = (Resolve-Path -LiteralPath $InstallerPath).Path
$tempRoot = (Resolve-Path -LiteralPath ([System.IO.Path]::GetTempPath())).Path.TrimEnd('\')
$proofRoot = Join-Path $tempRoot ("cockpit-stranger-proof-" + [guid]::NewGuid().ToString("N"))
$installRoot = Join-Path $proofRoot "installed-cockpit"
$workspaceRoot = Join-Path $proofRoot "ordinary-repository"
$userDataRoot = Join-Path $proofRoot "electron-user-data"
$resultPath = Join-Path $proofRoot "stranger-result.json"
$stdoutPath = Join-Path $proofRoot "cockpit.stdout.log"
$stderrPath = Join-Path $proofRoot "cockpit.stderr.log"

function Wait-CheckedProcess([System.Diagnostics.Process] $Process, [int] $TimeoutSeconds, [string] $Label) {
    try {
        Wait-Process -Id $Process.Id -Timeout $TimeoutSeconds -ErrorAction Stop
    } catch {
        Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue
        throw "$Label timed out after $TimeoutSeconds seconds."
    }
    $Process.Refresh()
    if ($Process.ExitCode -ne 0) {
        throw "$Label failed with exit code $($Process.ExitCode)."
    }
}

function Assert-ProofPath([string] $Candidate) {
    $resolved = [System.IO.Path]::GetFullPath($Candidate).TrimEnd('\')
    if (-not $resolved.StartsWith($proofRoot + '\', [System.StringComparison]::OrdinalIgnoreCase) -and
        -not $resolved.Equals($proofRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing cleanup outside the isolated proof root: $resolved"
    }
}

New-Item -ItemType Directory -Path $proofRoot, $workspaceRoot, $userDataRoot -Force | Out-Null
try {
    & git -C $workspaceRoot init | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Could not initialize the ordinary repository fixture." }

    $copiedInstaller = Join-Path $proofRoot "Cockpit-setup.exe"
    Copy-Item -LiteralPath $installer -Destination $copiedInstaller
    $installProcess = Start-Process -FilePath $copiedInstaller -ArgumentList @("/S", "/D=$installRoot") -PassThru -WindowStyle Hidden
    Wait-CheckedProcess $installProcess 180 "Cockpit installer"

    $cockpitExe = Join-Path $installRoot "Cockpit.exe"
    $bridgeExe = Join-Path $installRoot "resources\bridge\cockpit-bridge.exe"
    $requestSchema = Join-Path $installRoot "resources\bridge\_internal\schemas\cockpit-operation-request-v1.schema.json"
    foreach ($required in @($cockpitExe, $bridgeExe, $requestSchema)) {
        if (-not (Test-Path -LiteralPath $required -PathType Leaf)) {
            throw "Installed payload is missing $required."
        }
    }

    $smokeEnvironment = @{
        ELECTRON_RUN_AS_NODE = $null
        COCKPIT_SMOKE_TEST = "1"
        COCKPIT_SMOKE_RESULT = $resultPath
        COCKPIT_SMOKE_USER_DATA = $userDataRoot
        COCKPIT_WORKSPACE = $workspaceRoot
    }
    $appProcess = Start-Process -FilePath $cockpitExe -PassThru -WorkingDirectory $proofRoot -Environment $smokeEnvironment -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
    Wait-CheckedProcess $appProcess 90 "Installed Cockpit smoke"

    $result = Get-Content -Raw -LiteralPath $resultPath | ConvertFrom-Json
    if ($result.status -ne "passed" -or -not $result.packaged) {
        throw "Installed Cockpit did not report a packaged PASS."
    }
    if (-not [System.IO.Path]::GetFullPath([string]$result.workspace_root).Equals([System.IO.Path]::GetFullPath($workspaceRoot), [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Installed Cockpit opened the wrong workspace."
    }
    if ([string]$result.resources_path -like "C:\dev\*") {
        throw "Installed Cockpit resolved resources from the development portfolio."
    }
    if (-not $result.ui.auditTab -or $result.ui.tabCount -lt 5) {
        throw "Installed Cockpit did not render the expected standalone shell."
    }

    $evidence = [ordered]@{
        status = "PASS"
        installer_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $copiedInstaller).Hash.ToLowerInvariant()
        proof_root = $proofRoot
        install_root = $installRoot
        workspace_root = $workspaceRoot
        packaged = [bool]$result.packaged
        resources_path = [string]$result.resources_path
        bridge_path = [string]$result.bridge_path
        shell_title = [string]$result.ui.title
        shell_tabs = [int]$result.ui.tabCount
        footer = [string]$result.ui.footer
    }
    $evidence | ConvertTo-Json -Depth 5
} finally {
    $uninstaller = Join-Path $installRoot "Uninstall Cockpit.exe"
    if (Test-Path -LiteralPath $uninstaller -PathType Leaf) {
        $uninstallProcess = Start-Process -FilePath $uninstaller -ArgumentList @("/S") -PassThru -WindowStyle Hidden
        Wait-CheckedProcess $uninstallProcess 120 "Cockpit uninstaller"
        $uninstallDeadline = [DateTime]::UtcNow.AddSeconds(30)
        while ((Test-Path -LiteralPath $installRoot) -and [DateTime]::UtcNow -lt $uninstallDeadline) {
            Start-Sleep -Milliseconds 200
        }
        if (Test-Path -LiteralPath $installRoot) {
            throw "Cockpit uninstaller did not release the isolated install directory."
        }
    }
    if (-not $KeepProof -and (Test-Path -LiteralPath $proofRoot)) {
        Assert-ProofPath $proofRoot
        Remove-Item -LiteralPath $proofRoot -Recurse -Force
    } elseif ($KeepProof) {
        Write-Output "Proof retained at $proofRoot"
    }
}
