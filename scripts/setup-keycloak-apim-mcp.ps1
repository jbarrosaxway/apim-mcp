# Keycloak Admin provisioning for apim-mcp realm (lab).
# Usage (Windows PowerShell):
#   powershell -File scripts/setup-keycloak-apim-mcp.ps1 -AdminPassword '***'
#
# Creates hierarchical MCP scopes (observe ⊂ operator ⊂ admin), audience mappers,
# sample users per profile, and legacy mcp:tools (= admin).
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
  if ($Body -is [string]) {
    $json = $Body
  } else {
    # -AsArray ensures single-element lists serialize as JSON arrays (Keycloak scope-mappings)
    $json = ConvertTo-Json -InputObject $Body -Depth 30 -Compress
  }
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

function Ensure-ClientScope {
  param(
    [string]$Name,
    [string]$Description
  )
  $scopes = Invoke-RestMethod -Uri "$base/admin/realms/$Realm/client-scopes" `
    -Headers @{ Authorization = "Bearer $(Get-AdminToken)" }
  $scope = $scopes | Where-Object { $_.name -eq $Name }
  if (-not $scope) {
    Write-Host "Creating client scope $Name"
    Invoke-KcJson -Method POST -Path "/realms/$Realm/client-scopes" -Body @{
      name = $Name
      description = $Description
      protocol = "openid-connect"
      attributes = @{
        "include.in.token.scope" = "true"
        "display.on.consent.screen" = "true"
      }
    } | Out-Null
    $scopes = Invoke-RestMethod -Uri "$base/admin/realms/$Realm/client-scopes" `
      -Headers @{ Authorization = "Bearer $(Get-AdminToken)" }
    $scope = $scopes | Where-Object { $_.name -eq $Name }
  } else {
    Write-Host "Client scope $Name already exists"
  }

  $mappers = Invoke-RestMethod -Uri "$base/admin/realms/$Realm/client-scopes/$($scope.id)/protocol-mappers/models" `
    -Headers @{ Authorization = "Bearer $(Get-AdminToken)" }
  if (-not ($mappers | Where-Object { $_.name -eq "mcp-audience" })) {
    Write-Host "Adding audience mapper on $Name -> $AudienceClientId"
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
  return $scope
}

function Ensure-RealmRole {
  param([string]$Name, [string]$Description)
  $roles = Invoke-RestMethod -Uri "$base/admin/realms/$Realm/roles" `
    -Headers @{ Authorization = "Bearer $(Get-AdminToken)" }
  $role = $roles | Where-Object { $_.name -eq $Name }
  if (-not $role) {
    Write-Host "Creating realm role $Name"
    Invoke-KcJson -Method POST -Path "/realms/$Realm/roles" -Body @{
      name = $Name
      description = $Description
    } | Out-Null
  }
  return Invoke-RestMethod -Uri "$base/admin/realms/$Realm/roles/$Name" `
    -Headers @{ Authorization = "Bearer $(Get-AdminToken)" }
}

function Ensure-ScopeRoleMapping {
  param($Scope, $Role)
  $mapped = Invoke-RestMethod `
    -Uri "$base/admin/realms/$Realm/client-scopes/$($Scope.id)/scope-mappings/realm" `
    -Headers @{ Authorization = "Bearer $(Get-AdminToken)" }
  if (-not ($mapped | Where-Object { $_.name -eq $Role.name })) {
    Write-Host "Binding scope $($Scope.name) -> role $($Role.name)"
    $mappingJson = ConvertTo-Json -InputObject @(@{ id = $Role.id; name = $Role.name }) -Depth 5 -Compress
    Invoke-KcJson -Method POST `
      -Path "/realms/$Realm/client-scopes/$($Scope.id)/scope-mappings/realm" `
      -Body $mappingJson | Out-Null
  }
}

function Assign-UserRealmRole {
  param([string]$UserId, $Role)
  $assigned = Invoke-RestMethod `
    -Uri "$base/admin/realms/$Realm/users/$UserId/role-mappings/realm" `
    -Headers @{ Authorization = "Bearer $(Get-AdminToken)" }
  if (-not ($assigned | Where-Object { $_.name -eq $Role.name })) {
    Write-Host "Assigning role $($Role.name) to user $UserId"
    $mappingJson = ConvertTo-Json -InputObject @(@{ id = $Role.id; name = $Role.name }) -Depth 5 -Compress
    Invoke-KcJson -Method POST `
      -Path "/realms/$Realm/users/$UserId/role-mappings/realm" `
      -Body $mappingJson | Out-Null
  }
}

$scopeObserve = Ensure-ClientScope -Name "mcp:observe" -Description "MCP read-only (topology, traffic, list/get)"
$scopeOperator = Ensure-ClientScope -Name "mcp:operator" -Description "MCP observe + publish/unpublish/deprecate + quotas/alerts"
$scopeAdmin = Ensure-ClientScope -Name "mcp:admin" -Description "MCP full admin (CRUD + credentials)"
$scopeTools = Ensure-ClientScope -Name "mcp:tools" -Description "Legacy alias = mcp:admin (full access)"

$roleObserve = Ensure-RealmRole -Name "mcp-observe" -Description "May request scope mcp:observe"
$roleOperator = Ensure-RealmRole -Name "mcp-operator" -Description "May request scope mcp:operator"
$roleAdmin = Ensure-RealmRole -Name "mcp-admin" -Description "May request scope mcp:admin"
$roleTools = Ensure-RealmRole -Name "mcp-tools" -Description "May request legacy scope mcp:tools"

Ensure-ScopeRoleMapping -Scope $scopeObserve -Role $roleObserve
Ensure-ScopeRoleMapping -Scope $scopeOperator -Role $roleOperator
Ensure-ScopeRoleMapping -Scope $scopeAdmin -Role $roleAdmin
Ensure-ScopeRoleMapping -Scope $scopeTools -Role $roleTools

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

# Public PKCE client for MCP agents (Cursor, Kiro, Claude Code, Codex, …).
# redirect_uri is chosen by each client; loopback wildcards cover ephemeral ports.
$cursorId = Ensure-Client @{
  clientId = "mcp-cursor"
  name = "MCP clients public PKCE"
  enabled = $true
  protocol = "openid-connect"
  publicClient = $true
  standardFlowEnabled = $true
  directAccessGrantsEnabled = $false
  implicitFlowEnabled = $false
  redirectUris = @(
    "http://127.0.0.1/*",
    "http://localhost/*",
    "cursor://*",
    "https://www.cursor.com/*",
    "https://claude.ai/api/mcp/auth_callback"
  )
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

function Attach-OptionalScope {
  param([string]$ClientId, $Scope)
  try {
    Invoke-WebRequest -Method PUT `
      -Uri "$base/admin/realms/$Realm/clients/$ClientId/optional-client-scopes/$($Scope.id)" `
      -Headers @{ Authorization = "Bearer $(Get-AdminToken)" } -UseBasicParsing | Out-Null
  } catch {}
}

function Detach-OptionalScope {
  param([string]$ClientId, $Scope)
  try {
    Invoke-WebRequest -Method DELETE `
      -Uri "$base/admin/realms/$Realm/clients/$ClientId/optional-client-scopes/$($Scope.id)" `
      -Headers @{ Authorization = "Bearer $(Get-AdminToken)" } -UseBasicParsing | Out-Null
  } catch {}
}

function Attach-DefaultScope {
  param([string]$ClientId, $Scope)
  try {
    Invoke-WebRequest -Method PUT `
      -Uri "$base/admin/realms/$Realm/clients/$ClientId/default-client-scopes/$($Scope.id)" `
      -Headers @{ Authorization = "Bearer $(Get-AdminToken)" } -UseBasicParsing | Out-Null
  } catch {}
}

# Default scopes: client requests only openid/profile; Keycloak includes the MCP scope
# allowed by the user's role (role scope mapping). No need to request mcp:* in Cursor.
foreach ($s in @($scopeObserve, $scopeOperator, $scopeAdmin, $scopeTools)) {
  Detach-OptionalScope -ClientId $cursorId -Scope $s
  Attach-DefaultScope -ClientId $cursorId -Scope $s
  Detach-OptionalScope -ClientId $cliId -Scope $s
  Attach-DefaultScope -ClientId $cliId -Scope $s
}

function Ensure-User {
  param(
    [string]$Username,
    [string]$Email,
    [string]$FirstName,
    [string]$LastName
  )
  $users = Invoke-RestMethod -Uri "$base/admin/realms/$Realm/users?username=$Username" `
    -Headers @{ Authorization = "Bearer $(Get-AdminToken)" }
  if (-not $users -or @($users).Count -eq 0) {
    Write-Host "Creating user $Username"
    Invoke-KcJson -Method POST -Path "/realms/$Realm/users" -Body @{
      username = $Username
      enabled = $true
      emailVerified = $true
      firstName = $FirstName
      lastName = $LastName
      email = $Email
    } | Out-Null
    $users = Invoke-RestMethod -Uri "$base/admin/realms/$Realm/users?username=$Username" `
      -Headers @{ Authorization = "Bearer $(Get-AdminToken)" }
  } else {
    Write-Host "User $Username already exists"
  }
  $userId = $users[0].id
  $pwdJson = (@{ type = "password"; value = $TestUserPassword; temporary = $false } | ConvertTo-Json)
  Invoke-WebRequest -Method PUT -Uri "$base/admin/realms/$Realm/users/$userId/reset-password" `
    -Headers @{ Authorization = "Bearer $(Get-AdminToken)"; "Content-Type" = "application/json" } `
    -Body $pwdJson -UseBasicParsing | Out-Null
  Write-Host "User $Username password set"
  return $userId
}

$idObserver = Ensure-User -Username "mcp-observer" -Email "mcp-observer@example.local" -FirstName "MCP" -LastName "Observer"
$idOperator = Ensure-User -Username "mcp-operator" -Email "mcp-operator@example.local" -FirstName "MCP" -LastName "Operator"
$idAdmin = Ensure-User -Username "mcp-admin" -Email "mcp-admin@example.local" -FirstName "MCP" -LastName "Admin"
$idTester = Ensure-User -Username "mcp-tester" -Email "mcp-tester@example.local" -FirstName "MCP" -LastName "Tester"

Assign-UserRealmRole -UserId $idObserver -Role $roleObserve
Assign-UserRealmRole -UserId $idOperator -Role $roleOperator
Assign-UserRealmRole -UserId $idAdmin -Role $roleAdmin
Assign-UserRealmRole -UserId $idTester -Role $roleTools

# Resolve actual client secret (may pre-exist from earlier lab)
$cliSecret = (Invoke-RestMethod -Uri "$base/admin/realms/$Realm/clients/$cliId/client-secret" `
  -Headers @{ Authorization = "Bearer $(Get-AdminToken)" }).value
