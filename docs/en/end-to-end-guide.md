# End-to-end guide — Install, configure, and authenticate Axway APIM MCP

Languages: [English](end-to-end-guide.md) | [Português (Brasil)](../pt-BR/guia-fim-a-fim.md)

Single document to get the MCP running with **Axway (Gateway/ANM + API Manager)** and **OIDC (Keycloak or another IdP)**, including use in **Cursor**.

For other IdPs (Entra, Okta, Auth0): [oidc-idps.md](oidc-idps.md).  
For a conceptual overview of the project: [README.md](../../README.md).

---

## 1. Overview (two authentication planes)

There are **two distinct planes**:

```text
  User (Cursor)
        │  OIDC / Bearer JWT          ← who may talk to the MCP
        ▼
  Axway APIM MCP (HTTP or stdio)
        │  Basic Auth AXWAY_*         ← MCP talks to Axway
        ▼
  Gateway (ANM)  +  API Manager
```

| Plane | What | Where to configure |
|-------|------|--------------------|
| **A — Client → MCP** | Who uses the tools (Cursor) | OIDC / Keycloak; in Cursor: `url` + `auth` |
| **B — MCP → Axway** | Technical credentials for Gateway and Manager | K8s Secret or `env` in stdio/Docker |

- **Remote HTTP:** use OIDC (`MCP_AUTH_MODE=oidc`).  
- **Local stdio:** no OIDC (local process); only needs `AXWAY_*` vars.

---

## 2. Prerequisites

- Node.js 20+ (local install / build) **or** Docker **or** Kubernetes cluster + Helm  
- HTTPS access to the **Admin Node Manager / Gateway** and **API Manager**  
- (HTTP) OIDC IdP with Authorization Code + PKCE (lab: Keycloak)  
- MCP client with remote OAuth support (Cursor)

Typical API base URLs (adjust to your environment):

| System | Base URL (example) |
|--------|---------------------|
| Gateway / ANM | `https://anm.<host>/api` |
| API Manager | `https://apimgr.<host>/api/portal/v1.4` |

---

## 3. Build the application

```bash
git clone <repo> && cd apim-mcp
npm ci
npm run build    # produces build/
```

Docker image:

```bash
docker build -t axwayjbarros/apim-mcp:1.0.15 .
```

---

## 4. Choose the run mode

| Mode | When to use | Client auth |
|------|-------------|-------------|
| **A. stdio (local)** | Laptop development | None (OS) |
| **B. Docker HTTP** | Lab / single VM | OIDC recommended |
| **C. Kubernetes + Helm** | Cluster (production/lab AKS) | OIDC recommended |

---

## 5. Configure Axway (plane B)

### 5.1 Variables

| Variable | Description |
|----------|-------------|
| `AXWAY_GATEWAY_URL` | Gateway API base (`…/api`) |
| `AXWAY_GATEWAY_USERNAME` / `PASSWORD` | Technical ANM/Gateway user |
| `AXWAY_MANAGER_URL` | Portal base (`…/api/portal/v1.4`) |
| `AXWAY_MANAGER_USERNAME` / `PASSWORD` | Technical API Manager user |
| `AXWAY_TLS_REJECT_UNAUTHORIZED` | `false` = accept self-signed cert (default); `true` in prod with CA |
| `AXWAY_TLS_INSECURE` | Shortcut: `true` ⇒ TLS verify off |

### 5.2 Validate the APIs manually (optional)

```bash
curl -sk -u 'admin:PASSWORD' https://anm.example/api/topology
curl -sk -u 'user:PASSWORD' https://apimgr.example/api/portal/v1.4/organizations
```

Expected: HTTP **200**.

---

## 6. Install A — Local (stdio) + Cursor

