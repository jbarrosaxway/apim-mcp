# Axway APIM MCP

Languages: [English](README.md) | [Português (Brasil)](README.pt-BR.md)

**Versão:** `1.0.17-axway-std`

Servidor [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) em **Node.js / TypeScript** para administrar e monitorar ambientes **Axway API Gateway (ANM)** e **API Manager** a partir de clientes de IA como **Cursor, Google Antigravity, Claude Code, Cline, Windsurf** e outras ferramentas habilitadas para MCP.

| Guia | Conteúdo |
|------|----------|
| **[docs/pt-BR/guia-fim-a-fim.md](docs/pt-BR/guia-fim-a-fim.md)** | Instalar, configurar Axway + OIDC e autenticar em clientes MCP |
| **[skills/README.md](skills/README.md)** | Skills multi-agente (`apim-policy-development` + `apim-gateway-code-analysis`) |
| **[docs/pt-BR/instalar-skills-policy-dev.md](docs/pt-BR/instalar-skills-policy-dev.md)** | Instalar skills de policy-dev em workspaces externos (`apim-policies`) |
| **[docs/pt-BR/oidc-idps.md](docs/pt-BR/oidc-idps.md)** | Conectar Keycloak, Entra ID, Okta, Auth0 (ou outro OIDC) |
| **[mcp.json.example](mcp.json.example)** | Exemplos de configuração multi-cliente (Cursor, Claude, Antigravity, Cline) |
| **[helm/axway-mcp/](helm/axway-mcp/)** | Chart Kubernetes (Secret obrigatório para users/senhas Axway) |

Índice completo: [docs/README.md](docs/README.md).

---

## O que há de novo (1.0.17-axway-std)

- **Naming Axway MCP:** tools `axway_apim_<resource>_<action>` e prompt `axway_apim_gateway_diagnose` (segmento `apim` provisório — ver [docs/pt-BR/cpo-apim-product-request.md](docs/pt-BR/cpo-apim-product-request.md))
- **Annotations MCP** (`readOnlyHint` / `destructiveHint` / `idempotentHint` / `openWorldHint`) em todas as tools
- **Resources** mínimos `axway://apim/...`
- Descriptions/params alinhados ao style guide (side effects, retry, siblings)
- OAuth 2.1 Resource Server + scopes hierárquicos (`mcp:observe` ⊂ `mcp:operator` ⊂ `mcp:admin`)
- Auditoria: skill em `vendor/axway-mcp-auditor/` (local; ignorado pelo git) + `scripts/export-mcp-manifest.mjs`

---

## Arquitetura (duas autenticações)

```text
  Cursor / cliente MCP
        │  OIDC Bearer JWT     (quem pode usar o MCP — só em HTTP)
        ▼
  axway-mcp 1.0.17
        │  Basic Auth AXWAY_*  (MCP → Gateway + Manager)
        ▼
  API Gateway / ANM   +   API Manager
```

| Plano | Variáveis | Notas |
|-------|-----------|--------|
| Cliente → MCP | `MCP_AUTH_MODE`, `OIDC_*`, `MCP_RESOURCE_URL` | Em `stdio`: `MCP_TOOL_PROFILE` |
| MCP → Axway | `AXWAY_GATEWAY_*`, `AXWAY_MANAGER_*`, TLS | Em K8s: users/senhas no Secret |

---

## Auditoria Axway MCP (style guide)

O auditor vive em `vendor/axway-mcp-auditor/` (não versionado; extrair o ZIP da skill Axway para essa pasta).

```bash
# 1) Exportar manifest do servidor HTTP (admin token para ver todas as tools)
mkdir -p tmp
node scripts/export-mcp-manifest.mjs http://127.0.0.1:3000 "$MCP_BEARER_TOKEN"

# 2) Normalizar + auditar + score (Python 3)
python vendor/axway-mcp-auditor/scripts/normalize_manifest.py tmp/mcp_manifest.json -o tmp/mcp_manifest.normalized.json
python vendor/axway-mcp-auditor/scripts/audit_manifest.py tmp/mcp_manifest.normalized.json -o tmp/audit_report.json
python vendor/axway-mcp-auditor/scripts/scoring.py tmp/audit_report.json
```

