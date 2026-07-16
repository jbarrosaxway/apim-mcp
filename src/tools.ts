/**
 * DEFINIÇÃO DAS TOOLS MCP PARA AXWAY APIM
 * Naming: axway_apim_<resource>_<action> (segmento de produto provisório \`apim\`).
 */

import { z } from "zod";

const tool0 = {
  method: "axway_apim_time_get",
  description: "Returns the current wall-clock time and configured timezone of this MCP process so agents can align event search windows with gateway clocks. No Axway credentials or instanceId are required; call anytime before traffic searches when the user asks about time ranges. Takes no parameters. Read-only; does not call Axway APIs or mutate state. Fails only if the Node process clock is unavailable (rare); returns a structured JSON error string. Safe to retry immediately; not dependent on Gateway availability. Prefer axway_apim_traffic_search for historical events; this tool only anchors absolute time. JSON with ISO timestamp and timezone name.",
  parameters: z.object({}).shape,
};

const tool1 = {
  method: "axway_apim_config_get",
  description: "Reads API Manager portal configuration such as policies, security defaults, and platform limits for APIM administration context. Requires Manager connectivity via AXWAY_MANAGER_* credentials; not a substitute for Gateway runtime health checks. Takes no parameters. Read-only Manager GET; no configuration changes. 401/403 if Manager credentials are wrong; 5xx on Manager outage; TLS errors if AXWAY_TLS_* blocks the cert. Retry with exponential backoff on 5xx or network timeouts; fix credentials on 401/403 without blind retry loops. For live Gateway health use axway_apim_topology_list first; for published APIs use axway_apim_proxy_list or axway_apim_catalog_get. JSON Manager config object.",
  parameters: z.object({}).shape,
};

const tool2 = {
  method: "axway_apim_topology_list",
  description: "Lists Axway API Gateway (ANM) topology: groups, instances, product version, and current instanceId values needed for every traffic or metrics call. Always call this first in Kubernetes/Docker because instanceId changes after pod restart; Manager-only questions can skip it. Takes no parameters. Read-only Gateway topology query; no mutations. 401/403 on bad Gateway credentials; empty topology if ANM unreachable; TLS handshake failures when verify is on. Retry with backoff on 5xx/timeouts; on empty results re-check AXWAY_GATEWAY_URL before repeating. Then call axway_apim_instancetraffic_get / axway_apim_metrics_get / axway_apim_traffic_search with the returned instanceId. Not a substitute for axway_apim_proxy_list. JSON topology with groups and instances including instanceId.",
  parameters: z.object({}).shape,
};

const tool3 = {
  method: "axway_apim_instancetraffic_get",
  description: "Returns aggregate traffic counters (successes, failures, volume) for one Gateway instance to support health and incident triage. Obtain a fresh instanceId from axway_apim_topology_list immediately before calling; stale IDs fail or return empty data in containers. instanceId (string, required): Gateway instance identifier from topology, example instance-1. Read-only metrics snapshot; does not alter traffic or configuration. 404/empty if instanceId expired; 401/403 auth; 5xx Gateway overload. On empty or 404 refresh topology then retry once; exponential backoff on 5xx. Use axway_apim_metrics_get for time series; axway_apim_servicetraffic_get for one service; axway_apim_traffic_search for individual transactions. JSON traffic summary for the instance.",
  parameters: z.object({
    instanceId: z.string().describe("Gateway instance ID from axway_apim_topology_list (e.g. 'instance-1'). Must be refreshed after pod restarts.")
  }).shape,
};

const tool4 = {
  method: "axway_apim_servicetraffic_get",
  description: "Fetches traffic metrics for a named service inside a Gateway instance when diagnosing a single virtualized service rather than the whole node. Call axway_apim_topology_list for a current instanceId; know the service display name such as Default Services. instanceId (string, required); serviceName (string, required) example Default Services. Read-only; no service reconfiguration. 404 if serviceName unknown on that instance; stale instanceId; 5xx Gateway errors. Refresh topology on instance errors; backoff on 5xx; do not retry endlessly on unknown serviceName. Prefer axway_apim_instancetraffic_get for whole-instance health; axway_apim_traffic_search for HTTP status forensics. JSON per-service traffic counters.",
  parameters: z.object({
    instanceId: z.string().describe("Gateway instance ID from axway_apim_topology_list."),
    serviceName: z.string().describe("Service display name on that instance, e.g. 'Default Services'.")
  }).shape,
};