1. Build (`npm run build`).  
2. Edit [`.cursor/mcp.json`](../../.cursor/mcp.json) (or `~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "Axway MCP - stdio - local": {
      "command": "node",
      "args": ["C:/Users/YOUR_USER/apim-mcp/build/index.js"],
      "env": {
        "TRANSPORT_MODE": "stdio",
        "AXWAY_TLS_REJECT_UNAUTHORIZED": "false",
        "AXWAY_GATEWAY_URL": "https://anm.example/api",
        "AXWAY_GATEWAY_USERNAME": "admin",
        "AXWAY_GATEWAY_PASSWORD": "***",
        "AXWAY_MANAGER_URL": "https://apimgr.example/api/portal/v1.4",
        "AXWAY_MANAGER_USERNAME": "apiadmin",
        "AXWAY_MANAGER_PASSWORD": "***"
      }
    }
  }
}
```

3. Cursor → **Settings → Tools & MCP** → enable the server / restart.  
4. Ask in chat: *“list the gateway topology”* / *“list organizations”*.

There is no OIDC login in this mode.

---

## 7. Install B — Docker (HTTP + OIDC)

```bash
docker run -d --name axway-mcp -p 8080:3000 \
  -e TRANSPORT_MODE=http \
  -e MCP_AUTH_MODE=oidc \
  -e OIDC_ISSUER=https://idp.example/realms/apim-mcp \
  -e OIDC_AUDIENCE=apim-mcp-api \
  -e MCP_RESOURCE_URL=http://localhost:8080 \
  -e MCP_REQUIRED_SCOPES=mcp:observe \
  -e AXWAY_TLS_REJECT_UNAUTHORIZED=false \
  -e AXWAY_GATEWAY_URL=https://anm.example/api \
  -e AXWAY_GATEWAY_USERNAME=admin \
  -e AXWAY_GATEWAY_PASSWORD=*** \
  -e AXWAY_MANAGER_URL=https://apimgr.example/api/portal/v1.4 \
  -e AXWAY_MANAGER_USERNAME=apiadmin \
  -e AXWAY_MANAGER_PASSWORD=*** \
  -e TZ=America/Sao_Paulo \
  axwayjbarros/apim-mcp:1.0.15
```

Preferred: `--env-file .env` (`.env` files are in `.gitignore`).

Continue in [section 9 (OIDC)](#9-configure-oidc-plane-a) and [section 10 (Cursor HTTP)](#10-connect-cursor-to-the-mcp-http).

---

## 8. Install C — Kubernetes + Helm (recommended)

### 8.1 Namespace and Axway Secret (required)

Users and passwords do **not** go in `values.yaml` — only in a Secret:

```bash
kubectl create namespace apim-mcp

kubectl -n apim-mcp create secret generic axway-mcp-credentials \
  --from-literal=AXWAY_GATEWAY_USERNAME='admin' \
  --from-literal=AXWAY_GATEWAY_PASSWORD='***' \
  --from-literal=AXWAY_MANAGER_USERNAME='apiadmin' \
  --from-literal=AXWAY_MANAGER_PASSWORD='***'
```

YAML example: [`helm/axway-mcp/secret.example.yaml`](../../helm/axway-mcp/secret.example.yaml).

Update credentials later:

```bash
kubectl -n apim-mcp create secret generic axway-mcp-credentials \
  --from-literal=AXWAY_GATEWAY_USERNAME='...' \
  --from-literal=AXWAY_GATEWAY_PASSWORD='...' \
  --from-literal=AXWAY_MANAGER_USERNAME='...' \
  --from-literal=AXWAY_MANAGER_PASSWORD='...' \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl -n apim-mcp rollout restart deploy/axway-mcp
```

### 8.2 Helm install / upgrade

```bash
helm upgrade --install axway-mcp ./helm/axway-mcp -n apim-mcp \
  --set secrets.name=axway-mcp-credentials \
  --set secrets.create=false \
  --set image.repository=axwayjbarros/apim-mcp \
  --set image.tag=1.0.15 \
  --set service.type=LoadBalancer \
  --set env.TRANSPORT_MODE=http \
  --set env.TZ=America/Sao_Paulo \
  --set env.AXWAY_TLS_REJECT_UNAUTHORIZED=false \
  --set-string env.AXWAY_GATEWAY_URL='https://anm.example/api' \
  --set-string env.AXWAY_MANAGER_URL='https://apimgr.example/api/portal/v1.4' \
  --set env.MCP_AUTH_MODE=oidc \
  --set-string env.OIDC_ISSUER='https://idp.example/realms/apim-mcp' \
  --set env.OIDC_AUDIENCE=apim-mcp-api \
  --set-string env.MCP_RESOURCE_URL='http://<EXTERNAL-IP-OR-DNS>' \
  --set env.MCP_REQUIRED_SCOPES=mcp:observe
```

Get the Service IP/DNS and **update** `MCP_RESOURCE_URL` if needed:

```bash
kubectl -n apim-mcp get svc axway-mcp
helm upgrade axway-mcp ./helm/axway-mcp -n apim-mcp --reuse-values \
  --set-string env.MCP_RESOURCE_URL='http://<EXTERNAL-IP>'
kubectl -n apim-mcp rollout restart deploy/axway-mcp
```

If the image is in a private registry, configure `imagePullSecrets`.

---

## 9. Configure OIDC (plane A)

### 9.1 What to create in the IdP

1. Realm / tenant (e.g. `apim-mcp`)  
2. Audience / API resource → `OIDC_AUDIENCE` (e.g. `apim-mcp-api`)  
3. Scopes `mcp:observe` / `mcp:operator` / `mcp:admin` (legacy `mcp:tools` = admin)  
4. **Public** client + PKCE for MCP clients (e.g. name `mcp-cursor` — the same client can serve Cursor, Kiro, Claude Code, Codex, etc.)  
5. **Redirect URIs** — set by the **client** in the OAuth redirect URL (not by Axway MCP). Register at least a generic loopback and, if needed, client-specific schemes:
   - Generic (lab): `http://127.0.0.1/*`, `http://localhost/*`
   - Cursor: `cursor://anysphere.cursor-mcp/oauth/callback`, `https://www.cursor.com/agents/mcp/oauth/callback`
   - Kiro: fix `oauth.redirectUri` (e.g. `127.0.0.1:8080` or `http://localhost:7778/oauth/callback`) **or** rely on loopback wildcards
   - Claude Code: `http://localhost:<port>/callback` (ephemeral port; optional `--callback-port`)
   - Codex: loopback + possible callback id suffix (see `mcp_oauth_callback_port` / `mcp_oauth_callback_url` in Codex)
   Detail and table: [oidc-idps.md](oidc-idps.md) §3.
6. Test user

### 9.2 Keycloak example

Example IdP: `https://idp.example.com/`

| Field | Example value |
|-------|---------------|
| Realm | `apim-mcp` |
| Test user | `mcp-tester` |
| Password | `replace-me` |
| MCP client (public PKCE) | `mcp-cursor` (example name; shareable across agents) |
| Audience | `apim-mcp-api` |
| Scopes | `mcp:observe` (+ operator/admin/tools) — **default** on the client; come from the user role |
| Smoke client | `mcp-test-cli` / secret `replace-me-client-secret` |

Provision (admin password **only** via parameter/env, never in the repository):

```powershell
powershell -File scripts/setup-keycloak-apim-mcp.ps1 `
  -KeycloakUrl 'https://idp.example.com' `
  -AdminUser 'admin' `
  -AdminPassword $env:KC_ADMIN_PASSWORD `
  -TestUserPassword 'replace-me'
```

Issuer on the MCP:

```bash
OIDC_ISSUER=https://idp.example.com/realms/apim-mcp
OIDC_AUDIENCE=apim-mcp-api
MCP_REQUIRED_SCOPES=mcp:observe
```

Other IdPs: [oidc-idps.md](oidc-idps.md).

### 9.3 Authorization matrix (tool × profile)

Hierarchy: **`mcp:admin` ⊃ `mcp:operator` ⊃ `mcp:observe`**. Legacy: **`mcp:tools` = admin**.

| Profile | Tools | Denied |
|---------|------:|-------:|
| `mcp:observe` | 25 | 24 |
| `mcp:operator` | 30 | 19 |
| `mcp:admin` | 49 | 0 |

**observe** — `axway_apim_time_get`, `axway_apim_config_get`, `axway_apim_topology_list`, traffic/metrics (`axway_apim_instancetraffic_get`, `axway_apim_servicetraffic_get`, `axway_apim_metrics_get`, `axway_apim_traffic_search`, `axway_apim_trafficevent_*`), list/get of orgs/users/apps/proxies/backend/access/alerts/quotas, `axway_apim_catalog_get`, `axway_apim_proxyauth_get`, `axway_apim_permission_get`.

**operator** (+ observe) — `axway_apim_proxy_update` (incl. `lifecycle=publish|unpublish|deprecate`), `axway_apim_alert_update`, `axway_apim_quota_update`.

**admin** (+ operator) — create/update/delete orgs/users/proxies; import/delete backend; `grant`/`revoke` access; `get_api_keys_*`, `create_api_key`, `get_oauth_*`, `create_oauth_credential`, `upload_file_for_import`.

Literal map in code: [`src/auth/tool-scopes.ts`](../../src/auth/tool-scopes.ts).

stdio (no OIDC): `MCP_TOOL_PROFILE=observe|operator|admin` (default `admin`).

---

## 10. Connect Cursor to the MCP (HTTP)

In `.cursor/mcp.json` or Settings → Tools & MCP:

```json
{
  "mcpServers": {
    "Axway MCP (remote OIDC)": {
      "url": "http://<MCP-HOST-OR-IP>",
      "auth": {
        "CLIENT_ID": "mcp-cursor",
        "scopes": ["openid", "profile"]
      }
    }
  }
}
```

The `mcp-cursor` client has MCP scopes as **default**; the IdP includes only what the user **role** allows. You do not request `mcp:observe` / `mcp:admin` in Cursor.

1. **Connect** / authenticate to the server.  
2. Browser opens Keycloak → realm **`apim-mcp`**.  
3. Log in with the test user (e.g. `mcp-observer` = read-only, `mcp-admin` = full).  
4. Return to Cursor; Axway tools appear filtered by the token profile.  
5. Test: *“list topology”*. As observer, `axway_apim_proxy_update` / `axway_apim_organization_delete` should be denied.

Cursor docs: [cursor.com/docs/mcp](https://cursor.com/docs/mcp).

---

## 11. Verify everything is OK

### 11.1 MCP auth (OIDC)

```bash
# No token → 401
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://<MCP>/ \
  -H 'Content-Type: application/json' -d '{}'

# Metadata
curl -s http://<MCP>/.well-known/oauth-protected-resource
```

### 11.2 Token + tool (smoke)

```bash
TOKEN=$(curl -s -X POST \
  'https://idp.example.com/realms/apim-mcp/protocol/openid-connect/token' \
  -d 'grant_type=password' -d 'client_id=mcp-test-cli' \
  -d 'client_secret=replace-me-client-secret' \
  -d 'username=mcp-observer' -d 'password=replace-me' \
  -d 'scope=openid' | jq -r .access_token)

# initialize
curl -s -D - -X POST "http://<MCP>/" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"0.0.1"}}}'
# save mcp-session-id from the response header

# tools/call list_organizations (reuse session id)
curl -s -X POST "http://<MCP>/" \
  -H "Authorization: Bearer $TOKEN" \
  -H "mcp-session-id: <SESSION>" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_organizations","arguments":{}}}'
```

Expected: Axway topology / organizations in the JSON.

### 11.3 Logs (Kubernetes)

```bash
kubectl -n apim-mcp logs deploy/axway-mcp --tail=100
```

Look for: `[Auth] MCP_AUTH_MODE=oidc`, `tools/call`, absence of Axway API errors.

---

## 12. Quick checklist

- [ ] `npm run build` or Docker image available  
- [ ] `AXWAY_GATEWAY_URL` / `AXWAY_MANAGER_URL` correct (`/api`, `/api/portal/v1.4`)  
- [ ] Axway users+passwords in the **Secret** (K8s) or local env  
- [ ] Axway TLS: `AXWAY_TLS_REJECT_UNAUTHORIZED=false` if self-signed cert  
- [ ] HTTP: `MCP_AUTH_MODE=oidc` + issuer/audience/resource/scopes  
- [ ] OIDC client with PKCE + Cursor redirect URIs  
- [ ] Cursor with `url` + `auth.CLIENT_ID` → Connect → login  
- [ ] Smoke `axway_apim_topology_list` / `axway_apim_organization_list` OK

---

## 13. Troubleshooting

| Problem | Action |
|---------|--------|
| Cursor 401 / won't connect | Token/OIDC: check issuer, audience, redirects; `GET /.well-known/oauth-protected-resource` |
| Keycloak login fails | Realm `apim-mcp`, user `mcp-tester`, correct password |
| Tools fail with Axway error | Secret / URLs; test `curl -u` against the APIs; TLS cert |
| `insufficient_scope` | Missing profile scope (needs ≥ `mcp:observe`) |
| Audience mismatch | JWT `aud` ≠ `OIDC_AUDIENCE` |
| Pod with stale env | `rollout restart` after changing Secret |
| stdio “build not found” | Run `npm run build`; absolute path in `mcp.json` |

---

## 14. Inventory reference (example)

| Item | Example value |
|------|---------------|
| Namespace | `apim-mcp` |
| Service / MCP URL | `http://mcp.example.com` |
| Axway Secret | `axway-mcp-credentials` |
| OIDC issuer | `https://idp.example.com/realms/apim-mcp` |
| OIDC test user | `mcp-tester` / `replace-me` |

Replace all values with your environment. Do not commit real credentials.
