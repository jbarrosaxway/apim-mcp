/**
 * @module src/mcp-guidance
 * @description Server instructions and discovery keywords for MCP clients.
 * Shown at initialize and via prompts so the model routes troubleshooting questions
 * to Axway tools — not to this repository's source code.
 */

/** Returned in the MCP initialize response (field `instructions`). */
export const SERVER_INSTRUCTIONS = `You are connected to the **Axway APIM MCP** — use this server's **tools** to operate and diagnose **Axway API Gateway (ANM)** and **API Manager**. Do not read or modify the MCP server source code to answer the user.

## Naming
Tools: \`axway_apim_<resource>_<action>\` (verbs: list|get|search|create|update|delete|execute|describe|submit).
Prompts: \`axway_apim_gateway_diagnose\` (saúde/tráfego), \`axway_apim_api_rootcause_analyze\` (FED + análise pelo agente), \`axway_apim_policy_develop\` (Policy Studio / fragments).
Resources: \`axway://apim/...\` — attach \`axway://apim/playbook/gateway-code-analysis\` for root-cause; \`axway://apim/playbook/policy-development\` + \`axway://apim/docs/policydev/{slug}\` for authoring policies (RAG from Axway apim_policydev docs).

## When to use (user keywords)
Gateway, API Gateway, ANM, APIM, Axway, problem, failure, error, down, slow, latency, 5xx, 4xx, timeout, unavailable, health, monitoring, traffic, transaction, topology, instance, proxy, published API, FED, deployment archive, policy, invoke, Connect to URL, routing, organization, application, quota, alert, "me ajude a entender", "problema da API", lib/libs do gateway, caminho local apigateway/system/lib.

## Natural language = full root-cause playbook
If the user asks in plain language to understand an API problem/error **and/or** gives a local Gateway path (e.g. \`C:\\Users\\...\\apigateway\` or \`system/lib\`):
1. Treat that path as \`gatewayPath\` (JARs under \`system/lib\` of the same build as topology).
2. Run the same flow as prompt \`axway_apim_api_rootcause_analyze\` — do **not** require the user to name the prompt.
3. Always: \`axway_apim_topology_list\` → proxy/traffic tools → \`axway_apim_deployment_archive_get\` (FED).
4. Calling agent (Cursor): extract FED, then find-in-jars/CFR decompile under the given \`gatewayPath\` using skill \`apim-gateway-code-analysis\`.
5. Deliver root cause + workaround; cite policy class/method when bytecode was inspected.

## Playbook — health / "gateway com problema?"
1. \`axway_apim_topology_list\` — versão, \`instanceId\` (sempre primeiro).
2. Por \`instanceId\`: \`axway_apim_instancetraffic_get\`, \`axway_apim_metrics_get\`.
3. \`axway_apim_traffic_search\` (\`ago=1h\` ou \`24h\`); erros: \`searchField=status\`, \`searchValue=5\` ou \`4\`.
4. Transações suspeitas: \`axway_apim_trafficevent_get\` → \`axway_apim_traffictrace_get\` / \`axway_apim_trafficpayload_get\`.
5. Catálogo APIM: \`axway_apim_proxy_list\` / \`axway_apim_proxy_get\`.
6. \`axway_apim_alert_list\` — só configuração de triggers (não histórico de alertas).

## FED — essencial para análise de políticas (Axway Deployment API)
**Sempre** obter o FED deployado via MCP (não pedir upload manual ao usuário):

1. \`axway_apim_topology_list\` → \`instanceId\` (= \`serviceID\` na Deployment API).
2. \`axway_apim_deployment_archive_get\` — primário: \`GET /deployment/archive/service/{serviceID}\`; fallback automático: \`GET /router/service/{instance}/api/configuration/archive\` (EMT / Externally Managed Topology, HTTP 405). Opcionais: \`axway_apim_policy_archive_get\` (.pol), \`axway_apim_environment_archive_get\` (.env), \`axway_apim_envsettings_get\` (JSON), \`axway_apim_deployments_list\` (archive IDs), \`axway_apim_group_conf_get\` (arquivo conf do grupo; sensível).
3. Resposta: \`result.data\` base64 → arquivo \`.fed\` (ZIP). A tool devolve \`dataBase64\` (até 8 MB) ou grava em \`savePath\` no host do MCP.

**Decompilação, extract-fed e grep em JARs** são responsabilidade do **agente chamador** (shell local ou pod), usando o playbook em \`axway://apim/playbook/gateway-code-analysis\`. O MCP não expõe tools de decompile. Se o usuário já deu um path local de Gateway/libs, use-o; não peça outro path.

## Root-cause (regressão pós-upgrade, query string, invoke policy)
1. Evidência live: topology → proxy_get → traffic trace.
2. FED: \`axway_apim_deployment_archive_get\`.
3. Agente: extrair FED, correlacionar políticas; decompilar JARs da versão da topologia (path do usuário ou \`system/lib\`).
4. Prompt expandido opcional: \`axway_apim_api_rootcause_analyze\` (mesma lógica que a pergunta em linguagem natural).

## APIM administration
Organizations, users, apps, credentials, lifecycle (\`axway_apim_proxy_update\` + \`lifecycle=publish|unpublish|deprecate\`), OpenAPI import (\`axway_apim_backend_submit\`).

## Policy Studio / develop policies
If the user asks to create or change Gateway policies, filters, listeners, Portal Alerts, Auth Profiles, YAML/XML fragments, OAuth/KPS in Policy Studio:
1. Attach \`axway://apim/playbook/policy-development\` (skill \`apim-policy-development\`).
2. Use RAG markdown under docs/rag or \`axway://apim/docs/policydev/{slug}\` — do not invent filter semantics.
3. Prefer API Management **Read *** for local registry lookups; REST ConnectToURL for mutations.
4. After editing fragments — decision tree (do not invent fragmentPath):
   - Policy already in MCP container: call \`axway_apim_fragment_packages_list\` -> \`axway_apim_fragment_validate\` with returned \`fragmentPath\` (package ROOT under \`policies/\`).
   - Policy only on agent/client workspace: call \`axway_apim_fragment_validate_submit\` (no image rebuild):
     - Prefer \`files\`: map \`relativePath -> base64\` when the agent has individual YAML/XML files.
     - Or \`archiveBase64\`: when the user has a .tar.gz archive.
     - Optional \`packageLabel\` for sandbox identifier/logs (e.g. \`example-policy-package\`).
   - Tier 0 (offline): static YAML/XML checks; Tier 1 (Axway libs): yamles/import dry-run with resolved \`gatewayHome\`. Tools: \`axway_apim_fragment_yaml_to_xml\`, \`axway_apim_fragment_sync_ps_project\`, \`axway_apim_fragment_gateway_resolve\`. Resource: \`axway://apim/policies/packages\`.
5. Optional prompt: \`axway_apim_policy_develop\`.

## Rules
- Em Kubernetes/Docker, \`instanceId\` muda após restart — chame \`axway_apim_topology_list\` antes de métricas/FED.
- Prefira encadear tools MCP; use o resource playbook para passos pós-FED.
- Prompt \`axway_apim_gateway_diagnose\` para playbook de saúde expandido.
`;

