# Client Registry Sync — fragmento de policies (Send / Receive)

Pacote YAML importável no Policy Studio para replicar **organizations**, **applications** e **credentials** entre ambientes APIM via Portal Alerts + endpoint HTTP no Gateway destino.

## Estrutura

```
fragment/
  Policies/Client Registry Sync/
    Common/     # build envelope, call peer, call APIM local, resolve, anti-loop (Guard/Mark)
    Send/       # todos os alerts Governance de Org / App / Cred (+ Guard Sync Send)
    Receive/    # Upsert*|Delete*|Apply*|Update* (+ Mark Sync Seen após mutação)
  Libraries/Cache Manager/
    Client Registry Sync Seen.yaml   # Local Cache TTL 90s (anti-loop A↔B)
  Server Settings/Portal Alerts/   # aponta alerts para as policies Send
  External Connections/Auth Profiles/HTTP Basic/  # Local API Manager + Sync Peer (YAML só user)
  Environment Configuration/Service/
    Client Registry Sync Services/   # listener :18090 + /api/sync/v1/*
    local-apimanager.yaml            # RemoteHost APIM local (alias + Addresses)
envSettings.props.example            # prop do peer sync (origem)
```

## Anti-loop bidirecional (A ↔ B)

Sem proteção, um disable em A dispara alert → Send → Receive em B → mutação no Manager B → o mesmo alert em B → Send de volta a A → loop.

**Mecanismo (Local Cache TTL):**

1. **Receive** (após mutação APIM local com sucesso): grava chave `sync:seen:{entityType}:{entityId}:{event}` no cache **Client Registry Sync Seen**.
2. **Send** (início de cada `On *`): se a chave existir → **Guard Sync Seen** curto-circuita (True) **sem** Call Target Sync Endpoint.
3. TTL curto (**90s** por omissão) — mudanças legítimas distintas na mesma entidade após o TTL voltam a sincronizar.

| Item | Valor |
|------|--------|
| Cache | `Libraries/Cache Manager/Client Registry Sync Seen` |
| TTL | `timeToLiveSeconds: 90` (ajustável no Policy Studio) |
| Chave | `sync:seen:{entityType}:{entityId}:{event}` |
| Policies | Common: `Guard Sync Send`, `Mark Sync Seen`, `Prepare Sync Seen`, `Build Sync Seen Key` |

**Requisito:** os **dois** lados (A e B) precisam do **mesmo** fragmento importado; o cache é **local** a cada Gateway (não é partilhado entre peers).

Portal Alerts em geral **não** expõem o HTTP que criou a entidade, por isso header `X-Axway-Client-Registry-Sync` não é fiável para anti-loop — o cache TTL é a abordagem usada.

## Env Settings — peer sync (obrigatório no Gateway origem)

O **Call Target Sync Endpoint** não usa RemoteHost. A base URL vem de `envSettings.props`:

| Item | Valor |
|------|--------|
| Ficheiro | `INSTALL_DIR/conf/envSettings.props` (por instância/grupo) |
| Propriedade | `env.CLIENT.REGISTRY.SYNC.PEER.URL` |
| Selector no Connect to URL | `${env.CLIENT.REGISTRY.SYNC.PEER.URL}${sync.path}` |
| Policy | `Call Target Sync Endpoint` |
| Exemplo | `env.CLIENT.REGISTRY.SYNC.PEER.URL=http://gateway-peer.example:18090` |

- Valor = base URL do peer **sem** path e **sem** barra final.
- `${sync.path}` é definido pelas policies Send (ex. `/api/sync/v1/organization`).
- Prefixo `env.` no ficheiro é opcional (compatibilidade Axway); o selector continua `${env....}`.
- Auth HTTP Basic do peer: profile **Sync Peer** (criar password **após** import; ver passphrase abaixo).

## APIM local — Remote Host (Receive / mutações Portal)

**Call Local APIM** e **Call Local APIM Soft** usam o entity **Remote Host** `local-apimanager`, não `envSettings.props`.

| Item | Valor |
|------|--------|
| Entity | `Environment Configuration/Service/local-apimanager` |
| Alias / Host name | `local-apimanager` |
| Port | `8075` |
| Addresses (default) | `localhost:8075` |
| URL no Connect to URL | `http://local-apimanager:8075${apim.path}` |
| Auth | Profile **Local API Manager** (password após import) |

