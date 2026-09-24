# Install Axway policy-development skills for Cursor, Claude Code, and generic agents.
# Usage:
#   powershell -File scripts/install-policy-dev-skills.ps1 -TargetWorkspace "C:\path\to\apim-policies" -Force
#   powershell -File scripts/install-policy-dev-skills.ps1 -Scope Global -Platform Cursor -Force
#   powershell -File scripts/install-policy-dev-skills.ps1 -TargetWorkspace "C:\path\to\apim-policies" -Platform All -Mode Junction -Force
#
# Does NOT copy client-specific policies into apim-mcp. Policies stay in apim-policies.
# Skill markdown (SKILL.md + RAG) is the source of truth; each platform gets copies/pointers.

[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [ValidateSet("Workspace", "Global")]
  [string]$Scope = "Workspace",

  [string]$TargetWorkspace = "",

  [ValidateSet("Copy", "Junction")]
  [string]$Mode = "Copy",

  # Cursor, Claude, Generic, or All (comma-separated also OK). Alias: -Targets
  [Alias("Targets")]
  [string]$Platform = "All",

  [switch]$IncludeGatewaySkill,

  [string]$PoliciesRepoPath = "",

  [string]$McpUrl = "https://mcp.example.com/mcp",

  [switch]$SkipRule,
  [switch]$SkipMcpSnippet,
  [switch]$SkipPointers,
  [switch]$Force
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$SourceSkillsRoot = Join-Path $RepoRoot ".cursor\skills"
$BootstrapRoot = Join-Path $RepoRoot "resources\policy-dev-bootstrap"

$SkillNames = @("apim-policy-development")
if ($IncludeGatewaySkill) {
  $SkillNames += "apim-gateway-code-analysis"
}

function Resolve-PlatformList {
  param([string]$Raw)
  $parts = @($Raw -split "[,\s]+" | Where-Object { $_ })
  $set = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
  foreach ($p in $parts) {
    switch -Regex ($p) {
      "^(?i)all$" { [void]$set.Add("Cursor"); [void]$set.Add("Claude"); [void]$set.Add("Generic"); break }
      "^(?i)cursor$" { [void]$set.Add("Cursor"); break }
      "^(?i)claude$" { [void]$set.Add("Claude"); break }
      "^(?i)generic$" { [void]$set.Add("Generic"); break }
      default { throw "Unknown -Platform value: $p (use All, Cursor, Claude, Generic)" }
    }
  }
  if ($set.Count -eq 0) { throw "-Platform resolved to empty set." }
  return @($set | Sort-Object)
}

function Resolve-WorkspaceRoot {
  if ($Scope -eq "Global") {
    if ($env:USERPROFILE) { return $env:USERPROFILE }
    return $HOME
  }
  if (-not $TargetWorkspace) {
    throw "With -Scope Workspace, pass -TargetWorkspace (e.g. path to apim-policies)."
  }
  return (Resolve-Path -LiteralPath $TargetWorkspace).Path
}

function Install-SkillDir {
  param(
    [string]$Name,
    [string]$DestSkillsRoot
  )

  $src = Join-Path $SourceSkillsRoot $Name
  if (-not (Test-Path -LiteralPath $src)) {
    throw "Missing source skill: $src"
  }

  $dest = Join-Path $DestSkillsRoot $Name
  if (Test-Path -LiteralPath $dest) {
    if (-not $Force) {
      throw "Already exists: $dest. Use -Force to replace."
    }
    if ($PSCmdlet.ShouldProcess($dest, "Remove existing skill")) {
      $item = Get-Item -LiteralPath $dest -Force
      if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
        Remove-Item -LiteralPath $dest -Force
      } else {
        Remove-Item -LiteralPath $dest -Recurse -Force
      }
    }
  }

  New-Item -ItemType Directory -Path $DestSkillsRoot -Force | Out-Null

  if ($Mode -eq "Junction") {
    if ($PSCmdlet.ShouldProcess($dest, "Create junction")) {
      New-Item -ItemType Junction -Path $dest -Target $src | Out-Null
      Write-Host "OK junction: $dest -> $src"
    }
  } else {
    if ($PSCmdlet.ShouldProcess($dest, "Copy skill")) {
      Copy-Item -LiteralPath $src -Destination $dest -Recurse -Force
      Write-Host "OK copy: $Name -> $dest"
    }
  }
}

function Expand-Template {
  param(
    [string]$Text,
    [string]$PoliciesPath,
    [string]$SkillsHint
  )
  if ($PoliciesPath) {
    $resolved = (Resolve-Path -LiteralPath $PoliciesPath).Path
    $Text = $Text.Replace("{{APIM_POLICIES_PATH}}", $resolved)
  } else {
    $Text = $Text.Replace("{{APIM_POLICIES_PATH}}", "(not set - pass -PoliciesRepoPath)")
  }
  $Text = $Text.Replace("{{MCP_URL}}", $McpUrl)
  $Text = $Text.Replace("{{SKILLS_HINT}}", $SkillsHint)
  $Text = $Text.Replace("{{SKILL_NAMES}}", ($SkillNames -join ", "))
  return $Text
}

