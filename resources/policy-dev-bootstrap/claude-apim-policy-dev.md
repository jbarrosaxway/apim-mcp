# Axway policy development (Claude Code)

When authoring Axway Gateway policies / fragments:

1. Read and follow skills under `{{SKILLS_HINT}}/` (especially `apim-policy-development/SKILL.md` and local RAG in `docs/rag/`).
2. If an Axway APIM MCP server is configured, attach `axway://apim/playbook/policy-development` or use prompt `axway_apim_policy_develop`.
3. Do not invent `com.vordel.*` APIs — use skill + RAG (and MCP docs resources when online).
4. Client packages live in **apim-policies**: `{{APIM_POLICIES_PATH}}`.
5. Validate with `axway_apim_fragment_validate_submit` when MCP is available.

Installed skills: {{SKILL_NAMES}}.
