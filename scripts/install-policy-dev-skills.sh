#!/usr/bin/env bash
# Install Axway policy-development skills for Cursor, Claude Code, and generic agents.
# Usage:
#   ./scripts/install-policy-dev-skills.sh -TargetWorkspace "$HOME/apim-policies" -Force
#   ./scripts/install-policy-dev-skills.sh -Scope Global -Platform Cursor -Force
#   ./scripts/install-policy-dev-skills.sh -TargetWorkspace "$HOME/apim-policies" -Platform All -Mode Junction -Force
#
# Does NOT copy client-specific policies into apim-mcp. Policies stay in apim-policies.
# Flags mirror install-policy-dev-skills.ps1. -Mode Junction => ln -s on Unix.

set -euo pipefail

Scope="Workspace"
TargetWorkspace=""
Mode="Copy"
Platform="All"
IncludeGatewaySkill=0
PoliciesRepoPath=""
McpUrl="https://apim-mcp.gnosistech.com.br"
SkipRule=0
SkipMcpSnippet=0
SkipPointers=0
Force=0

usage() {
  cat <<'EOF'
Usage: install-policy-dev-skills.sh [options]

  -TargetWorkspace PATH     Workspace root (required when -Scope Workspace)
  -Scope Workspace|Global   Default: Workspace
  -Mode Copy|Junction       Default: Copy (Junction = symlink via ln -s)
  -Platform LIST            All|Cursor|Claude|Generic (comma-separated OK). Alias: -Targets
  -Force                    Replace existing skill dirs / links
  -IncludeGatewaySkill      Also install apim-gateway-code-analysis
  -PoliciesRepoPath PATH    Path substituted into rules/pointers
  -McpUrl URL               URL for MCP snippet
  -SkipRule                 Skip Cursor .mdc rule
  -SkipMcpSnippet           Skip MCP snippets
  -SkipPointers             Skip CLAUDE.md / AGENTS.md / POLICY_DEV.md pointers
  -h, --help                Show this help

Examples:
  ./scripts/install-policy-dev-skills.sh -TargetWorkspace "$HOME/apim-policies" -Platform All -Force
  ./scripts/install-policy-dev-skills.sh -Scope Global -Platform Cursor,Claude -Force
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -TargetWorkspace|--TargetWorkspace) TargetWorkspace="${2:-}"; shift 2 ;;
    -Scope|--Scope) Scope="${2:-}"; shift 2 ;;
    -Mode|--Mode) Mode="${2:-}"; shift 2 ;;
    -Platform|--Platform|-Targets|--Targets) Platform="${2:-}"; shift 2 ;;
    -PoliciesRepoPath|--PoliciesRepoPath) PoliciesRepoPath="${2:-}"; shift 2 ;;
    -McpUrl|--McpUrl) McpUrl="${2:-}"; shift 2 ;;
    -Force|--Force) Force=1; shift ;;
    -IncludeGatewaySkill|--IncludeGatewaySkill) IncludeGatewaySkill=1; shift ;;
    -SkipRule|--SkipRule) SkipRule=1; shift ;;
    -SkipMcpSnippet|--SkipMcpSnippet) SkipMcpSnippet=1; shift ;;
    -SkipPointers|--SkipPointers) SkipPointers=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 1 ;;
  esac
done

case "$Scope" in Workspace|Global) ;; *) echo "Invalid -Scope: $Scope" >&2; exit 1 ;; esac
case "$Mode" in Copy|Junction) ;; *) echo "Invalid -Mode: $Mode" >&2; exit 1 ;; esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SourceSkillsRoot="$REPO_ROOT/skills"
if [[ ! -d "$SourceSkillsRoot" ]]; then
  SourceSkillsRoot="$REPO_ROOT/.cursor/skills"
fi
BootstrapRoot="$REPO_ROOT/resources/policy-dev-bootstrap"

SkillNames=("apim-policy-development")
if [[ "$IncludeGatewaySkill" -eq 1 ]]; then
  SkillNames+=("apim-gateway-code-analysis")
fi