function Write-Utf8NoBom {
  param([string]$Path, [string]$Content, [switch]$NoNewline)
  $dir = Split-Path -Parent $Path
  if ($dir -and -not (Test-Path -LiteralPath $dir)) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
  }
  $utf8 = New-Object System.Text.UTF8Encoding $false
  $out = if ($NoNewline) { $Content } else { $Content.TrimEnd() + [Environment]::NewLine }
  [System.IO.File]::WriteAllText($Path, $out, $utf8)
}

function Install-FromTemplate {
  param(
    [string]$TemplateName,
    [string]$DestPath,
    [string]$PoliciesPath,
    [string]$SkillsHint,
    [string]$Label
  )
  $template = Join-Path $BootstrapRoot $TemplateName
  if (-not (Test-Path -LiteralPath $template)) {
    Write-Warning "Missing template: $template"
    return
  }
  $text = Get-Content -LiteralPath $template -Raw -Encoding UTF8
  $text = Expand-Template -Text $text -PoliciesPath $PoliciesPath -SkillsHint $SkillsHint
  if ($PSCmdlet.ShouldProcess($DestPath, "Write $Label")) {
    Write-Utf8NoBom -Path $DestPath -Content $text -NoNewline
    Write-Host "OK ${Label}: $DestPath"
  }
}

function Write-SetupReadme {
  param(
    [string]$DestPath,
    [string]$Label,
    [string[]]$PlatformsInstalled,
    [hashtable]$Locations
  )

  $skillsBullet = ($SkillNames | ForEach-Object { "- ``$_``" }) -join [Environment]::NewLine
  $locLines = @()
  foreach ($k in ($Locations.Keys | Sort-Object)) {
    $locLines += "- **$k**: ``$($Locations[$k])``"
  }
  $locBlock = $locLines -join [Environment]::NewLine
  $plat = $PlatformsInstalled -join ", "
  $lines = @(
    "# Policy development setup (generated)",
    "",
    "Installed from **apim-mcp** at $(Get-Date -Format 'yyyy-MM-dd HH:mm').",
    "",
    "## Destination",
    $Label,
    "Mode: **$Mode** | Scope: **$Scope** | Platforms: **$plat**",
    "",
    "## Skills",
    $skillsBullet,
    "",
    "## Locations",
    $locBlock,
    "",
    "## Next steps",
    "1. Point your agent/IDE at the skill markdown (see Locations). Offline RAG works without MCP.",
    "2. If available, attach MCP resource ``axway://apim/playbook/policy-development`` or prompt ``axway_apim_policy_develop``.",
    "3. Merge MCP URL from the generated snippet into your client MCP config when using live tools.",
    "4. Real policies live in **apim-policies** (not this MCP). Validate with ``axway_apim_fragment_validate_submit``.",
    "5. Reinstall/update: re-run ``scripts/install-policy-dev-skills.ps1`` or ``.sh`` with ``-Force``.",
    "",
    "## Docs",
    "- ``docs/pt-BR/instalar-skills-policy-dev.md`` / ``docs/en/install-policy-dev-skills.md``"
  )
  if ($PSCmdlet.ShouldProcess($DestPath, "Write setup readme")) {
    Write-Utf8NoBom -Path $DestPath -Content ($lines -join [Environment]::NewLine)
    Write-Host "OK setup note: $DestPath"
  }
}

# --- main ---
$platforms = Resolve-PlatformList -Raw $Platform
$wsRoot = Resolve-WorkspaceRoot

Write-Host "apim-mcp: install policy-dev skills (platform-agnostic)"
Write-Host "  Source: $SourceSkillsRoot"
Write-Host "  Scope: $Scope | Mode: $Mode | Platforms: $($platforms -join ', ')"
Write-Host "  Workspace/home: $wsRoot"

$policiesPath = $PoliciesRepoPath
if (-not $policiesPath -and $Scope -eq "Workspace" -and $TargetWorkspace) {
  $maybe = Join-Path $TargetWorkspace "policies"
  if (Test-Path -LiteralPath $maybe) {
    $policiesPath = (Resolve-Path -LiteralPath $TargetWorkspace).Path
  }
}

$locations = @{}
$label = if ($Scope -eq "Global") { "global ($wsRoot)" } else { "workspace $wsRoot" }

