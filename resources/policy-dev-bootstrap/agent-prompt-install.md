# Prompt — install policy-development environment

Paste into any coding agent (Cursor, Claude Code, Copilot, Windsurf, VS Code, …), from the **apim-mcp** repo or the target policies workspace:

---

Install the **platform-agnostic** Axway policy-development environment from this MCP repo:

1. Run `scripts/install-policy-dev-skills.ps1` (Windows) or `scripts/install-policy-dev-skills.sh` (Unix/macOS/WSL) with `-TargetWorkspace` pointing at the policies workspace (e.g. `apim-policies`), or `-Scope Global`.
2. Use `-Platform All` (default) or pick `Cursor`, `Claude`, `Generic` (comma-separated OK).
3. Ensure skill `apim-policy-development` (RAG under `docs/rag`) is installed under the platform paths (`.cursor/skills`, `.claude/skills`, and/or `agent-skills/`).
4. Confirm MCP Axway config via the generated `mcp.json.policy-dev.snippet` if live tools are needed.
5. Summarize: how to load the skill offline and how to attach `axway://apim/playbook/policy-development` when MCP is available.

Do **not** copy client-specific policies into apim-mcp.

---

After install, e.g.: *Create a Portal Alerts Send fragment following the playbook*.