if (-not $cliSecret) { $cliSecret = "replace-me-client-secret" }

function Smoke-Token {
  param([string]$Username, [string]$Scope, [string]$ExpectContains)
  $access = Invoke-RestMethod -Method Post -Uri "$base/realms/$Realm/protocol/openid-connect/token" `
    -ContentType "application/x-www-form-urlencoded" -Body @{
      grant_type = "password"
      client_id = "mcp-test-cli"
      client_secret = $cliSecret
      username = $Username
      password = $TestUserPassword
      scope = $Scope
    }
  $part = $access.access_token.Split(".")[1]
  $pad = "=" * ((4 - ($part.Length % 4)) % 4)
  $payload = [Text.Encoding]::UTF8.GetString(
    [Convert]::FromBase64String(($part.Replace("-", "+").Replace("_", "/")) + $pad)
  )
  $obj = $payload | ConvertFrom-Json
  $scopeClaim = [string]$obj.scope
  Write-Host "Smoke OK user=$Username requested='$Scope' got scope='$scopeClaim'"
  if ($ExpectContains -and ($scopeClaim -notmatch [regex]::Escape($ExpectContains))) {
    throw "Expected scope to contain '$ExpectContains' but got '$scopeClaim'"
  }
}

function Smoke-DeniedScope {
  param([string]$Username, [string]$Scope, [string]$MustNotContain)
  $access = Invoke-RestMethod -Method Post -Uri "$base/realms/$Realm/protocol/openid-connect/token" `
    -ContentType "application/x-www-form-urlencoded" -Body @{
      grant_type = "password"
      client_id = "mcp-test-cli"
      client_secret = $cliSecret
      username = $Username
      password = $TestUserPassword
      scope = $Scope
    }
  $part = $access.access_token.Split(".")[1]
  $pad = "=" * ((4 - ($part.Length % 4)) % 4)
  $payload = [Text.Encoding]::UTF8.GetString(
    [Convert]::FromBase64String(($part.Replace("-", "+").Replace("_", "/")) + $pad)
  )
  $obj = $payload | ConvertFrom-Json
  $scopeClaim = [string]$obj.scope
  if ($scopeClaim -match [regex]::Escape($MustNotContain)) {
    throw "User $Username should NOT get '$MustNotContain' but got '$scopeClaim'"
  }
  Write-Host "Smoke DENY OK user=$Username requested='$Scope' did not get '$MustNotContain' (got='$scopeClaim')"
}

