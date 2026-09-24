# Claude Code Guidelines (CLAUDE.md)

Welcome! This repository is **`apim-mcp`**, an Axway API Gateway and API Manager Model Context Protocol (MCP) server.

## Commands

- **Build:** `npm run build` (compiles TypeScript to `build/`)
- **Clean install:** `npm ci`
- **Lint/Check:** `npm run build` (validates types across `src/`)
- **Start (stdio):** `node build/index.js` (with `TRANSPORT_MODE=stdio`)
- **Start (HTTP):** `node build/index.js` (with `TRANSPORT_MODE=http PORT=3000`)

## Project Conventions

- **Language:** Code and comments in English. Documentation bilingual (English in `docs/en/` and Portuguese in `docs/pt-BR/`).
- **Tool definitions:** In `src/tools.ts` using Zod schemas with descriptions, annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`), and titles.
- **Operations:** Domain implementations in `src/operations/*.ts`.
- **Naming:** Tools follow `axway_apim_<resource>_<action>`.
- **Policy authoring boundary:** Customer policies belong in `apim-policies`. This repo only contains the MCP server and validation tools (`axway_apim_fragment_validate_submit`).

## Skills & RAG

- **Canonical skills:** Located in [`skills/`](skills/):
  - `skills/apim-policy-development/SKILL.md`: Policy Studio development + offline RAG under `docs/rag/`.
  - `skills/apim-gateway-code-analysis/SKILL.md`: FED inspection and decompilation.
- To install skills into an external policies workspace:
  ```bash
  ./scripts/install-policy-dev-skills.sh -TargetWorkspace "$HOME/apim-policies" -Platform Claude -Force
  ```
- MCP resources: `axway://apim/playbook/policy-development`, `axway://apim/playbook/gateway-code-analysis`.
