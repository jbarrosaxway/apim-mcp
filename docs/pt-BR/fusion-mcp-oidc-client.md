# Axway Fusion Design — cliente OIDC Keycloak (`mcp-fusion`)

Idiomas: [English](../en/fusion-mcp-oidc-client.md) | [Português (Brasil)](fusion-mcp-oidc-client.md)

Relacionados: [OIDC IdPs](oidc-idps.md) · [Guia fim a fim](guia-fim-a-fim.md)

Este documento descreve o client Keycloak usado pelo formulário OAuth do **proxy MCP do Axway Fusion Design**, e como criá-lo ou mantê-lo no realm `apim-mcp`.

**Nunca grave nem cole o client secret no git, na documentação, em tickets ou em logs de chat.** Copie-o apenas para a UI do Fusion (ou para um cofre de segredos).

---

## 1. Campos do formulário OAuth do Fusion

Issuer (referência): `https://idp.example.com/realms/apim-mcp`  
Audience esperado pelo MCP: `apim-mcp-api`

| Campo no Fusion | Valor |
|-----------------|--------|
| **Authorize URL** | `https://idp.example.com/realms/apim-mcp/protocol/openid-connect/auth` |
| **Token URL** | `https://idp.example.com/realms/apim-mcp/protocol/openid-connect/token` |
| **Client ID** | `mcp-fusion` |
| **Client Secret** | Em Keycloak → Clients → `mcp-fusion` → **Credentials** (client confidential) |
| **Scopes** | `openid profile` |
| **Code Challenge Method** | `S256` (PKCE; não use `plain`) |
| **Redirect URL** (fixo pelo Fusion) | `https://example.sandbox.fusion.services.axway.com/design/oauth2/callback` |

Discovery (verificação opcional):

```text
https://idp.example.com/realms/apim-mcp/.well-known/openid-configuration
```

### Service Root URL

No Fusion, **Service Root URL** é a URL base do endpoint HTTP do Axway APIM MCP (o mesmo conceito de `MCP_RESOURCE_URL`).

| Situação | O que usar |
|----------|------------|
| Browser / Fusion SaaS a chamar um MCP público | Host público **Istio / Ingress / LoadBalancer** em HTTPS (URL alcançável de fora do cluster) |
| Apenas chamadores in-cluster | DNS do cluster, ex. `http://<service>.<namespace>.svc.cluster.local:<port>` — **não** utilizável a partir do Fusion na cloud |

Prefira o host HTTPS público que corresponde à exposição do MCP (Gateway + VirtualService ou LB). Não aponte o Fusion para um DNS só interno, a menos que o Fusion consiga chegar a essa rede.

Os scopes MCP (`mcp:observe` / `operator` / `admin` / `tools`) estão como **default client scopes** em `mcp-fusion`. Peça só `openid profile` no formulário; o Keycloak acrescenta o scope MCP permitido pela role do utilizador.

---

## 2. Redirect URL exacto

O Fusion Design usa este callback **exacto** (tem de estar registado no client):

```text
https://example.sandbox.fusion.services.axway.com/design/oauth2/callback
```

O script de setup também permite `http://127.0.0.1/*` e `http://localhost/*` para testes locais (mesmo padrão dos outros clients MCP). Não remova o URI do Fusion ao atualizar o client.

---

## 3. Criar o client manualmente (Keycloak Admin Console)

1. Abra `https://idp.example.com` → Admin Console → realm **`apim-mcp`**.
2. **Clients** → **Create client**.
3. **General**:
   - Client type: OpenID Connect  
   - Client ID: `mcp-fusion`  
   - Name: `MCP Axway Fusion (PKCE)`  
   - Always display in UI: opcional  
4. **Capability config**:
   - Client authentication: **On** (confidential)  
   - Authorization: Off  
   - Authentication flow: **Standard flow** On; Direct access grants Off; Implicit Off  
5. **Login settings**:
   - Valid redirect URIs: adicione o callback do Fusion acima (e wildcards localhost se quiser)  
   - Web origins: `+` (ou a origem do Fusion)  
6. **Advanced** (ou settings do client): método PKCE **S256**.
7. **Client scopes** → Default:
   - Mantenha `openid` / `profile` (e built-ins necessários)  
   - Anexe os mesmos scopes MCP do `mcp-cursor`: `mcp:observe`, `mcp:operator`, `mcp:admin`, `mcp:tools` (já trazem o audience mapper para `apim-mcp-api`).
8. **Credentials**: copie o **Client secret** gerado só para o Fusion (não guarde no repositório).

---

## 4. Provisionar / atualizar via script

O provisionamento idempotente está em [`scripts/setup-keycloak-apim-mcp.ps1`](../../scripts/setup-keycloak-apim-mcp.ps1) (`Ensure-Client` para `mcp-fusion`, com comentário sobre o redirect do Fusion).

```powershell
$env:KC_ADMIN_PASSWORD = '<senha-admin>'   # não fazer commit

powershell -File scripts/setup-keycloak-apim-mcp.ps1 `
  -KeycloakUrl 'https://idp.example.com' `
  -AdminUser $env:KC_ADMIN_USER `   # ex.: admin ou o username admin do Keycloak
  -AdminPassword $env:KC_ADMIN_PASSWORD
```


Reexecutar o script atualiza redirect URIs / PKCE / default MCP scopes sem gravar o secret em ficheiro. Após criar ou rodar, leia o secret na Admin Console (ou Admin API `.../clients/{id}/client-secret`) e cole no Fusion.

---

## 5. Rodar ou obter o client secret

1. Keycloak Admin → realm **`apim-mcp`** → **Clients** → **`mcp-fusion`**.
2. Separador **Credentials**.
3. Copie o secret atual, ou use **Regenerate** para rodar.
4. Atualize de imediato o formulário OAuth do Fusion com o novo secret.
5. Não cole o secret em documentação, git ou canais partilhados.

---

## 6. Pré-requisitos (utilizadores e roles)

Utilizadores que autenticam via Fusion precisam de uma realm role que desbloqueie um scope MCP default:

| Realm role | Scope MCP efectivo (típico) |
|------------|-----------------------------|
| `mcp-observe` | `mcp:observe` (só leitura) |
| `mcp-operator` | `mcp:operator` |
| `mcp-admin` | `mcp:admin` |
| `mcp-tools` | `mcp:tools` (legado = admin) |

Sem uma destas roles, o access token pode não trazer scope MCP e o resource server rejeita as tools. Ver [oidc-idps.md](oidc-idps.md) para a hierarquia e [guia-fim-a-fim.md](guia-fim-a-fim.md) para o setup completo do lab Keycloak.
