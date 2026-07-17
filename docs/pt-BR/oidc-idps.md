# Integrar outros Identity Providers (OIDC)

Languages: [English](../en/oidc-idps.md) | [Português (Brasil)](oidc-idps.md)

Para detalhe operacional fim a fim (instalar + Axway Secret + OIDC + Cursor): [guia-fim-a-fim.md](guia-fim-a-fim.md).

O Axway APIM MCP, em modo HTTP com `MCP_AUTH_MODE=oidc`, atua apenas como **OAuth 2.1 Resource Server**. Não faz login no browser e não emite tokens — isso fica a cargo do **cliente MCP** (ex.: Cursor) e do seu **Authorization Server / IdP**.

Qualquer IdP compatível com **OpenID Connect** (discovery + JWKS + access tokens JWT) pode ser usado: Keycloak, Microsoft Entra ID, Okta, Auth0, Ping, Cognito (com JWT), etc.

---

## 1. O que o MCP precisa do IdP

| Requisito | Detalhe |
|-----------|---------|
| Issuer estável | URL que aparece no claim `iss` do access token |
| JWKS | Endpoint de chaves públicas (`jwks_uri` no discovery) |
| Access token JWT | O MCP valida o Bearer com `jose` (não usa introspection) |
| Audience (`aud`) | Claim que corresponde a `OIDC_AUDIENCE` (ou `MCP_RESOURCE_URL`) |
| Scopes | Claim `scope` / `scp`; gate de entrada default `mcp:observe` (hierárquico: operator/admin/tools também satisfazem); autorização **por tool** via perfil |

Discovery típico:

```text
{OIDC_ISSUER}/.well-known/openid-configuration
```

O MCP resolve sozinho o `jwks_uri` a partir daí, salvo se você definir `OIDC_JWKS_URI`.

---

## 2. Variáveis de ambiente no MCP

```bash
MCP_AUTH_MODE=oidc
OIDC_ISSUER=https://<seu-idp>/...          # sem barra final
OIDC_AUDIENCE=<audience-do-api-resource>   # deve bater no aud do JWT
MCP_RESOURCE_URL=https://<url-publica-do-mcp>  # URI canônica (RFC 9728)
MCP_REQUIRED_SCOPES=mcp:observe            # gate mínimo (default se omitido em oidc)
# Perfis: mcp:observe | mcp:operator | mcp:admin (legado mcp:tools = admin)
# OIDC_JWKS_URI=...                        # só se o discovery não bastar
```

### Perfis e tools

| Scope OIDC | Tools (resumo) |
|------------|----------------|
| `mcp:observe` | 25 — leitura (topologia, tráfego/logs, list/get; **sem** API keys/OAuth secrets) |
| `mcp:operator` | 30 — observe + publish/unpublish/deprecate + update cotas/alertas |
| `mcp:admin` / `mcp:tools` | 49 — tudo (CRUD, import, credenciais) |

Mapa literal: [`src/auth/tool-scopes.ts`](../../src/auth/tool-scopes.ts).

Checklist rápido depois de configurar:

1. `GET {OIDC_ISSUER}/.well-known/openid-configuration` → 200  
2. `GET {MCP}/.well-known/oauth-protected-resource` → `authorization_servers` = seu issuer  
3. Pedido MCP sem `Authorization` → `401` + `WWW-Authenticate`  
4. Pedido com JWT válido (`aud` + scopes certos) → deixa de ser `401`

---

## 3. Objetos a criar no IdP (padrão)

Independente do fornecedor, crie conceitualmente:

1. **API / Resource / Audience** — representa o MCP (ex.: `apim-mcp-api` ou a URL pública).  
   Valor → `OIDC_AUDIENCE`.
2. **Scopes** — `mcp:observe`, `mcp:operator`, `mcp:admin` (e opcionalmente legado `mcp:tools`).  
   Gate MCP: `MCP_REQUIRED_SCOPES=mcp:observe` (ou superior via hierarquia).