Meta GA-ready: score ≥ 70, **0 Critical**, ≤ 3 High. Finding **A10** (`apim` ainda não está na lista canônica `{fusion,st,cft,b2bi,workbench,engage}`) fica documentado até a CPO aprovar o segmento.

Alternativa: `python vendor/axway-mcp-auditor/scripts/fetch_manifest.py <url> --header "Authorization: Bearer …"`.

Resumo da última auditoria: [docs/pt-BR/axway-mcp-audit-1.0.17.md](docs/pt-BR/axway-mcp-audit-1.0.17.md).

---

## Arranque rápido

### Local (stdio)

```bash
npm ci && npm run build
```

Exemplo em [`.cursor/mcp.json`](.cursor/mcp.json) — preencher URLs/credenciais Axway (placeholders `replace-me`). Sem OIDC.

### Docker (HTTP + OIDC)

```bash
docker build -t axwayjbarros/apim-mcp:1.0.17-axway-std .

docker run -d -p 8080:3000 --name axway-mcp \
  -e TRANSPORT_MODE=http \
  -e MCP_AUTH_MODE=oidc \
  -e OIDC_ISSUER=https://idp.example.com/realms/apim-mcp \
  -e OIDC_AUDIENCE=apim-mcp-api \
  -e MCP_RESOURCE_URL=http://localhost:8080 \
  -e MCP_REQUIRED_SCOPES=mcp:observe \
  -e AXWAY_TLS_REJECT_UNAUTHORIZED=false \
  -e AXWAY_GATEWAY_URL=https://anm.example.com/api \
  -e AXWAY_GATEWAY_USERNAME=admin \
  -e AXWAY_GATEWAY_PASSWORD=replace-me \
  -e AXWAY_MANAGER_URL=https://apimgr.example.com/api/portal/v1.4 \
  -e AXWAY_MANAGER_USERNAME=apiadmin \
  -e AXWAY_MANAGER_PASSWORD=replace-me \
  axwayjbarros/apim-mcp:1.0.17-axway-std
```

### Kubernetes (Helm)

```bash
kubectl create namespace apim-mcp

kubectl -n apim-mcp create secret generic axway-mcp-credentials \
  --from-literal=AXWAY_GATEWAY_USERNAME='admin' \
  --from-literal=AXWAY_GATEWAY_PASSWORD='replace-me' \
  --from-literal=AXWAY_MANAGER_USERNAME='apiadmin' \
  --from-literal=AXWAY_MANAGER_PASSWORD='replace-me'

helm upgrade --install axway-mcp ./helm/axway-mcp -n apim-mcp \
  --set image.repository=axwayjbarros/apim-mcp \
  --set image.tag=1.0.17-axway-std \
  --set secrets.name=axway-mcp-credentials \
  --set env.MCP_AUTH_MODE=oidc \
  --set env.OIDC_ISSUER=https://idp.example.com/realms/apim-mcp \
  --set env.OIDC_AUDIENCE=apim-mcp-api \
  --set-string env.MCP_RESOURCE_URL=http://mcp.example.com \
  --set env.MCP_REQUIRED_SCOPES=mcp:observe \
  --set-string env.AXWAY_GATEWAY_URL=https://anm.example.com/api \
  --set-string env.AXWAY_MANAGER_URL=https://apimgr.example.com/api/portal/v1.4 \
  --set env.AXWAY_TLS_REJECT_UNAUTHORIZED=false
```

Passos completos (OIDC no IdP, Cursor, smoke tests): **[docs/pt-BR/guia-fim-a-fim.md](docs/pt-BR/guia-fim-a-fim.md)**.

---

## Variáveis de ambiente

