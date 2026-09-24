param(
    [Parameter(Mandatory = $true)]
    [string]$JarPath,
    [Parameter(Mandatory = $true)]
    [string]$ClassFilter,
    [Parameter(Mandatory = $true)]
    [string]$OutDir,
    [Parameter(Mandatory = $true)]
    [string]$CfrJar,
    [Parameter(Mandatory = $true)]
    [string]$JavaExe
)

foreach ($p in @($JarPath, $CfrJar, $JavaExe)) {
    if (-not (Test-Path $p)) {
        Write-Error "Path not found: $p"
        exit 1
    }
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

& $JavaExe -jar $CfrJar $JarPath --outputdir $OutDir --jarfilter $ClassFilter 2>&1 | Write-Host
Write-Host "Decompiled matching classes to $OutDir"
