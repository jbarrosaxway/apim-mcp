# Keycloak Admin provisioning for apim-mcp realm (lab).
# Usage (Windows PowerShell):
#   powershell -File scripts/setup-keycloak-apim-mcp.ps1 -AdminPassword '***'
#
# Secrets are never committed; pass AdminPassword via parameter or env KC_ADMIN_PASSWORD.

param(
  [string]$KeycloakUrl = "https://idp.example.com",
  [string]$AdminUser = "admin",
  [string]$AdminPassword = $env:KC_ADMIN_PASSWORD,
  [string]$Realm = "apim-mcp",
  [string]$AudienceClientId = "apim-mcp-api",
  [string]$TestUserPassword = "replace-me"
)

$ErrorActionPreference = "Stop"
if (-not $AdminPassword) {
  throw "Pass -AdminPassword or set env KC_ADMIN_PASSWORD"
}

$base = $KeycloakUrl.TrimEnd("/")

function Get-AdminToken {
  $body = @{
    grant_type = "password"
    client_id  = "admin-cli"
    username   = $AdminUser
    password   = $AdminPassword
  }
  $r = Invoke-RestMethod -Method Post -Uri "$base/realms/master/protocol/openid-connect/token" `
    -ContentType "application/x-www-form-urlencoded" -Body $body
  return $r.access_token
}

function Invoke-KcJson {
  param([string]$Method, [string]$Path, $Body = $null)
  $token = Get-AdminToken
  $headers = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }
  $uri = "$base/admin$Path"
  if ($null -eq $Body) {
    return Invoke-RestMethod -Method $Method -Uri $uri -Headers @{ Authorization = "Bearer $token" }
  }
  $json = if ($Body -is [string]) { $Body } else { ($Body | ConvertTo-Json -Depth 30) }
  return Invoke-WebRequest -Method $Method -Uri $uri -Headers $headers -Body $json -UseBasicParsing
}

Write-Host "Authenticated to Keycloak admin API"

$realms = Invoke-RestMethod -Uri "$base/admin/realms" -Headers @{ Authorization = "Bearer $(Get-AdminToken)" }
if (-not ($realms | Where-Object { $_.realm -eq $Realm })) {
  Write-Host "Creating realm $Realm"
  Invoke-KcJson -Method POST -Path "/realms" -Body @{
    realm = $Realm
    enabled = $true
    displayName = "Axway APIM MCP"
    sslRequired = "external"
  } | Out-Null
} else {
  Write-Host "Realm $Realm already exists"
}

$scopes = Invoke-RestMethod -Uri "$base/admin/realms/$Realm/client-scopes" -Headers @{ Authorization = "Bearer $(Get-AdminToken)" }
$scope = $scopes | Where-Object { $_.name -eq "mcp:tools" }
if (-not $scope) {
  Write-Host "Creating client scope mcp:tools"
  Invoke-KcJson -Method POST -Path "/realms/$Realm/client-scopes" -Body @{
    name = "mcp:tools"
    description = "Access to Axway MCP tools"
    protocol = "openid-connect"
    attributes = @{
      "include.in.token.scope" = "true"
      "display.on.consent.screen" = "true"
    }
  } | Out-Null
  $scopes = Invoke-RestMethod -Uri "$base/admin/realms/$Realm/client-scopes" -Headers @{ Authorization = "Bearer $(Get-AdminToken)" }
  $scope = $scopes | Where-Object { $_.name -eq "mcp:tools" }
}

$mappers = Invoke-RestMethod -Uri "$base/admin/realms/$Realm/client-scopes/$($scope.id)/protocol-mappers/models" `
  -Headers @{ Authorization = "Bearer $(Get-AdminToken)" }
if (-not ($mappers | Where-Object { $_.name -eq "mcp-audience" })) {
  Write-Host "Adding audience mapper -> $AudienceClientId"
  Invoke-KcJson -Method POST -Path "/realms/$Realm/client-scopes/$($scope.id)/protocol-mappers/models" -Body @{
    name = "mcp-audience"
    protocol = "openid-connect"
    protocolMapper = "oidc-audience-mapper"
    config = @{
      "included.client.audience" = $AudienceClientId
      "id.token.claim" = "false"
      "access.token.claim" = "true"
      "introspection.token.claim" = "true"
    }
  } | Out-Null
}

function Ensure-Client {
  param([hashtable]$ClientRep)
  $token = Get-AdminToken
  $found = Invoke-RestMethod -Uri "$base/admin/realms/$Realm/clients?clientId=$($ClientRep.clientId)" `
    -Headers @{ Authorization = "Bearer $token" }
  if ($found -and @($found).Count -gt 0) {
    $id = $found[0].id
    Write-Host "Updating client $($ClientRep.clientId)"
    $ClientRep.id = $id
    $json = $ClientRep | ConvertTo-Json -Depth 30
    Invoke-WebRequest -Method PUT -Uri "$base/admin/realms/$Realm/clients/$id" `
      -Headers @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" } `
      -Body $json -UseBasicParsing | Out-Null
    return $id
  }
  Write-Host "Creating client $($ClientRep.clientId)"
  $json = $ClientRep | ConvertTo-Json -Depth 30
  Invoke-WebRequest -Method POST -Uri "$base/admin/realms/$Realm/clients" `
    -Headers @{ Authorization = "Bearer $(Get-AdminToken)"; "Content-Type" = "application/json" } `
    -Body $json -UseBasicParsing | Out-Null
  $found = Invoke-RestMethod -Uri "$base/admin/realms/$Realm/clients?clientId=$($ClientRep.clientId)" `
    -Headers @{ Authorization = "Bearer $(Get-AdminToken)" }
  return $found[0].id
}

Ensure-Client @{
  clientId = $AudienceClientId
  name = "Axway MCP Resource"
  enabled = $true
  protocol = "openid-connect"
  publicClient = $false
  standardFlowEnabled = $false
  directAccessGrantsEnabled = $false
  serviceAccountsEnabled = $false
} | Out-Null

$cursorId = Ensure-Client @{
  clientId = "mcp-cursor"
  name = "MCP Cursor public PKCE"
  enabled = $true
  protocol = "openid-connect"
  publicClient = $true
  standardFlowEnabled = $true
  directAccessGrantsEnabled = $false
  implicitFlowEnabled = $false
  redirectUris = @("http://127.0.0.1/*", "http://localhost/*", "cursor://*")
  webOrigins = @("+")
  attributes = @{ "pkce.code.challenge.method" = "S256" }
}

$cliId = Ensure-Client @{
  clientId = "mcp-test-cli"
  name = "MCP test CLI"
  enabled = $true
  protocol = "openid-connect"
  publicClient = $false
  secret = "replace-me-client-secret"
  standardFlowEnabled = $true
  directAccessGrantsEnabled = $true
  redirectUris = @("http://127.0.0.1/*", "http://localhost/*")
  webOrigins = @("+")
}

try {
  Invoke-WebRequest -Method PUT `
    -Uri "$base/admin/realms/$Realm/clients/$cliId/default-client-scopes/$($scope.id)" `
    -Headers @{ Authorization = "Bearer $(Get-AdminToken)" } -UseBasicParsing | Out-Null
} catch {}
try {
  Invoke-WebRequest -Method PUT `
    -Uri "$base/admin/realms/$Realm/clients/$cursorId/optional-client-scopes/$($scope.id)" `
    -Headers @{ Authorization = "Bearer $(Get-AdminToken)" } -UseBasicParsing | Out-Null
} catch {}

$users = Invoke-RestMethod -Uri "$base/admin/realms/$Realm/users?username=mcp-tester" `
  -Headers @{ Authorization = "Bearer $(Get-AdminToken)" }
if (-not $users -or @($users).Count -eq 0) {
  Write-Host "Creating user mcp-tester"
  Invoke-KcJson -Method POST -Path "/realms/$Realm/users" -Body @{
    username = "mcp-tester"
    enabled = $true
    emailVerified = $true
    firstName = "MCP"
    lastName = "Tester"
    email = "mcp-tester@example.local"
  } | Out-Null
  $users = Invoke-RestMethod -Uri "$base/admin/realms/$Realm/users?username=mcp-tester" `
    -Headers @{ Authorization = "Bearer $(Get-AdminToken)" }
}

$userId = $users[0].id
$pwdJson = (@{ type = "password"; value = $TestUserPassword; temporary = $false } | ConvertTo-Json)
Invoke-WebRequest -Method PUT -Uri "$base/admin/realms/$Realm/users/$userId/reset-password" `
  -Headers @{ Authorization = "Bearer $(Get-AdminToken)"; "Content-Type" = "application/json" } `
  -Body $pwdJson -UseBasicParsing | Out-Null
Write-Host "User mcp-tester password set"

$access = Invoke-RestMethod -Method Post -Uri "$base/realms/$Realm/protocol/openid-connect/token" `
  -ContentType "application/x-www-form-urlencoded" -Body @{
    grant_type = "password"
    client_id = "mcp-test-cli"
    client_secret = "replace-me-client-secret"
    username = "mcp-tester"
    password = $TestUserPassword
    scope = "openid mcp:tools"
  }
$part = $access.access_token.Split(".")[1]
$pad = "=" * ((4 - ($part.Length % 4)) % 4)
$payload = [Text.Encoding]::UTF8.GetString(
  [Convert]::FromBase64String(($part.Replace("-", "+").Replace("_", "/")) + $pad)
)
Write-Host "Token smoke OK"
Write-Host "JWT claims: $payload"
Write-Host ""
Write-Host "Configure MCP with:"
Write-Host "  OIDC_ISSUER=$base/realms/$Realm"
Write-Host "  OIDC_AUDIENCE=$AudienceClientId"
Write-Host "  MCP_AUTH_MODE=oidc"
Write-Host "  MCP_REQUIRED_SCOPES=mcp:tools"
