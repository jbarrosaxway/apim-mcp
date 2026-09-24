---
name: apim-gateway-code-analysis
description: Diagnostica problemas de APIs Axway cruzando tools do apim-mcp (tráfego, proxy, topologia), FED do cliente e código decompilado do API Gateway. Use quando o usuário pedir ajuda com API/erro Axway em linguagem natural (ex. "me ajude a entender o problema da API X que dá erro Y"), mencionar path local do Gateway/libs (ex. C:\\...\\apigateway ou system/lib), regressão após upgrade, query string ausente, invoke policy, Connect to URL, routing policy, ou análise de binário/FED/código. Se o usuário indicar um caminho de libs, trate-o como gatewayPath e execute o playbook completo (MCP + FED + decompile local) sem exigir o prompt formal.
---

# Análise de código Axway APIM (MCP + FED + decompile)

Combina **tools MCP** (`axway_apim_*`) com **FED** e **JARs decompilados** para ir além de sintomas HTTP e apontar causa no runtime + workaround.

## Gatilho em linguagem natural (equivalente ao prompt MCP)

Se o usuário disser algo como *"me ajude a entender o problema da API X que está dando o erro Y; a lib do gateway está em C:\\...\\apigateway"*, **não peça** que ele invoque `axway_apim_api_rootcause_analyze`. Interprete:

| Frase do usuário | Ação do agente |
|------------------|----------------|
| API / path / nome | `apiPath` — buscar com `axway_apim_proxy_list` / `proxy_get` |
| erro / sintoma | `symptom` — filtrar tráfego e correlacionar |
| caminho com `apigateway`, `system\\lib`, ou pasta de JARs | `gatewayPath` — decompile/grep **nessa pasta** (Windows: scripts `*.ps1`) |

Ordem obrigatória: MCP live → FED via `axway_apim_deployment_archive_get` → extract FED → JARs em `{gatewayPath}/system/lib` (ou o path dado) → hipótese + workaround.

## Pré-requisitos locais

