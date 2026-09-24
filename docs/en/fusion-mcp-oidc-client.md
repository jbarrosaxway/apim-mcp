# Axway Fusion Design — Keycloak OIDC client (`mcp-fusion`)

Languages: [English](fusion-mcp-oidc-client.md) | [Português (Brasil)](../pt-BR/fusion-mcp-oidc-client.md)

Related: [OIDC IdPs](oidc-idps.md) · [End-to-end guide](end-to-end-guide.md)

This document describes the Keycloak client used by the **Axway Fusion Design** MCP proxy OAuth form, and how to create or maintain it in realm `apim-mcp`.

**Never commit or paste the client secret into git, docs, tickets, or chat logs.** Copy it only into the Fusion UI (or a secrets store).

---

## 1. Fusion OAuth form fields

Issuer (for reference): `https://idp.example.com/realms/apim-mcp`  
Audience expected by the MCP: `apim-mcp-api`

| Fusion field | Value |
|--------------|--------|
| **Authorize URL** | `https://idp.example.com/realms/apim-mcp/protocol/openid-connect/auth` |
| **Token URL** | `https://idp.example.com/realms/apim-mcp/protocol/openid-connect/token` |
| **Client ID** | `mcp-fusion` |
| **Client Secret** | From Keycloak → Clients → `mcp-fusion` → **Credentials** (confidential client) |
| **Scopes** | `openid profile` |
| **Code Challenge Method** | `S256` (PKCE; do not use `plain`) |
| **Redirect URL** (Fusion fixed) | `https://example.sandbox.fusion.services.axway.com/design/oauth2/callback` |

Discovery (optional check):

```text
https://idp.example.com/realms/apim-mcp/.well-known/openid-configuration
```

### Service Root URL

In Fusion, **Service Root URL** is the base URL of your Axway APIM MCP HTTP endpoint (the same idea as `MCP_RESOURCE_URL`).

| Situation | What to use |
|-----------|-------------|
| Browser / Fusion SaaS calling a public MCP | Public **Istio / Ingress / LoadBalancer** HTTPS host (the URL users reach from outside the cluster) |
| Only in-cluster callers | Cluster DNS such as `http://<service>.<namespace>.svc.cluster.local:<port>` — **not** usable from Fusion cloud |

Prefer the public HTTPS host that matches how the MCP is exposed (Gateway + VirtualService or LB). Do not point Fusion at an internal-only DNS unless Fusion can reach that network.

MCP scopes (`mcp:observe` / `operator` / `admin` / `tools`) are attached as **default client scopes** on `mcp-fusion`. Request only `openid profile` in the form; Keycloak adds the MCP scope allowed by the user’s realm role.

---

## 2. Exact Redirect URL

Fusion Design uses this **exact** callback (must be registered on the client):

```text
https://example.sandbox.fusion.services.axway.com/design/oauth2/callback
```

The setup script also allows `http://127.0.0.1/*` and `http://localhost/*` for local tests (same pattern as other MCP clients). Do not remove the Fusion URI when updating the client.

---

## 3. Create the client manually (Keycloak Admin Console)

1. Open `https://idp.example.com` → Admin Console → realm **`apim-mcp`**.
2. **Clients** → **Create client**.
3. **General**:
   - Client type: OpenID Connect  
   - Client ID: `mcp-fusion`  
   - Name: `MCP Axway Fusion (PKCE)`  
   - Always display in UI: optional  
4. **Capability config**:
   - Client authentication: **On** (confidential)  
   - Authorization: Off  
   - Authentication flow: **Standard flow** On; Direct access grants Off; Implicit Off  
5. **Login settings**:
   - Valid redirect URIs: add the Fusion callback above (plus localhost wildcards if desired)  
   - Web origins: `+` (or your Fusion origin)  
6. **Advanced** (or client settings): PKCE code challenge method **S256**.
7. **Client scopes** → Default:
   - Keep `openid` / `profile` (and other built-ins as needed)  
   - Attach the same MCP scopes as `mcp-cursor`: `mcp:observe`, `mcp:operator`, `mcp:admin`, `mcp:tools` (these already carry the audience mapper to `apim-mcp-api`).
8. **Credentials**: copy the generated **Client secret** into Fusion only (do not store in the repo).

---

## 4. Provision / update via script

Idempotent provisioning lives in [`scripts/setup-keycloak-apim-mcp.ps1`](../../scripts/setup-keycloak-apim-mcp.ps1) (`Ensure-Client` for `mcp-fusion`, including the Fusion redirect comment).

```powershell
$env:KC_ADMIN_PASSWORD = '<admin-password>'   # do not commit

powershell -File scripts/setup-keycloak-apim-mcp.ps1 `
  -KeycloakUrl 'https://idp.example.com' `
  -AdminUser $env:KC_ADMIN_USER `   # e.g. admin or your Keycloak admin username
  -AdminPassword $env:KC_ADMIN_PASSWORD
```


Re-running the script updates redirect URIs / PKCE / default MCP scopes without writing the secret into any file. After create or rotate, read the secret from the Admin Console (or Admin API `.../clients/{id}/client-secret`) and paste it into Fusion.

---

## 5. Rotate or retrieve the client secret

1. Keycloak Admin → realm **`apim-mcp`** → **Clients** → **`mcp-fusion`**.
2. Tab **Credentials**.
3. Copy the current secret, or use **Regenerate** to rotate.
4. Update the Fusion OAuth form with the new secret immediately.
5. Do not paste the secret into documentation, git, or shared channels.

---

## 6. Prerequisites (users and roles)

Users who authenticate through Fusion must have a realm role that unlocks an MCP default scope:

| Realm role | Effective MCP scope (typical) |
|------------|-------------------------------|
| `mcp-observe` | `mcp:observe` (read-only) |
| `mcp-operator` | `mcp:operator` |
| `mcp-admin` | `mcp:admin` |
| `mcp-tools` | `mcp:tools` (legacy = admin) |

Without one of these roles, the access token may lack an MCP scope and the resource server will reject tool calls. See [oidc-idps.md](oidc-idps.md) for the hierarchy and [end-to-end-guide.md](end-to-end-guide.md) for the full Keycloak lab setup.
