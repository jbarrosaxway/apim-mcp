# Deploy apim-mcp no cluster pcloud (Rancher local).
#
# 1. Instala registry in-cluster (Helm, NodePort 30500)
# 2. Build da imagem via Kaniko -> push no registry
# 3. Secret Axway + Helm release axway-mcp no namespace axway
#
# Exemplo:
#   powershell -File scripts/deploy-pcloud-axway.ps1
#   powershell -File scripts/deploy-pcloud-axway.ps1 -SkipRegistry
#   powershell -File scripts/deploy-pcloud-axway.ps1 -ApimgrBase -SkipRegistry

param(
  [string]$KubeContext = "pcloud-local",
  [string]$RegistryNamespace = "registry",
  [string]$RegistryRelease = "docker-registry",
  [string]$McpNamespace = "axway",
  [string]$McpRelease = "axway-mcp",
  [string]$ImageTag = "1.0.20-pcloud-amd64",
  [int]$RegistryNodePort = 30500,
  [switch]$SkipRegistry,
  [switch]$SkipBuild,
  [switch]$SkipHelm,
  [switch]$ApimgrBase,
  [string]$ApimgrBaseImage = "docker.repository.axway.com/apigateway-docker-prod/7.7/gateway:7.7.0.20250530-2-BN0004-ubi9",
  [string]$HelmValuesFile = ""
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

function Invoke-Kubectl {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$KubectlArgs)
  & kubectl --context $KubeContext @KubectlArgs
  if ($LASTEXITCODE -ne 0) { throw "kubectl failed: kubectl $($KubectlArgs -join ' ')" }
}

function Get-WorkerNodeIp {
  $nodes = kubectl --context $KubeContext get nodes -l '!node-role.kubernetes.io/control-plane' -o json | ConvertFrom-Json
  $list = @($nodes.items)
  if ($list.Count -eq 0) {
    $nodes = kubectl --context $KubeContext get nodes -o json | ConvertFrom-Json
    $list = @($nodes.items)
  }
  $addr = ($list[0].status.addresses | Where-Object { $_.type -eq 'InternalIP' } | Select-Object -First 1).address
  if (-not $addr) { throw "Could not resolve worker node InternalIP" }
  return $addr
}

function Invoke-Build {
  Write-Host "==> npm run build"
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }
}

function Copy-SkillFiles {
  $dest = Join-Path $Root ".cursor/skills/apim-gateway-code-analysis"
  $src = Join-Path $env:USERPROFILE ".cursor/skills/apim-gateway-code-analysis"
  if ((Test-Path $src) -and ((Get-Item (Join-Path $dest "SKILL.md") -ErrorAction SilentlyContinue).Length -lt 100)) {
    Write-Host "==> Copiando skill de $src"
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
    Copy-Item -Recurse -Force "$src/*" $dest
  }
}

function New-BuildTarball([string]$OutPath) {
  if (Test-Path $OutPath) { Remove-Item -Force $OutPath }
  $paths = @(
    "src", "build", "config", "package.json", "package-lock.json", "tsconfig.json",
    "Dockerfile", "Dockerfile.apimgr-base", ".dockerignore",
    ".cursor/skills/apim-gateway-code-analysis",
    "policies/client-registry-sync/fragment",
    "policies/client-registry-sync/scripts",
    "policies/client-registry-sync/fragment-xml",
    "policies/client-registry-sync/docs"
  )
  $existing = @()
  foreach ($rel in $paths) {
    if (Test-Path (Join-Path $Root $rel)) { $existing += $rel }
  }
  if ($existing.Count -eq 0) { throw "No build context paths found under $Root" }
  Push-Location $Root
  try {
    tar -czf $OutPath @existing
  } finally {
    Pop-Location
  }
  $size = (Get-Item $OutPath).Length
  Write-Host "==> Context tarball: $OutPath ($size bytes)"
  if ($size -gt 900000) {
    throw "Context tarball exceeds ~900KB (ConfigMap limit ~1MB). Trim paths in New-BuildTarball."
  }
}