const tool5 = {
  method: "axway_apim_metrics_get",
  description: "Retrieves a time-series metrics timeline (successes, failures, latency-related series) for one Gateway instance over a relative window. Fresh instanceId from axway_apim_topology_list; choose timeline like 10m or 1h matching the user symptom window. instanceId (string); timeline (string, e.g. 10m, 1h); metricTypes (string array, e.g. successes, failures). Read-only analytics; no alert or quota changes. Invalid timeline format; stale instanceId; 5xx from metrics backend. Backoff on 5xx; refresh topology then retry on empty; fix metricTypes enum values instead of retrying unknown types. axway_apim_instancetraffic_get is a single snapshot; axway_apim_traffic_search lists concrete HTTP transactions for the same window. JSON timeline points per requested metric type.",
  parameters: z.object({
    instanceId: z.string().describe("Gateway instance ID from axway_apim_topology_list."),
    timeline: z.string().describe("Relative window such as '10m' or '1h'."),
    metricTypes: z.array(z.string()).describe("Metric names to fetch, e.g. ['successes','failures'].")
  }).shape,
};

const tool6 = {
  method: "axway_apim_traffic_search",
  description: "Searches Gateway HTTP traffic events/transactions in a relative time window, optionally filtering by protocol, status, remote address, or other fields for incident diagnosis. Call axway_apim_topology_list for instanceId; for 5xx set searchField=status and searchValue=5 (prefix match). instanceId; ago (e.g. 1h, 24h); optional count, protocol, searchField, searchValue. Read-only event query; does not replay or delete transactions. Empty results if window has no matches; stale instanceId; 5xx search service errors. Widen ago or clear filters before retry; backoff on 5xx; refresh topology on instance errors. Then axway_apim_trafficevent_get for one correlationId; axway_apim_trafficpayload_get / axway_apim_traffictrace_get for body/trace. Not for Manager catalog. JSON list of traffic events with correlationId and status.",
  parameters: z.object({
    instanceId: z.string().describe("Gateway instance ID from axway_apim_topology_list."),
    ago: z.string().describe("Relative lookback window, e.g. '1h', '24h', '10m'."),
    count: z.number().optional().describe("Max events to return; default 100."),
    protocol: z.string().optional().describe("Protocol filter such as 'http' or 'https'."),
    searchField: z.string().optional().describe("Field to filter, e.g. 'status', 'leg', 'remoteAddr'."),
    searchValue: z.string().optional().describe("Value for searchField; for HTTP 5xx use searchField=status and searchValue=5.")
  }).shape,
};

const tool7 = {
  method: "axway_apim_trafficevent_get",
  description: "Loads detailed metadata for one Gateway traffic transaction identified by correlationId, including optional request/response headers for troubleshooting. Obtain correlationId from axway_apim_traffic_search and a fresh instanceId from topology; protocol and leg usually http and 0. instanceId, correlationId, protocol, leg; optional includeDetails, includeRequestHeaders, includeResponseHeaders booleans. Read-only detail fetch; does not mutate the transaction. 404 if correlationId expired/not found; stale instanceId; 5xx Gateway. Re-search events if 404; backoff on 5xx; do not retry with wrong leg/protocol forever. Use axway_apim_trafficpayload_get for bodies and axway_apim_traffictrace_get for step traces; search first to discover IDs. JSON transaction detail object.",
  parameters: z.object({
    instanceId: z.string().describe("Gateway instance ID from axway_apim_topology_list."),
    correlationId: z.string().describe("Transaction correlation ID from axway_apim_traffic_search."),
    protocol: z.string().describe("Transaction protocol, typically 'http'."),
    leg: z.number().describe("Transaction leg index; usually 0."),
    includeDetails: z.boolean().optional().describe("Include extended details; default true."),
    includeRequestHeaders: z.boolean().optional().describe("Include request headers; default true."),
    includeResponseHeaders: z.boolean().optional().describe("Include response headers; default true.")
  }).shape,
};