# Populate Platforms array (Cursor Claude Antigravity VSCode Cline Generic)
resolve_platforms() {
  Platforms=()
  local raw="$1" part lower has_cursor=0 has_claude=0 has_antigravity=0 has_vscode=0 has_cline=0 has_generic=0
  IFS=', ' read -r -a parts <<< "$raw"
  for part in "${parts[@]}"; do
    [[ -z "$part" ]] && continue
    lower="$(printf '%s' "$part" | tr '[:upper:]' '[:lower:]')"
    case "$lower" in
      all) has_cursor=1; has_claude=1; has_antigravity=1; has_vscode=1; has_cline=1; has_generic=1 ;;
      cursor) has_cursor=1 ;;
      claude) has_claude=1 ;;
      antigravity|gemini|agy) has_antigravity=1 ;;
      vscode|vs-code|code) has_vscode=1 ;;
      cline|roo|roo-cline) has_cline=1 ;;
      generic) has_generic=1 ;;
      *) echo "Unknown -Platform value: $part" >&2; exit 1 ;;
    esac
  done
  [[ "$has_claude" -eq 1 ]] && Platforms+=("Claude")
  [[ "$has_cursor" -eq 1 ]] && Platforms+=("Cursor")
  [[ "$has_antigravity" -eq 1 ]] && Platforms+=("Antigravity")
  [[ "$has_vscode" -eq 1 ]] && Platforms+=("VSCode")
  [[ "$has_cline" -eq 1 ]] && Platforms+=("Cline")
  [[ "$has_generic" -eq 1 ]] && Platforms+=("Generic")
  if [[ ${#Platforms[@]} -eq 0 ]]; then
    echo "-Platform resolved to empty set." >&2
    exit 1
  fi
}

resolve_workspace_root() {
  if [[ "$Scope" == "Global" ]]; then
    WsRoot="$HOME"
    return
  fi
  if [[ -z "$TargetWorkspace" ]]; then
    echo "With -Scope Workspace, pass -TargetWorkspace (e.g. path to apim-policies)." >&2
    exit 1
  fi
  if [[ ! -d "$TargetWorkspace" ]]; then
    echo "Target workspace does not exist: $TargetWorkspace" >&2
    exit 1
  fi
  WsRoot="$(cd "$TargetWorkspace" && pwd)"
}

install_skill_dir() {
  local name="$1" dest_skills_root="$2"
  local src="${SourceSkillsRoot}/${name}"
  local dest="${dest_skills_root}/${name}"
  if [[ ! -d "$src" ]]; then
    echo "Missing source skill: $src" >&2
    exit 1
  fi
  if [[ -e "$dest" || -L "$dest" ]]; then
    if [[ "$Force" -ne 1 ]]; then
      echo "Already exists: $dest. Use -Force to replace." >&2
      exit 1
    fi
    rm -rf "$dest"
  fi
  mkdir -p "$dest_skills_root"
  if [[ "$Mode" == "Junction" ]]; then
    ln -s "$src" "$dest"
    echo "OK junction (symlink): $dest -> $src"
  else
    cp -R "$src" "$dest"
    echo "OK copy: $name -> $dest"
  fi
}

expand_template_file() {
  local template="$1" dest="$2" policies_path="$3" skills_hint="$4" label="$5"
  if [[ ! -f "$template" ]]; then
    echo "Warning: Missing template: $template" >&2
    return
  fi
  mkdir -p "$(dirname "$dest")"
  local text policies_val skill_names
  text="$(cat "$template")"
  skill_names="$(IFS=', '; echo "${SkillNames[*]}")"
  if [[ -n "$policies_path" ]]; then
    policies_val="$(cd "$policies_path" && pwd)"
  else
    policies_val="(not set - pass -PoliciesRepoPath)"
  fi
  text="${text//\{\{APIM_POLICIES_PATH\}\}/$policies_val}"
  text="${text//\{\{MCP_URL\}\}/$McpUrl}"
  text="${text//\{\{SKILLS_HINT\}\}/$skills_hint}"
  text="${text//\{\{SKILL_NAMES\}\}/$skill_names}"
  printf '%s' "$text" > "$dest"
  echo "OK ${label}: $dest"
}

# --- main ---
resolve_platforms "$Platform"
resolve_workspace_root

echo "apim-mcp: install policy-dev skills (platform-agnostic)"
echo "  Source: $SourceSkillsRoot"
echo "  Scope: $Scope | Mode: $Mode | Platforms: ${Platforms[*]}"
echo "  Workspace/home: $WsRoot"

policies_path="$PoliciesRepoPath"
if [[ -z "$policies_path" && "$Scope" == "Workspace" && -n "$TargetWorkspace" ]]; then
  if [[ -d "${TargetWorkspace}/policies" ]]; then
    policies_path="$(cd "$TargetWorkspace" && pwd)"
  fi
fi

declare -a LOC_KEYS=()
declare -a LOC_VALS=()
add_loc() { LOC_KEYS+=("$1"); LOC_VALS+=("$2"); }

for plat in "${Platforms[@]}"; do
  case "$plat" in
    Cursor)
      skills_root="${WsRoot}/.cursor/skills"
      rules_root="${WsRoot}/.cursor/rules"
      mcp_root="${WsRoot}/.cursor"
      for name in "${SkillNames[@]}"; do
        install_skill_dir "$name" "$skills_root"
      done
      add_loc "Cursor skills" "$skills_root"
      if [[ "$SkipRule" -ne 1 ]]; then
        expand_template_file "${BootstrapRoot}/apim-policy-development.mdc" \
          "${rules_root}/apim-policy-development.mdc" "$policies_path" ".cursor/skills" "Cursor rule"
        add_loc "Cursor rule" "${rules_root}/apim-policy-development.mdc"
      fi
      if [[ "$SkipMcpSnippet" -ne 1 ]]; then
        expand_template_file "${BootstrapRoot}/mcp.json.snippet" \
          "${mcp_root}/mcp.json.policy-dev.snippet" "$policies_path" ".cursor/skills" "MCP snippet (Cursor)"
        echo "  Merge into .cursor/mcp.json (or your client MCP config) if needed."
        add_loc "Cursor MCP snippet" "${mcp_root}/mcp.json.policy-dev.snippet"
      fi
      ;;
    Claude)
      skills_root="${WsRoot}/.claude/skills"
      for name in "${SkillNames[@]}"; do
        install_skill_dir "$name" "$skills_root"
      done
      add_loc "Claude skills" "$skills_root"
      if [[ "$SkipPointers" -ne 1 ]]; then
        expand_template_file "${BootstrapRoot}/claude-apim-policy-dev.md" \
          "${WsRoot}/.claude/apim-policy-dev.md" "$policies_path" ".claude/skills" "Claude instructions"
        add_loc "Claude pointer" "${WsRoot}/.claude/apim-policy-dev.md"
        if [[ ! -f "${WsRoot}/CLAUDE.md" ]]; then
          expand_template_file "${BootstrapRoot}/CLAUDE.md.snippet" \
            "${WsRoot}/CLAUDE.md" "$policies_path" ".claude/skills" "CLAUDE.md"
          add_loc "CLAUDE.md" "${WsRoot}/CLAUDE.md"
        else
          echo "OK skip CLAUDE.md (already exists): ${WsRoot}/CLAUDE.md - see .claude/apim-policy-dev.md"
        fi
      fi
      if [[ "$SkipMcpSnippet" -ne 1 ]]; then
        expand_template_file "${BootstrapRoot}/mcp.json.snippet" \
          "${WsRoot}/.claude/mcp.json.policy-dev.snippet" "$policies_path" ".claude/skills" "MCP snippet (Claude)"
        add_loc "Claude MCP snippet" "${WsRoot}/.claude/mcp.json.policy-dev.snippet"
      fi
      ;;
    Antigravity)
      if [[ "$Scope" == "Global" ]]; then
        skills_root="${WsRoot}/.gemini/config/skills"
        mcp_root="${WsRoot}/.gemini/config"
      else
        skills_root="${WsRoot}/.agents/skills"
        mcp_root="${WsRoot}/.agents"
      fi
      for name in "${SkillNames[@]}"; do
        install_skill_dir "$name" "$skills_root"
      done
      add_loc "Antigravity skills" "$skills_root"
      if [[ "$SkipPointers" -ne 1 && "$Scope" == "Workspace" ]]; then
        if [[ ! -f "${WsRoot}/AGENTS.md" ]]; then
          expand_template_file "${BootstrapRoot}/AGENTS.md.snippet" \
            "${WsRoot}/AGENTS.md" "$policies_path" ".agents/skills" "AGENTS.md"
          add_loc "AGENTS.md" "${WsRoot}/AGENTS.md"
        else
          echo "OK skip AGENTS.md (already exists): ${WsRoot}/AGENTS.md"
        fi
      fi
      if [[ "$SkipMcpSnippet" -ne 1 ]]; then
        expand_template_file "${BootstrapRoot}/mcp.json.snippet" \
          "${mcp_root}/mcp_config.json.policy-dev.snippet" "$policies_path" ".agents/skills" "MCP snippet (Antigravity)"
        add_loc "Antigravity MCP snippet" "${mcp_root}/mcp_config.json.policy-dev.snippet"
      fi
      ;;
    VSCode)
      skills_root="${WsRoot}/.vscode/skills"
      mcp_root="${WsRoot}/.vscode"
      for name in "${SkillNames[@]}"; do
        install_skill_dir "$name" "$skills_root"
      done
      add_loc "VSCode skills" "$skills_root"
      if [[ "$SkipPointers" -ne 1 ]]; then
        expand_template_file "${BootstrapRoot}/POLICY_DEV.md" \
          "${mcp_root}/POLICY_DEV.md" "$policies_path" ".vscode/skills" "POLICY_DEV.md (VSCode)"
        add_loc "VSCode POLICY_DEV.md" "${mcp_root}/POLICY_DEV.md"
        if [[ "$Scope" == "Workspace" ]]; then
          if [[ ! -f "${WsRoot}/AGENTS.md" ]]; then
            expand_template_file "${BootstrapRoot}/AGENTS.md.snippet" \
              "${WsRoot}/AGENTS.md" "$policies_path" ".vscode/skills" "AGENTS.md (VSCode)"
            add_loc "AGENTS.md" "${WsRoot}/AGENTS.md"
          else
            echo "OK skip AGENTS.md (already exists): ${WsRoot}/AGENTS.md"
          fi
        fi
      fi
      if [[ "$SkipMcpSnippet" -ne 1 ]]; then
        expand_template_file "${BootstrapRoot}/mcp.json.snippet" \
          "${mcp_root}/mcp.json.policy-dev.snippet" "$policies_path" ".vscode/skills" "MCP snippet (VSCode)"
        add_loc "VSCode MCP snippet" "${mcp_root}/mcp.json.policy-dev.snippet"
      fi
      ;;
    Cline)
      skills_root="${WsRoot}/.cline/skills"
      mcp_root="${WsRoot}/.cline"
      for name in "${SkillNames[@]}"; do
        install_skill_dir "$name" "$skills_root"
      done
      add_loc "Cline skills" "$skills_root"
      if [[ "$SkipPointers" -ne 1 ]]; then
        expand_template_file "${BootstrapRoot}/POLICY_DEV.md" \
          "${mcp_root}/POLICY_DEV.md" "$policies_path" ".cline/skills" "POLICY_DEV.md (Cline)"
        add_loc "Cline POLICY_DEV.md" "${mcp_root}/POLICY_DEV.md"
        expand_template_file "${BootstrapRoot}/POLICY_DEV.md" \
          "${WsRoot}/.clinerules" "$policies_path" ".cline/skills" ".clinerules (Cline)"
        add_loc "Cline .clinerules" "${WsRoot}/.clinerules"
      fi
      if [[ "$SkipMcpSnippet" -ne 1 ]]; then
        expand_template_file "${BootstrapRoot}/mcp.json.snippet" \
          "${mcp_root}/cline_mcp_settings.json.policy-dev.snippet" "$policies_path" ".cline/skills" "MCP snippet (Cline)"
        add_loc "Cline MCP snippet" "${mcp_root}/cline_mcp_settings.json.policy-dev.snippet"
      fi
      if [[ "$Scope" == "Global" ]]; then
        if [[ "$(uname)" == "Darwin" ]]; then
          cline_settings_file="$HOME/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json"
        else
          cline_settings_file="$HOME/.config/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json"
        fi
        mkdir -p "$(dirname "$cline_settings_file")"
        cat > "$cline_settings_file" <<EOF
{
  "mcpServers": {
    "axway-apim": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "${McpUrl}"
      ],
      "disabled": false,
      "autoApprove": []
    }
  }
}
EOF
        add_loc "Cline VSCode MCP Config" "$cline_settings_file"

        cline_data_file="${WsRoot}/.cline/data/settings/cline_mcp_settings.json"
        mkdir -p "$(dirname "$cline_data_file")"
        cat > "$cline_data_file" <<EOF
{
  "mcpServers": {
    "axway-apim": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "${McpUrl}"
      ],
      "disabled": false,
      "autoApprove": []
    }
  }
}
EOF
        add_loc "Cline Data MCP Config" "$cline_data_file"
      fi
      ;;
    Generic)
      skills_root="${WsRoot}/skills"
      for name in "${SkillNames[@]}"; do
        install_skill_dir "$name" "$skills_root"
      done
      add_loc "Generic skills" "$skills_root"
      if [[ "$SkipPointers" -ne 1 ]]; then
        expand_template_file "${BootstrapRoot}/POLICY_DEV.md" \
          "${WsRoot}/POLICY_DEV.md" "$policies_path" "skills" "POLICY_DEV.md"
        add_loc "POLICY_DEV.md" "${WsRoot}/POLICY_DEV.md"
        if [[ "$Scope" == "Workspace" ]]; then
          if [[ ! -f "${WsRoot}/AGENTS.md" ]]; then
            expand_template_file "${BootstrapRoot}/AGENTS.md.snippet" \
              "${WsRoot}/AGENTS.md" "$policies_path" "skills" "AGENTS.md"
            add_loc "AGENTS.md" "${WsRoot}/AGENTS.md"
          else
            echo "OK skip AGENTS.md (already exists): ${WsRoot}/AGENTS.md - see POLICY_DEV.md"
          fi
        fi
      fi
      if [[ "$SkipMcpSnippet" -ne 1 ]]; then
        expand_template_file "${BootstrapRoot}/mcp.json.snippet" \
          "${WsRoot}/mcp.json.policy-dev.snippet" "$policies_path" "skills" "MCP snippet (generic)"
        add_loc "Generic MCP snippet" "${WsRoot}/mcp.json.policy-dev.snippet"
      fi
      ;;
  esac