3. **Client público (PKCE)** — para **qualquer** cliente MCP com browser (Cursor, Kiro, Claude Code, Codex, etc.).  
   - Grant: Authorization Code + PKCE (`S256`)  
   - Sem client secret (ou secret só se o cliente for confidential)  
   - O `client_id` no IdP (ex.: `mcp-cursor`) é só um nome; o mesmo client público pode servir vários agentes.
4. **Redirect URIs** — o valor exato é **escolhido pelo cliente MCP** na autorização (`redirect_uri`), não pelo servidor Axway MCP. Registre no IdP os padrões que seus clientes usam (ver tabela abaixo). Em Keycloak, wildcards de loopback cobrem a maioria dos CLIs/IDEs:

   | Cliente | O que registrar (exemplos) | Notas |
   |---------|---------------------------|--------|
   | **Loopback genérico** (recomendado no lab) | `http://127.0.0.1/*`, `http://localhost/*` | Cobre portas efêmeras de vários clientes |
   | **Cursor** | `cursor://anysphere.cursor-mcp/oauth/callback`, `https://www.cursor.com/agents/mcp/oauth/callback`, e/ou `http://127.0.0.1:8787/callback` | Scheme próprio + callback web/agents |
   | **Kiro** (IDE/CLI) | Ex.: `http://127.0.0.1:8080/` ou `http://localhost:7778/oauth/callback` | Em config: `oauth.redirectUri` (host:porta ou URL completa); se omitir, a porta é aleatória — use wildcard loopback no IdP |
   | **Claude Code** | `http://localhost:*/callback`, `http://127.0.0.1:*/callback` (ou wildcard `http://localhost/*`) | Loopback RFC 8252; path `/callback`; porta efêmera (fixável com `--callback-port` / `oauth.callbackPort`) |
   | **Codex** (OpenAI) | Loopback tipo `http://127.0.0.1:<port>/callback/<id>` | Porta efêmera (ou `mcp_oauth_callback_port`); Codex pode acrescentar um callback id ao path — registre o URI completo derivado ou use wildcard loopback |

   Confirme sempre o `redirect_uri` real na tela de consentimento do IdP ou nos logs do cliente antes de fechar a lista no IdP.
5. **Usuários / grupos** — quem pode pedir cada scope (observer vs operator vs admin).

Opcional para testes automatizados: client confidential com *direct access* / *client credentials* **apenas em lab**.

---

## 4. Configuração no Cursor (`mcp.json`)

```json
{
  "mcpServers": {
    "Axway MCP (OIDC)": {
      "url": "https://<url-publica-do-mcp>",
      "auth": {
        "CLIENT_ID": "<client-id-publico-do-idp>",
        "scopes": ["openid", "profile"]
      }
    }
  }
}
```

No Keycloak, os scopes MCP são **default client scopes** + role mapping: o user autentica sem pedir `mcp:*`; o token recebe o scope da role (`mcp-observe` → `mcp:observe`, etc.).

- `url` = mesma base usada em `MCP_RESOURCE_URL` (ou o LoadBalancer/Ingress).  
- Se o IdP exigir client confidential estático, você pode acrescentar `CLIENT_SECRET` no bloco `auth` (preferir variáveis de ambiente do SO; não faça commit).  
- Em **Tools & MCP** → **Connect** → login no IdP no browser.

