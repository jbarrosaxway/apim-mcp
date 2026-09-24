# Axway policy development (any agent)

Platform-agnostic instructions for Cursor, Claude Code, Copilot, Windsurf, VS Code agents, etc.

## Skills (source of truth)

Markdown skills are under `{{SKILLS_HINT}}/`:

- `{{SKILL_NAMES}}`

Start with `{{SKILLS_HINT}}/apim-policy-development/SKILL.md` and the RAG corpus under that skill’s `docs/rag/`.

## MCP (optional)

Live Gateway/APIM tools and the policy-development playbook need an Axway APIM MCP connection.

- Playbook resource: `axway://apim/playbook/policy-development`
- Prompt: `axway_apim_policy_develop`
- Merge `mcp.json.policy-dev.snippet` into your client’s MCP config (URL: `{{MCP_URL}}`).

Offline: skill + RAG still apply; skip live topology/FED/validate tools until MCP is up.

## Policies repo

Author real packages in **apim-policies** (`{{APIM_POLICIES_PATH}}`). Do not copy client-specific policies into apim-mcp.

Validate with `axway_apim_fragment_validate_submit` when MCP is available.