const tool8 = {
  method: "axway_apim_trafficpayload_get",
  description: "Retrieves the HTTP payload body for a traffic event in the received or sent direction to inspect request/response content during failures. Requires correlationId from search/detail and current instanceId; payloads may be truncated or unavailable depending on Gateway capture settings. instanceId, correlationId, leg, direction enum received|sent. Read-only; may return sensitive data present in captured payloads — treat as confidential. 404 if payload not stored; 403 if policy blocks; 5xx Gateway. Backoff on 5xx; if 404 switch direction or confirm capture is enabled rather than endless retry. axway_apim_trafficevent_get for headers/metadata; axway_apim_traffictrace_get for processing steps without full body. JSON or text payload content for the chosen direction.",
  parameters: z.object({
    instanceId: z.string().describe("Gateway instance ID from axway_apim_topology_list."),
    correlationId: z.string().describe("Transaction correlation ID."),
    leg: z.number().describe("Transaction leg index; usually 0."),
    direction: z.enum(["received", "sent"]).describe("Payload direction: 'received' from client, 'sent' to client.")
  }).shape,
};

const tool9 = {
  method: "axway_apim_traffictrace_get",
  description: "Fetches the detailed processing trace/log for a Gateway transaction to see policy steps, faults, and optional sent/received data slices. correlationId from axway_apim_traffic_search; fresh instanceId; enable includeSentData/includeReceivedData only when needed (larger responses). instanceId, correlationId; optional includeSentData, includeReceivedData booleans default false. Read-only diagnostic; may include sensitive fragments if include flags are true. 404 missing transaction; stale instanceId; 5xx. Refresh topology then retry once on instance errors; backoff on 5xx. Complement axway_apim_trafficevent_get and axway_apim_trafficpayload_get; do not use for Manager API CRUD. JSON trace structure for the correlationId.",
  parameters: z.object({
    instanceId: z.string().describe("Gateway instance ID from axway_apim_topology_list."),
    correlationId: z.string().describe("Transaction correlation ID."),
    includeSentData: z.boolean().optional().describe("Include sent data in the trace; default false."),
    includeReceivedData: z.boolean().optional().describe("Include received data in the trace; default false.")
  }).shape,
};

const tool10 = {
  method: "axway_apim_organization_list",
  description: "Lists all organizations registered in API Manager for subsequent user, application, and proxy ownership operations. Manager credentials must work; no Gateway instanceId needed. Takes no parameters. Read-only organization inventory. 401/403 Manager auth; 5xx Manager. Backoff on 5xx; fix credentials on 401/403. Use axway_apim_organization_get for one org; create/update/delete siblings mutate state. JSON array of organizations with ids.",
  parameters: z.object({}).shape,
};

const tool11 = {
  method: "axway_apim_organization_get",
  description: "Retrieves a single API Manager organization by id including contact and enabled flags for administration workflows. Discover id via axway_apim_organization_list first. id (string, required): organization UUID/id from list. Read-only. 404 unknown id; 401/403; 5xx. Do not retry 404; backoff on 5xx. list for discovery; update/delete for mutations. JSON organization object.",
  parameters: z.object({ id: z.string().describe("Organization id from axway_apim_organization_list.") }).shape,
};

const tool12 = {
  method: "axway_apim_organization_create",
  description: "Creates a new API Manager organization with name and optional contact fields, enabling multi-tenant APIM administration. Caller needs mcp:admin; choose a unique name; Manager must be reachable. name required; optional description, email, phone, enabled (default true). Persists a new organization in Manager; subsequent users/apps can reference its id. 409 duplicate name; 400 validation; 401/403; 5xx. Do not retry 409 without renaming; backoff on 5xx only. Prefer update to change fields; delete removes the org — irreversible for contained assets. JSON created organization including id.",
  parameters: z.object({
    name: z.string().describe("Unique organization display name."),
    description: z.string().optional().describe("Optional human-readable description."),
    email: z.string().email().optional().describe("Contact email for the organization."),
    phone: z.string().optional().describe("Contact phone number."),
    enabled: z.boolean().optional().describe("Whether the organization is enabled; default true.")
  }).shape,
};

const tool13 = {
  method: "axway_apim_organization_update",
  description: "Updates selected fields of an existing API Manager organization without recreating it. id from list/get; only send fields that should change. id required; optional name, description, email, phone, enabled. Mutates organization record in Manager; no Gateway restart. 404 missing id; 409 name conflict; 401/403; 5xx. Safe to retry identical updates (idempotent); backoff on 5xx. create for new orgs; delete to remove; get to verify. JSON updated organization.",
  parameters: z.object({
    id: z.string().describe("Organization id to update."),
    name: z.string().optional().describe("New organization name."),
    description: z.string().optional().describe("New description."),
    email: z.string().email().optional().describe("New contact email."),
    phone: z.string().optional().describe("New contact phone."),
    enabled: z.boolean().optional().describe("New enabled flag.")
  }).shape,
};

