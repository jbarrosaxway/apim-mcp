# Valida fragmento Client Registry Sync (YAML + XML).
# Wrapper Windows — delega ao validate-fragment.py (cross-platform).
param(
    [string]$AxwayRoot = "C:\Axway-7.7.20260530",
    [switch]$RegenerateXml,
    [switch]$SyncPsProject,
    [switch]$SkipYaml,
    [switch]$SkipXml,
    [switch]$Strict
)

$ErrorActionPreference = "Stop"
$PkgRoot = Split-Path $PSScriptRoot -Parent
$Gateway = Join-Path $AxwayRoot "apigateway"
$Jython = Join-Path $Gateway "Win32\bin\jython.bat"
$SyncPy = Join-Path $PSScriptRoot "sync-ps-project-from-fragment.py"
$ValidatePy = Join-Path $PSScriptRoot "validate-fragment.py"

function Get-AxwayVersion {
    param([string]$Root)
    $lib = Join-Path $Root "apigateway\system\lib"
    if (-not (Test-Path $lib)) { return "desconhecida" }
    $jar = Get-ChildItem $lib -Filter "vordel-apigateway-*.jar" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($jar -and $jar.Name -match 'vordel-apigateway-(.+)\.jar') {
        return $Matches[1]
    }
    return (Split-Path $Root -Leaf)
}

$ver = Get-AxwayVersion -Root $AxwayRoot
Write-Host "========================================"
Write-Host " Client Registry Sync - validacao (PS wrapper)"
Write-Host " Axway: $AxwayRoot"
Write-Host " Build: $ver"
Write-Host "========================================"

$env:AXWAY_GATEWAY_HOME = $AxwayRoot

$failed = $false

if ($SyncPsProject) {
    if (-not (Test-Path $Jython)) {
        Write-Error "jython.bat nao encontrado: $Jython"
    }
    Write-Host "`n[sync] ps-project-with-sync from fragment"
    & $Jython $SyncPy
    if ($LASTEXITCODE -ne 0) { $failed = $true }
}

$pyArgs = @($ValidatePy, "--gateway-home", $AxwayRoot)
if ($RegenerateXml) { $pyArgs += "--regenerate-xml" }
if ($SkipYaml) { $pyArgs += "--xml-only" }
if ($SkipXml) { $pyArgs += "--yaml-only" }
if ($Strict) { $pyArgs += "--strict" }

Write-Host "`n[validate] validate-fragment.py"
& python @pyArgs
if ($LASTEXITCODE -ne 0) { $failed = $true }

Write-Host "`n========================================"
if ($failed) {
    Write-Host " RESULTADO: FALHOU" -ForegroundColor Red
    exit 1
}
Write-Host " RESULTADO: OK" -ForegroundColor Green
Write-Host "========================================"
exit 0
