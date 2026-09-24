# Deploy apim-mcp no EKS UAT example (namespace axway).
#
# Modos:
#   -Overlay (default se AWS indisponível): publica build+skills via ConfigMap e patch no Deployment
#   -BuildImage: Kaniko in-cluster + push ECR (requer AWS CLI autenticado)
#
# Exemplos:
#   pwsh -File scripts/deploy-eks-uat-axway.ps1
#   pwsh -File scripts/deploy-eks-uat-axway.ps1 -BuildImage
#   pwsh -File scripts/deploy-eks-uat-axway.ps1 -ImageTag 1.0.17-axway-std-eks-fed

param(
  [string]$Namespace = "axway",
  [string]$Release = "axway-mcp",
  [string]$ImageTag = "1.0.17-axway-std-eks-fed",
  [string]$EcrRegistry = "ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com",
  [string]$EcrRepo = "apim-mcp",
  [string]$AwsRegion = "us-east-1",
  [switch]$BuildImage,
  [switch]$OverlayOnly,
  [switch]$SkipHelm
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

function Test-AwsCreds {
  try {
    aws sts get-caller-identity --region $AwsRegion *> $null
    return $LASTEXITCODE -eq 0
  } catch { return $false }
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

function New-BuildTarball {
  param([string]$OutPath)
  $stage = Join-Path $env:TEMP "apim-mcp-deploy-stage"
  if (Test-Path $stage) { Remove-Item -Recurse -Force $stage }
  New-Item -ItemType Directory -Path $stage | Out-Null
  foreach ($item in @("src", "build", "package.json", "package-lock.json", "tsconfig.json", "Dockerfile", ".dockerignore", ".cursor/skills")) {
    $p = Join-Path $Root $item
    if (Test-Path $p) { Copy-Item -Recurse -Force $p (Join-Path $stage $item) }
  }
  if (Test-Path $OutPath) { Remove-Item -Force $OutPath }
  tar -czf $OutPath -C $stage .
  Write-Host "==> Context tarball: $OutPath ($((Get-Item $OutPath).Length) bytes)"
}

function Invoke-KanikoBuild {
  param([string]$TarPath, [string]$Tag)
  $dest = "$EcrRegistry/${EcrRepo}:$Tag"
  Write-Host "==> Kaniko build -> $dest (linux/arm64)"

  kubectl -n $Namespace delete job apim-mcp-kaniko --ignore-not-found | Out-Null
  kubectl -n $Namespace delete configmap apim-mcp-build-context --ignore-not-found | Out-Null
  kubectl -n $Namespace create configmap apim-mcp-build-context --from-file=ctx.tar.gz=$TarPath

  $ecrSecret = "apim-mcp-ecr"
  $login = aws ecr get-login-password --region $AwsRegion
  kubectl -n $Namespace delete secret $ecrSecret --ignore-not-found | Out-Null
  kubectl -n $Namespace create secret docker-registry $ecrSecret `
    --docker-server=$EcrRegistry `
    --docker-username=AWS `
    --docker-password=$login

  $jobYaml = @"
apiVersion: batch/v1
kind: Job
metadata:
  name: apim-mcp-kaniko
  namespace: $Namespace
spec:
  ttlSecondsAfterFinished: 900
  backoffLimit: 1
  template:
    spec:
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
            - --context=dir:///workspace
            - --dockerfile=Dockerfile
            - --destination=$dest
            - --custom-platform=linux/arm64
            - --cache=false
            - --verbosity=info
          volumeMounts:
            - name: workspace
              mountPath: /workspace
          env:
            - name: AWS_SDK_LOAD_CONFIG
              value: "true"
      volumes:
        - name: cfg
          configMap:
            name: apim-mcp-build-context
        - name: workspace
          emptyDir: {}
"@
  $jobYaml | kubectl apply -f -
  kubectl -n $Namespace wait --for=condition=complete job/apim-mcp-kaniko --timeout=900s
  kubectl -n $Namespace logs job/apim-mcp-kaniko -c kaniko --tail=80
}

function Invoke-OverlayDeploy {
  Write-Host "==> Overlay deploy (ConfigMap build + skills, sem nova imagem ECR)"
  $tarPath = Join-Path $env:TEMP "apim-mcp-overlay.tar.gz"
  $stage = Join-Path $env:TEMP "apim-mcp-overlay-stage"
  if (Test-Path $stage) { Remove-Item -Recurse -Force $stage }
  New-Item -ItemType Directory -Path "$stage/build" | Out-Null
  New-Item -ItemType Directory -Path "$stage/skills" | Out-Null
  Copy-Item -Recurse -Force (Join-Path $Root "build/*") "$stage/build/"
  Copy-Item -Recurse -Force (Join-Path $Root ".cursor/skills/apim-gateway-code-analysis/*") "$stage/skills/"
  if (Test-Path $tarPath) { Remove-Item -Force $tarPath }
  tar -czf $tarPath -C $stage .

  kubectl -n $Namespace delete configmap apim-mcp-runtime-overlay --ignore-not-found | Out-Null
  kubectl -n $Namespace create configmap apim-mcp-runtime-overlay --from-file=overlay.tar.gz=$tarPath

  $patchFile = Join-Path $env:TEMP "apim-mcp-overlay-patch.json"
  @'
[
  {"op":"add","path":"/spec/template/spec/initContainers","value":[{"name":"apim-mcp-overlay","image":"busybox:1.36","command":["sh","-c","mkdir -p /staging && tar -xzf /overlay/overlay.tar.gz -C /staging && cp -a /staging/build/. /app/build/ && mkdir -p /app/.cursor/skills/apim-gateway-code-analysis && cp -a /staging/skills/. /app/.cursor/skills/apim-gateway-code-analysis/"],"volumeMounts":[{"name":"runtime-overlay","mountPath":"/overlay"},{"name":"app-build","mountPath":"/app/build"},{"name":"app-skills","mountPath":"/app/.cursor/skills/apim-gateway-code-analysis"}]}]},
  {"op":"add","path":"/spec/template/spec/volumes","value":[{"name":"runtime-overlay","configMap":{"name":"apim-mcp-runtime-overlay"}},{"name":"app-build","emptyDir":{}},{"name":"app-skills","emptyDir":{}}]},
  {"op":"add","path":"/spec/template/spec/containers/0/volumeMounts","value":[{"name":"app-build","mountPath":"/app/build"},{"name":"app-skills","mountPath":"/app/.cursor/skills/apim-gateway-code-analysis"}]}
]
'@ | Set-Content -Encoding utf8 $patchFile

  kubectl -n $Namespace patch deployment $Release --type=json --patch-file $patchFile
  kubectl -n $Namespace rollout restart deployment/$Release
  kubectl -n $Namespace rollout status deployment/$Release --timeout=180s
}

function Invoke-HelmUpgrade {
  param([string]$Tag)
  $values = Join-Path $Root "helm/axway-mcp/values-eks-uat-axway.yaml"
  if (-not (Test-Path $values)) { throw "Missing $values" }
  helm upgrade --install $Release ./helm/axway-mcp -n $Namespace `
    -f $values `
    --set image.tag=$Tag `
    --wait --timeout 5m
}

# --- main ---
Write-Host "Deploy apim-mcp -> ns=$Namespace release=$Release tag=$ImageTag"
Invoke-Build
Copy-SkillFiles

$useKaniko = $BuildImage -or (-not $OverlayOnly -and (Test-AwsCreds))
if ($OverlayOnly) { $useKaniko = $false }

if ($useKaniko) {
  $tar = Join-Path $env:TEMP "apim-mcp-kaniko-context.tar.gz"
  New-BuildTarball -OutPath $tar
  Invoke-KanikoBuild -TarPath $tar -Tag $ImageTag
  if (-not $SkipHelm) { Invoke-HelmUpgrade -Tag $ImageTag }
} else {
  Write-Host "AWS CLI indisponível ou -OverlayOnly: usando overlay ConfigMap"
  Invoke-OverlayDeploy
}

Write-Host "==> Verificação"
kubectl -n $Namespace get pods -l app.kubernetes.io/name=axway-mcp
kubectl -n $Namespace logs deploy/$Release --tail=20

$pods = kubectl -n $Namespace get pods -l app.kubernetes.io/name=axway-mcp -o jsonpath='{.items[0].metadata.name}'
kubectl -n $Namespace exec $pods -- node -e "const t=require('./build/tools.js'); console.log('tools', t.tools().length); console.log(t.tools().some(x=>x.method==='axway_apim_deployment_archive_get'))"

Write-Host "Deploy concluído."
