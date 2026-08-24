# Exemplo — Query string perdida com invoke policy

**Cenário:** Upgrade `7.7.0.20230830-5` → `7.7.0.20260530-3`. APIs com security profile + invoke policy (OCC) não encaminham query params ao BFF.

## Passos MCP

1. `axway_apim_topology_list` → confirmar versão nova
2. `axway_apim_proxy_get` em `bff_app_cart_core` → `authPolicy` com invoke policy
3. `axway_apim_traffic_search` + trace → `destinationURL` sem `?checkoutType=`

## FED

Obter via ANM (não upload manual):

1. `axway_apim_topology_list` → `instanceId`
2. `axway_apim_deployment_archive_get` com `savePath=/workspace/cliente.fed` (ou curl ANM — ver abaixo)
3. `extract-fed.sh` → grep em XML

Conteúdo analisado:

- `EnvSettingsStore.xml`: verificar se `com.axway.api.runtime.broker.parameters.generation.legacy=false`
- PrimaryStore: localizar filtros da invoke policy (Connect to URL para introspect/token)

## Código

Decompilar `AbstractRuntimeBroker` (nova) vs `Broker` (antiga):

- Nova: após auth, `generateRestApiMsgAttributes` relê `http.request.uri.getRawQuery()` → `params.query` vazio
- Antiga: monta `destinationURL` de `params.query` original, sem regeneração pós-auth
- `ConnectToURLProcessor`: **igual** nas duas versões

## Workaround validado

```properties
com.axway.api.runtime.broker.parameters.generation.legacy=true
```

Case Axway RDAPI-33509; release note 20240830 (fault sem consumir body → geração tardia de params).

## Testes pós-workaround

- GET com query + invoke policy (cart, subscription, withdraw)
- POST form-urlencoded com OCC
- APIs sem auth (controle)