const tool14 = {
  method: "axway_apim_organization_delete",
  description: "Permanently deletes an API Manager organization by id. Destructive and may fail if dependent users, apps, or APIs still exist. Confirm no critical dependents remain; id from list/get; requires mcp:admin. id (string, required). Removes the organization; dependent objects may block deletion or become orphaned depending on Manager rules. 409 dependency conflict; 404; 401/403; 5xx. Idempotent on already-deleted (404); resolve dependencies before retrying 409; backoff on 5xx. Prefer update enabled=false to soft-disable when deletion is too risky. JSON confirmation of deletion.",
  parameters: z.object({ id: z.string().describe("Organization id to delete permanently.") }).shape,
};

const tool15 = {
  method: "axway_apim_user_list",
  description: "Lists API Manager users for identity administration and to discover user ids before get/update/delete. Manager auth required; no Gateway topology needed. None. Read-only. 401/403; 5xx. Backoff on 5xx. axway_apim_user_get for detail; create/update/delete for mutations. JSON user array. Follow Axway MCP recoverability guidance: surface HTTP status codes to the agent, avoid silent retries on 4xx validation failures, and prefer exponential backoff for transient 5xx or network timeouts.",
  parameters: z.object({}).shape,
};

const tool16 = {
  method: "axway_apim_user_get",
  description: "Fetches one API Manager user by id including role, organization, and contact attributes. id from axway_apim_user_list. id required. Read-only. 404; 401/403; 5xx. No retry on 404; backoff on 5xx. list for discovery; update/delete for changes. JSON user object. Follow Axway MCP recoverability guidance: surface HTTP status codes to the agent, avoid silent retries on 4xx validation failures, and prefer exponential backoff for transient 5xx or network timeouts.",
  parameters: z.object({ id: z.string().describe("User id from axway_apim_user_list.") }).shape,
};

const tool17 = {
  method: "axway_apim_user_create",
  description: "Creates an API Manager user bound to an organization with loginName, display name, and role user|admin. organizationId from axway_apim_organization_list; unique loginName; mcp:admin. organizationId, name, loginName, role enum; optional email, phone. Persists a new user account in Manager. 409 duplicate login; 400 validation; 404 bad organizationId; 401/403; 5xx. Do not retry 409 without new loginName; backoff on 5xx. update to change attributes; delete to remove. JSON created user with id.",
  parameters: z.object({
    organizationId: z.string().describe("Owning organization id from axway_apim_organization_list."),
    name: z.string().describe("Full display name."),
    loginName: z.string().describe("Unique login name for Manager."),
    role: z.enum(['user','admin']).describe("Manager role: 'user' or 'admin'."),
    email: z.string().email().optional().describe("User email."),
    phone: z.string().optional().describe("User phone.")
  }).shape,
};

const tool18 = {
  method: "axway_apim_user_update",
  description: "Updates fields on an existing API Manager user such as role, enabled flag, organization, or contact data. id from list/get; send only fields to change. id; optional name, loginName, email, phone, role, enabled, organizationId. Mutates user record; may change access immediately. 404; 409 login conflict; 401/403; 5xx. Idempotent for identical payloads; backoff on 5xx. create for new users; delete to remove. JSON updated user.",
  parameters: z.object({
    id: z.string().describe("User id to update."),
    name: z.string().optional().describe("New display name."),
    loginName: z.string().optional().describe("New login name."),
    email: z.string().email().optional().describe("New email."),
    phone: z.string().optional().describe("New phone."),
    role: z.enum(['user','admin']).optional().describe("New role."),
    enabled: z.boolean().optional().describe("Enabled flag."),
    organizationId: z.string().optional().describe("Move user to this organization id.")
  }).shape,
};

const tool19 = {
  method: "axway_apim_user_delete",
  description: "Deletes an API Manager user by id. Destructive; the login can no longer authenticate to Manager. Confirm the user is disposable; mcp:admin. id required. Removes the user account permanently. 404; 409 if constrained; 401/403; 5xx. Idempotent on 404; backoff on 5xx. Prefer update enabled=false to disable without deletion when possible. JSON deletion confirmation.",
  parameters: z.object({ id: z.string().describe("User id to delete.") }).shape,
};

const tool20 = {
  method: "axway_apim_application_list",
  description: "Lists applications visible to the Manager credentials, used to discover application ids for credentials, access, and quotas. Manager auth; no Gateway topology. None. Read-only. 401/403; 5xx. Backoff on 5xx. axway_apim_application_get for one app; credential tools for secrets. JSON applications array.",
  parameters: z.object({}).shape,
};

