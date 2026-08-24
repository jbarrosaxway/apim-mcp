# Referência — FED, JARs e atributos Gateway

## ANM FED API (Deployment API)

Swagger de referência: `api-gateway-swagger.json` (`basePath: /api`, tag **Deployment API**).

Autenticação: **HTTP Basic** (mesmas credenciais do MCP: `AXWAY_GATEWAY_USERNAME` / `AXWAY_GATEWAY_PASSWORD`). Base URL: `AXWAY_GATEWAY_URL` (ex.: `https://anm.exemplo/api` — **já inclui** `/api`).

### Fluxo recomendado

1. `axway_apim_topology_list` → `instanceId` (= `serviceID`) e `groupId`.
2. (Opcional) `GET /deployment/domain/deployments` → metadados; `archiveID` em `result[host][groupId][n].rootProperties.Id`.
3. `GET /deployment/archive/service/{serviceID}` → FED completo (Deployment Archive).
4. Decodificar `result.data` (base64, `format: byte`) → arquivo `.fed` → `extract-fed.sh`.

### Endpoints de download (GET)

| Path | Resumo | Params | Resposta |
|------|--------|--------|----------|
| `/deployment/archive/service/{serviceID}` | **FED (.fed) deployado na instância** | `serviceID` = `instanceId` da topologia | `ApiResponseDeploymentArchive` → `result.data` (base64) |
| `/router/service/{instance}/api/configuration/archive` | FED via Routing API (equivalente) | `instance` = `instanceId` | `ApiResponseArchive` → `result.data` (base64) |
| `/deployment/archive/policy/service/{serviceID}` | Policy Archive (.pol) da instância | `serviceID` | `ApiResponseArchive` |
| `/deployment/archive/environment/service/{serviceID}` | Environment Archive (.env) da instância | `serviceID` | `ApiResponseArchive` |
| `/deployment/archive/policy/{groupID}/{archiveID}` | Policy Archive por grupo + id | `groupID`, `archiveID`; query `local` (bool, default false) | `ApiResponseArchive` |
| `/deployment/archive/environment/{groupID}/{archiveID}` | Environment Archive por grupo + id | idem | `ApiResponseArchive` |
| `/deployment/envsettings/service/{serviceID}` | Env settings (JSON, **não** binário FED) | `serviceID` | `ApiResponseEnvironmentalizedEntities` |
| `/deployment/envsettings/{groupID}/{archiveID}` | Env settings por grupo | `groupID`, `archiveID`; query `local` | `ApiResponseEnvironmentalizedEntities` |

### Endpoints de metadados (GET, sem binário)

| Path | Resumo |
|------|--------|
| `/deployment/domain/deployments` | Deployment info de **todas** as instâncias; `archiveID` em `rootProperties.Id` |
| `/deployment/domain/deployments/withpending` | Idem incluindo pending (só metadados) |
| `/deployment/local/deployments` | Deployments no host local; query `cleanupPending` (bool) |

### Exemplo curl — FED completo

```bash
INSTANCE_ID="<instanceId>"   # de axway_apim_topology_list

curl -sk -u "${AXWAY_GATEWAY_USERNAME}:${AXWAY_GATEWAY_PASSWORD}" \
  "${AXWAY_GATEWAY_URL}/deployment/archive/service/${INSTANCE_ID}" \
  -H "Accept: application/json" \
  -o /tmp/fed-response.json

python3 - <<'PY'
import json, base64, sys
r = json.load(open("/tmp/fed-response.json"))
if r.get("errors"):
    sys.exit(f"API errors: {r['errors']}")
fed = base64.b64decode(r["result"]["data"])
open("/workspace/cliente.fed", "wb").write(fed)
print(f"Wrote /workspace/cliente.fed ({len(fed)} bytes)")
PY

bash /app/.cursor/skills/apim-gateway-code-analysis/scripts/extract-fed.sh \
  /workspace/cliente.fed /tmp/fed-extract
```

### Tool MCP

`axway_apim_deployment_archive_get` — params: `instanceId` (opcional se topologia tiver uma instância), `savePath` (opcional). Chama `GET /deployment/archive/service/{serviceID}` e decodifica `result.data` (base64). Perfil `observe`, `readOnlyHint: true`.

## Estrutura do FED (export `.fed`)

O FED é um ZIP. Após extração:

```
fed-extract/
  META-INF/MANIFEST.MF
  META-INF/MANIFEST-ENVIRONMENT.MF
  META-INF/MANIFEST-POLICY.MF
  {uuid}/
    PrimaryStore.xml      # entidades principais (policies, filters)
    ResourceRepository.xml
    EnvSettingsStore.xml  # system properties (-D / env)
    ListenersStore.xml
    ExtConnsStore.xml
    CertStore.xml
    UserStore.xml
    configs.xml
```

### System properties frequentes (APIM runtime)

