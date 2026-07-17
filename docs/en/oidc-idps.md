# Integrate other Identity Providers (OIDC)

Languages: [English](oidc-idps.md) | [Português (Brasil)](../pt-BR/oidc-idps.md)

For the full operational end-to-end guide (install + Axway Secret + OIDC + Cursor): [end-to-end-guide.md](end-to-end-guide.md).

In HTTP mode with `MCP_AUTH_MODE=oidc`, Axway APIM MCP acts only as an **OAuth 2.1 Resource Server**. It does not perform browser login and does not issue tokens — that is the responsibility of the **MCP client** (e.g. Cursor) and your **Authorization Server / IdP**.

Any IdP compatible with **OpenID Connect** (discovery + JWKS + JWT access tokens) can be used: Keycloak, Microsoft Entra ID, Okta, Auth0, Ping, Cognito (with JWT), etc.

---

## 1. What the MCP needs from the IdP

| Requirement | Detail |
|-------------|--------|
| Stable issuer | URL that appears in the access token `iss` claim |
| JWKS | Public key endpoint (`jwks_uri` in discovery) |
| JWT access token | The MCP validates the Bearer with `jose` (does not use introspection) |
| Audience (`aud`) | Claim matching `OIDC_AUDIENCE` (or `MCP_RESOURCE_URL`) |
| Scopes | `scope` / `scp` claim; default entry gate `mcp:observe` (hierarchical: operator/admin/tools also satisfy); **per-tool** authorization via profile |

Typical discovery:

```text
{OIDC_ISSUER}/.well-known/openid-configuration
```

The MCP resolves `jwks_uri` from there automatically, unless you set `OIDC_JWKS_URI`.

---

## 2. Environment variables on the MCP

```bash
MCP_AUTH_MODE=oidc
OIDC_ISSUER=https://<your-idp>/...          # no trailing slash
OIDC_AUDIENCE=<api-resource-audience>       # must match JWT aud
MCP_RESOURCE_URL=https://<public-mcp-url>   # canonical URI (RFC 9728)
MCP_REQUIRED_SCOPES=mcp:observe             # minimum gate (default if omitted in oidc)
# Profiles: mcp:observe | mcp:operator | mcp:admin (legacy mcp:tools = admin)
# OIDC_JWKS_URI=...                         # only if discovery is not enough
```

### Profiles and tools

| OIDC scope | Tools (summary) |
|------------|-----------------|
| `mcp:observe` | 25 — read (topology, traffic/logs, list/get; **no** API keys/OAuth secrets) |
| `mcp:operator` | 30 — observe + publish/unpublish/deprecate + update quotas/alerts |
| `mcp:admin` / `mcp:tools` | 49 — everything (CRUD, import, credentials) |

Literal map: [`src/auth/tool-scopes.ts`](../../src/auth/tool-scopes.ts).

Quick checklist after configuration:

1. `GET {OIDC_ISSUER}/.well-known/openid-configuration` → 200  
2. `GET {MCP}/.well-known/oauth-protected-resource` → `authorization_servers` = your issuer  
3. MCP request without `Authorization` → `401` + `WWW-Authenticate`  
4. Request with valid JWT (`aud` + correct scopes) → no longer `401`

---

## 3. Objects to create in the IdP (pattern)

Regardless of vendor, create conceptually:

1. **API / Resource / Audience** — represents the MCP (e.g. `apim-mcp-api` or the public URL).  
   Value → `OIDC_AUDIENCE`.
2. **Scopes** — `mcp:observe`, `mcp:operator`, `mcp:admin` (and optionally legacy `mcp:tools`).  
   MCP gate: `MCP_REQUIRED_SCOPES=mcp:observe` (or higher via hierarchy).
3. **Public client (PKCE)** — for **any** MCP client with a browser (Cursor, Kiro, Claude Code, Codex, etc.).  
   - Grant: Authorization Code + PKCE (`S256`)  
   - No client secret (or secret only if the client is confidential)  
   - The `client_id` in the IdP (e.g. `mcp-cursor`) is just a name; the same public client can serve multiple agents.