foreach ($plat in $platforms) {
  switch ($plat) {
    "Cursor" {
      $skillsRoot = Join-Path $wsRoot ".cursor\skills"
      $rulesRoot = Join-Path $wsRoot ".cursor\rules"
      $mcpRoot = Join-Path $wsRoot ".cursor"
      foreach ($name in $SkillNames) {
        Install-SkillDir -Name $name -DestSkillsRoot $skillsRoot
      }
      $locations["Cursor skills"] = $skillsRoot
      if (-not $SkipRule) {
        Install-FromTemplate -TemplateName "apim-policy-development.mdc" -DestPath (Join-Path $rulesRoot "apim-policy-development.mdc") `
          -PoliciesPath $policiesPath -SkillsHint ".cursor/skills" -Label "Cursor rule"
        $locations["Cursor rule"] = Join-Path $rulesRoot "apim-policy-development.mdc"
      }
      if (-not $SkipMcpSnippet) {
        Install-FromTemplate -TemplateName "mcp.json.snippet" -DestPath (Join-Path $mcpRoot "mcp.json.policy-dev.snippet") `
          -PoliciesPath $policiesPath -SkillsHint ".cursor/skills" -Label "MCP snippet (Cursor)"
        Write-Host "  Merge into .cursor/mcp.json (or your client MCP config) if needed."
        $locations["Cursor MCP snippet"] = Join-Path $mcpRoot "mcp.json.policy-dev.snippet"
      }
    }
    "Claude" {
      $skillsRoot = Join-Path $wsRoot ".claude\skills"
      foreach ($name in $SkillNames) {
        Install-SkillDir -Name $name -DestSkillsRoot $skillsRoot
      }
      $locations["Claude skills"] = $skillsRoot
      if (-not $SkipPointers) {
        Install-FromTemplate -TemplateName "claude-apim-policy-dev.md" -DestPath (Join-Path $wsRoot ".claude\apim-policy-dev.md") `
          -PoliciesPath $policiesPath -SkillsHint ".claude/skills" -Label "Claude instructions"
        $locations["Claude pointer"] = Join-Path $wsRoot ".claude\apim-policy-dev.md"
        $claudeMd = Join-Path $wsRoot "CLAUDE.md"
        if (-not (Test-Path -LiteralPath $claudeMd)) {
          Install-FromTemplate -TemplateName "CLAUDE.md.snippet" -DestPath $claudeMd `
            -PoliciesPath $policiesPath -SkillsHint ".claude/skills" -Label "CLAUDE.md"
          $locations["CLAUDE.md"] = $claudeMd
        } else {
          Write-Host "OK skip CLAUDE.md (already exists): $claudeMd - see .claude/apim-policy-dev.md"
        }
      }
      if (-not $SkipMcpSnippet) {
        Install-FromTemplate -TemplateName "mcp.json.snippet" -DestPath (Join-Path $wsRoot ".claude\mcp.json.policy-dev.snippet") `
          -PoliciesPath $policiesPath -SkillsHint ".claude/skills" -Label "MCP snippet (Claude)"
        $locations["Claude MCP snippet"] = Join-Path $wsRoot ".claude\mcp.json.policy-dev.snippet"
      }
    }
    "Generic" {
      $skillsRoot = Join-Path $wsRoot "agent-skills"
      foreach ($name in $SkillNames) {
        Install-SkillDir -Name $name -DestSkillsRoot $skillsRoot
      }
      $locations["Generic skills"] = $skillsRoot
      if (-not $SkipPointers) {
        Install-FromTemplate -TemplateName "POLICY_DEV.md" -DestPath (Join-Path $wsRoot "POLICY_DEV.md") `
          -PoliciesPath $policiesPath -SkillsHint "agent-skills" -Label "POLICY_DEV.md"
        $locations["POLICY_DEV.md"] = Join-Path $wsRoot "POLICY_DEV.md"
        if ($Scope -eq "Workspace") {
          $agentsPath = Join-Path $wsRoot "AGENTS.md"
          if (-not (Test-Path -LiteralPath $agentsPath)) {
            Install-FromTemplate -TemplateName "AGENTS.md.snippet" -DestPath $agentsPath `
              -PoliciesPath $policiesPath -SkillsHint "agent-skills" -Label "AGENTS.md"
            $locations["AGENTS.md"] = $agentsPath
          } else {
            Write-Host "OK skip AGENTS.md (already exists): $agentsPath - see POLICY_DEV.md"
          }
        }
      }
      if (-not $SkipMcpSnippet) {
        Install-FromTemplate -TemplateName "mcp.json.snippet" -DestPath (Join-Path $wsRoot "mcp.json.policy-dev.snippet") `
          -PoliciesPath $policiesPath -SkillsHint "agent-skills" -Label "MCP snippet (generic)"
        $locations["Generic MCP snippet"] = Join-Path $wsRoot "mcp.json.policy-dev.snippet"
      }
    }
  }
}

$setupDir = if ($platforms -contains "Cursor") {
  Join-Path $wsRoot ".cursor"
} elseif ($platforms -contains "Claude") {
  Join-Path $wsRoot ".claude"
} else {
  $wsRoot
}
Write-SetupReadme -DestPath (Join-Path $setupDir "POLICY-DEV-SETUP.md") -Label $label `
  -PlatformsInstalled $platforms -Locations $locations

Write-Host ""
Write-Host "Done. Reload your IDE/agent if the skill does not appear."
Write-Host "MCP playbook (optional): axway://apim/playbook/policy-development"
Write-Host "MCP prompt (optional):    axway_apim_policy_develop"