export const ANALYZE_API_ROOTCAUSE_PROMPT = `Axway APIM root-cause analysis — MCP tools for live + FED; calling agent handles extract/decompile:

NOTE: A natural-language ask ("help me understand API X error Y; gateway libs at <path>") is equivalent to this prompt. Use the path as gatewayPath without asking the user to restate it.

## Phase A — Live evidence (MCP tools)
1. axway_apim_topology_list — productVersion, instanceId
2. axway_apim_proxy_list / axway_apim_proxy_get — security profile, invoke policy, routing destinationURL
3. If failing traffic exists: axway_apim_traffic_search → axway_apim_trafficevent_get → axway_apim_traffictrace_get (destinationURL, params.query, http.request.uri)

## Phase B — FED via ANM (MCP tool — mandatory, no manual upload)
4. axway_apim_topology_list → instanceId (= serviceID per Axway Deployment API swagger)
5. axway_apim_deployment_archive_get — tries GET /deployment/archive/service/{serviceID}; on EMT/405 falls back to GET /router/service/{instance}/api/configuration/archive
6. Decode dataBase64 to .fed (ZIP) or use savedPath from MCP host
7. **Calling agent** (not MCP): unzip / extract-fed → grep PrimaryStore.xml, EnvSettingsStore.xml (system properties), policies from proxy_get

## Phase C — Gateway bytecode (calling agent)
8. JARs from gatewayPath below (prefer {gatewayPath}/system/lib) — must match topology productVersion
9. find-in-jars + CFR decompile only relevant classes (ConnectToURLProcessor, Broker, ApiSystemProperty)
10. Diff OK vs broken version when available

## Phase D — Deliver
11. Root cause in one paragraph; cite class/method or FED policy
12. Workarounds: system property → routing template (\${http.raw.querystring}) → Change Message
13. Suggested validation APIs

Playbook resource: axway://apim/playbook/gateway-code-analysis
Skill: apim-gateway-code-analysis

API path or name: {{apiPath}}
Symptom: {{symptom}}
Gateway instanceId (optional; from topology_list): {{instanceId}}
Gateway binary path for agent-side decompile (if known): {{gatewayPath}}
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

export const POLICY_DEVELOP_PROMPT = `Axway Policy Studio development — use skill apim-policy-development + RAG docs (not guesswork):

## Phase A — Scope
1. Restate the policy goal: Send (Portal Alert), Receive (HTTP listener), local APIM Read, routing, OAuth/KPS, or fragment import.
2. Attach resource axway://apim/playbook/policy-development
3. Open matching RAG pages via axway://apim/docs/policydev/{slug} or .cursor/skills/apim-policy-development/docs/rag/_manifest.md

## Phase B — Design
4. Prefer API Management Read * filters for local Client Registry reads (Read Organization supports selects Name|ID).
5. Use ConnectToURL / Call Local APIM only for Portal REST mutations or remote Gateway calls.
6. Sketch filter chain (start → success/failure paths).

## Phase C — Author + validate
7. Produce YAML fragment (and XML via Federated re-export if target project is XML FED).
8. Omit encrypted passwords from fragments; document post-import Auth Profile setup.
9. Validate via MCP: \`axway_apim_fragment_validate\` (Tier 0 offline com Python 3; Tier 1 yamles + import dry-run quando gatewayHome resolvido — ver \`axway_apim_fragment_gateway_resolve\`). YAML→XML: \`axway_apim_fragment_yaml_to_xml\` (Tier 1, exige mapeamento productVersion→gatewayHome). Sync ps-project: \`axway_apim_fragment_sync_ps_project\` (Tier 0).

## Phase D — Deliver
10. Files + import steps (Policy Studio File → Import → Configuration Fragment)
11. Cite Axway doc source URLs from RAG frontmatter

Goal / topic from user: {{goal}}
Target format (yaml|xml|both): {{format}}
`;
