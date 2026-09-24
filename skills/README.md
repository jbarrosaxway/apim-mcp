# Axway AI Agent Skills

This directory contains canonical AI agent skills for **Axway API Gateway** and **API Manager** policy development and gateway code analysis.

These skills are designed to be **vendor-agnostic and multi-agent compatible**, working seamlessly with:
- **Cursor** (`.cursor/skills/` and `.cursor/rules/*.mdc`)
- **Google Antigravity** (`.agents/skills/` or `~/.gemini/config/skills/`)
- **Claude Code** (`.claude/skills/` and `CLAUDE.md`)
- **Cline, Roo Code, Windsurf, GitHub Copilot** (root `skills/` or `agent-skills/` via `AGENTS.md`)

---

## Available Skills

| Skill | Directory | Description | Offline Docs / RAG |
|-------|-----------|-------------|--------------------|
| **`apim-policy-development`** | [`apim-policy-development/`](apim-policy-development/) | Guide for authoring and editing Axway API Gateway policies, filters (Connect to URL, Script MIME, routing), KPS, OAuth, Portal Alerts, and configuration fragments (YAML/XML). | Scraped offline RAG mirror under `docs/rag/` from Axway Open Docs `apim_policydev`. |
| **`apim-gateway-code-analysis`** | [`apim-gateway-code-analysis/`](apim-gateway-code-analysis/) | Forensic and diagnostic analysis of deployed Axway Gateway code, FED packages (`.fed`), environment settings (`EnvSettingsStore.xml`), and JAR decompilation (`cfr.jar`). | Decompiler & extraction scripts under `scripts/`. |

---

## Agent Discovery & Compatibility

Every AI coding assistant has a preferred discovery path for skills and project rules. The table below outlines how this repository organizes compatibility:

| Agent / IDE | Discovery Path | Project Instructions | MCP Configuration |
|-------------|----------------|----------------------|-------------------|
| **Cursor** | `.cursor/skills/` (mirrored) | `.cursor/rules/apim-policy-development.mdc` | `.cursor/mcp.json` |
| **Google Antigravity** | `.agents/skills/` or global `~/.gemini/config/skills/` | `AGENTS.md` / `GEMINI.md` | `mcp_config.json` |
| **Claude Code** | `.claude/skills/` | `CLAUDE.md` | `claude_desktop_config.json` / `claude.json` |
| **Cline / Roo Code** | `skills/` | `.clinerules` or `AGENTS.md` | `cline_mcp_settings.json` |
| **Windsurf / Cascade** | `skills/` | `.windsurfrules` or `AGENTS.md` | `mcp_config.json` |
| **Open Standards** | `skills/` | `AGENTS.md` | `mcp.json.example` |

---

## Installing Skills into Other Workspaces

Policies typically reside in a dedicated policies repository (e.g. `apim-policies`), not inside this MCP repository. To install these skills and RAG documentation into an external workspace, use the included installer scripts.

### Windows (PowerShell)

```powershell
# Install for all platforms (Cursor, Claude, Antigravity, Generic)
powershell -File scripts/install-policy-dev-skills.ps1 `
  -TargetWorkspace "C:\path\to\apim-policies" `
  -Platform All -Force

# Or install for a specific agent (e.g., Antigravity or Claude)
powershell -File scripts/install-policy-dev-skills.ps1 `
  -TargetWorkspace "C:\path\to\apim-policies" `
  -Platform Antigravity -Force
```

### Linux / macOS / WSL (Bash)

```bash
# Install for all platforms
./scripts/install-policy-dev-skills.sh \
  -TargetWorkspace "$HOME/apim-policies" \
  -Platform All -Force

# Fast symlink mode (auto-syncs changes from apim-mcp)
./scripts/install-policy-dev-skills.sh \
  -TargetWorkspace "$HOME/apim-policies" \
  -Mode Junction -Force
```

See the full installation guide: [docs/en/install-policy-dev-skills.md](../docs/en/install-policy-dev-skills.md) (Portuguese: [docs/pt-BR/instalar-skills-policy-dev.md](../docs/pt-BR/instalar-skills-policy-dev.md)).

---

## MCP Server Integration

When an AI agent connects to this **Axway APIM MCP** server, it automatically gains access to:

1. **Playbook Resources:**
   - `axway://apim/playbook/policy-development` (Full policy authoring playbook)
   - `axway://apim/playbook/gateway-code-analysis` (Full gateway code analysis playbook)
   - `axway://apim/docs/policydev/{slug}` (Direct access to any scraped RAG documentation page)
   - `axway://apim/policies/packages` (List of policy fragment packages)

2. **Workflows & Prompts:**
   - `axway_apim_policy_develop` (Prompt guiding policy authoring)
   - `axway_apim_gateway_diagnose` (Prompt guiding diagnostic investigation)

3. **Fragment Validation Tools:**
   - `axway_apim_fragment_validate_submit`: Submit and validate policy fragments directly from your workspace without mounting them in the container.
   - `axway_apim_fragment_validate`: Validate packages installed on the MCP image.
   - `axway_apim_fragment_packages_list`: List fragment packages available on the server.
