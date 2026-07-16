/**
 * @module src/mcp-guidance
 * @description Server instructions and discovery keywords for MCP clients (Cursor).
 * Shown at initialize and via prompts so the model routes troubleshooting questions
 * to Axway tools — not to this repository's source code.
 */
/** Returned in the MCP initialize response (field `instructions`). */
export const SERVER_INSTRUCTIONS = `Você está ligado ao Axway APIM MCP — use as **tools deste servidor** para operar e diagnosticar ambientes **Axway API Gateway (ANM)** e **API Manager**. Não leia nem altere o código-fonte do servidor MCP para responder ao utilizador.

## Naming
Tools: \`axway_apim_<resource>_<action>\` (verbos: list|get|search|create|update|delete|execute|describe|submit).
Prompt: \`axway_apim_gateway_diagnose\`.
Resources: \`axway://apim/...\`.

## Quando usar (palavras-chave do utilizador)
Gateway, API Gateway, ANM, APIM, Axway, problema, falha, erro, down, lento, latência, 5xx, 4xx, timeout, indisponível, health, saúde, monitorização, tráfego, transação, topologia, instância, proxy, API publicada, organização, aplicação, quota, alerta.

## Playbook — "O gateway está com problema?" / health check
1. \`axway_apim_topology_list\` — instâncias, grupos, versão (sempre o primeiro passo; obtém \`instanceId\`).
2. Para **cada** \`instanceId\`: \`axway_apim_instancetraffic_get\` e \`axway_apim_metrics_get\` (falhas/latência).
3. \`axway_apim_traffic_search\` com \`ago=1h\` ou \`24h\`; filtrar erros: \`searchField=status\`, \`searchValue=5\` (5xx) ou \`4\` (4xx).
4. Para transações suspeitas: \`axway_apim_trafficevent_get\` → \`axway_apim_traffictrace_get\` / \`axway_apim_trafficpayload_get\`.
5. Catálogo APIM: \`axway_apim_proxy_list\` (todos os estados) ou \`axway_apim_catalog_get\` (publicado); detalhe com \`axway_apim_proxy_get\`.
6. \`axway_apim_alert_list\` — **só** configuração de gatilhos (não lista alertas já disparados).

## Gestão APIM
Organizações, users, apps, credenciais, lifecycle (\`axway_apim_proxy_update\` + \`lifecycle=publish|unpublish|deprecate\`), import OpenAPI (\`axway_apim_backend_submit\`).

## Regras
- Em Kubernetes/Docker o \`instanceId\` muda após restart — chame \`axway_apim_topology_list\` antes de métricas/eventos.
- Prefira encadear tools MCP a suposições ou leitura do repositório apim-mcp.
- Prompt \`axway_apim_gateway_diagnose\` disponível para playbook expandido.
`;
export const DIAGNOSE_GATEWAY_PROMPT = `Diagnóstico Axway API Gateway — execute via MCP tools (não código):

1. axway_apim_topology_list
2. Por instanceId: axway_apim_instancetraffic_get, axway_apim_metrics_get (metricTypes: failures, successes)
3. axway_apim_traffic_search (ago conforme sintoma; status 5xx/4xx se houver erro HTTP)
4. axway_apim_trafficevent_get + traffictrace/trafficpayload nas correlationIds relevantes
5. axway_apim_proxy_list / axway_apim_proxy_get para APIs em produção
6. axway_apim_alert_list — apenas config de gatilhos, não histórico de alertas

Sintoma do utilizador: {{symptom}}
Janela sugerida: {{timeWindow}}`;
//# sourceMappingURL=mcp-guidance.js.map