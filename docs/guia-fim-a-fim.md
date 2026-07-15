# Guia fim a fim — Instalar, configurar e autenticar o Axway APIM MCP

Documento único para pôr o MCP a funcionar com **Axway (Gateway/ANM + API Manager)** e **OIDC (Keycloak ou outro IdP)**, incluindo uso no **Cursor**.

Para detalhe de outros IdPs (Entra, Okta, Auth0): [oidc-idps.md](oidc-idps.md).  
Para visão conceptual do projeto: [README.md](../README.md).

---

## 1. Visão geral (duas autenticações)

Existem **dois planos** distintos:

```text
  Utilizador (Cursor)
        │  OIDC / Bearer JWT          ← quem pode falar com o MCP
        ▼
  Axway APIM MCP (HTTP ou stdio)
        │  Basic Auth AXWAY_*         ← MCP fala com o Axway
        ▼
  Gateway (ANM)  +  API Manager
```

| Plano | O quê | Onde configurar |
|-------|--------|-----------------|
| **A — Cliente → MCP** | Quem usa as tools (Cursor) | OIDC / Keycloak; no Cursor: `url` + `auth` |
| **B — MCP → Axway** | Credenciais técnicas do Gateway e Manager | Secret K8s ou `env` no stdio/Docker |

- **HTTP remoto:** use OIDC (`MCP_AUTH_MODE=oidc`).  
- **stdio local:** sem OIDC (processo local); só precisa das vars `AXWAY_*`.

---

## 2. Pré-requisitos

- Node.js 20+ (instalação local / build) **ou** Docker **ou** cluster Kubernetes + Helm  
- Acesso HTTPS ao **Admin Node Manager / Gateway** e ao **API Manager**  
- (HTTP) IdP OIDC com Authorization Code + PKCE (lab: Keycloak)  
- Cliente MCP com suporte a OAuth remoto (Cursor)

URLs típicas das APIs (ajuste ao teu ambiente):

| Sistema | Base URL (exemplo) |
|---------|---------------------|
| Gateway / ANM | `https://anm.<host>/api` |
| API Manager | `https://apimgr.<host>/api/portal/v1.4` |

---

## 3. Build da aplicação

```bash
git clone <repo> && cd apim-mcp
npm ci
npm run build    # gera build/
```

Imagem Docker:

```bash
docker build -t axwayjbarros/apim-mcp:1.0.15 .
```

---

## 4. Escolher o modo de execução

| Modo | Quando usar | Auth cliente |
|------|-------------|--------------|
| **A. stdio (local)** | Desenvolvimento no laptop | Nenhuma (OS) |
| **B. Docker HTTP** | Lab / VM única | OIDC recomendado |
| **C. Kubernetes + Helm** | Cluster (produção/lab AKS) | OIDC recomendado |

---

## 5. Configurar o Axway (plano B)

### 5.1 Variáveis

| Variável | Descrição |
|----------|-----------|
| `AXWAY_GATEWAY_URL` | Base da API do Gateway (`…/api`) |
| `AXWAY_GATEWAY_USERNAME` / `PASSWORD` | User técnico ANM/Gateway |
| `AXWAY_MANAGER_URL` | Base do Portal (`…/api/portal/v1.4`) |
| `AXWAY_MANAGER_USERNAME` / `PASSWORD` | User técnico API Manager |
| `AXWAY_TLS_REJECT_UNAUTHORIZED` | `false` = aceita cert autoassinado (default); `true` em prod com CA |
| `AXWAY_TLS_INSECURE` | Atalho: `true` ⇒ TLS verify off |

### 5.2 Validar as APIs à mão (opcional)

```bash
curl -sk -u 'admin:SENHA' https://anm.exemplo/api/topology
curl -sk -u 'user:SENHA' https://apimgr.exemplo/api/portal/v1.4/organizations
```

Esperado: HTTP **200**.

---

## 6. Instalação A — Local (stdio) + Cursor