function Install-Registry {
  Write-Host "==> Helm install registry (ns=$RegistryNamespace)"
  helm upgrade --install $RegistryRelease ./helm/registry -n $RegistryNamespace --create-namespace --wait --timeout 5m
  Invoke-Kubectl -n $RegistryNamespace rollout status "deployment/$RegistryRelease" --timeout=120s
  Invoke-Kubectl -n $RegistryNamespace get svc
}

function Preload-ImageOnNodes([string]$RegistryHost, [string]$Tag) {
  Write-Host "==> Pre-carregando imagem nos nodes via ctr --plain-http (${RegistryHost}/apim-mcp:${Tag})"
  $img = "${RegistryHost}/apim-mcp:${Tag}"
  $preloadYaml = @"
apiVersion: v1
kind: ConfigMap
metadata:
  name: preload-apim-mcp-script
  namespace: kube-system
data:
  preload.sh: |
    #!/bin/sh
    set -e
    IMG="$img"
    nsenter -t 1 -m -u -i -n -p -- ctr -n k8s.io images pull --plain-http "`$IMG"
    echo "PRELOAD_OK on `$(hostname): `$IMG"
    sleep 3600
---
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: preload-apim-mcp-image
  namespace: kube-system
spec:
  selector:
    matchLabels:
      app: preload-apim-mcp-image
  template:
    metadata:
      labels:
        app: preload-apim-mcp-image
    spec:
      hostPID: true
      tolerations:
        - operator: Exists
      nodeSelector:
        kubernetes.io/os: linux
      containers:
        - name: preload
          image: nicolaka/netshoot:v0.13
          securityContext:
            privileged: true
          command: ["/bin/sh", "/config/preload.sh"]
          volumeMounts:
            - name: config
              mountPath: /config
      volumes:
        - name: config
          configMap:
            name: preload-apim-mcp-script
            defaultMode: 0755
"@
  $preloadFile = Join-Path $env:TEMP "preload-apim-mcp-image.yaml"
  $preloadYaml | Set-Content -Encoding utf8 $preloadFile
  Invoke-Kubectl delete ds/preload-apim-mcp-image -n kube-system --ignore-not-found
  Invoke-Kubectl apply -f $preloadFile
  Invoke-Kubectl -n kube-system rollout status ds/preload-apim-mcp-image --timeout=300s
  Invoke-Kubectl -n kube-system logs ds/preload-apim-mcp-image --tail=2
}

