# Instalar skills de policy development

Como preparar um workspace (Cursor, Claude Code, Copilot, Windsurf, VS Code agents, etc.) para **criar políticas Axway** usando o MCP (`apim-mcp`) sem misturar policies client-specific neste repo.

A **skill em markdown** (`SKILL.md` + RAG) é a fonte de verdade. Cada plataforma só recebe cópias/ponteiros no sítio certo. O MCP Axway é **opcional** para tools live; skill+RAG funcionam offline.

## Opções (resumo)

| Opção | O quê | Quando |
|-------|--------|--------|
| **A — Script (recomendado)** | Copia/junction/symlink da skill + ponteiros + snippet MCP | Workspace `apim-policies` ou instalação global |
| **B — Só MCP** | Playbook/prompt/resources no servidor; sem ficheiros locais | MCP já ligado; RAG via `axway://apim/docs/policydev/...` |
| **C — Prompt no agente** | O agente corre o script | Ver `resources/policy-dev-bootstrap/agent-prompt-install.md` |

## Plataformas (`-Platform` / `-Targets`)

| Valor | Destinos |
|-------|----------|
| **All** (default) | Cursor + Claude + Generic |
| **Cursor** | `.cursor/skills`, `.cursor/rules/*.mdc`, snippet MCP em `.cursor/` |
| **Claude** | `.claude/skills`, `.claude/apim-policy-dev.md`, `CLAUDE.md` se ainda não existir |
| **Generic** | `agent-skills/`, `POLICY_DEV.md`, `AGENTS.md` se ainda não existir (workspace) |

Pode passar lista: `-Platform Cursor,Generic`.

## Passos (opção A)

No repo **apim-mcp**:

### Windows (PowerShell)

```powershell
# Todas as plataformas (default -Platform All)
powershell -File scripts/install-policy-dev-skills.ps1 `
  -TargetWorkspace "C:\path\to\apim-policies" `
  -PoliciesRepoPath "C:\path\to\apim-policies" `
  -Force

# Só Cursor
powershell -File scripts/install-policy-dev-skills.ps1 `
  -TargetWorkspace "C:\path\to\apim-policies" `
  -Platform Cursor -Force

# Global (perfil do utilizador)
powershell -File scripts/install-policy-dev-skills.ps1 -Scope Global -Platform Cursor,Claude -Force

# Manter sincronizado com este repo (junction Windows)
powershell -File scripts/install-policy-dev-skills.ps1 `
  -TargetWorkspace "C:\path\to\apim-policies" `
  -Mode Junction -Force
```

### Unix / macOS / WSL / Git Bash

```bash
chmod +x scripts/install-policy-dev-skills.sh   # uma vez (ou: git update-index --chmod=+x scripts/install-policy-dev-skills.sh)

./scripts/install-policy-dev-skills.sh \
  -TargetWorkspace "$HOME/apim-policies" \
  -PoliciesRepoPath "$HOME/apim-policies" \
  -Platform All \
  -Force

./scripts/install-policy-dev-skills.sh -Scope Global -Platform Cursor,Claude -Force

# Symlink em vez de cópia (-Mode Junction)
./scripts/install-policy-dev-skills.sh \
  -TargetWorkspace "$HOME/apim-policies" \
  -Mode Junction -Force
```

Opcional: `-IncludeGatewaySkill` também instala `apim-gateway-code-analysis`.

## O que o script instala

1. Skill **`apim-policy-development`** (RAG `docs/rag`) → pastas da(s) plataforma(s)
2. Ponteiros / rules conforme a plataforma (ver tabela acima)
3. Snippet **`mcp.json.policy-dev.snippet`** → mesclar na config MCP do cliente
4. Nota **`POLICY-DEV-SETUP.md`** no destino

## Depois de instalar

1. Recarregue o IDE/agente se a skill não aparecer.
2. Confirme o MCP Axway na config do cliente (se quiser tools live).
3. Anexe `axway://apim/playbook/policy-development` ou use `axway_apim_policy_develop` quando o MCP estiver ligado.
4. Autorar em **apim-policies**; validar com `axway_apim_fragment_validate_submit`.

## Trade-offs

| | Workspace | Global |
|--|-----------|--------|
| Partilha com o time | Commit da skill/ponteiros no repo (Copy) | Só na sua máquina |
| Atualizar skill | Re-correr script (`-Force`) ou Junction/symlink | Idem |
| RAG offline | Sim (ficheiros da skill) | Sim |
| Playbook live + tools fragment | Requer **MCP ligado** | Idem |

**Copy vs Junction/symlink:** Copy é portátil; Junction (`ln -s` no Unix) atualiza quando o `apim-mcp` muda, mas o path do MCP tem de permanecer estável.

**Só MCP (B):** o servidor já expõe playbook e RAG; sem skill local o agente pode autorar, mas perde a skill detalhada e o RAG em disco.

## Relação dos repos

```text
apim-mcp          → skills, playbooks, RAG, tools de validação
apim-policies     → pacotes reais (ex. example-policy-package)
```

Não reintroduza policies client-specific no MCP.