### Axway

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `AXWAY_GATEWAY_URL` | Sim | Base da API do Gateway (`…/api`) |
| `AXWAY_GATEWAY_USERNAME` / `PASSWORD` | Sim | Em Helm: chaves do Secret |
| `AXWAY_MANAGER_URL` | Sim | Base do Portal (`…/api/portal/v1.4`) |
| `AXWAY_MANAGER_USERNAME` / `PASSWORD` | Sim | Em Helm: chaves do Secret |
| `AXWAY_TLS_REJECT_UNAUTHORIZED` | Não | Default `false` (cert autoassinado) |
| `AXWAY_TLS_INSECURE` | Não | `true` ⇒ TLS verify off |

### Runtime / auth

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `TRANSPORT_MODE` | Não | `http` (default) ou `stdio` |
| `PORT` | Não | Default `3000` |
| `TZ` | Não | Ex.: `America/Sao_Paulo` |
| `MCP_AUTH_MODE` | Não | `none` ou `oidc` (HTTP) |
| `OIDC_ISSUER` | Se oidc | Issuer OIDC (sem `/` final) |
| `OIDC_AUDIENCE` | Se oidc | Claim `aud` do JWT |
| `MCP_RESOURCE_URL` | Se oidc | URL canônica do MCP (RFC 9728) |
| `MCP_REQUIRED_SCOPES` | Não | Gate de entrada; default OIDC `mcp:observe` (hierárquico) |
| `OIDC_JWKS_URI` | Não | Override do JWKS (senão discovery) |
| `MCP_TOOL_PROFILE` | Não | Só `stdio`: `observe` \| `operator` \| `admin` (default `admin`) |

---

## Skills para Agentes de IA (`skills/`)

As skills canônicas para agentes e o corpus RAG de documentação vivem na pasta [`skills/`](skills/):

| Skill | Objetivo | Ponto de Entrada |
|-------|----------|------------------|
| **`apim-policy-development`** | Desenvolvimento de policies no Policy Studio, desenho de filtros, fragments YAML/XML, RAG local em `docs/rag/`. | `skills/apim-policy-development/SKILL.md` |
| **`apim-gateway-code-analysis`** | Análise forense de arquivos FED (`.fed`), configurações de ambiente e descompilação de JARs. | `skills/apim-gateway-code-analysis/SKILL.md` |

### Como Diferentes Agentes Descobrem as Skills

- **Cursor:** Carrega automaticamente de `.cursor/skills/` (espelhado de `skills/`) com regras em `.cursor/rules/`.
- **Google Antigravity:** Carrega de `.agents/skills/` (workspace) ou `~/.gemini/config/skills/` (global), ou lê diretamente de `skills/`.
- **Claude Code:** Carrega de `.claude/skills/` ou referenciado em `CLAUDE.md`.
- **Cline / Roo Code / Windsurf:** Carrega diretamente de `skills/` usando as instruções em `AGENTS.md`.

Para instalar as skills noutro workspace (ex. `apim-policies`):
```bash
# Windows
powershell -File scripts/install-policy-dev-skills.ps1 -TargetWorkspace "C:\caminho\para\apim-policies" -Platform All -Force

# Linux / macOS
./scripts/install-policy-dev-skills.sh -TargetWorkspace "$HOME/apim-policies" -Platform All -Force
```
Consulte **[skills/README.md](skills/README.md)** para a documentação completa.

---

## Configuração de Clientes MCP

Veja **[`mcp.json.example`](mcp.json.example)** para exemplos de configuração detalhados para Cursor, Claude Desktop, Google Antigravity e Cline.

### Remoto (HTTP + OIDC)

Exemplo de configuração para Cursor / clientes genéricos:

```json
{
  "mcpServers": {
    "Axway MCP": {
      "url": "http://mcp.example.com",
      "auth": {
        "CLIENT_ID": "mcp-cursor",
        "scopes": ["openid", "profile"]
      }
    }
  }
}
```

O Keycloak/IdP inclui automaticamente o scope MCP conforme a **role** do user (`mcp-observe` / `mcp-operator` / `mcp-admin`).