function Invoke-KanikoBuild([string]$TarPath, [string]$DestImage, [string]$Dockerfile = "Dockerfile", [string]$BaseImageArg = "") {
  Write-Host "==> Kaniko build -> $DestImage (linux/amd64) dockerfile=$Dockerfile"
  Invoke-Kubectl delete job/apim-mcp-kaniko -n $McpNamespace --ignore-not-found
  Invoke-Kubectl delete configmap/apim-mcp-build-context -n $McpNamespace --ignore-not-found
  Invoke-Kubectl create configmap apim-mcp-build-context -n $McpNamespace "--from-file=ctx.tar.gz=$TarPath"

  $kanikoArgs = @(
    "--context=dir:///workspace",
    "--dockerfile=$Dockerfile",
    "--destination=$DestImage",
    "--custom-platform=linux/amd64",
    "--insecure",
    "--skip-tls-verify",
    "--cache=false",
    "--verbosity=info"
  )
  if ($BaseImageArg) {
    $kanikoArgs += "--build-arg=APIMGR_BASE_IMAGE=$BaseImageArg"
  }

  $argsLines = New-Object System.Collections.Generic.List[string]
  foreach ($a in $kanikoArgs) { [void]$argsLines.Add("            - $a") }
  $argsYaml = $argsLines -join "`n"

  $jobYaml = @"
apiVersion: batch/v1
kind: Job
metadata:
  name: apim-mcp-kaniko
  namespace: $McpNamespace
spec:
  ttlSecondsAfterFinished: 900
  backoffLimit: 1
  template:
    spec:
      imagePullSecrets:
        - name: regcred
      restartPolicy: Never
      initContainers:
        - name: unpack-context
          image: busybox:1.36
          command:
            - sh
            - -c
            - cp /cfg/ctx.tar.gz /tmp/ctx.tar.gz && mkdir -p /workspace && tar -xzf /tmp/ctx.tar.gz -C /workspace && ls -la /workspace
          volumeMounts:
            - name: cfg
              mountPath: /cfg
            - name: workspace
              mountPath: /workspace
      containers:
        - name: kaniko
          image: gcr.io/kaniko-project/executor:v1.23.2
          args:
$argsYaml
          volumeMounts:
            - name: workspace
              mountPath: /workspace
            - name: docker-config
              mountPath: /kaniko/.docker
      volumes:
        - name: cfg
          configMap:
            name: apim-mcp-build-context
        - name: workspace
          emptyDir: {}
        - name: docker-config
          secret:
            secretName: regcred
            items:
              - key: .dockerconfigjson
                path: config.json
"@
  $jobFile = Join-Path $env:TEMP "apim-mcp-kaniko.yaml"
  $jobYaml | Set-Content -Encoding utf8 $jobFile
  Invoke-Kubectl apply -f $jobFile
  $deadline = (Get-Date).AddSeconds(600)
  $kanikoOk = $false
  while ((Get-Date) -lt $deadline) {
    $succeeded = kubectl --context $KubeContext -n $McpNamespace get job apim-mcp-kaniko -o jsonpath='{.status.succeeded}' 2>$null
    if ($succeeded -eq '1') { $kanikoOk = $true; break }
    $failed = kubectl --context $KubeContext -n $McpNamespace get job apim-mcp-kaniko -o jsonpath='{.status.failed}' 2>$null
    if ($failed -eq '1') { break }
    $phase = kubectl --context $KubeContext -n $McpNamespace get pods -l job-name=apim-mcp-kaniko -o jsonpath='{.items[0].status.phase}' 2>$null
    if ($phase -eq 'Failed') { break }
    Start-Sleep -Seconds 15
  }
  if (-not $kanikoOk) {
    Write-Host "==> Kaniko FAILED (dumping logs)" -ForegroundColor Red
    kubectl --context $KubeContext -n $McpNamespace logs job/apim-mcp-kaniko -c kaniko --tail=200 2>&1
    kubectl --context $KubeContext -n $McpNamespace logs job/apim-mcp-kaniko -c unpack-context --tail=50 2>&1
    throw "Kaniko build failed or timed out after 600s"
  }
  Invoke-Kubectl logs job/apim-mcp-kaniko -n $McpNamespace -c kaniko --tail=40
}

function Install-McpSecret {
  Write-Host "==> Secret axway-mcp-credentials"
  kubectl --context $KubeContext -n $McpNamespace create secret generic axway-mcp-credentials `
    --from-literal=AXWAY_GATEWAY_USERNAME='admin' `
    --from-literal=AXWAY_GATEWAY_PASSWORD='changeme' `
    --from-literal=AXWAY_MANAGER_USERNAME='apiadmin' `
    --from-literal=AXWAY_MANAGER_PASSWORD='changeme' `
    --dry-run=client -o yaml | kubectl --context $KubeContext apply -f -
}

function Install-McpHelm([string]$ImageRepo, [string]$Tag, [string]$ValuesFile) {
  Write-Host "==> Helm install $McpRelease image=${ImageRepo}:$Tag values=$ValuesFile"
  helm upgrade --install $McpRelease ./helm/axway-mcp -n $McpNamespace --create-namespace `
    -f $ValuesFile `
    --set image.repository=$ImageRepo `
    --set image.tag=$Tag `
    --set image.pullPolicy=IfNotPresent `
    --wait --timeout 5m
}