const tool21 = {
  method: "axway_apim_application_get",
  description: "Gets one application by id with metadata needed before granting API access or inspecting quotas. id from axway_apim_application_list. id required. Read-only; does not return API key secrets by itself. 404; 401/403; 5xx. No retry on 404; backoff on 5xx. Use axway_apim_apikey_get / axway_apim_oauth_get for credentials; axway_apim_access_list for granted APIs. JSON application object.",
  parameters: z.object({ id: z.string().describe("Application id from axway_apim_application_list.") }).shape,
};

const tool22 = {
  method: "axway_apim_permission_get",
  description: "Reads the ACL/permissions associated with an application to understand who can manage it in API Manager. Application id from list/get. id required (application id). Read-only ACL view. 404; 401/403; 5xx. Backoff on 5xx. Not the same as axway_apim_access_list which lists frontend API grants for consumption. JSON permissions/ACL structure.",
  parameters: z.object({ id: z.string().describe("Application id whose ACL to read.") }).shape,
};

const tool23 = {
  method: "axway_apim_apikey_get",
  description: "Lists API keys for an application. Use the apiKey field for client calls; do not confuse with secret. mcp:admin; application id from list; treat returned secrets as confidential. id required (application id). Read-only credential disclosure — high sensitivity. 404; 401/403; 5xx. Backoff on 5xx; do not spam retries (secret exposure). axway_apim_apikey_create to mint keys; oauth siblings for OAuth clients. JSON API key list; authenticate with apiKey header value.",
  parameters: z.object({ id: z.string().describe("Application id whose API keys to list.") }).shape,
};

const tool24 = {
  method: "axway_apim_apikey_create",
  description: "Creates a new API key for an application, optionally supplying a secret and enabled flag. mcp:admin; appId from application list; store returned key securely. appId required; optional secret, enabled default true. Persists a new credential; clients can call APIs with the new key immediately after grants. 404 bad appId; 400 validation; 401/403; 5xx. Backoff on 5xx; avoid duplicate creates that multiply unused keys. apikey_get to list; oauth_create for OAuth instead of API keys. JSON created API key including apiKey value.",
  parameters: z.object({
    appId: z.string().describe("Application id that will own the new API key."),
    secret: z.string().optional().describe("Optional secret; generated if omitted."),
    enabled: z.boolean().optional().describe("Whether the key is enabled; default true.")
  }).shape,
};

const tool25 = {
  method: "axway_apim_oauth_get",
  description: "Lists OAuth client credentials for an application for confidential inspection and troubleshooting of OAuth-protected APIs. mcp:admin; application id; handle secrets carefully. id application id. Read-only secret disclosure. 404; 401/403; 5xx. Backoff on 5xx. oauth_create to mint; apikey_* for API key auth style. JSON OAuth credential list.",
  parameters: z.object({ id: z.string().describe("Application id whose OAuth credentials to list.") }).shape,
};

const tool26 = {
  method: "axway_apim_oauth_create",
  description: "Creates an OAuth client credential for an application with optional redirect URIs and public certificate PEM. mcp:admin; appId known; redirect URIs comma-separated when needed. appId; optional redirectURIs, cert PEM. Persists OAuth client; may enable token flows for the app. 400 invalid cert/URIs; 404; 401/403; 5xx. Backoff on 5xx; fix validation errors before retry. oauth_get to list; apikey_create for API keys instead. JSON created OAuth client including client id/secret fields as returned by Manager.",
  parameters: z.object({
    appId: z.string().describe("Application id for the new OAuth client."),
    cert: z.string().optional().describe("Optional public certificate PEM bound to the client."),
    redirectURIs: z.string().optional().describe("Comma-separated redirect URIs.")
  }).shape,
};

const tool27 = {
  method: "axway_apim_proxy_list",
  description: "Lists all frontend API proxies in API Manager across lifecycle states (published, unpublished, end-of-life) for inventory and ops. Manager auth; for Gateway runtime issues still start with topology/traffic tools. None. Read-only inventory of proxies. 401/403; 5xx. Backoff on 5xx. axway_apim_catalog_get focuses on consumer-facing published APIs; use proxy_get for one proxy; proxy_update for fields or lifecycle. JSON proxy list with id, path, state.",
  parameters: z.object({}).shape,
};