done

# Setup readme
setup_dir="$WsRoot"
for plat in "${Platforms[@]}"; do
  if [[ "$plat" == "Cursor" ]]; then setup_dir="${WsRoot}/.cursor"; break; fi
  if [[ "$plat" == "Claude" ]]; then setup_dir="${WsRoot}/.claude"; fi
  if [[ "$plat" == "Antigravity" ]]; then setup_dir="${WsRoot}/.agents"; fi
  if [[ "$plat" == "VSCode" ]]; then setup_dir="${WsRoot}/.vscode"; fi
  if [[ "$plat" == "Cline" ]]; then setup_dir="${WsRoot}/.cline"; fi
done
mkdir -p "$setup_dir"
readme="${setup_dir}/POLICY-DEV-SETUP.md"
now="$(date '+%Y-%m-%d %H:%M')"
{
  echo "# Policy development setup (generated)"
  echo ""
  echo "Installed from **apim-mcp** at ${now}."
  echo ""
  echo "## Destination"
  if [[ "$Scope" == "Global" ]]; then echo "global ($WsRoot)"; else echo "workspace $WsRoot"; fi
  echo "Mode: **${Mode}** | Scope: **${Scope}** | Platforms: **${Platforms[*]}**"
  echo ""
  echo "## Skills"
  for n in "${SkillNames[@]}"; do echo "- \`${n}\`"; done
  echo ""
  echo "## Locations"
  i=0
  while [[ $i -lt ${#LOC_KEYS[@]} ]]; do
    echo "- **${LOC_KEYS[$i]}**: \`${LOC_VALS[$i]}\`"
    i=$((i + 1))
  done
  echo ""
  echo "## Next steps"
  echo "1. Point your agent/IDE at the skill markdown (see Locations). Offline RAG works without MCP."
  echo "2. If available, attach MCP resource \`axway://apim/playbook/policy-development\` or prompt \`axway_apim_policy_develop\`."
  echo "3. Merge MCP URL from the generated snippet into your client MCP config when using live tools."
  echo "4. Real policies live in **apim-policies** (not this MCP). Validate with \`axway_apim_fragment_validate_submit\`."
  echo "5. Reinstall/update: re-run \`scripts/install-policy-dev-skills.sh\` (or \`.ps1\`) with \`-Force\`."
  echo ""
  echo "## Docs"
  echo "- \`docs/pt-BR/instalar-skills-policy-dev.md\` / \`docs/en/install-policy-dev-skills.md\`"
} > "$readme"
echo "OK setup note: $readme"

echo ""
echo "Done. Reload your IDE/agent if the skill does not appear."
echo "MCP playbook (optional): axway://apim/playbook/policy-development"
echo "MCP prompt (optional):    axway_apim_policy_develop"
