[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string] $Path,
    [Parameter(Mandatory = $true)]
    [ValidateSet("x64", "arm64")]
    [string] $Architecture
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$resolved = (Resolve-Path -LiteralPath $Path).Path
$bytes = [System.IO.File]::ReadAllBytes($resolved)
if ($bytes.Length -lt 64) { throw "Not a valid PE file: $resolved" }
$peOffset = [BitConverter]::ToInt32($bytes, 0x3c)
if ($peOffset -lt 0 -or $peOffset + 6 -gt $bytes.Length) { throw "Invalid PE header offset in $resolved" }
$machine = [BitConverter]::ToUInt16($bytes, $peOffset + 4)
$expected = if ($Architecture -eq "arm64") { [uint16]0xaa64 } else { [uint16]0x8664 }
if ($machine -ne $expected) {
    throw "Architecture mismatch for $resolved`: expected $Architecture (0x$($expected.ToString('X4'))), found 0x$($machine.ToString('X4'))."
}

[pscustomobject]@{
    path = $resolved
    architecture = $Architecture
    machine = "0x$($machine.ToString('X4'))"
}