Documentação Cursor: [Model Context Protocol (MCP)](https://cursor.com/docs/mcp).

---

## 5. Receitas por IdP

### 5.1 Keycloak

Issuer:

```text
https://<host>/realms/<realm>
```

| Objeto Keycloak | Sugestão |
|------------------|----------|
| Realm | `apim-mcp` |
| Client scopes | `mcp:observe` / `operator` / `admin` / `tools` como **default** no `mcp-cursor` + role mapping + Audience → `apim-mcp-api` |
| Client audience | `apim-mcp-api` (`OIDC_AUDIENCE`) |
| Client público | `mcp-cursor` (nome de exemplo; PKCE compartilhável entre agentes MCP) |
| Script de lab | `scripts/setup-keycloak-apim-mcp.ps1` |

**Users de teste (lab):**

| Username | Role Keycloak | Scope no token (automático) | Perfil |
|----------|---------------|-----------------------------|--------|
| `mcp-observer` | `mcp-observe` | `mcp:observe` | leitura |
| `mcp-operator` | `mcp-operator` | `mcp:operator` | publish + cotas |
| `mcp-admin` | `mcp-admin` | `mcp:admin` | admin |
| `mcp-tester` | `mcp-tools` | `mcp:tools` | legado = admin |

Password exemplo: `replace-me`. Client smoke: `mcp-test-cli` / secret `replace-me-client-secret`.

Substitua pelos valores reais do seu IdP (nunca faça commit de passwords).

Envs:

```bash
OIDC_ISSUER=https://idp.example.com/realms/apim-mcp
OIDC_AUDIENCE=apim-mcp-api
MCP_REQUIRED_SCOPES=mcp:observe
```

Runbook Keycloak de exemplo: ver [README](../../README.pt-BR.md) e [guia-fim-a-fim.md](guia-fim-a-fim.md).

---

### 5.2 Microsoft Entra ID (Azure AD)

1. **App registration** para a API (o MCP):
   - Expoe um Application ID URI (ex.: `api://apim-mcp` ou a URL do MCP).
   - Cria scopes/App roles `mcp:observe` (e opcionalmente `mcp:operator`, `mcp:admin`).
2. **App registration** (ou o mesmo app) para o cliente público dos agentes MCP (Cursor, Kiro, Claude Code, Codex, …):
   - Platform: Mobile and desktop / SPA conforme o fluxo PKCE do cliente.
   - Redirect URIs: lista da seção 3 (loopback + schemes específicos).
   - API permissions: o scope do perfil desejado (ex. `mcp:observe`).
3. Tokens: ensure access token version 2.0 e que `aud` seja o Application ID URI (ou o App ID da API).

Issuer (tenant):

```text
https://login.microsoftonline.com/<tenant-id>/v2.0
```

```bash
OIDC_ISSUER=https://login.microsoftonline.com/<tenant-id>/v2.0
OIDC_AUDIENCE=api://apim-mcp          # ou o Application ID URI exato no JWT
MCP_REQUIRED_SCOPES=mcp:observe         # se o claim for api://apim-mcp/mcp:observe, use o valor exato do JWT
```

**Atenção:** no Entra o scope no token costuma ser `api://<app-id-uri>/mcp:observe`. Defina `MCP_REQUIRED_SCOPES` com o valor **exato** que vem no JWT (não só o nome curto). Hierarquia MCP só reconhece os nomes curtos `mcp:observe|operator|admin|tools` — se o Entra prefixar a URI, mapeie no IdP ou alinhe o claim.

Validar claims num JWT de teste (jwt.ms ou `jq` no payload).

---

### 5.3 Okta

1. **Authorization Server** (Custom AS recomendado) com audience = `OIDC_AUDIENCE`.  
2. **Scopes** `mcp:observe` (e opcionalmente operator/admin).  
3. **Application** OIDC → Native / SPA (PKCE), grant Authorization Code.  
4. Redirect URIs dos clientes MCP (loopback + schemes específicos — seção 3).

Issuer:

```text
https://<org>.okta.com/oauth2/<authServerId>
# ou
https://<org>.okta.com/oauth2/default
```

```bash
OIDC_ISSUER=https://dev-xxxxx.okta.com/oauth2/default
OIDC_AUDIENCE=apim-mcp-api
MCP_REQUIRED_SCOPES=mcp:observe
```

No Okta, confirme que o access token é JWT (não opaco) e que o **Audience** do Authorization Server coincide com `OIDC_AUDIENCE`.

---

### 5.4 Auth0

1. **API** em Auth0 com Identifier = audience (ex.: `https://mcp.example.com` ou `apim-mcp-api`).  
2. Em **Permissions** da API, adicione `mcp:observe` (e opcionalmente operator/admin).  
3. **Application** → Native ou SPA, grant Authorization Code + PKCE.  
4. Authorize a Application na API; Active Toggle “Allow Skipping User Consent” só se fizer sentido em lab.

Issuer:

```text
https://<tenant>.auth0.com/
# (trailing slash pode fazer parte do iss — copie o valor exato de /.well-known/openid-configuration)
```

```bash
OIDC_ISSUER=https://<tenant>.auth0.com/
OIDC_AUDIENCE=apim-mcp-api
MCP_REQUIRED_SCOPES=mcp:observe
```

Auth0 coloca o audience da API em `aud`. Ative RBAC / “Add Permissions in the Access Token” para o claim `permissions` — **nota:** o MCP lê `scope` / `scp`, não `permissions`. Garanta que `mcp:observe` (ou operator/admin) vem em `scope` (Auth0 costuma incluir permissions pedidas no `scope` do access token quando pedidas no authorize).

---

### 5.5 Outros (genérico)

1. Descubra o issuer: abra `/.well-known/openid-configuration`.  
2. Configure um resource/API com audience fixo.  
3. Emita JWT com `iss`, `aud`, `exp`, `scope` (ou `scp`).  
4. Client Authorization Code + PKCE com redirect URIs do Cursor.  
5. Copie os envs para o Deployment/Helm do MCP.  
6. Teste o fluxo da seção 2.

Se o IdP só emitir tokens opacos, este MCP **não** serve sem alteração (seria preciso token introspection).

---

## 6. Helm / Kubernetes

Exemplo de overlay de envs (sem secrets do IdP no chart — o IdP autentica o **cliente**, não o pod do MCP):

```yaml
env:
  MCP_AUTH_MODE: "oidc"
  OIDC_ISSUER: "https://login.microsoftonline.com/<tenant-id>/v2.0"
  OIDC_AUDIENCE: "api://apim-mcp"
  MCP_RESOURCE_URL: "https://mcp.seu-dominio"
  MCP_REQUIRED_SCOPES: "mcp:observe"
```

Reinicie o Deployment após mudar issuer/audience (a config é lida no arranque).

---

## 7. Troubleshooting

| Sintoma | Causa provável |
|---------|----------------|
| `401` com token | `iss` diferente de `OIDC_ISSUER` (barra final, tenant errado) |
| `401` audience mismatch | `aud` do JWT ≠ `OIDC_AUDIENCE` / `MCP_RESOURCE_URL` |
| `403 insufficient_scope` | Scope em falta ou nome diferente (ex. Entra com URI completa) |
| PRM aponta issuer antigo | Pod não reiniciado após `helm upgrade` |
| Cliente MCP não abre login / `redirect_uri` mismatch | Registre no IdP o URI que o **cliente** envia (Cursor / Kiro / Claude Code / Codex); em lab preferir `http://127.0.0.1/*` e `http://localhost/*` |
| Cursor conecta mas tools falham no Axway | OIDC OK; faltam credenciais `AXWAY_*` no MCP |

Decodifique o access token (payload) e compare `iss`, `aud`, `scope`/`scp`, `exp` com as envs.

Lab: se precisar pular a checagem de audience **temporariamente** (nunca em produção), existe `OIDC_SKIP_AUDIENCE_CHECK=true` no código — use só para diagnóstico.

---

## 8. Segurança

- Preferir HTTPS no `MCP_RESOURCE_URL` e no IdP.  
- Não faça commit de client secrets; no Cursor use env vars quando possível.  
- Rotacione users de lab (`mcp-tester`) e senhas de admin do IdP compartilhadas em chat.  
- Limite quem recebe scopes MCP via **roles** no IdP (`mcp-observe` / `mcp-operator` / `mcp-admin`); o cliente só pede `openid` / `profile`.  
- `MCP_AUTH_MODE=none` só em redes de confiança / desenvolvimento local.