const tool28 = {
  method: "axway_apim_proxy_get",
  description: "Gets troubleshooting-oriented details for one frontend proxy including security profiles and authenticationInfo.fieldName for correct client headers. id from proxy_list or catalog_get. id required. Read-only. 404; 401/403; 5xx. Backoff on 5xx; no retry on 404. proxyauth_get specializes in auth header examples; catalog_get is published inventory only. JSON simplified proxy with authenticationInfo.",
  parameters: z.object({ id: z.string().describe("Frontend proxy id from axway_apim_proxy_list.") }).shape,
};

const tool29 = {
  method: "axway_apim_proxyauth_get",
  description: "Returns authentication helper info for a proxy (header name, auth type, curl example) so agents construct correct client calls. Proxy id known; complements proxy_get when only auth wiring is needed. id required. Read-only; does not create keys. 404; 401/403; 5xx. Backoff on 5xx. Use apikey_get/oauth_get to obtain actual credentials; proxy_get for full config. JSON auth helper with fieldName and curlExample.",
  parameters: z.object({ id: z.string().describe("Frontend proxy id.") }).shape,
};

const tool30 = {
  method: "axway_apim_catalog_get",
  description: "Returns the consumer-oriented API catalog view emphasizing published frontend APIs available for discovery after Gateway health is confirmed. Manager auth; prefer after traffic diagnosis when asking which APIs are exposed to consumers. None. Read-only catalog projection (published-focused sibling of proxy_list). 401/403; 5xx. Backoff on 5xx. Use axway_apim_proxy_list when you need unpublished or end-of-life proxies or full admin inventory; proxy_get for one API detail. JSON catalog/proxy entries suitable for consumer discovery.",
  parameters: z.object({}).shape,
};

const tool31 = {
  method: "axway_apim_proxy_create",
  description: "Creates a frontend API proxy bound to a backend apiId and organization, with path and optional vhost/version/description. backend id from axway_apim_backend_list; organizationId from organization_list; path unique; mcp:admin. name, path, apiId, organizationId; optional vhost, version, description. Persists a new proxy typically unpublished until lifecycle publish via proxy_update. 409 path conflict; 404 bad apiId/org; 400; 401/403; 5xx. Fix conflicts before retry; backoff on 5xx. proxy_update for fields/lifecycle; proxy_delete to remove; backend_submit to import OpenAPI first. JSON created proxy with id.",
  parameters: z.object({
    name: z.string().describe("Display name for the frontend proxy."),
    path: z.string().describe("Public path, e.g. '/my-api/v1'."),
    apiId: z.string().describe("Backend API id from axway_apim_backend_list."),
    organizationId: z.string().describe("Owning organization id."),
    vhost: z.string().optional().describe("Optional virtual host binding."),
    version: z.string().optional().describe("Optional proxy version label."),
    description: z.string().optional().describe("Optional description.")
  }).shape,
};

const tool32 = {
  method: "axway_apim_proxy_update",
  description: "Updates frontend proxy fields and/or lifecycle state. Set lifecycle to publish, unpublish, or deprecate to change availability without inventing non-canonical verbs; omit lifecycle to patch name/path/apiId only. id from proxy_list; mcp:operator for lifecycle, mcp:admin recommended for structural field changes; confirm blast radius before publish/unpublish. id required; optional name, path, apiId, organizationId, vhost, version, description; optional lifecycle enum publish|unpublish|deprecate. Mutates Manager proxy configuration and may immediately change consumer availability when lifecycle is set. 404; 409 conflicts; 400 invalid lifecycle; 401/403; 5xx. Idempotent for identical field/lifecycle updates; backoff on 5xx; do not flip lifecycle repeatedly on transient errors. proxy_create for new proxies; proxy_delete to remove; catalog_get/proxy_list to verify state afterwards. JSON updated proxy or lifecycle operation result.",
  parameters: z.object({
    id: z.string().describe("Frontend proxy id to update."),
    name: z.string().optional().describe("New proxy name."),
    path: z.string().optional().describe("New public path."),
    apiId: z.string().optional().describe("New backend API id."),
    organizationId: z.string().optional().describe("New owning organization id."),
    vhost: z.string().optional().describe("New virtual host."),
    version: z.string().optional().describe("New version label."),
    description: z.string().optional().describe("New description."),
    lifecycle: z.enum(['publish','unpublish','deprecate']).optional().describe("Lifecycle action: publish (make available), unpublish (withdraw), or deprecate. Omit to only patch fields.")
  }).shape,
};

