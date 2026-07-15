# Axway APIM MCP

**Versão:** `1.0.15`

Servidor [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) em **Node.js / TypeScript** para administrar e monitorizar ambientes **Axway API Gateway (ANM)** e **API Manager** a partir de clientes como o **Cursor**.

| Guia | Conteúdo |
|------|----------|
| **[docs/guia-fim-a-fim.md](docs/guia-fim-a-fim.md)** | Instalar, configurar Axway + OIDC e autenticar no Cursor |
| **[docs/oidc-idps.md](docs/oidc-idps.md)** | Ligar Keycloak, Entra ID, Okta, Auth0 (ou outro OIDC) |
| **[helm/axway-mcp/](helm/axway-mcp/)** | Chart Kubernetes (Secret obrigatório para users/senhas Axway) |

---

## O que há de novo (1.0.15)

- **OAuth 2.1 Resource Server** no transporte HTTP (`MCP_AUTH_MODE=oidc`) — JWT via JWKS, Protected Resource Metadata (RFC 9728)
- **TLS Axway configurável** (`AXWAY_TLS_REJECT_UNAUTHORIZED` / `AXWAY_TLS_INSECURE`) — default compatível com cert autoassinado
- **Helm:** credentials Axway só via **Kubernetes Secret** (`secretKeyRef`); helpers, ServiceAccount e envs OIDC
- Transportes: **Streamable HTTP** (remoto) e **stdio** (local)
- Documentação fim a fim sem credenciais reais nos exemplos

---

## Arquitectura (duas autenticações)

```text
  Cursor / cliente MCP
        │  OIDC Bearer JWT     (quem pode usar o MCP — só em HTTP)
        ▼
  axway-mcp 1.0.15
        │  Basic Auth AXWAY_*  (MCP → Gateway + Manager)
        ▼
  API Gateway / ANM   +   API Manager
```

| Plano | Variáveis | Notas |
|-------|-----------|--------|
| Cliente → MCP | `MCP_AUTH_MODE`, `OIDC_*`, `MCP_RESOURCE_URL` | Ignorado em `stdio` |
| MCP → Axway | `AXWAY_GATEWAY_*`, `AXWAY_MANAGER_*`, TLS | Em K8s: users/senhas no Secret |

---

## Arranque rápido

### Local (stdio)

```bash
npm ci && npm run build
```

Exemplo em [`.cursor/mcp.json`](.cursor/mcp.json) — preencher URLs/credenciais Axway (placeholders `replace-me`). Sem OIDC.

### Docker (HTTP + OIDC)

```bash
docker build -t axwayjbarros/apim-mcp:1.0.15 .

docker run -d -p 8080:3000 --name axway-mcp \
  -e TRANSPORT_MODE=http \
  -e MCP_AUTH_MODE=oidc \
  -e OIDC_ISSUER=https://idp.example.com/realms/apim-mcp \
  -e OIDC_AUDIENCE=apim-mcp-api \
  -e MCP_RESOURCE_URL=http://localhost:8080 \
  -e MCP_REQUIRED_SCOPES=mcp:tools \
  -e AXWAY_TLS_REJECT_UNAUTHORIZED=false \
  -e AXWAY_GATEWAY_URL=https://anm.example.com/api \
  -e AXWAY_GATEWAY_USERNAME=admin \
  -e AXWAY_GATEWAY_PASSWORD=replace-me \
  -e AXWAY_MANAGER_URL=https://apimgr.example.com/api/portal/v1.4 \
  -e AXWAY_MANAGER_USERNAME=apiadmin \
  -e AXWAY_MANAGER_PASSWORD=replace-me \
  axwayjbarros/apim-mcp:1.0.15
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
  --set image.tag=1.0.15 \
  --set secrets.name=axway-mcp-credentials \
  --set env.MCP_AUTH_MODE=oidc \
  --set env.OIDC_ISSUER=https://idp.example.com/realms/apim-mcp \
  --set env.OIDC_AUDIENCE=apim-mcp-api \
  --set-string env.MCP_RESOURCE_URL=http://mcp.example.com \
  --set env.MCP_REQUIRED_SCOPES=mcp:tools \
  --set-string env.AXWAY_GATEWAY_URL=https://anm.example.com/api \
  --set-string env.AXWAY_MANAGER_URL=https://apimgr.example.com/api/portal/v1.4 \
  --set env.AXWAY_TLS_REJECT_UNAUTHORIZED=false
```

Passos completos (OIDC no IdP, Cursor, smoke tests): **[docs/guia-fim-a-fim.md](docs/guia-fim-a-fim.md)**.

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
| `MCP_RESOURCE_URL` | Se oidc | URL canónica do MCP (RFC 9728) |
| `MCP_REQUIRED_SCOPES` | Não | Ex.: `mcp:tools` |
| `OIDC_JWKS_URI` | Não | Override do JWKS (senão discovery) |

---

## Cursor (cliente MCP)

**Remoto (OIDC):**

```json
{
  "mcpServers": {
    "Axway MCP": {
      "url": "http://mcp.example.com",
      "auth": {
        "CLIENT_ID": "mcp-cursor",
        "scopes": ["openid", "profile", "mcp:tools"]
      }
    }
  }
}
```

Settings → Tools & MCP → **Connect** → login no IdP.

**Local (stdio):** ver [`.cursor/mcp.json`](.cursor/mcp.json).

---

## Capacidades (tools)

O servidor expoe dezenas de tools em `src/tools.ts` / `src/operations/`, entre outras:

| Área | Exemplos |
|------|----------|
| Topologia / sistema | `list_topology`, `get_mcp_server_time`, `get_manager_config` |
| Monitorização | `search_traffic_events`, `get_traffic_event_details`, `get_instance_traffic` |
| Organizações / users | CRUD `list_*` / `create_*` / `update_*` / `delete_*` |
| Aplicações / credenciais | API keys, OAuth, permissions |
| Proxies / catálogo | publish, unpublish, deprecate, auth info |
| Backend / acesso | import OpenAPI, grant/revoke API access |
| Alertas / cotas | `list_alerts`, `get_application_quotas` |

O LLM obtém IDs com listagens e encadeia tools específicas (`correlationId`, `instanceId`, etc.).

---

## Layout do código

| Path | Função |
|------|--------|
| `src/index.ts` | Entrada MCP (HTTP sessões + stdio) + gate OIDC |
| `src/auth/oidc.ts` | Resource Server (PRM, JWT/JWKS) |
| `src/api.ts` | Cliente Axway (Gateway + Manager) |
| `src/tools.ts` | Schemas Zod das tools |
| `src/operations/*` | Implementações por domínio |
| `helm/axway-mcp/` | Deploy K8s |
| `scripts/setup-keycloak-apim-mcp.ps1` | Provisionamento Keycloak (exemplo) |

---

## Licença

ISC — ver `package.json`.
