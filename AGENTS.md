# AI Agent Instructions (AGENTS.md)

Welcome! This repository is **`apim-mcp`**, a Model Context Protocol (MCP) server written in **Node.js / TypeScript** designed to administer, diagnose, and monitor **Axway API Gateway (ANM)** and **Axway API Manager** environments.

---

## 1. Project Overview & Architecture

- **Runtime:** Node.js 20+, TypeScript, MCP SDK (`@modelcontextprotocol/sdk`).
- **Transport modes:**
  - `http`: Express server with Streamable Server-Sent Events (SSE) / JSON-RPC sessions and OAuth 2.1 / OIDC Resource Server protection.
  - `stdio`: Standard I/O mode for local single-user CLI / IDE execution.
- **Two authentication planes:**
  1. *Client → MCP*: OIDC Bearer token with hierarchical scopes (`mcp:observe` ⊂ `mcp:operator` ⊂ `mcp:admin`).
  2. *MCP → Axway*: Basic Auth credentials targeting Axway Gateway (`AXWAY_GATEWAY_*`) and Manager (`AXWAY_MANAGER_*`).

---

## 2. Agent Skills in This Workspace

This repository provides canonical AI agent skills located under [`skills/`](skills/):

| Skill Path | Purpose | When to Use |
|------------|---------|-------------|
| [`skills/apim-policy-development/SKILL.md`](skills/apim-policy-development/SKILL.md) | Policy Studio development with local RAG documentation. | Authoring or editing API Gateway policies, filters (Connect to URL, Script, Read *), OAuth, KPS, XML/YAML fragments. |
| [`skills/apim-gateway-code-analysis/SKILL.md`](skills/apim-gateway-code-analysis/SKILL.md) | Diagnostic analysis and decompiler workflows. | Investigating FED packages (`.fed`), environment settings (`EnvSettingsStore.xml`), and decompiling Gateway JARs. |

### How to Load Skills

- **Google Antigravity:** Read `skills/<skill_name>/SKILL.md` or install to `.agents/skills/<skill_name>/` using `scripts/install-policy-dev-skills.ps1 -Platform Antigravity`.
- **Cursor:** Reads `.cursor/skills/` (mirrored from `skills/`).
- **Claude Code:** Reads `.claude/skills/` or follows guidance in `CLAUDE.md`.
- **Generic / Cline / Roo Code / Windsurf:** Read directly from `skills/<skill_name>/SKILL.md`.

---

## 3. Important Boundaries & Conventions

1. **Policies boundary:**
   - Real customer policies live in the external repository **`apim-policies`**, NOT in `apim-mcp`.
   - When writing or validating policy fragments from an agent workspace, use the tool `axway_apim_fragment_validate_submit` or the RAG markdown corpus under `skills/apim-policy-development/docs/rag/`.
2. **Language & Translations:**
   - All code, code comments, and log messages MUST be written in **English**.
   - User-facing documentation is bilingual: English in `docs/en/` (canonical) and Portuguese in `docs/pt-BR/`. Keep both in sync when modifying documentation.
3. **Build & Quality:**
   - Verify TypeScript compilation with `npm run build`. Zero compile errors are required.
   - All tools must adhere to Axway MCP style guide naming (`axway_apim_<resource>_<action>`) and include proper annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`).
4. **Policy Deployment & K8s `/merge` Lifecycle:**
   - Pre-flight validation MUST use [`resources/fragment/scripts/validate-fragment-generic.py`](resources/fragment/scripts/validate-fragment-generic.py) or `axway_apim_fragment_validate_submit`.
   - Deployments to containerized Axway Gateways (e.g. `apim-lab`) use the persistent volume mounted at **/merge** (`/merge/fed.fed` or `/merge/yaml.tar.gz`).
   - Deployment automation is standardized in [`scripts/deploy-gateway-fed-helpers.ps1`](scripts/deploy-gateway-fed-helpers.ps1) (`Copy-ArtifactToPod` via `kubectl cp` -> `Restart-Deployments` -> `Wait-DeploymentsReady`).


---

## 4. MCP Tools & Resources Quick Reference

- **Playbook resources:**
  - `axway://apim/playbook/policy-development`
  - `axway://apim/playbook/gateway-code-analysis`
  - `axway://apim/docs/policydev/{slug}`
  - `axway://apim/policies/packages`
- **Prompts:**
  - `axway_apim_gateway_diagnose`: Diagnostic troubleshooting flow.
  - `axway_apim_policy_develop`: Interactive policy authoring playbook.
- **Example MCP client config:** See [`mcp.json.example`](mcp.json.example).