1. Build (`npm run build`).  
2. Editar [`.cursor/mcp.json`](../.cursor/mcp.json) (ou `~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "Axway MCP - stdio - local": {
      "command": "node",
      "args": ["C:/Users/SEU_USER/apim-mcp/build/index.js"],
      "env": {
        "TRANSPORT_MODE": "stdio",
        "AXWAY_TLS_REJECT_UNAUTHORIZED": "false",
        "AXWAY_GATEWAY_URL": "https://anm.exemplo/api",
        "AXWAY_GATEWAY_USERNAME": "admin",
        "AXWAY_GATEWAY_PASSWORD": "***",
        "AXWAY_MANAGER_URL": "https://apimgr.exemplo/api/portal/v1.4",
        "AXWAY_MANAGER_USERNAME": "apiadmin",
        "AXWAY_MANAGER_PASSWORD": "***"
      }
    }
  }
}
```

3. Cursor → **Settings → Tools & MCP** → activar o servidor / reiniciar.  
4. Pedir no chat: *“lista a topologia do gateway”* / *“lista as organizações”*.

Não há login OIDC neste modo.

---

## 7. Instalação B — Docker (HTTP + OIDC)

```bash
docker run -d --name axway-mcp -p 8080:3000 \
  -e TRANSPORT_MODE=http \
  -e MCP_AUTH_MODE=oidc \
  -e OIDC_ISSUER=https://idp.exemplo/realms/apim-mcp \
  -e OIDC_AUDIENCE=apim-mcp-api \
  -e MCP_RESOURCE_URL=http://localhost:8080 \
  -e MCP_REQUIRED_SCOPES=mcp:tools \
  -e AXWAY_TLS_REJECT_UNAUTHORIZED=false \
  -e AXWAY_GATEWAY_URL=https://anm.exemplo/api \
  -e AXWAY_GATEWAY_USERNAME=admin \
  -e AXWAY_GATEWAY_PASSWORD=*** \
  -e AXWAY_MANAGER_URL=https://apimgr.exemplo/api/portal/v1.4 \
  -e AXWAY_MANAGER_USERNAME=apiadmin \
  -e AXWAY_MANAGER_PASSWORD=*** \
  -e TZ=America/Sao_Paulo \
  axwayjbarros/apim-mcp:1.0.15
```

Preferível: `--env-file .env` (ficheiros `.env` no `.gitignore`).

Continuar na [secção 9 (OIDC)](#9-configurar-oidc-plano-a) e [secção 10 (Cursor HTTP)](#10-ligar-o-cursor-ao-mcp-http).

---

## 8. Instalação C — Kubernetes + Helm (recomendado)

### 8.1 Namespace e Secret Axway (obrigatório)

Users e senhas **não** vão no `values.yaml` — só num Secret:

```bash
kubectl create namespace apim-mcp

kubectl -n apim-mcp create secret generic axway-mcp-credentials \
  --from-literal=AXWAY_GATEWAY_USERNAME='admin' \
  --from-literal=AXWAY_GATEWAY_PASSWORD='***' \
  --from-literal=AXWAY_MANAGER_USERNAME='apiadmin' \
  --from-literal=AXWAY_MANAGER_PASSWORD='***'
```

Exemplo YAML: [`helm/axway-mcp/secret.example.yaml`](../helm/axway-mcp/secret.example.yaml).

Actualizar credenciais depois:

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
  --set-string env.AXWAY_GATEWAY_URL='https://anm.exemplo/api' \
  --set-string env.AXWAY_MANAGER_URL='https://apimgr.exemplo/api/portal/v1.4' \
  --set env.MCP_AUTH_MODE=oidc \
  --set-string env.OIDC_ISSUER='https://idp.exemplo/realms/apim-mcp' \
  --set env.OIDC_AUDIENCE=apim-mcp-api \
  --set-string env.MCP_RESOURCE_URL='http://<EXTERNAL-IP-OU-DNS>' \
  --set env.MCP_REQUIRED_SCOPES=mcp:tools
```

Obter o IP/DNS do Service e **actualizar** `MCP_RESOURCE_URL` se necessário:

```bash
kubectl -n apim-mcp get svc axway-mcp
helm upgrade axway-mcp ./helm/axway-mcp -n apim-mcp --reuse-values \
  --set-string env.MCP_RESOURCE_URL='http://<EXTERNAL-IP>'
kubectl -n apim-mcp rollout restart deploy/axway-mcp
```

Se a imagem estiver num registry privado, configurar `imagePullSecrets`.

---

## 9. Configurar OIDC (plano A)

### 9.1 O que criar no IdP

1. Realm / tenant (ex.: `apim-mcp`)  
2. Audience / API resource → `OIDC_AUDIENCE` (ex.: `apim-mcp-api`)  
3. Scope `mcp:tools`  
4. Client **público** + PKCE para o Cursor (ex.: `mcp-cursor`)  
5. Redirect URIs do Cursor:
   - `http://localhost:8787/callback`
   - `http://127.0.0.1:8787/callback`
   - `cursor://anysphere.cursor-mcp/oauth/callback`
   - `https://www.cursor.com/agents/mcp/oauth/callback`
6. User de teste

### 9.2 Exemplo Keycloak

IdP de exemplo: `https://idp.example.com/`

| Campo | Valor de exemplo |
|-------|------------------|
| Realm | `apim-mcp` |
| User de teste | `mcp-tester` |
| Password | `replace-me` |
| Client Cursor | `mcp-cursor` (público) |
| Audience | `apim-mcp-api` |
| Scope | `mcp:tools` |
| Client smoke | `mcp-test-cli` / secret `replace-me-client-secret` |

Provisionar (password admin **só** via parâmetro/env, nunca no repositório):

```powershell
powershell -File scripts/setup-keycloak-apim-mcp.ps1 `
  -KeycloakUrl 'https://idp.example.com' `
  -AdminUser 'admin' `
  -AdminPassword $env:KC_ADMIN_PASSWORD `
  -TestUserPassword 'replace-me'
```

Issuer no MCP:

```bash
OIDC_ISSUER=https://idp.example.com/realms/apim-mcp
OIDC_AUDIENCE=apim-mcp-api
MCP_REQUIRED_SCOPES=mcp:tools
```

Outros IdPs: [oidc-idps.md](oidc-idps.md).

---

## 10. Ligar o Cursor ao MCP HTTP

Em `.cursor/mcp.json` ou Settings → Tools & MCP:

```json
{
  "mcpServers": {
    "Axway MCP (remoto OIDC)": {
      "url": "http://<HOST-OU-IP-DO-MCP>",
      "auth": {
        "CLIENT_ID": "mcp-cursor",
        "scopes": ["openid", "profile", "mcp:tools"]
      }
    }
  }
}
```

1. **Connect** / autenticar no servidor.  
2. Browser abre o Keycloak → realm **`apim-mcp`**.  
3. Login com o user de teste do teu IdP (ex.: `mcp-tester` / `replace-me`).  
4. Volta ao Cursor; as tools Axway aparecem na lista MCP.  
5. Testar: *“lista a topologia”*, *“lista as organizações”*.

Documentação Cursor: [cursor.com/docs/mcp](https://cursor.com/docs/mcp).

---

## 11. Verificar que está tudo OK

### 11.1 Auth MCP (OIDC)

```bash
# Sem token → 401
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
  -d 'username=mcp-tester' -d 'password=replace-me' \
  -d 'scope=openid mcp:tools' | jq -r .access_token)

# initialize
curl -s -D - -X POST "http://<MCP>/" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"0.0.1"}}}'
# guardar mcp-session-id do header da resposta

# tools/call list_organizations (reutilizar session id)
curl -s -X POST "http://<MCP>/" \
  -H "Authorization: Bearer $TOKEN" \
  -H "mcp-session-id: <SESSION>" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_organizations","arguments":{}}}'
```

Esperado: topologia / organizações do Axway no JSON.

### 11.3 Logs (Kubernetes)

```bash
kubectl -n apim-mcp logs deploy/axway-mcp --tail=100
```

Procura: `[Auth] MCP_AUTH_MODE=oidc`, `tools/call`, ausência de erros de API Axway.

---

## 12. Checklist rápido

- [ ] `npm run build` ou imagem Docker disponível  
- [ ] `AXWAY_GATEWAY_URL` / `AXWAY_MANAGER_URL` correctas (`/api`, `/api/portal/v1.4`)  
- [ ] Users+senhas Axway no **Secret** (K8s) ou env local  
- [ ] TLS Axway: `AXWAY_TLS_REJECT_UNAUTHORIZED=false` se cert autoassinado  
- [ ] HTTP: `MCP_AUTH_MODE=oidc` + issuer/audience/resource/scopes  
- [ ] Client OIDC com PKCE + redirect URIs Cursor  
- [ ] Cursor com `url` + `auth.CLIENT_ID` → Connect → login  
- [ ] Smoke `list_topology` / `list_organizations` OK  

---

## 13. Troubleshooting

| Problema | Acção |
|----------|--------|
| Cursor 401 / não conecta | Token/OIDC: ver issuer, audience, redirects; `GET /.well-known/oauth-protected-resource` |
| Login Keycloak falha | Realm `apim-mcp`, user `mcp-tester`, password correcta |
| Tools falham com erro Axway | Secret / URLs; testar `curl -u` nas APIs; cert TLS |
| `insufficient_scope` | Scope `mcp:tools` em falta no token |
| Audience mismatch | `aud` do JWT ≠ `OIDC_AUDIENCE` |
| Pod com env antigas | `rollout restart` após alterar Secret |
| stdio “não encontra build” | Correr `npm run build`; path absoluto no `mcp.json` |

---

## 14. Referência de inventário (exemplo)

| Item | Valor de exemplo |
|------|------------------|
| Namespace | `apim-mcp` |
| Service / MCP URL | `http://mcp.example.com` |
| Secret Axway | `axway-mcp-credentials` |
| OIDC issuer | `https://idp.example.com/realms/apim-mcp` |
| User OIDC teste | `mcp-tester` / `replace-me` |

Substitui todos os valores pelo teu ambiente. Não commits credenciais reais.
