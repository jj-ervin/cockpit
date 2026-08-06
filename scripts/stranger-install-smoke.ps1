[CmdletBinding()]
param(
    [string] $InstallerPath = "C:\dev\marlin\apps\setup\release\MarlinSetup-0.2.0-windows-x64.exe",
    [string] $SandboxRoot = "C:\sandbox",
    [ValidateSet("x64", "arm64")]
    [string] $Architecture = "x64",
    [switch] $KeepProof
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$installer = (Resolve-Path -LiteralPath $InstallerPath).Path
$sandbox = (Resolve-Path -LiteralPath $SandboxRoot).Path.TrimEnd('\')
$proofRoot = Join-Path $sandbox ("cockpit-marlin-proof-" + [guid]::NewGuid().ToString("N"))
$setupRoot = Join-Path $proofRoot "marlin-setup"
$marlinHome = Join-Path $proofRoot "marlin-home"
$workspaceRoot = Join-Path $proofRoot "ordinary-repository"
$userDataRoot = Join-Path $proofRoot "cockpit-user-data"
$setupResultPath = Join-Path $proofRoot "marlin-setup-result.json"
$cockpitResultPath = Join-Path $proofRoot "cockpit-result.json"
$assertPe = Join-Path $PSScriptRoot "assert-pe-architecture.ps1"

function Wait-CheckedProcess([System.Diagnostics.Process] $Process, [int] $TimeoutSeconds, [string] $Label) {
    try {
        Wait-Process -Id $Process.Id -Timeout $TimeoutSeconds -ErrorAction Stop
    } catch {
        Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue
        throw "$Label timed out after $TimeoutSeconds seconds."
    }
    $Process.Refresh()
    if ($Process.ExitCode -ne 0) { throw "$Label failed with exit code $($Process.ExitCode)." }
}

function Assert-ProofPath([string] $Candidate) {
    $resolved = [System.IO.Path]::GetFullPath($Candidate).TrimEnd('\')
    if (-not $resolved.StartsWith($proofRoot + '\', [System.StringComparison]::OrdinalIgnoreCase) -and
        -not $resolved.Equals($proofRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing cleanup outside the isolated proof root: $resolved"
    }
}

function Get-PeMachine([string] $Candidate) {
    $bytes = [System.IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $Candidate).Path)
    $peOffset = [BitConverter]::ToInt32($bytes, 0x3c)
    return "0x$(([BitConverter]::ToUInt16($bytes, $peOffset + 4)).ToString('X4'))"
}

New-Item -ItemType Directory -Path $proofRoot, $workspaceRoot, $userDataRoot -Force | Out-Null
try {
    & git -C $workspaceRoot init | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Could not initialize the ordinary repository fixture." }

    $setupEnvironment = @{
        ELECTRON_RUN_AS_NODE = $null
        MARLIN_HOME = $marlinHome
        MARLIN_SETUP_SMOKE = "1"
        MARLIN_SETUP_RESULT = $setupResultPath
        MARLIN_SETUP_COCKPIT_RESULT = $cockpitResultPath
        MARLIN_SETUP_COCKPIT_USER_DATA = $userDataRoot
        MARLIN_SETUP_WORKSPACE = $workspaceRoot
    }
    $copiedInstaller = Join-Path $proofRoot "MarlinSetup.exe"
    Copy-Item -LiteralPath $installer -Destination $copiedInstaller
    $installProcess = Start-Process -FilePath $copiedInstaller -ArgumentList @("/S", "/D=$setupRoot") -PassThru -WindowStyle Hidden -Environment $setupEnvironment
    Wait-CheckedProcess $installProcess 240 "MarlinSetup installer"

    $setupExe = Join-Path $setupRoot "MarlinSetup.exe"
    $bundledArtifact = Join-Path $setupRoot "resources\bootstrap\cockpit-core-1.0.0-windows-$Architecture.zip"
    # The NSIS archive is solid and carries a large already-compressed payload.
    # ARM64 hosts with real-time scanning can take several minutes before the
    # final executable appears even after the launcher process has exited.
    $payloadDeadline = [DateTime]::UtcNow.AddSeconds(600)
    while ((-not (Test-Path -LiteralPath $setupExe -PathType Leaf) -or
            -not (Test-Path -LiteralPath $bundledArtifact -PathType Leaf)) -and
            [DateTime]::UtcNow -lt $payloadDeadline) {
        Start-Sleep -Milliseconds 250
    }
    foreach ($required in @($setupExe, $bundledArtifact)) {
        if (-not (Test-Path -LiteralPath $required -PathType Leaf)) { throw "MarlinSetup payload is missing $required." }
    }
    & $assertPe -Path $setupExe -Architecture $Architecture | Out-Null

    $runningSetup = @(Get-Process -Name "MarlinSetup" -ErrorAction SilentlyContinue | Where-Object {
        try { $_.Path.StartsWith($setupRoot + '\', [System.StringComparison]::OrdinalIgnoreCase) } catch { $false }
    })
    if ($runningSetup.Count -eq 0) {
        Start-Process -FilePath $setupExe -WorkingDirectory $proofRoot -Environment $setupEnvironment -WindowStyle Hidden | Out-Null
    }

    $resultDeadline = [DateTime]::UtcNow.AddSeconds(300)
    while ((-not (Test-Path -LiteralPath $setupResultPath -PathType Leaf) -or
            -not (Test-Path -LiteralPath $cockpitResultPath -PathType Leaf)) -and
            [DateTime]::UtcNow -lt $resultDeadline) {
        Start-Sleep -Milliseconds 250
    }
    if (-not (Test-Path -LiteralPath $setupResultPath -PathType Leaf) -or
        -not (Test-Path -LiteralPath $cockpitResultPath -PathType Leaf)) {
        throw "Auto-launched MarlinSetup did not finish the managed Cockpit proof."
    }

    $setupResult = Get-Content -Raw -LiteralPath $setupResultPath | ConvertFrom-Json
    $cockpitResult = Get-Content -Raw -LiteralPath $cockpitResultPath | ConvertFrom-Json
    if ($setupResult.status -ne "passed" -or $setupResult.install.name -ne "cockpit-core") {
        throw "MarlinSetup did not report a managed cockpit-core installation."
    }
    if ($setupResult.install.pathUpdated) {
        throw "The isolated proof must not modify the user's PATH."
    }
    if ($cockpitResult.status -ne "passed" -or -not $cockpitResult.packaged) {
        throw "Marlin-installed Cockpit did not report a packaged PASS."
    }

    $expectedInstallRoot = Join-Path $marlinHome "apps\cockpit-core\1.0.0"
    $statePath = Join-Path $marlinHome "state.yaml"
    foreach ($required in @($statePath, (Join-Path $expectedInstallRoot "Cockpit.exe"))) {
        if (-not (Test-Path -LiteralPath $required -PathType Leaf)) { throw "Marlin managed state is missing $required." }
    }
    $cockpitExe = Join-Path $expectedInstallRoot "Cockpit.exe"
    $bridgeExe = Join-Path $expectedInstallRoot "resources\bridge\cockpit-bridge.exe"
    & $assertPe -Path $cockpitExe -Architecture $Architecture | Out-Null
    & $assertPe -Path $bridgeExe -Architecture $Architecture | Out-Null
    if (-not ([string]$setupResult.install.installDir).Equals($expectedInstallRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Cockpit was not installed in Marlin's managed app directory."
    }
    if ([string]$cockpitResult.resources_path -like "C:\dev\*") {
        throw "Marlin-installed Cockpit resolved resources from the development portfolio."
    }

    [ordered]@{
        status = "PASS"
        installer_authority = "marlin"
        architecture = $Architecture
        nsis_stub_machine = Get-PeMachine $copiedInstaller
        installed_setup_machine = Get-PeMachine $setupExe
        cockpit_machine = Get-PeMachine $cockpitExe
        bridge_machine = Get-PeMachine $bridgeExe
        setup_installer_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $copiedInstaller).Hash.ToLowerInvariant()
        cockpit_payload_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $bundledArtifact).Hash.ToLowerInvariant()
        proof_root = $proofRoot
        marlin_home = $marlinHome
        marlin_state = $statePath
        install_root = $expectedInstallRoot
        workspace_root = $workspaceRoot
        packaged = [bool]$cockpitResult.packaged
        resources_path = [string]$cockpitResult.resources_path
        bridge_path = [string]$cockpitResult.bridge_path
        shell_title = [string]$cockpitResult.ui.title
        shell_tabs = [int]$cockpitResult.ui.tabCount
        footer = [string]$cockpitResult.ui.footer
    } | ConvertTo-Json -Depth 5
} finally {
    if (-not $KeepProof) {
        $uninstaller = Join-Path $setupRoot "Uninstall MarlinSetup.exe"
        if (Test-Path -LiteralPath $uninstaller -PathType Leaf) {
            $uninstallProcess = Start-Process -FilePath $uninstaller -ArgumentList @("/S") -PassThru -WindowStyle Hidden
            Wait-CheckedProcess $uninstallProcess 180 "MarlinSetup uninstaller"
            $uninstallDeadline = [DateTime]::UtcNow.AddSeconds(45)
            while ((Test-Path -LiteralPath $setupRoot) -and [DateTime]::UtcNow -lt $uninstallDeadline) {
                Start-Sleep -Milliseconds 250
            }
            if (Test-Path -LiteralPath $setupRoot) {
                throw "MarlinSetup uninstaller did not release the isolated install directory."
            }
        }
        if (Test-Path -LiteralPath $proofRoot) {
            Assert-ProofPath $proofRoot
            Remove-Item -LiteralPath $proofRoot -Recurse -Force
        }
    } else {
        Write-Output "Proof retained at $proofRoot"
    }
}