const tool33 = {
  method: "axway_apim_proxy_delete",
  description: "Permanently deletes a frontend API proxy by id. Destructive; consumers lose that path. Unpublish first if required by policy; mcp:admin; confirm id. id required. Removes the proxy definition from Manager. 409 if state blocks delete; 404; 401/403; 5xx. Idempotent on 404; resolve state then retry 409; backoff on 5xx. Prefer lifecycle unpublish via proxy_update when soft withdrawal is enough. JSON deletion confirmation.",
  parameters: z.object({ id: z.string().describe("Frontend proxy id to delete.") }).shape,
};

const tool34 = {
  method: "axway_apim_backend_list",
  description: "Lists backend APIs in the Manager repository so agents can pick apiId when creating frontend proxies. Manager auth. None. Read-only repository listing. 401/403; 5xx. Backoff on 5xx. backend_submit to import OpenAPI; backend_delete to remove; proxy_create consumes apiId. JSON backend API list with ids.",
  parameters: z.object({}).shape,
};

const tool35 = {
  method: "axway_apim_backend_submit",
  description: "Imports a backend API definition into the Manager repository from a remote OpenAPI/Swagger URL or a local file path previously uploaded to the MCP host. organizationId known; for file source run axway_apim_file_submit first if needed; mcp:admin; URL must be reachable from the MCP pod/host. source enum url|file; organizationId; for url provide url; for file provide filePath; optional name. Creates a backend API resource in Manager; does not publish a frontend proxy by itself. 400 bad OpenAPI; 404 file missing; network errors fetching url; 401/403; 5xx. Backoff on 5xx/network; fix OpenAPI/validation before retry; do not duplicate imports blindly. file_submit uploads bytes; backend_list to verify; proxy_create to expose; backend_delete to remove. JSON imported backend API including id.",
  parameters: z.object({
    source: z.enum(['url','file']).describe("Import source: 'url' fetches OpenAPI remotely; 'file' reads a path on the MCP host."),
    organizationId: z.string().describe("Organization that will own the backend API."),
    url: z.string().url().optional().describe("OpenAPI/Swagger URL when source=url."),
    filePath: z.string().optional().describe("Local path on MCP host when source=file (e.g. /tmp/swagger.json)."),
    name: z.string().optional().describe("Optional custom backend API name.")
  }).shape,
};

const tool36 = {
  method: "axway_apim_file_submit",
  description: "Stages a local OpenAPI/Swagger file path available to the MCP process (container filesystem) and returns the saved path for axway_apim_backend_submit with source=file. File must already exist on the MCP host path; mcp:admin; not a remote HTTP upload from the chat client unless previously copied. filePath required — absolute/relative path inside the MCP runtime filesystem. May copy/normalize the file into an import staging location; does not import into Manager until backend_submit. 404 path missing; 400 invalid file; 401/403; IO errors. Fix path before retry; safe to retry identical staging. Follow with backend_submit source=file; prefer backend_submit source=url when the spec is remote. JSON with staged filePath to pass to backend_submit.",
  parameters: z.object({
    filePath: z.string().describe("Path to the file on the MCP host filesystem, e.g. /tmp/swagger.json.")
  }).shape,
};

const tool37 = {
  method: "axway_apim_backend_delete",
  description: "Deletes a backend API from the repository by id. Destructive; proxies referencing it may break. Ensure no required proxies depend on it; mcp:admin. id required. Removes backend definition from Manager. 409 dependents; 404; 401/403; 5xx. Idempotent on 404; resolve dependents for 409; backoff on 5xx. backend_list to find ids; proxy_delete/update first if needed. JSON deletion confirmation.",
  parameters: z.object({ id: z.string().describe("Backend API id to delete.") }).shape,
};

const tool38 = {
  method: "axway_apim_access_list",
  description: "Lists frontend APIs an application is granted to consume — application-to-proxy access grants, not Manager ACL permissions. applicationId from application_list. applicationId required. Read-only grant listing. 404; 401/403; 5xx. Backoff on 5xx. access_update to grant; access_delete to revoke; permission_get is Manager ACL, not API consumption grants. JSON list of granted frontend APIs.",
  parameters: z.object({ applicationId: z.string().describe("Application id from axway_apim_application_list.") }).shape,
};

