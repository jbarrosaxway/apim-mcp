/**
 * @module src/mcp-guidance
 * @description Server instructions and discovery keywords for MCP clients (Cursor).
 * Shown at initialize and via prompts so the model routes troubleshooting questions
 * to Axway tools — not to this repository's source code.
 */
/** Returned in the MCP initialize response (field `instructions`). */
export const SERVER_INSTRUCTIONS = `You are connected to the Axway APIM MCP — use this server's **tools** to operate and diagnose **Axway API Gateway (ANM)** and **API Manager** environments. Do not read or modify the MCP server source code to answer the user.

## Naming
Tools: \`axway_apim_<resource>_<action>\` (verbs: list|get|search|create|update|delete|execute|describe|submit).
Prompt: \`axway_apim_gateway_diagnose\`.
Resources: \`axway://apim/...\`.

## When to use (user keywords)
Gateway, API Gateway, ANM, APIM, Axway, problem, failure, error, down, slow, latency, 5xx, 4xx, timeout, unavailable, health, monitoring, traffic, transaction, topology, instance, proxy, published API, organization, application, quota, alert.

## Playbook — "Is the gateway having a problem?" / health check
1. \`axway_apim_topology_list\` — instances, groups, version (always the first step; obtains \`instanceId\`).
2. For **each** \`instanceId\`: \`axway_apim_instancetraffic_get\` and \`axway_apim_metrics_get\` (failures/latency).
3. \`axway_apim_traffic_search\` with \`ago=1h\` or \`24h\`; filter errors: \`searchField=status\`, \`searchValue=5\` (5xx) or \`4\` (4xx).
4. For suspicious transactions: \`axway_apim_trafficevent_get\` → \`axway_apim_traffictrace_get\` / \`axway_apim_trafficpayload_get\`.
5. APIM catalog: \`axway_apim_proxy_list\` (all states) or \`axway_apim_catalog_get\` (published); details via \`axway_apim_proxy_get\`.
6. \`axway_apim_alert_list\` — **only** trigger configuration (does not list already-fired alerts).

## APIM administration
Organizations, users, apps, credentials, lifecycle (\`axway_apim_proxy_update\` + \`lifecycle=publish|unpublish|deprecate\`), OpenAPI import (\`axway_apim_backend_submit\`).

## Rules
- In Kubernetes/Docker, \`instanceId\` changes after restart — call \`axway_apim_topology_list\` before metrics/events.
- Prefer chaining MCP tools over guessing or reading the apim-mcp repository.
- Prompt \`axway_apim_gateway_diagnose\` is available for an expanded playbook.
`;
export const DIAGNOSE_GATEWAY_PROMPT = `Axway API Gateway diagnosis — run via MCP tools (not code):

1. axway_apim_topology_list
2. Per instanceId: axway_apim_instancetraffic_get, axway_apim_metrics_get (metricTypes: failures, successes)
3. axway_apim_traffic_search (ago matching the symptom; status 5xx/4xx if there is an HTTP error)
4. axway_apim_trafficevent_get + traffictrace/trafficpayload on relevant correlationIds
5. axway_apim_proxy_list / axway_apim_proxy_get for production APIs
6. axway_apim_alert_list — trigger config only, not alert history

User symptom: {{symptom}}
Suggested window: {{timeWindow}}`;
//# sourceMappingURL=mcp-guidance.js.map