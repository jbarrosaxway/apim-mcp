param(
    [Parameter(Mandatory = $true)]
    [string]$FedPath,
    [Parameter(Mandatory = $true)]
    [string]$OutDir
)

if (-not (Test-Path $FedPath)) {
    Write-Error "FED not found: $FedPath"
    exit 1
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$zipPath = $FedPath
if ($FedPath -notmatch '\.zip$') {
    $zipPath = Join-Path $env:TEMP ("fed-" + [guid]::NewGuid().ToString() + ".zip")
    Copy-Item -Path $FedPath -Destination $zipPath -Force
}

try {
    Expand-Archive -Path $zipPath -DestinationPath $OutDir -Force
} finally {
    if ($zipPath -ne $FedPath -and (Test-Path $zipPath)) {
        Remove-Item $zipPath -Force
    }
}
Write-Host "Extracted FED to $OutDir"
Get-ChildItem -Recurse $OutDir -Filter *.xml | Select-Object -ExpandProperty FullName