4. **Redirect URIs** — the exact value is **chosen by the MCP client** at authorization (`redirect_uri`), not by the Axway MCP server. Register in the IdP the patterns your clients use (see table below). In Keycloak, loopback wildcards cover most CLIs/IDEs:

   | Client | What to register (examples) | Notes |
   |--------|------------------------------|-------|
   | **Generic loopback** (recommended in lab) | `http://127.0.0.1/*`, `http://localhost/*` | Covers ephemeral ports of many clients |
   | **Cursor** | `cursor://anysphere.cursor-mcp/oauth/callback`, `https://www.cursor.com/agents/mcp/oauth/callback`, and/or `http://127.0.0.1:8787/callback` | Custom scheme + web/agents callback |
   | **Kiro** (IDE/CLI) | e.g. `http://127.0.0.1:8080/` or `http://localhost:7778/oauth/callback` | In config: `oauth.redirectUri` (host:port or full URL); if omitted, port is random — use loopback wildcard in the IdP |
   | **Claude Code** | `http://localhost:*/callback`, `http://127.0.0.1:*/callback` (or wildcard `http://localhost/*`) | RFC 8252 loopback; path `/callback`; ephemeral port (fixable with `--callback-port` / `oauth.callbackPort`) |
   | **Codex** (OpenAI) | Loopback like `http://127.0.0.1:<port>/callback/<id>` | Ephemeral port (or `mcp_oauth_callback_port`); Codex may append a callback id to the path — register the derived full URI or use loopback wildcard |

   Always confirm the real `redirect_uri` on the IdP consent screen or in client logs before finalizing the IdP list.
5. **Users / groups** — who may request each scope (observer vs operator vs admin).

Optional for automated tests: confidential client with *direct access* / *client credentials* **lab only**.

---

## 4. Cursor configuration (`mcp.json`)

```json
{
  "mcpServers": {
    "Axway MCP (OIDC)": {
      "url": "https://<public-mcp-url>",
      "auth": {
        "CLIENT_ID": "<public-client-id-from-idp>",
        "scopes": ["openid", "profile"]
      }
    }
  }
}
```

In Keycloak, MCP scopes are **default client scopes** + role mapping: the user authenticates without requesting `mcp:*`; the token receives the scope from the role (`mcp-observe` → `mcp:observe`, etc.).

- `url` = same base used in `MCP_RESOURCE_URL` (or the LoadBalancer/Ingress).  
- If the IdP requires a static confidential client, you may add `CLIENT_SECRET` to the `auth` block (prefer OS environment variables; do not commit).  
- In **Tools & MCP** → **Connect** → log in to the IdP in the browser.