| Chave | Enum / origem | Efeito |
|-------|---------------|--------|
| `com.axway.api.runtime.broker.parameters.generation.legacy` | `ApiParametersGenerationLegacy` | `true` = geração de params estilo pré-20240830 |
| `api.manager.querystring.passthrough` | `ApiManagerQueryStringPassThrough` | Pass-through de query no Manager |
| `com.coreapireg.apimethod.querystring.passthrough` | `ApiMethodPreserveQueryStringValue` | Preserva query no método |

Definidas em `com.vordel.api.config.ApiSystemProperty` (decompilar `vordel-apimanager-*.jar`).

## JARs prioritários (`system/lib/`)

| JAR | Pacotes úteis |
|-----|---------------|
| `vordel-apimanager-7.7.0.*.jar` | `com.vordel.apiportal.runtime.*`, virtualized auth |
| `com.vordel.circuit.net.jar` | `ConnectToURLProcessor`, `ConnectionProcessor` |
| `com.vordel.circuit.conversion.jar` | `ChangeMessageProcessor`, body/URI |
| `com.vordel.api.config.jar` | `ApiSystemProperty` |

## Atributos de mensagem (whiteboard)

| Atributo | Uso em diagnóstico |
|----------|-------------------|
| `http.request.uri` | URI corrente — **sobrescrita** por Connect to URL |
| `http.raw.querystring` | Query original (útil em templates de routing) |
| `params.query` | Query usada para montar `destinationURL` |
| `destinationURL` | URL final enviada ao backend |
| `api.request.path` | Path da API publicada |

## Connect to URL — comportamento conhecido

`com.vordel.circuit.net.ConnectToURLProcessor` grava destino em `http.request.uri` (e path/host/port/protocol) **sem restaurar** a URI do cliente. Se código posterior chama `getRawQuery()` em `http.request.uri`, perde query params originais.

Workaround em routing policy: `${http.request.uri}?${http.raw.querystring}` (validar duplicação de `?`).

## Tools MCP usadas neste fluxo

| Tool | Papel |
|------|-------|
| `axway_apim_topology_list` | Versão + instanceId |
| `axway_apim_deployment_archive_get` | Download FED (.fed) via Deployment API |
| `axway_apim_proxy_get` | Security/routing da API |
| `axway_apim_traffic_search` | Achar correlationId |
| `axway_apim_traffictrace_get` | Passos de policy |
| `axway_apim_trafficpayload_get` | Body/query enviados |
| `axway_apim_config_get` | Config global Manager |

## Container Linux (apim-mcp)

Quando o MCP roda em container Linux, o agente **não** tem acesso a scripts PowerShell. Use os equivalentes bash em `scripts/`.

### Layout sugerido de volumes

```text
/workspace/
  cliente.fed              # baixado via GET /deployment/archive/service/{serviceID}
  gateway-lib/             # mount: JARs de system/lib/ da mesma versão do topology
  tools/
    cfr.jar                # CFR de https://github.com/leibnitz27/cfr/releases
    jre/                   # JRE 17+ (Temurin) — bin/java deve existir
  .cursor/skills/apim-gateway-code-analysis/scripts/
```

Monte `gateway-lib` a partir de:

- `kubectl cp <pod>:/opt/Axway/apigateway/system/lib /workspace/gateway-lib` (caminho varia por imagem)
- tarball extraído do node Gateway no Helm chart
- volume persistente compartilhado no cluster

### Dependências no container

| Ferramenta | Uso |
|------------|-----|
| `bash`, `unzip` | `extract-fed.sh` |
| `python3` | `find-in-jars.py` (stdlib apenas — sem pip) |
| `java` 17+ | `decompile-classes.sh` via CFR |

Se `unzip` ou `java` não estiverem na imagem apim-mcp, estenda o Dockerfile ou monte um sidecar/tools volume com JRE + CFR.

### Exemplo completo no container

```bash
SKILL=/.cursor/skills/apim-gateway-code-analysis/scripts
chmod +x "$SKILL"/*.sh

# 0. Baixar FED (se ainda não existe) — ver seção ANM FED API acima
# curl ... "${AXWAY_GATEWAY_URL}/deployment/archive/service/${INSTANCE_ID}" ...

# 1. Extrair FED
bash "$SKILL/extract-fed.sh" /workspace/cliente.fed /tmp/fed-extract
grep -r 'broker.parameters.generation' /tmp/fed-extract

# 2. Localizar classes nos JARs
python3 "$SKILL/find-in-jars.py" \
  -JarDir /workspace/gateway-lib \
  -Pattern 'AbstractRuntimeBroker|ConnectToURL'

# 3. Decompilar só Broker
bash "$SKILL/decompile-classes.sh" \
  /workspace/gateway-lib/vordel-apimanager-7.7.0.20260530-3.jar \
  '.*AbstractRuntimeBroker.*' \
  /tmp/decompiled/broker \
  /workspace/tools/cfr.jar \
  /workspace/tools/jre/bin/java
```

Saídas temporárias (`/tmp/fed-extract`, `/tmp/decompiled/`) não devem ser commitadas.
