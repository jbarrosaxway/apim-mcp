# Install policy-development skills

Prepare a workspace (Cursor, Claude Code, Copilot, Windsurf, VS Code agents, etc.) to **author Axway policies** using this MCP without copying client-specific policies into `apim-mcp`.

The **markdown skill** (`SKILL.md` + RAG) is the source of truth. Each platform only gets copies/pointers in the right place. Axway MCP is **optional** for live tools; skill+RAG work offline.

## Options

| Option | What | When |
|--------|------|------|
| **A — Script (recommended)** | Copy/junction/symlink skill + pointers + MCP snippet | `apim-policies` workspace or global install |
| **B — MCP only** | Server playbook/prompt/RAG resources | MCP already connected |
| **C — Agent prompt** | Agent runs the script | See `resources/policy-dev-bootstrap/agent-prompt-install.md` |

## Platforms (`-Platform` / `-Targets`)

| Value | Destinations |
|-------|----------------|
| **All** (default) | Cursor + Claude + Generic |
| **Cursor** | `.cursor/skills`, `.cursor/rules/*.mdc`, MCP snippet under `.cursor/` |
| **Claude** | `.claude/skills`, `.claude/apim-policy-dev.md`, `CLAUDE.md` if missing |
| **Generic** | `agent-skills/`, `POLICY_DEV.md`, `AGENTS.md` if missing (workspace) |

Comma-separated lists work: `-Platform Cursor,Generic`.

## Steps (option A)

From the **apim-mcp** repo:

### Windows (PowerShell)

```powershell
powershell -File scripts/install-policy-dev-skills.ps1 `
  -TargetWorkspace "C:\path\to\apim-policies" `
  -PoliciesRepoPath "C:\path\to\apim-policies" `
  -Platform All -Force

powershell -File scripts/install-policy-dev-skills.ps1 -Scope Global -Platform Cursor -Force
```

### Unix / macOS / WSL / Git Bash

```bash
chmod +x scripts/install-policy-dev-skills.sh   # once if needed

./scripts/install-policy-dev-skills.sh \
  -TargetWorkspace "$HOME/apim-policies" \
  -PoliciesRepoPath "$HOME/apim-policies" \
  -Platform All -Force

./scripts/install-policy-dev-skills.sh -Scope Global -Platform Cursor,Claude -Force

# Symlink instead of copy
./scripts/install-policy-dev-skills.sh \
  -TargetWorkspace "$HOME/apim-policies" \
  -Mode Junction -Force
```

Optional: `-IncludeGatewaySkill`, `-Mode Junction` (Windows junction / Unix `ln -s`).

## After install

1. Reload the IDE/agent if the skill does not appear.
2. Ensure the Axway MCP server is in your client MCP config when you need live tools.
3. Attach `axway://apim/playbook/policy-development` or use prompt `axway_apim_policy_develop` when MCP is connected.
4. Author in **apim-policies**; validate with `axway_apim_fragment_validate_submit`.

## Trade-offs

- **Workspace vs Global:** workspace can be committed for the team; global applies on your machine.
- **Copy vs Junction/symlink:** copy is portable; junction/`ln -s` auto-updates when `apim-mcp` changes.
- **MCP required** for live playbook tools / fragment validate against the gateway image; offline RAG still works from the installed skill.

Full PT guide: [instalar-skills-policy-dev.md](../pt-BR/instalar-skills-policy-dev.md).