function Test-McpPod {
  Write-Host "==> Verificacao ($McpRelease)"
  Invoke-Kubectl -n $McpNamespace get pods -l "app.kubernetes.io/name=axway-mcp,app.kubernetes.io/instance=$McpRelease"
  $podJson = kubectl --context $KubeContext -n $McpNamespace get pods -l "app.kubernetes.io/name=axway-mcp,app.kubernetes.io/instance=$McpRelease" -o json | ConvertFrom-Json
  $podName = $podJson.items[0].metadata.name
  if (-not $podName) { throw "MCP pod not found for release $McpRelease" }
  Invoke-Kubectl -n $McpNamespace logs $podName --tail=25
  kubectl --context $KubeContext -n $McpNamespace exec $podName -- node -e "const t=require('./build/tools.js'); console.log('tools', t.tools().length);"
  kubectl --context $KubeContext -n $McpNamespace exec $podName -- test -x /opt/Axway/apigateway/posix/bin/jython; Write-Host "JYTHON_OK"
  kubectl --context $KubeContext -n $McpNamespace exec $podName -- python3 policies/client-registry-sync/scripts/validate-fragment.py --yaml-only 2>&1 | Select-Object -Last 5
  kubectl --context $KubeContext -n $McpNamespace exec $podName -- node --input-type=module -e @"
import { AxwayApi } from './build/api.js';
import * as topology from './build/operations/topology.js';
const api = new AxwayApi();
const top = await topology.listTopology(api);
console.log('TOPOLOGY_OK', top.instanceCount, top.domainInfo?.productVersion);
"@
}

if ($ApimgrBase) {
  if (-not $HelmValuesFile) { $HelmValuesFile = "./helm/axway-mcp/values-pcloud-apimgr-base.yaml" }
  if ($McpRelease -eq "axway-mcp") { $McpRelease = "axway-mcp-apimgr-test" }
  if ($ImageTag -eq "1.0.20-pcloud-amd64") { $ImageTag = "1.0.21-pcloud-apimgr-base" }
}

Write-Host "Deploy apim-mcp -> pcloud ($KubeContext) ns=$McpNamespace release=$McpRelease tag=$ImageTag"
kubectl config use-context $KubeContext | Out-Null
if (-not $HelmValuesFile) { $HelmValuesFile = "./helm/axway-mcp/values-pcloud-axway.yaml" }

if (-not $SkipRegistry) {
  Install-Registry
}

$nodeIp = Get-WorkerNodeIp
$registryCluster = "docker-registry.$RegistryNamespace.svc.cluster.local:5000"
$registryNode = "${nodeIp}:$RegistryNodePort"
$kanikoDest = "$registryCluster/apim-mcp:$ImageTag"
$pullImage = "$registryNode/apim-mcp"

Write-Host "Registry cluster DNS: $registryCluster"
Write-Host "Registry NodePort:    $registryNode"
Write-Host "Kaniko destination:   $kanikoDest"
Write-Host "Pod image:            ${pullImage}:$ImageTag"

if (-not $SkipBuild) {
  Invoke-Build
  Copy-SkillFiles
  $tar = Join-Path $env:TEMP "apim-mcp-pcloud-context.tar.gz"
  New-BuildTarball -OutPath $tar
  if ($ApimgrBase) {
    Invoke-KanikoBuild -TarPath $tar -DestImage $kanikoDest -Dockerfile "Dockerfile.apimgr-base" -BaseImageArg $ApimgrBaseImage
  } else {
    Invoke-KanikoBuild -TarPath $tar -DestImage $kanikoDest
  }
  Preload-ImageOnNodes -RegistryHost $registryNode -Tag $ImageTag
}

if (-not $SkipHelm) {
  Install-McpSecret
  Install-McpHelm -ImageRepo $pullImage -Tag $ImageTag -ValuesFile $HelmValuesFile
}

Test-McpPod
Write-Host "Deploy pcloud concluido."