# Request openid only — the MCP profile comes from the role (default client scopes)
Smoke-Token -Username "mcp-observer" -Scope "openid" -ExpectContains "mcp:observe"
Smoke-Token -Username "mcp-operator" -Scope "openid" -ExpectContains "mcp:operator"
Smoke-Token -Username "mcp-admin" -Scope "openid" -ExpectContains "mcp:admin"
Smoke-Token -Username "mcp-tester" -Scope "openid" -ExpectContains "mcp:tools"
Smoke-DeniedScope -Username "mcp-observer" -Scope "openid" -MustNotContain "mcp:admin"
Smoke-DeniedScope -Username "mcp-observer" -Scope "openid" -MustNotContain "mcp:operator"
Smoke-DeniedScope -Username "mcp-observer" -Scope "openid" -MustNotContain "mcp:tools"

Write-Host ""
Write-Host "Configure MCP with:"
Write-Host "  OIDC_ISSUER=$base/realms/$Realm"
Write-Host "  OIDC_AUDIENCE=$AudienceClientId"
Write-Host "  MCP_AUTH_MODE=oidc"
Write-Host "  MCP_REQUIRED_SCOPES=mcp:observe"
Write-Host ""
Write-Host "Cursor: pedir so openid/profile - o MCP scope vem da role do user"
Write-Host '  scopes: ["openid", "profile"]'
Write-Host "  mcp-observer -> mcp:observe | mcp-operator -> mcp:operator | mcp-admin -> mcp:admin"