| Artefato | Onde obter | Uso |
|----------|------------|-----|
| FED | **API ANM** (Deployment API) — ver [reference.md — ANM FED API](reference.md#anm-fed-api-deployment-api) | Políticas, listeners, system properties |
| Binário Gateway | `kubectl cp`, tarball Helm, ou cópia em disco | JARs em `system/lib/` |
| CFR | https://github.com/leibnitz27/cfr/releases → `cfr.jar` | Decompilação |
| JRE 17+ | Temurin/Adoptium portable | `java -jar cfr.jar` |

Scripts desta skill: [scripts/](scripts/). Detalhes FED/JARs: [reference.md](reference.md). Caso real: [examples.md](examples.md).

### Ambiente de execução dos scripts

| Ambiente | Scripts preferidos |
|----------|-------------------|
| **Container Linux** (apim-mcp, agent remoto) | `*.sh` + `find-in-jars.py` |
| **Windows local** (dev local na máquina) | `*.ps1` + `find-in-jars.py` |

No container, monte o volume com JARs do Gateway (ex.: `/workspace/gateway-lib`) e coloque `cfr.jar` + JRE em `/workspace/tools`. Ver [reference.md — Container Linux](reference.md#container-linux-apim-mcp).

## Playbook (seguir na ordem)

```
Progresso:
- [ ] 1. Contexto live via MCP
- [ ] 2. API afetada (proxy + auth + routing)
- [ ] 3. Evidência de tráfego (se houver falha recente)
- [ ] 4. FED — políticas e propriedades
- [ ] 5. Versão Gateway → JARs → decompile
- [ ] 6. Hipótese + workaround + correção
```

### 1. Contexto live (sempre primeiro)

Chame `GetMcpTools` no servidor **Axway API Gateway & APIM** antes de invocar tools.

1. `axway_apim_topology_list` — versão do produto (`7.7.0.YYYYMMDD-N`), `instanceId`
2. Se há sintoma em produção/UAT: `axway_apim_traffic_search` (filtro `status` = `4` ou `5`) → `axway_apim_trafficevent_get` → `axway_apim_traffictrace_get`
3. Inspecionar `destinationURL`, query string recebida vs enviada ao backend nos atributos do trace

### 2. API afetada no API Manager

1. `axway_apim_proxy_list` ou `axway_apim_catalog_get`
2. `axway_apim_proxy_get` com id da API — anotar:
   - `securityProfiles` / invoke policy (`authPolicy`, OCC, OAuth introspect)
   - `outboundProfiles` / routing (`destinationURL`, `${params.query}`, backend base path)
   - Método HTTP, query params obrigatórios
3. `axway_apim_proxyauth_get` se autenticação for ambígua

### 3. FED via API ANM (não fazer upload manual)

O FED **não precisa ser anexado pelo usuário**. Obter o Deployment Archive (`.fed`) pela **Deployment API** do ANM, usando credenciais já configuradas no MCP (`AXWAY_GATEWAY_URL`, `AXWAY_GATEWAY_USERNAME`, `AXWAY_GATEWAY_PASSWORD`).

**Passo A — IDs via MCP (sempre primeiro):**

1. `axway_apim_topology_list` → anotar `instanceId` (=`serviceID` na Deployment API) e `groupId` do grupo alvo.

**Passo B — Baixar FED:**

Preferir `axway_apim_deployment_archive_get` com `savePath` (ex.: `/workspace/cliente.fed`). Alternativa shell:

```bash
# Variáveis já presentes no pod apim-mcp (ou exportar manualmente)
INSTANCE_ID="<instanceId de topology_list>"

curl -sk -u "${AXWAY_GATEWAY_USERNAME}:${AXWAY_GATEWAY_PASSWORD}" \
  "${AXWAY_GATEWAY_URL}/deployment/archive/service/${INSTANCE_ID}" \
  -H "Accept: application/json" \
  -o /tmp/fed-response.json

# result.data é base64 do .fed (ZIP)
python3 - <<'PY'
import json, base64
with open("/tmp/fed-response.json") as f:
    data = json.load(f)["result"]["data"]
open("/workspace/cliente.fed", "wb").write(base64.b64decode(data))
print("Saved /workspace/cliente.fed", len(base64.b64decode(data)), "bytes")
PY
```

Endpoint alternativo (via Routing API, mesmo conteúdo):

```bash
curl -sk -u "${AXWAY_GATEWAY_USERNAME}:${AXWAY_GATEWAY_PASSWORD}" \
  "${AXWAY_GATEWAY_URL}/router/service/${INSTANCE_ID}/api/configuration/archive" \
  -H "Accept: application/json" \
  -o /tmp/fed-response.json
```

Para obter `archiveID` (opcional, p.ex. download por grupo): `GET ${AXWAY_GATEWAY_URL}/deployment/domain/deployments` — o id está em `rootProperties.Id` de cada instância. Detalhes em [reference.md](reference.md#anm-fed-api-deployment-api).

**Passo C — Extrair FED:**

**Container Linux** (preferir quando o agente roda no pod apim-mcp):

```bash
bash scripts/extract-fed.sh /workspace/cliente.fed /tmp/fed-extract
# ou, com skill montada no workspace:
bash skills/apim-gateway-code-analysis/scripts/extract-fed.sh /workspace/cliente.fed /tmp/fed-extract
# ou (legado Cursor):
bash .cursor/skills/apim-gateway-code-analysis/scripts/extract-fed.sh /workspace/cliente.fed /tmp/fed-extract
```

**Windows local:**

```powershell
# scripts/extract-fed.ps1 -FedPath "cliente.fed" -OutDir "fed-extract"
```

Buscar no FED (grep em XML):

| Pergunta | Onde |
|----------|------|
| System properties | `EnvSettingsStore.xml` — chaves `com.axway.*`, `api.manager.*` |
| Políticas referenciadas | `PrimaryStore.xml`, `ResourceRepository.xml` |
| Connect to URL na auth | Filtros `ConnectToURL`, `ChangeMessage`, routing filters |
| Listeners / vhost | `ListenersStore.xml` |

Correlacionar invoke policy da API (passo 2) com entradas no FED.

### 4. Binário e decompilação

Obter JARs da **mesma versão** retornada em `topology_list`:

- Caminho típico: `{gateway-root}/system/lib/`
- JARs centrais APIM runtime: `vordel-apimanager-*.jar`, `com.vordel.circuit.net.jar`, `com.vordel.apiportal.runtime*.jar`

**Buscar classes por nome** (antes de decompilar tudo):

```bash
# Container Linux
python3 scripts/find-in-jars.py -JarDir /workspace/gateway-lib -Pattern 'ConnectToURL|AbstractRuntimeBroker|generateRestApiMsgAttributes'
```

```powershell
# Windows local
python scripts/find-in-jars.py -JarDir "gateway/system/lib" -Pattern "ConnectToURL|AbstractRuntimeBroker|generateRestApiMsgAttributes"
```

**Decompilar só o necessário**:

```bash
# Container Linux
bash scripts/decompile-classes.sh \
  /workspace/gateway-lib/vordel-apimanager-7.7.0.x.jar \
  '.*Broker.*' \
  /tmp/decompiled/src \
  /workspace/tools/cfr.jar \
  /workspace/tools/jre/bin/java
```

```powershell
# Windows local
# scripts/decompile-classes.ps1 -JarPath "system/lib/vordel-apimanager-7.7.0.x.jar" -ClassFilter ".*Broker.*" -OutDir "decompiled/src" -CfrJar "tools/cfr.jar" -JavaExe "tools/jre/bin/java.exe"
```

Comparar **duas versões** (OK vs quebrada): diff nos métodos que montam URI, `params.query`, `destinationURL`, ou leem `http.request.uri`.

### 5. Hipótese e entrega

Responder com esta estrutura:

```markdown
## Resumo
[1 parágrafo: sintoma + causa provável]

## Evidências
- Versão Gateway: …
- API / path: …
- Invoke policy: …
- Classe/método: …
- Trecho de código ou diff entre versões

## Workarounds (ordem de preferência)
1. System property / feature flag (menor impacto)
2. Ajuste de routing policy / template `${http.raw.querystring}`
3. Change Message para restaurar atributos após Connect to URL

## Correção definitiva
[Patch Axway / case / upgrade quando existir]

## Testes sugeridos
- APIs representativas com/sem invoke policy
- Métodos GET com query params
```

## Mapa sintoma → classes (ponto de partida)

| Sintoma | Classes / JARs |
|---------|----------------|
| Query string perdida após auth | `ConnectToURLProcessor`, `AbstractRuntimeBroker`, `Broker`/`APIBroker`, `ApiSystemProperty` |
| Cert SSL outbound APIM vs Connect to URL | `ConnectionProcessor`, `SslAuthNProfileAttributesProvider`, `CertificateConfig` |
| Body consumido antes de fault | `AbstractRuntimeBroker`, geração tardia de params (pós-20240830) |
| OAuth / API Key header errado | `transformApiProxyForTroubleshooting` via `axway_apim_proxy_get` |

## Regras

- Preferir MCP tools para dados live; FED/decompile para **por quê** no código.
- Decompilar **só** JARs/classes relevantes — não o `system/lib` inteiro.
- Nunca commitar FED, credenciais ou dumps de tráfego com PII.
- Se o MCP Axway estiver em erro, chamar `mcp_auth` e repetir `GetMcpTools`.
- Prompt MCP irmão: `axway_apim_api_rootcause_analyze` (playbook expandido no servidor).

## Scripts

| Script | Plataforma | Função |
|--------|------------|--------|
| `scripts/extract-fed.sh` | Linux / container | Descompacta `.fed` (ZIP) |
| `scripts/extract-fed.ps1` | Windows | Descompacta `.fed` (ZIP) |
| `scripts/find-in-jars.py` | Cross-platform | Localiza `.class` por regex no nome/conteúdo |
| `scripts/decompile-classes.sh` | Linux / container | CFR com filtro `--jarfilter` |
| `scripts/decompile-classes.ps1` | Windows | CFR com filtro `--jarfilter` |

Todos os scripts bash usam `#!/usr/bin/env bash` e `set -euo pipefail`. Torne-os executáveis no container: `chmod +x scripts/*.sh`.