O hostname `local-apimanager` na URL é o **alias lógico** do Remote Host. O Gateway resolve a ligação TCP via **Addresses** (ex. `localhost:8075`), **sem DNS** — padrão Axway documentado para Remote Hosts. Ajustar host/port/addresses no Policy Studio conforme o ambiente (ex. hostname real do API Manager ou `127.0.0.1:8075`).

Ver também: [Select configuration values at runtime](https://docs.axway.com/bundle/axway-open-docs/page/docs/apim_policydev/apigw_poldev/general_selector/index.html) (`${env.*}` ← `envSettings.props`, só para peer sync).

## Cobertura de eventos (Portal Alerts)

Alert IDs oficiais do API Manager 7.7 (`portalalerts`). Não existe alert **Create Application** — o equivalente é **Application Approved** / **Approve Application Registration**.

### Organization (Governance)

| Evento | Alert id | Send | Receive path |
|--------|----------|------|--------------|
| Create Organization | `alert.organization.create` | On Create Organization | `POST /organization` (upsert) |
| Delete Organization | `alert.organization.delete` | On Delete Organization | `POST /organization/delete` |
| Enable Organization | `alert.organization.enable` | On Enable Organization | `POST /organization/status` (PUT APIM `enabled`) |
| Disable Organization | `alert.organization.disable` | On Disable Organization | `POST /organization/status` |
| Add Organization API Access | `alert.organization.addapi` | On Add Organization API Access | `POST /org-access` grant |
| Remove Organization API Access | `alert.organization.removeapi` | On Remove Organization API Access | `POST /org-access` revoke |
| Enable Organization API Access | `alert.organization.enableapi` | On Enable Organization API Access | `POST /org-access` enable |
| Disable Organization API Access | `alert.organization.disableapi` | On Disable Organization API Access | `POST /org-access` disable |

### Application (Governance)

| Evento | Alert id | Send | Receive path |
|--------|----------|------|--------------|
| Application Approved | `alert.application.approve` | On Application Approved | `POST /application` (upsert) |
| Approve Application Registration | `alert.application.register` | On Approve Application Registration | `POST /application` (upsert) |
| Delete Application | `alert.application.delete` | On Delete Application | `POST /application/delete` |
| Enable Application | `alert.application.enable` | On Enable Application | `POST /application/status` |
| Disable Application | `alert.application.disable` | On Disable Application | `POST /application/status` |
| Approve Application API Access | `alert.application.approveapi` | On Approve Application API Access | `POST /app-access` grant |
| Approve Application API Access Request | `alert.application.requestapi` | On Approve Application API Access Request | `POST /app-access` grant |
| Remove Application API Access | `alert.application.removeapi` | On Remove Application API Access | `POST /app-access` revoke |
| Enable Application API Access | `alert.application.enableapi` | On Enable Application API Access | `POST /app-access` enable |
| Disable Application API Access | `alert.application.disableapi` | On Disable Application API Access | `POST /app-access` disable |

### Application Credentials (Governance)

| Evento | Alert id | Send | Receive path |
|--------|----------|------|--------------|
| Create Application Credential | `alert.applicationcredentials.create` | On Create Application Credential | `POST /credential` (upsert) |
| Delete Application Credential | `alert.applicationcredentials.delete` | On Delete Application Credential | `POST /credential/delete` |
| Enable Application Credential | `alert.applicationcredentials.enable` | On Enable Application Credential | `POST /credential/update` |
| Disable Application Credential | `alert.applicationcredentials.disable` | On Disable Application Credential | `POST /credential/update` |
| Update Application Credential | `alert.applicationcredentials.update` | On Update Application Credential | `POST /credential/update` |

Scripts: **Groovy**. Correlação entre ambientes por **nome** (org/app) e proxy por **name/path** (API access).

**Create/Update/Enable/Disable Credential (v1):** Read Application Credential com `credentialType: apikey` (literal — o filtro não aceita selector). OAuth/external: extensão futura (Switch como nas sample policies).

### Assunções REST (API Manager 7.7 Portal v1.4)

| Mutação | Endpoint local (Receive → Call Local APIM) |
|---------|-------------------------------------------|
| Enable/Disable org | `PUT /api/portal/v1.4/organizations/{id}` body `{"enabled":bool}` |
| Enable/Disable app | `PUT /api/portal/v1.4/applications/{id}` body `{"enabled":bool}` |
| Enable/Disable/Update cred | `PUT .../applications/{appId}/apikeys\|oauth\|extcredentials/{id}` body `{"enabled":bool}` (+ `secret` se presente) |
| Enable/Disable API access | `PUT .../{org\|app}/{id}/apis/{apiId}` body `{"enabled":bool}` — **assunção**: path com `apiId` (mesmo padrão do DELETE já usado); docs falam em `apiAccessId` |

### Leitura local do API Manager (sem REST)

| Filtro | Uso no fragmento |
|--------|------------------|
| Read Organization | Send (por ID do alert); Receive resolve por **nome** (`selects: Name`) |
| Read Application | Send (approve/enable/disable/cred/access) |
| Read Application Credential | Send create/enable/disable/update credential (`credentialType: apikey`) |
| Read API Proxy | Send (org/app API access) |

Resolve de **Application** e **Proxy** no Receive: Groovy local (Read App/Proxy só aceitam ID). **REST (`Call Local APIM`)** só para mutações.

## Importar no Policy Studio (projeto XML / FED)

Arquivo: `fragment-xml\client-registry-sync-fragment.xml`.

> **Importante:** o XML tem de ser gerado via FED Federated (script `yaml-frag-to-xml.py`). Export directo do YAML deixa `realizedTypes` em formato YAML e o Policy Studio falha com **Unable to upgrade the import file**.

1. Policy Studio → abrir o projeto XML (ou o FED).
2. **File → Import → Configuration Fragment**.
3. Selecionar `client-registry-sync-fragment.xml`.
4. Manter policies Sync, Portal Alerts (Org/App/Cred), listener `:18090`, RemoteHost `local-apimanager`.
5. Revisar conflitos de merge em Portal Alerts / Auth Profiles / Service.

Regenerar:

```bat
C:\Axway-7.7.20260530\apigateway\Win32\bin\jython.bat policies\client-registry-sync\scripts\yaml-frag-to-xml.py
```

Validar (YAML + XML, cross-platform):

**Via MCP** (prefer when agent uses apim-mcp; Python 3 on MCP host):

| Tier | Tool | Requisitos |
|------|------|------------|
| **0 — Offline** | `axway_apim_fragment_validate` (default) | Python 3; sem Axway |
| **0** | `axway_apim_fragment_sync_ps_project` | Python 3 |
| **1 — Axway libs** | `axway_apim_fragment_validate` com yamles + import dry-run | `gatewayHome` resolvido |
| **1** | `axway_apim_fragment_yaml_to_xml` | `gatewayHome` resolvido (Jython) |
| — | `axway_apim_fragment_gateway_resolve` | Diagnóstico de mapeamento |

**Mapeamento versão → install local:** copiar `config/axway-gateway-homes.example.json` para `config/axway-gateway-homes.json`, ou definir `AXWAY_GATEWAY_VERSION_MAP` (JSON) / `AXWAY_GATEWAY_HOME` (install único). Com `instanceId` da topologia, o MCP resolve `productVersion` e procura o `gatewayHome` correspondente.

Exemplos MCP:

```json
{ "tool": "axway_apim_fragment_validate" }
{ "tool": "axway_apim_fragment_validate", "instanceId": "instance-1" }
{ "tool": "axway_apim_fragment_yaml_to_xml", "gatewayHome": "C:\\Axway-7.7.20260530" }
{ "tool": "axway_apim_fragment_gateway_resolve", "instanceId": "instance-1" }
```

**Shell local** (dev machine):

```bash
# Windows / Linux / macOS — Python 3 (checks offline; + Axway se detectado)
python policies/client-registry-sync/scripts/validate-fragment.py

# So YAML ou so XML
python policies/client-registry-sync/scripts/validate-fragment.py --yaml-only
python policies/client-registry-sync/scripts/validate-fragment.py --xml-only

# CI com Axway instalado (falha se gateway ausente)
python policies/client-registry-sync/scripts/validate-fragment.py --strict --gateway-home /opt/axway

# Regenerar XML antes de validar (requer Axway/jython)
python policies/client-registry-sync/scripts/validate-fragment.py --regenerate-xml
```

Wrapper PowerShell (Windows, chama o `.py` internamente):

```powershell
policies\client-registry-sync\scripts\validate-fragment.ps1
policies\client-registry-sync\scripts\validate-fragment.ps1 -RegenerateXml -Strict
```

Só import dry-run XML (Jython + Axway):

```bat
policies\client-registry-sync\scripts\validate-xml-fragment.bat
```

Só YAML via Axway:

```bat
C:\Axway-7.7.20260530\apigateway\Win32\bin\yamles.bat validate -s yaml:file:.\fragment
```

### O que o `validate-fragment.py` valida

| Camada | Tier 0 (sem Axway) | Tier 1 (com gatewayHome resolvido) |
|--------|---------------------|-------------------------------------|
| XML | Parse well-formed, regras estaticas (sem BasicProfile/passphrase/YAML types), entityStoreData, 23 Portal Alerts, selector peer `${env.CLIENT.REGISTRY.SYNC.PEER.URL}`, Remote Host `local-apimanager` | Import dry-run Blank FED (`validate-xml-fragment.py`) |
| YAML | Estrutura fragment, anti-loop (Guard/Mark/Cache), `_fragment.yaml` addOrReplace | `yamles validate` |

Detalhes dos validadores Axway 7.7: `docs/axway-7.7-validation.md`.

## Ajustes obrigatórios após import

| Item | Onde | O que fazer |
|------|------|-------------|
| **Peer URL** | `conf/envSettings.props` no Gateway **origem** | `env.CLIENT.REGISTRY.SYNC.PEER.URL=http://HOST_PEER:18090` (ver `envSettings.props.example`) |
| Porta receive | Interface `18090` no **destino** | Firewall / Service / NodePort |
| APIM local | RemoteHost `local-apimanager` | Host/port e Addresses (default `localhost:8075`) no Policy Studio |
| Credenciais | Auth Profiles HTTP Basic | XML **não** exporta BasicProfiles. Após import: criar `Local API Manager` e `Sync Peer` com passwords no Policy Studio |
| Alerts | API Manager → Settings → Alerts | Ativar **todos** os eventos Org/App/Cred da matriz |
| **Cache anti-loop** | Libraries → Cache Manager | Confirmar cache **Client Registry Sync Seen** (TTL 90s). Se o merge não o trouxe: Add Local Cache com o mesmo nome e TTL |
| Fragmento nos **dois** peers | A e B | Mesmo fragmento em ambos os Gateways para o Guard/Mark funcionarem em A→B e B→A |

> **Passphrase / “No Passphrase Details”:** o XML em `fragment-xml/` não inclui BasicProfiles nem `passphraseTest`. Passwords só **depois** do import.

URLs efectivas:

- Send (peer): `${env.CLIENT.REGISTRY.SYNC.PEER.URL}${sync.path}`
- Receive → APIM local: `http://local-apimanager:8075${apim.path}` (Remote Host resolve TCP)

## Teste rápido (só receive)

```bash
curl -u sync-user:changeme -H "Content-Type: application/json" \
  -d '{"syncType":"organization","action":"upsert","organization":{"name":"Sync Test Org","email":"test@example.com","enabled":true,"development":true}}' \
  http://DESTINO:18090/api/sync/v1/organization
```

Status (enable/disable):

```bash
curl -u sync-user:changeme -H "Content-Type: application/json" \
  -d '{"syncType":"organization","organization":{"name":"Sync Test Org","enabled":false}}' \
  http://DESTINO:18090/api/sync/v1/organization/status
```

## Teste ponta a ponta

1. Importar fragment nos **dois** ambientes (origem = Send+alerts; destino = Receive+listener+APIM).
2. No **origem**: definir `env.CLIENT.REGISTRY.SYNC.PEER.URL` no `envSettings.props`.
3. No **destino**: confirmar Remote Host `local-apimanager` (Addresses apontam ao API Manager local).
4. Reiniciar/reload settings se necessário.
5. Criar organization no API Manager origem → alert dispara → org no destino.
6. Disable/Enable org/app/cred → status no peer.

## Limitações (v1)

- Secrets de API Key/OAuth: destino pode gerar novos secrets.
- Credenciais OAuth/external no Send: só **apikey** no Read filter (v1).
- Auth peer: HTTP Basic — rede privada / mTLS depois.
- XML Federated **sem** BasicProfiles (passphrase).
- Anti-loop: dentro do TTL, um segundo evento **idêntico** (mesmo entityType+entityId+event) no mesmo Gateway é ignorado no Send; eventos diferentes (ex. enable vs disable) não partilham chave.

## Referências

- Selectors / `envSettings.props`: docs Policy Studio *general_selector*
- Portal Alerts: `apigateway/system/conf/apiportal/.../portalalerts`
- Sample policies `API Management Alerts`
