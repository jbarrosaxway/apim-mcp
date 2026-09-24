param(
  [string]$KubeContext,
  [string]$ContainerName
)

function Write-Step([string]$Message) {
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Ok([string]$Message) {
  Write-Host "OK  $Message" -ForegroundColor Green
}

function Write-Warn([string]$Message) {
  Write-Host "WARN $Message" -ForegroundColor Yellow
}

function Invoke-Kubectl {
  param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$KubectlArgs
  )
  $allArgs = @()
  if ($KubeContext) { $allArgs += "--context"; $allArgs += $KubeContext }
  $allArgs += $KubectlArgs
  & kubectl @allArgs
  if ($LASTEXITCODE -ne 0) {
    throw "kubectl falhou: kubectl $($allArgs -join ' ')"
  }
}

function Get-ApimgrPodName {
  param(
    [string]$Namespace,
    [string]$InstanceLabel
  )
  $selector = "app.kubernetes.io/component=apimgr,app.kubernetes.io/instance=$InstanceLabel,app.kubernetes.io/name=gateway"
  $ctxArgs = @()
  if ($KubeContext) { $ctxArgs = @("--context", $KubeContext) }

  $podName = kubectl @ctxArgs -n $Namespace get pods -l $selector `
    --field-selector=status.phase=Running `
    -o jsonpath='{.items[0].metadata.name}' 2>$null
  if ($LASTEXITCODE -eq 0 -and $podName) { return $podName.Trim() }

  Write-Warn "Selector label falhou em ns=$Namespace; tentando padrao de nome..."
  $pattern = if ($InstanceLabel -eq "apim-lab") { "apim-lab-gateway-apimgr" } else { "apim-gateway-apimgr" }
  $lines = kubectl @ctxArgs -n $Namespace get pods --field-selector=status.phase=Running -o name
  if ($LASTEXITCODE -ne 0) {
    throw "kubectl get pods falhou em namespace '$Namespace'."
  }
  foreach ($line in $lines) {
    $name = ($line -replace '^pod/', '').Trim()
    if ($name -like "${pattern}*") { return $name }
  }
  throw "Pod apimgr nao encontrado em namespace '$Namespace' (instance=$InstanceLabel)."
}

function Copy-ArtifactToPod {
  param(
    [string]$LocalPath,
    [string]$PodName,
    [string]$Namespace,
    [string]$RemotePath,
    [string]$Label
  )
  if (-not (Test-Path -LiteralPath $LocalPath)) {
    throw "Arquivo local inexistente: $LocalPath"
  }
  $resolved = (Resolve-Path -LiteralPath $LocalPath).Path
  $localDir = Split-Path -Parent $resolved
  $localLeaf = Split-Path -Leaf $resolved
  $localForCp = "./$localLeaf"
  $remoteSpec = "${Namespace}/${PodName}:${RemotePath}"
  Write-Step "kubectl cp $Label -> $remoteSpec (local=$localForCp em $localDir)"
  Push-Location -LiteralPath $localDir
  try {
    $cpArgs = @("cp", $localForCp, $remoteSpec, "-c", $ContainerName)
    Invoke-Kubectl @cpArgs
  }
  finally {
    Pop-Location
  }
  Write-Ok "$Label copiado ($localLeaf)"
}

function Restart-Deployments {
  param(
    [string]$Namespace,
    [string[]]$Deployments
  )
  Write-Step "rollout restart em ns=$Namespace : $($Deployments -join ', ')"
  $restartArgs = @("rollout", "restart")
  foreach ($deploy in $Deployments) {
    $restartArgs += "deployment/$deploy"
  }
  $restartArgs += "-n"
  $restartArgs += $Namespace
  Invoke-Kubectl @restartArgs
}

function Wait-DeploymentsReady {
  param(
    [string]$Namespace,
    [string[]]$Deployments,
    [int]$TimeoutSeconds
  )
  foreach ($deploy in $Deployments) {
    Write-Step "rollout status deployment/$deploy -n $Namespace (timeout=${TimeoutSeconds}s)"
    Invoke-Kubectl -n $Namespace rollout status "deployment/$deploy" "--timeout=${TimeoutSeconds}s"
    Write-Ok "deployment/$deploy pronto"
  }
}

function Copy-EnvironmentArtifacts {
  param(
    [hashtable]$Profile,
    [string]$Namespace,
    [string]$FedFile,
    [string]$YamlFile
  )

  $key = $Profile.Key
  Write-Host ""
  Write-Host "######## $key COPY (namespace=$Namespace) ########" -ForegroundColor Magenta

  $pod = Get-ApimgrPodName -Namespace $Namespace -InstanceLabel $Profile.InstanceLabel
  Write-Ok "Pod apimgr: $pod"

  if ($key -eq "lab") {
    if (-not $FedFile) {
      throw "FED nao encontrado para LAB. Passe -FedPath ou coloque fed.fed no diretorio atual."
    }
    if (-not (Test-Path -LiteralPath $FedFile)) {
      throw "Arquivo FED inexistente: $FedFile"
    }
    Copy-ArtifactToPod -LocalPath $FedFile -PodName $pod -Namespace $Namespace `
      -RemotePath $Profile.FedDest -Label "fed.fed"
  }
  elseif ($key -eq "prd") {
    if (-not $YamlFile) {
      throw "YAML tar nao encontrado para PRD. Passe -YamlPath ou coloque $($Profile.DefaultYaml) no diretorio atual."
    }
    if (-not (Test-Path -LiteralPath $YamlFile)) {
      throw "Arquivo YAML tar inexistente: $YamlFile"
    }
    Copy-ArtifactToPod -LocalPath $YamlFile -PodName $pod -Namespace $Namespace `
      -RemotePath $Profile.YamlDest -Label "yaml.tar.gz"
  }
  else {
    throw "Perfil de ambiente desconhecido: $key"
  }
}

function Restart-AndWait-Environment {
  param(
    [hashtable]$Profile,
    [string]$Namespace,
    [int]$TimeoutSeconds
  )

  $key = $Profile.Key
  Write-Host ""
  Write-Host "######## $key ROLLOUT (namespace=$Namespace) ########" -ForegroundColor Magenta

  $deployments = @($Profile.ApimgrDeploy, $Profile.ApitrafficDeploy)
  Restart-Deployments -Namespace $Namespace -Deployments $deployments
  Wait-DeploymentsReady -Namespace $Namespace -Deployments $deployments -TimeoutSeconds $TimeoutSeconds
}