### Local (stdio)

Exemplo para desenvolvimento local:
```json
{
  "mcpServers": {
    "Axway MCP (stdio)": {
      "command": "node",
      "args": ["C:/caminho/para/apim-mcp/build/index.js"],
      "env": {
        "TRANSPORT_MODE": "stdio",
        "MCP_TOOL_PROFILE": "admin",
        "AXWAY_TLS_REJECT_UNAUTHORIZED": "false",
        "AXWAY_GATEWAY_URL": "https://anm.example.com/api",
        "AXWAY_GATEWAY_USERNAME": "admin",
        "AXWAY_GATEWAY_PASSWORD": "replace-me",
        "AXWAY_MANAGER_URL": "https://apimgr.example.com/api/portal/v1.4",
        "AXWAY_MANAGER_USERNAME": "apiadmin",
        "AXWAY_MANAGER_PASSWORD": "replace-me"
      }
    }
  }
}
```
Opcional: defina `MCP_TOOL_PROFILE=observe` no `env` do servidor para restringir a execução a operações apenas de leitura.

---

## Scopes por perfil (autorização de tools)

Hierarquia: **`mcp:admin` ⊃ `mcp:operator` ⊃ `mcp:observe`**. Alias legado: **`mcp:tools` = `mcp:admin`**.

| Scope | Axway análogo | Pode |
|-------|---------------|------|
| `mcp:observe` | API Server Operator + leitura APIM | Topologia, tráfego/logs, list/get (sem secrets) |
| `mcp:operator` | Operação | + lifecycle de proxy (`lifecycle` em `axway_apim_proxy_update`), cotas, alertas |
| `mcp:admin` | Admin | + CRUD, import backend, API keys/OAuth |

Matriz completa tool × perfil: [`src/auth/tool-scopes.ts`](src/auth/tool-scopes.ts) e [docs/pt-BR/guia-fim-a-fim.md](docs/pt-BR/guia-fim-a-fim.md).

---

## Capacidades (tools)

O servidor expõe dezenas de tools em `src/tools.ts` / `src/operations/`, entre outras:

| Área | Exemplos |
|------|----------|
| Topologia / sistema | `axway_apim_topology_list`, `axway_apim_time_get`, `axway_apim_config_get` |
| Monitoramento | `axway_apim_traffic_search`, `axway_apim_trafficevent_get`, `axway_apim_instancetraffic_get` |
| Organizações / users | `axway_apim_organization_*`, `axway_apim_user_*` |
| Aplicações / credenciais | `axway_apim_apikey_*`, `axway_apim_oauth_*` |
| Proxies / catálogo | `axway_apim_proxy_*` (lifecycle via `lifecycle`), `axway_apim_catalog_get` |
| Backend / acesso | `axway_apim_backend_submit`, `axway_apim_access_update` / `_delete` |
| Alertas / cotas | `axway_apim_alert_*`, `axway_apim_quota_*` |
| Prompt | `axway_apim_gateway_diagnose`

O LLM obtém IDs com listagens e encadeia tools específicas (`correlationId`, `instanceId`, etc.).

---

## Layout do código

| Path | Função |
|------|--------|
| `src/index.ts` | Entrada MCP (HTTP sessões + stdio) + gate OIDC + authz por tool |
| `src/auth/oidc.ts` | Resource Server (PRM, JWT/JWKS) |
| `src/auth/tool-scopes.ts` | Matriz tool → perfil (observe/operator/admin) |
| `src/auth/context.ts` | AsyncLocalStorage / `MCP_TOOL_PROFILE` (stdio) |
| `src/api.ts` | Cliente Axway (Gateway + Manager) |
| `src/tools.ts` | Schemas Zod das tools |
| `src/operations/*` | Implementações por domínio |
| `helm/axway-mcp/` | Deploy K8s |
| `scripts/setup-keycloak-apim-mcp.ps1` | Provisionamento Keycloak (exemplo) |

---

## Licença

ISC — ver `package.json`.