Cursor docs: [Model Context Protocol (MCP)](https://cursor.com/docs/mcp).

---

## 5. Recipes by IdP

### 5.1 Keycloak

Issuer:

```text
https://<host>/realms/<realm>
```

| Keycloak object | Suggestion |
|-----------------|------------|
| Realm | `apim-mcp` |
| Client scopes | `mcp:observe` / `operator` / `admin` / `tools` as **default** on `mcp-cursor` + role mapping + Audience → `apim-mcp-api` |
| Client audience | `apim-mcp-api` (`OIDC_AUDIENCE`) |
| Public client | `mcp-cursor` (example name; PKCE shareable across MCP agents) |
| Lab script | `scripts/setup-keycloak-apim-mcp.ps1` |

**Lab test users:**

| Username | Keycloak role | Token scope (automatic) | Profile |
|----------|---------------|-------------------------|---------|
| `mcp-observer` | `mcp-observe` | `mcp:observe` | read |
| `mcp-operator` | `mcp-operator` | `mcp:operator` | publish + quotas |
| `mcp-admin` | `mcp-admin` | `mcp:admin` | admin |
| `mcp-tester` | `mcp-tools` | `mcp:tools` | legacy = admin |

Example password: `replace-me`. Smoke client: `mcp-test-cli` / secret `replace-me-client-secret`.

Replace with your real IdP values (never commit passwords).

Envs:

```bash
OIDC_ISSUER=https://idp.example.com/realms/apim-mcp
OIDC_AUDIENCE=apim-mcp-api
MCP_REQUIRED_SCOPES=mcp:observe
```

Example Keycloak runbook: see [README](../../README.md) and [end-to-end-guide.md](end-to-end-guide.md).

---

### 5.2 Microsoft Entra ID (Azure AD)

1. **App registration** for the API (the MCP):
   - Expose an Application ID URI (e.g. `api://apim-mcp` or the MCP URL).
   - Create scopes/App roles `mcp:observe` (and optionally `mcp:operator`, `mcp:admin`).
2. **App registration** (or the same app) for the public MCP agent client (Cursor, Kiro, Claude Code, Codex, …):
   - Platform: Mobile and desktop / SPA per the client's PKCE flow.
   - Redirect URIs: list from section 3 (loopback + specific schemes).
   - API permissions: the desired profile scope (e.g. `mcp:observe`).
3. Tokens: ensure access token version 2.0 and that `aud` is the Application ID URI (or the API App ID).

Issuer (tenant):

```text
https://login.microsoftonline.com/<tenant-id>/v2.0
```

```bash
OIDC_ISSUER=https://login.microsoftonline.com/<tenant-id>/v2.0
OIDC_AUDIENCE=api://apim-mcp          # or the exact Application ID URI in the JWT
MCP_REQUIRED_SCOPES=mcp:observe         # if the claim is api://apim-mcp/mcp:observe, use the exact JWT value
```

**Note:** in Entra the scope in the token is often `api://<app-id-uri>/mcp:observe`. Set `MCP_REQUIRED_SCOPES` to the **exact** value in the JWT (not only the short name). MCP hierarchy only recognizes the short names `mcp:observe|operator|admin|tools` — if Entra prefixes the URI, map it in the IdP or align the claim.

Validate claims in a test JWT (jwt.ms or `jq` on the payload).

---

### 5.3 Okta

1. **Authorization Server** (Custom AS recommended) with audience = `OIDC_AUDIENCE`.  
2. **Scopes** `mcp:observe` (and optionally operator/admin).  
3. **Application** OIDC → Native / SPA (PKCE), Authorization Code grant.  
4. Redirect URIs for MCP clients (loopback + specific schemes — section 3).

Issuer:

```text
https://<org>.okta.com/oauth2/<authServerId>
# or
https://<org>.okta.com/oauth2/default
```

```bash
OIDC_ISSUER=https://dev-xxxxx.okta.com/oauth2/default
OIDC_AUDIENCE=apim-mcp-api
MCP_REQUIRED_SCOPES=mcp:observe
```

In Okta, confirm the access token is JWT (not opaque) and that the Authorization Server **Audience** matches `OIDC_AUDIENCE`.

---

### 5.4 Auth0

1. **API** in Auth0 with Identifier = audience (e.g. `https://mcp.example.com` or `apim-mcp-api`).  
2. Under API **Permissions**, add `mcp:observe` (and optionally operator/admin).  
3. **Application** → Native or SPA, Authorization Code + PKCE grant.  
4. Authorize the Application on the API; enable “Allow Skipping User Consent” only if it makes sense in lab.

Issuer:

```text
https://<tenant>.auth0.com/
# (trailing slash may be part of iss — copy the exact value from /.well-known/openid-configuration)
```

```bash
OIDC_ISSUER=https://<tenant>.auth0.com/
OIDC_AUDIENCE=apim-mcp-api
MCP_REQUIRED_SCOPES=mcp:observe
```

Auth0 puts the API audience in `aud`. Enable RBAC / “Add Permissions in the Access Token” for the `permissions` claim — **note:** the MCP reads `scope` / `scp`, not `permissions`. Ensure `mcp:observe` (or operator/admin) appears in `scope` (Auth0 typically includes requested permissions in the access token `scope` when requested at authorize).

---

### 5.5 Others (generic)

1. Discover the issuer: open `/.well-known/openid-configuration`.  
2. Configure a resource/API with a fixed audience.  
3. Issue JWT with `iss`, `aud`, `exp`, `scope` (or `scp`).  
4. Authorization Code + PKCE client with Cursor redirect URIs.  
5. Copy the envs to the MCP Deployment/Helm.  
6. Test the flow in section 2.

If the IdP only issues opaque tokens, this MCP **does not** work without changes (token introspection would be required).

---

## 6. Helm / Kubernetes

Example env overlay (no IdP secrets in the chart — the IdP authenticates the **client**, not the MCP pod):

```yaml
env:
  MCP_AUTH_MODE: "oidc"
  OIDC_ISSUER: "https://login.microsoftonline.com/<tenant-id>/v2.0"
  OIDC_AUDIENCE: "api://apim-mcp"
  MCP_RESOURCE_URL: "https://mcp.your-domain"
  MCP_REQUIRED_SCOPES: "mcp:observe"
```

Restart the Deployment after changing issuer/audience (config is read at startup).

---

## 7. Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| `401` with token | `iss` differs from `OIDC_ISSUER` (trailing slash, wrong tenant) |
| `401` audience mismatch | JWT `aud` ≠ `OIDC_AUDIENCE` / `MCP_RESOURCE_URL` |
| `403 insufficient_scope` | Missing scope or different name (e.g. Entra with full URI) |
| PRM points to old issuer | Pod not restarted after `helm upgrade` |
| MCP client won't open login / `redirect_uri` mismatch | Register in the IdP the URI the **client** sends (Cursor / Kiro / Claude Code / Codex); in lab prefer `http://127.0.0.1/*` and `http://localhost/*` |
| Cursor connects but tools fail on Axway | OIDC OK; missing `AXWAY_*` credentials on the MCP |

Decode the access token (payload) and compare `iss`, `aud`, `scope`/`scp`, `exp` with the envs.

Lab: if you need to skip audience checks **temporarily** (never in production), `OIDC_SKIP_AUDIENCE_CHECK=true` exists in the code — use for diagnosis only.

---

## 8. Security

- Prefer HTTPS for `MCP_RESOURCE_URL` and the IdP.  
- Do not commit client secrets; in Cursor use env vars when possible.  
- Rotate lab users (`mcp-tester`) and shared IdP admin passwords from chat.  
- Limit who receives MCP scopes via IdP **roles** (`mcp-observe` / `mcp-operator` / `mcp-admin`); the client only requests `openid` / `profile`.  
- `MCP_AUTH_MODE=none` only on trusted networks / local development.