const tool39 = {
  method: "axway_apim_access_update",
  description: "Grants an application access to a frontend API proxy so its credentials can call that API. applicationId and apiId (frontend proxy id) known; mcp:admin; proxy usually published. applicationId, apiId required. Creates/updates an access grant; enables consumption immediately when credentials exist. 404; 409 already granted; 401/403; 5xx. Idempotent if already granted; backoff on 5xx. access_delete to revoke; access_list to verify; proxy_update lifecycle publish if API not visible. JSON grant result.",
  parameters: z.object({
    applicationId: z.string().describe("Application id to grant."),
    apiId: z.string().describe("Frontend proxy id to grant access to.")
  }).shape,
};

const tool40 = {
  method: "axway_apim_access_delete",
  description: "Revokes an application access grant to a frontend API proxy. Destructive for that app-API relationship. applicationId and apiId known; mcp:admin. applicationId, apiId. Removes consumption rights; existing keys stop authorizing that API. 404 grant missing; 401/403; 5xx. Idempotent on missing grant; backoff on 5xx. access_update to re-grant; access_list to confirm. JSON revoke confirmation.",
  parameters: z.object({
    applicationId: z.string().describe("Application id to revoke."),
    apiId: z.string().describe("Frontend proxy id to revoke.")
  }).shape,
};

const tool41 = {
  method: "axway_apim_alert_list",
  description: "Lists Gateway alert TRIGGER configuration (which event types can raise alerts). Does not list historically fired incidents — use traffic/metrics tools for live errors. Gateway/Manager auth as implemented; do not treat empty fired-alert expectations as success of this tool. None. Read-only alert settings inventory. 401/403; 5xx. Backoff on 5xx. alert_update to change triggers; traffic_search/metrics_get for runtime failures. JSON alert trigger configuration map.",
  parameters: z.object({}).shape,
};

const tool42 = {
  method: "axway_apim_alert_update",
  description: "Updates alert trigger enablement flags. Provide a settings object mapping alert event names to booleans for only the keys you want to change. mcp:operator; know valid alert event names from alert_list; avoid disabling critical ops alerts without approval. settings object required (alertName → boolean). Mutates which events can raise alerts; does not clear past incidents. 400 unknown keys; 401/403; 5xx. Idempotent for same settings; backoff on 5xx. alert_list to inspect current triggers; traffic tools for live errors. JSON updated settings confirmation.",
  parameters: z.object({
    settings: z.record(z.boolean()).describe("Map of alert event name to enabled boolean; include only keys to change.")
  }).shape,
};

const tool43 = {
  method: "axway_apim_quota_get",
  description: "Reads the effective quota (system or application-specific) for an application, typically messages-per-second style limits. applicationId from application_list. applicationId required. Read-only. 404; 401/403; 5xx. Backoff on 5xx. quota_update to change limits; application_get for app metadata. JSON quota object. Follow Axway MCP recoverability guidance: surface HTTP status codes to the agent, avoid silent retries on 4xx validation failures, and prefer exponential backoff for transient 5xx or network timeouts.",
  parameters: z.object({ applicationId: z.string().describe("Application id whose quotas to read.") }).shape,
};

const tool44 = {
  method: "axway_apim_quota_update",
  description: "Sets application-specific maximum messages (requests) per second quota for rate limiting in API Manager. mcp:operator; applicationId known; choose a safe messages_per_second integer. applicationId; messages_per_second int. Mutates rate limits; may throttle clients immediately. 400 invalid number; 404; 401/403; 5xx. Idempotent for same value; backoff on 5xx. quota_get to verify; alert_update is unrelated trigger config. JSON updated quota.",
  parameters: z.object({
    applicationId: z.string().describe("Application id to update."),
    messages_per_second: z.number().int().positive().describe("Max messages/requests per second.")
  }).shape,
};

export function tools() {
  return [
    tool0,
    tool1,
    tool2,
    tool3,
    tool4,
    tool5,
    tool6,
    tool7,
    tool8,
    tool9,
    tool10,
    tool11,
    tool12,
    tool13,
    tool14,
    tool15,
    tool16,
    tool17,
    tool18,
    tool19,
    tool20,
    tool21,
    tool22,
    tool23,
    tool24,
    tool25,
    tool26,
    tool27,
    tool28,
    tool29,
    tool30,
    tool31,
    tool32,
    tool33,
    tool34,
    tool35,
    tool36,
    tool37,
    tool38,
    tool39,
    tool40,
    tool41,
    tool42,
    tool43,
    tool44,
  ];
}
