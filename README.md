# Axway APIM MCP

Languages: [English](README.md) | [Português (Brasil)](README.pt-BR.md)

**Version:** `1.0.17-axway-std`

[MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server in **Node.js / TypeScript** to administer and monitor **Axway API Gateway (ANM)** and **API Manager** environments from AI clients such as **Cursor, Google Antigravity, Claude Code, Cline, Windsurf**, and other MCP-enabled tools.

| Guide | Content |
|-------|---------|
| **[docs/en/end-to-end-guide.md](docs/en/end-to-end-guide.md)** | Install, configure Axway + OIDC, and authenticate in MCP clients |
| **[skills/README.md](skills/README.md)** | Multi-agent skills (`apim-policy-development` + `apim-gateway-code-analysis`) |
| **[docs/en/install-policy-dev-skills.md](docs/en/install-policy-dev-skills.md)** | Install policy-dev skills into external workspaces (`apim-policies`) |
| **[docs/en/oidc-idps.md](docs/en/oidc-idps.md)** | Connect Keycloak, Entra ID, Okta, Auth0 (or another OIDC IdP) |
| **[mcp.json.example](mcp.json.example)** | Multi-client MCP configuration examples (Cursor, Claude, Antigravity, Cline) |
| **[helm/axway-mcp/](helm/axway-mcp/)** | Kubernetes chart (Secret required for Axway users/passwords) |

Full docs index: [docs/README.md](docs/README.md).

---

## What's new (1.0.17-axway-std)

- **Axway MCP naming:** tools `axway_apim_<resource>_<action>` and prompt `axway_apim_gateway_diagnose` (provisional `apim` segment — see [docs/en/cpo-apim-product-request.md](docs/en/cpo-apim-product-request.md))
- **MCP annotations** (`readOnlyHint` / `destructiveHint` / `idempotentHint` / `openWorldHint`) on all tools
- Minimal **resources** `axway://apim/...`
- Descriptions/params aligned to the style guide (side effects, retry, siblings)
- OAuth 2.1 Resource Server + hierarchical scopes (`mcp:observe` ⊂ `mcp:operator` ⊂ `mcp:admin`)
- Audit: skill in `vendor/axway-mcp-auditor/` (local; gitignored) + `scripts/export-mcp-manifest.mjs`

---

## Architecture (two authentication planes)

```text
  Cursor / MCP client
        │  OIDC Bearer JWT     (who may use the MCP — HTTP only)
        ▼
  axway-mcp 1.0.17
        │  Basic Auth AXWAY_*  (MCP → Gateway + Manager)
        ▼
  API Gateway / ANM   +   API Manager
```

| Plane | Variables | Notes |
|-------|-----------|-------|
| Client → MCP | `MCP_AUTH_MODE`, `OIDC_*`, `MCP_RESOURCE_URL` | In `stdio`: `MCP_TOOL_PROFILE` |
| MCP → Axway | `AXWAY_GATEWAY_*`, `AXWAY_MANAGER_*`, TLS | In K8s: users/passwords in the Secret |

---

## Axway MCP audit (style guide)

The auditor lives in `vendor/axway-mcp-auditor/` (not versioned; extract the Axway skill ZIP into that folder).

```bash
# 1) Export manifest from the HTTP server (admin token to see all tools)
mkdir -p tmp
node scripts/export-mcp-manifest.mjs http://127.0.0.1:3000 "$MCP_BEARER_TOKEN"

# 2) Normalize + audit + score (Python 3)
python vendor/axway-mcp-auditor/scripts/normalize_manifest.py tmp/mcp_manifest.json -o tmp/mcp_manifest.normalized.json
python vendor/axway-mcp-auditor/scripts/audit_manifest.py tmp/mcp_manifest.normalized.json -o tmp/audit_report.json
python vendor/axway-mcp-auditor/scripts/scoring.py tmp/audit_report.json
```

GA-ready target: score ≥ 70, **0 Critical**, ≤ 3 High. Finding **A10** (`apim` is not yet on the canonical list `{fusion,st,cft,b2bi,workbench,engage}`) remains documented until CPO approves the segment.

Alternative: `python vendor/axway-mcp-auditor/scripts/fetch_manifest.py <url> --header "Authorization: Bearer …"`.

Latest audit summary: [docs/en/axway-mcp-audit-1.0.17.md](docs/en/axway-mcp-audit-1.0.17.md).

---

## Quick start

### Local (stdio)

```bash
npm ci && npm run build
```

Example in [`.cursor/mcp.json`](.cursor/mcp.json) — fill in Axway URLs/credentials (`replace-me` placeholders). No OIDC.

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

Full steps (OIDC in the IdP, Cursor, smoke tests): **[docs/en/end-to-end-guide.md](docs/en/end-to-end-guide.md)**.

---

## Environment variables

### Axway

| Variable | Required | Description |
|----------|----------|-------------|
| `AXWAY_GATEWAY_URL` | Yes | Gateway API base (`…/api`) |
| `AXWAY_GATEWAY_USERNAME` / `PASSWORD` | Yes | In Helm: Secret keys |
| `AXWAY_MANAGER_URL` | Yes | Portal base (`…/api/portal/v1.4`) |
| `AXWAY_MANAGER_USERNAME` / `PASSWORD` | Yes | In Helm: Secret keys |
| `AXWAY_TLS_REJECT_UNAUTHORIZED` | No | Default `false` (self-signed cert) |
| `AXWAY_TLS_INSECURE` | No | `true` ⇒ TLS verify off |

### Runtime / auth

| Variable | Required | Description |
|----------|----------|-------------|
| `TRANSPORT_MODE` | No | `http` (default) or `stdio` |
| `PORT` | No | Default `3000` |
| `TZ` | No | e.g. `America/Sao_Paulo` |
| `MCP_AUTH_MODE` | No | `none` or `oidc` (HTTP) |
| `OIDC_ISSUER` | If oidc | OIDC issuer (no trailing `/`) |
| `OIDC_AUDIENCE` | If oidc | JWT `aud` claim |
| `MCP_RESOURCE_URL` | If oidc | Canonical MCP URL (RFC 9728) |
| `MCP_REQUIRED_SCOPES` | No | Entry gate; OIDC default `mcp:observe` (hierarchical) |
| `OIDC_JWKS_URI` | No | JWKS override (otherwise discovery) |
| `MCP_TOOL_PROFILE` | No | `stdio` only: `observe` \| `operator` \| `admin` (default `admin`) |

---

## AI Agent Skills (`skills/`)

Canonical agent skills and product documentation RAG are located in the [`skills/`](skills/) folder:

| Skill | Purpose | Agent Entry |
|-------|---------|-------------|
| **`apim-policy-development`** | Policy Studio policy development, filter design, YAML/XML fragments, local documentation RAG under `docs/rag/`. | `skills/apim-policy-development/SKILL.md` |
| **`apim-gateway-code-analysis`** | Forensic analysis of FED archives (`.fed`), environment settings, and JAR decompilation. | `skills/apim-gateway-code-analysis/SKILL.md` |

### How Different Agents Discover Skills

- **Cursor:** Automatically loads from `.cursor/skills/` (mirrored from `skills/`) with rules in `.cursor/rules/`.
- **Google Antigravity:** Loads from `.agents/skills/` (workspace) or `~/.gemini/config/skills/` (global), or reads directly from `skills/`.
- **Claude Code:** Loads from `.claude/skills/` or referenced in `CLAUDE.md`.
- **Cline / Roo Code / Windsurf:** Loads directly from `skills/` using `AGENTS.md`.

To install skills into another workspace (such as `apim-policies`):
```bash
# Windows
powershell -File scripts/install-policy-dev-skills.ps1 -TargetWorkspace "C:\path\to\apim-policies" -Platform All -Force

# Linux / macOS
./scripts/install-policy-dev-skills.sh -TargetWorkspace "$HOME/apim-policies" -Platform All -Force
```
See **[skills/README.md](skills/README.md)** for full documentation.

---

## MCP Clients Configuration

See **[`mcp.json.example`](mcp.json.example)** for complete configuration examples across Cursor, Claude Desktop, Google Antigravity, and Cline.

### Remote (HTTP + OIDC)

Example Cursor / generic MCP client configuration:

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

Keycloak/IdP automatically maps the MCP scope according to the user **role** (`mcp-observe` / `mcp-operator` / `mcp-admin`).

### Local (stdio)

Example for local development:
```json
{
  "mcpServers": {
    "Axway MCP (stdio)": {
      "command": "node",
      "args": ["C:/path/to/apim-mcp/build/index.js"],
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
Optional: set `MCP_TOOL_PROFILE=observe` in the server `env` to restrict tool execution to read-only operations.

---

## Scopes by profile (tool authorization)

Hierarchy: **`mcp:admin` ⊃ `mcp:operator` ⊃ `mcp:observe`**. Legacy alias: **`mcp:tools` = `mcp:admin`**.

| Scope | Axway analogue | Can |
|-------|----------------|-----|
| `mcp:observe` | API Server Operator + APIM read | Topology, traffic/logs, list/get (no secrets) |
| `mcp:operator` | Operations | + proxy lifecycle (`lifecycle` on `axway_apim_proxy_update`), quotas, alerts |
| `mcp:admin` | Admin | + CRUD, backend import, API keys/OAuth |

Full tool × profile matrix: [`src/auth/tool-scopes.ts`](src/auth/tool-scopes.ts) and [docs/en/end-to-end-guide.md](docs/en/end-to-end-guide.md).

---

## Capabilities (tools)

The server exposes dozens of tools in `src/tools.ts` / `src/operations/`, including:

| Area | Examples |
|------|----------|
| Topology / system | `axway_apim_topology_list`, `axway_apim_time_get`, `axway_apim_config_get` |
| Monitoring | `axway_apim_traffic_search`, `axway_apim_trafficevent_get`, `axway_apim_instancetraffic_get` |
| Organizations / users | `axway_apim_organization_*`, `axway_apim_user_*` |
| Applications / credentials | `axway_apim_apikey_*`, `axway_apim_oauth_*` |
| Proxies / catalog | `axway_apim_proxy_*` (lifecycle via `lifecycle`), `axway_apim_catalog_get` |
| Backend / access | `axway_apim_backend_submit`, `axway_apim_access_update` / `_delete` |
| Alerts / quotas | `axway_apim_alert_*`, `axway_apim_quota_*` |
| Prompt | `axway_apim_gateway_diagnose`

The LLM obtains IDs from list calls and chains specific tools (`correlationId`, `instanceId`, etc.).

---

## Code layout

| Path | Role |
|------|------|
| `src/index.ts` | MCP entry (HTTP sessions + stdio) + OIDC gate + per-tool authz |
| `src/auth/oidc.ts` | Resource Server (PRM, JWT/JWKS) |
| `src/auth/tool-scopes.ts` | Tool → profile matrix (observe/operator/admin) |
| `src/auth/context.ts` | AsyncLocalStorage / `MCP_TOOL_PROFILE` (stdio) |
| `src/api.ts` | Axway client (Gateway + Manager) |
| `src/tools.ts` | Zod tool schemas |
| `src/operations/*` | Domain implementations |
| `helm/axway-mcp/` | K8s deploy |
| `scripts/setup-keycloak-apim-mcp.ps1` | Keycloak provisioning (example) |

---

## License

ISC — see `package.json`.
