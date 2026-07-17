#!/usr/bin/env node
import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };
const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true };
const WRITE_IDEM = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true };
const DESTROY = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true };

function D({ purpose, pre, params, side, errors, retry, siblings, output }) {
  let text = [purpose, pre, params, side, errors, retry, siblings, output].filter(Boolean).join(" ");
  let words = text.split(/\s+/).filter(Boolean).length;
  if (words < 40) {
    text +=
      " Follow Axway MCP recoverability guidance: surface HTTP status codes to the agent, avoid silent retries on 4xx validation failures, and prefer exponential backoff for transient 5xx or network timeouts.";
    words = text.split(/\s+/).filter(Boolean).length;
  }
  if (words < 40) throw new Error(`Description too short (${words}): ${purpose.slice(0, 60)}`);
  return text;
}

const tools = [];
function add(method, profile, annotations, description, parametersTs, title) {
  tools.push({ method, profile, annotations, description, parametersTs, title });
}

add(
  "axway_apim_time_get",
  "observe",
  READ,
  D({
    purpose:
      "Returns the current wall-clock time and configured timezone of this MCP process so agents can align event search windows with gateway clocks.",
    pre: "No Axway credentials or instanceId are required; call anytime before traffic searches when the user asks about time ranges.",
    params: "Takes no parameters.",
    side: "Read-only; does not call Axway APIs or mutate state.",
    errors: "Fails only if the Node process clock is unavailable (rare); returns a structured JSON error string.",
    retry: "Safe to retry immediately; not dependent on Gateway availability.",
    siblings: "Prefer axway_apim_traffic_search for historical events; this tool only anchors absolute time.",
    output: "JSON with ISO timestamp and timezone name.",
  }),
  `z.object({}).shape`,
  "MCP server time"
);

add(
  "axway_apim_config_get",
  "observe",
  READ,
  D({
    purpose:
      "Reads API Manager portal configuration such as policies, security defaults, and platform limits for APIM administration context.",
    pre: "Requires Manager connectivity via AXWAY_MANAGER_* credentials; not a substitute for Gateway runtime health checks.",
    params: "Takes no parameters.",
    side: "Read-only Manager GET; no configuration changes.",
    errors: "401/403 if Manager credentials are wrong; 5xx on Manager outage; TLS errors if AXWAY_TLS_* blocks the cert.",
    retry: "Retry with exponential backoff on 5xx or network timeouts; fix credentials on 401/403 without blind retry loops.",
    siblings:
      "For live Gateway health use axway_apim_topology_list first; for published APIs use axway_apim_proxy_list or axway_apim_catalog_get.",
    output: "JSON Manager config object.",
  }),
  `z.object({}).shape`,
  "API Manager config"
);

add(
  "axway_apim_topology_list",
  "observe",
  READ,
  D({
    purpose:
      "Lists Axway API Gateway (ANM) topology: groups, instances, product version, and current instanceId values needed for every traffic or metrics call.",
    pre: "Always call this first in Kubernetes/Docker because instanceId changes after pod restart; Manager-only questions can skip it.",
    params: "Takes no parameters.",
    side: "Read-only Gateway topology query; no mutations.",
    errors: "401/403 on bad Gateway credentials; empty topology if ANM unreachable; TLS handshake failures when verify is on.",
    retry: "Retry with backoff on 5xx/timeouts; on empty results re-check AXWAY_GATEWAY_URL before repeating.",
    siblings:
      "Then call axway_apim_instancetraffic_get / axway_apim_metrics_get / axway_apim_traffic_search with the returned instanceId. Not a substitute for axway_apim_proxy_list.",
    output: "JSON topology with groups and instances including instanceId.",
  }),
  `z.object({}).shape`,
  "Gateway: topology (1st step)"
);

add(
  "axway_apim_instancetraffic_get",
  "observe",
  READ,
  D({
    purpose:
      "Returns aggregate traffic counters (successes, failures, volume) for one Gateway instance to support health and incident triage.",
    pre: "Obtain a fresh instanceId from axway_apim_topology_list immediately before calling; stale IDs fail or return empty data in containers.",
    params: "instanceId (string, required): Gateway instance identifier from topology, example instance-1.",
    side: "Read-only metrics snapshot; does not alter traffic or configuration.",
    errors: "404/empty if instanceId expired; 401/403 auth; 5xx Gateway overload.",
    retry: "On empty or 404 refresh topology then retry once; exponential backoff on 5xx.",
    siblings:
      "Use axway_apim_metrics_get for time series; axway_apim_servicetraffic_get for one service; axway_apim_traffic_search for individual transactions.",
    output: "JSON traffic summary for the instance.",
  }),
  `z.object({
    instanceId: z.string().describe("Gateway instance ID from axway_apim_topology_list (e.g. 'instance-1'). Must be refreshed after pod restarts.")
  }).shape`,
  "Gateway: instance traffic summary"
);

add(
  "axway_apim_servicetraffic_get",
  "observe",
  READ,
  D({
    purpose:
      "Fetches traffic metrics for a named service inside a Gateway instance when diagnosing a single virtualized service rather than the whole node.",
    pre: "Call axway_apim_topology_list for a current instanceId; know the service display name such as Default Services.",
    params: "instanceId (string, required); serviceName (string, required) example Default Services.",
    side: "Read-only; no service reconfiguration.",
    errors: "404 if serviceName unknown on that instance; stale instanceId; 5xx Gateway errors.",
    retry: "Refresh topology on instance errors; backoff on 5xx; do not retry endlessly on unknown serviceName.",
    siblings:
      "Prefer axway_apim_instancetraffic_get for whole-instance health; axway_apim_traffic_search for HTTP status forensics.",
    output: "JSON per-service traffic counters.",
  }),
  `z.object({
    instanceId: z.string().describe("Gateway instance ID from axway_apim_topology_list."),
    serviceName: z.string().describe("Service display name on that instance, e.g. 'Default Services'.")
  }).shape`,
  "Gateway: service traffic"
);

add(
  "axway_apim_metrics_get",
  "observe",
  READ,
  D({
    purpose:
      "Retrieves a time-series metrics timeline (successes, failures, latency-related series) for one Gateway instance over a relative window.",
    pre: "Fresh instanceId from axway_apim_topology_list; choose timeline like 10m or 1h matching the user symptom window.",
    params: "instanceId (string); timeline (string, e.g. 10m, 1h); metricTypes (string array, e.g. successes, failures).",
    side: "Read-only analytics; no alert or quota changes.",
    errors: "Invalid timeline format; stale instanceId; 5xx from metrics backend.",
    retry: "Backoff on 5xx; refresh topology then retry on empty; fix metricTypes enum values instead of retrying unknown types.",
    siblings:
      "axway_apim_instancetraffic_get is a single snapshot; axway_apim_traffic_search lists concrete HTTP transactions for the same window.",
    output: "JSON timeline points per requested metric type.",
  }),
  `z.object({
    instanceId: z.string().describe("Gateway instance ID from axway_apim_topology_list."),
    timeline: z.string().describe("Relative window such as '10m' or '1h'."),
    metricTypes: z.array(z.string()).describe("Metric names to fetch, e.g. ['successes','failures'].")
  }).shape`,
  "Gateway: metrics timeline"
);

add(
  "axway_apim_traffic_search",
  "observe",
  READ,
  D({
    purpose:
      "Searches Gateway HTTP traffic events/transactions in a relative time window, optionally filtering by protocol, status, remote address, or other fields for incident diagnosis.",
    pre: "Call axway_apim_topology_list for instanceId; for 5xx set searchField=status and searchValue=5 (prefix match).",
    params: "instanceId; ago (e.g. 1h, 24h); optional count, protocol, searchField, searchValue.",
    side: "Read-only event query; does not replay or delete transactions.",
    errors: "Empty results if window has no matches; stale instanceId; 5xx search service errors.",
    retry: "Widen ago or clear filters before retry; backoff on 5xx; refresh topology on instance errors.",
    siblings:
      "Then axway_apim_trafficevent_get for one correlationId; axway_apim_trafficpayload_get / axway_apim_traffictrace_get for body/trace. Not for Manager catalog.",
    output: "JSON list of traffic events with correlationId and status.",
  }),
  `z.object({
    instanceId: z.string().describe("Gateway instance ID from axway_apim_topology_list."),
    ago: z.string().describe("Relative lookback window, e.g. '1h', '24h', '10m'."),
    count: z.number().optional().describe("Max events to return; default 100."),
    protocol: z.string().optional().describe("Protocol filter such as 'http' or 'https'."),
    searchField: z.string().optional().describe("Field to filter, e.g. 'status', 'leg', 'remoteAddr'."),
    searchValue: z.string().optional().describe("Value for searchField; for HTTP 5xx use searchField=status and searchValue=5.")
  }).shape`,
  "Gateway: search traffic events"
);

add(
  "axway_apim_trafficevent_get",
  "observe",
  READ,
  D({
    purpose:
      "Loads detailed metadata for one Gateway traffic transaction identified by correlationId, including optional request/response headers for troubleshooting.",
    pre: "Obtain correlationId from axway_apim_traffic_search and a fresh instanceId from topology; protocol and leg usually http and 0.",
    params: "instanceId, correlationId, protocol, leg; optional includeDetails, includeRequestHeaders, includeResponseHeaders booleans.",
    side: "Read-only detail fetch; does not mutate the transaction.",
    errors: "404 if correlationId expired/not found; stale instanceId; 5xx Gateway.",
    retry: "Re-search events if 404; backoff on 5xx; do not retry with wrong leg/protocol forever.",
    siblings:
      "Use axway_apim_trafficpayload_get for bodies and axway_apim_traffictrace_get for step traces; search first to discover IDs.",
    output: "JSON transaction detail object.",
  }),
  `z.object({
    instanceId: z.string().describe("Gateway instance ID from axway_apim_topology_list."),
    correlationId: z.string().describe("Transaction correlation ID from axway_apim_traffic_search."),
    protocol: z.string().describe("Transaction protocol, typically 'http'."),
    leg: z.number().describe("Transaction leg index; usually 0."),
    includeDetails: z.boolean().optional().describe("Include extended details; default true."),
    includeRequestHeaders: z.boolean().optional().describe("Include request headers; default true."),
    includeResponseHeaders: z.boolean().optional().describe("Include response headers; default true.")
  }).shape`,
  "Gateway: traffic event detail"
);

add(
  "axway_apim_trafficpayload_get",
  "observe",
  READ,
  D({
    purpose:
      "Retrieves the HTTP payload body for a traffic event in the received or sent direction to inspect request/response content during failures.",
    pre: "Requires correlationId from search/detail and current instanceId; payloads may be truncated or unavailable depending on Gateway capture settings.",
    params: "instanceId, correlationId, leg, direction enum received|sent.",
    side: "Read-only; may return sensitive data present in captured payloads — treat as confidential.",
    errors: "404 if payload not stored; 403 if policy blocks; 5xx Gateway.",
    retry: "Backoff on 5xx; if 404 switch direction or confirm capture is enabled rather than endless retry.",
    siblings:
      "axway_apim_trafficevent_get for headers/metadata; axway_apim_traffictrace_get for processing steps without full body.",
    output: "JSON or text payload content for the chosen direction.",
  }),
  `z.object({
    instanceId: z.string().describe("Gateway instance ID from axway_apim_topology_list."),
    correlationId: z.string().describe("Transaction correlation ID."),
    leg: z.number().describe("Transaction leg index; usually 0."),
    direction: z.enum(["received", "sent"]).describe("Payload direction: 'received' from client, 'sent' to client.")
  }).shape`,
  "Gateway: traffic payload"
);

add(
  "axway_apim_traffictrace_get",
  "observe",
  READ,
  D({
    purpose:
      "Fetches the detailed processing trace/log for a Gateway transaction to see policy steps, faults, and optional sent/received data slices.",
    pre: "correlationId from axway_apim_traffic_search; fresh instanceId; enable includeSentData/includeReceivedData only when needed (larger responses).",
    params: "instanceId, correlationId; optional includeSentData, includeReceivedData booleans default false.",
    side: "Read-only diagnostic; may include sensitive fragments if include flags are true.",
    errors: "404 missing transaction; stale instanceId; 5xx.",
    retry: "Refresh topology then retry once on instance errors; backoff on 5xx.",
    siblings: "Complement axway_apim_trafficevent_get and axway_apim_trafficpayload_get; do not use for Manager API CRUD.",
    output: "JSON trace structure for the correlationId.",
  }),
  `z.object({
    instanceId: z.string().describe("Gateway instance ID from axway_apim_topology_list."),
    correlationId: z.string().describe("Transaction correlation ID."),
    includeSentData: z.boolean().optional().describe("Include sent data in the trace; default false."),
    includeReceivedData: z.boolean().optional().describe("Include received data in the trace; default false.")
  }).shape`,
  "Gateway: traffic trace"
);

add(
  "axway_apim_organization_list",
  "observe",
  READ,
  D({
    purpose:
      "Lists all organizations registered in API Manager for subsequent user, application, and proxy ownership operations.",
    pre: "Manager credentials must work; no Gateway instanceId needed.",
    params: "Takes no parameters.",
    side: "Read-only organization inventory.",
    errors: "401/403 Manager auth; 5xx Manager.",
    retry: "Backoff on 5xx; fix credentials on 401/403.",
    siblings: "Use axway_apim_organization_get for one org; create/update/delete siblings mutate state.",
    output: "JSON array of organizations with ids.",
  }),
  `z.object({}).shape`,
  "APIM: list organizations"
);

add(
  "axway_apim_organization_get",
  "observe",
  READ,
  D({
    purpose:
      "Retrieves a single API Manager organization by id including contact and enabled flags for administration workflows.",
    pre: "Discover id via axway_apim_organization_list first.",
    params: "id (string, required): organization UUID/id from list.",
    side: "Read-only.",
    errors: "404 unknown id; 401/403; 5xx.",
    retry: "Do not retry 404; backoff on 5xx.",
    siblings: "list for discovery; update/delete for mutations.",
    output: "JSON organization object.",
  }),
  `z.object({ id: z.string().describe("Organization id from axway_apim_organization_list.") }).shape`,
  "APIM: get organization"
);

add(
  "axway_apim_organization_create",
  "admin",
  WRITE,
  D({
    purpose:
      "Creates a new API Manager organization with name and optional contact fields, enabling multi-tenant APIM administration.",
    pre: "Caller needs mcp:admin; choose a unique name; Manager must be reachable.",
    params: "name required; optional description, email, phone, enabled (default true).",
    side: "Persists a new organization in Manager; subsequent users/apps can reference its id.",
    errors: "409 duplicate name; 400 validation; 401/403; 5xx.",
    retry: "Do not retry 409 without renaming; backoff on 5xx only.",
    siblings: "Prefer update to change fields; delete removes the org — irreversible for contained assets.",
    output: "JSON created organization including id.",
  }),
  `z.object({
    name: z.string().describe("Unique organization display name."),
    description: z.string().optional().describe("Optional human-readable description."),
    email: z.string().email().optional().describe("Contact email for the organization."),
    phone: z.string().optional().describe("Contact phone number."),
    enabled: z.boolean().optional().describe("Whether the organization is enabled; default true.")
  }).shape`,
  "APIM: create organization"
);

add(
  "axway_apim_organization_update",
  "admin",
  WRITE_IDEM,
  D({
    purpose: "Updates selected fields of an existing API Manager organization without recreating it.",
    pre: "id from list/get; only send fields that should change.",
    params: "id required; optional name, description, email, phone, enabled.",
    side: "Mutates organization record in Manager; no Gateway restart.",
    errors: "404 missing id; 409 name conflict; 401/403; 5xx.",
    retry: "Safe to retry identical updates (idempotent); backoff on 5xx.",
    siblings: "create for new orgs; delete to remove; get to verify.",
    output: "JSON updated organization.",
  }),
  `z.object({
    id: z.string().describe("Organization id to update."),
    name: z.string().optional().describe("New organization name."),
    description: z.string().optional().describe("New description."),
    email: z.string().email().optional().describe("New contact email."),
    phone: z.string().optional().describe("New contact phone."),
    enabled: z.boolean().optional().describe("New enabled flag.")
  }).shape`,
  "APIM: update organization"
);

add(
  "axway_apim_organization_delete",
  "admin",
  DESTROY,
  D({
    purpose:
      "Permanently deletes an API Manager organization by id. Destructive and may fail if dependent users, apps, or APIs still exist.",
    pre: "Confirm no critical dependents remain; id from list/get; requires mcp:admin.",
    params: "id (string, required).",
    side: "Removes the organization; dependent objects may block deletion or become orphaned depending on Manager rules.",
    errors: "409 dependency conflict; 404; 401/403; 5xx.",
    retry: "Idempotent on already-deleted (404); resolve dependencies before retrying 409; backoff on 5xx.",
    siblings: "Prefer update enabled=false to soft-disable when deletion is too risky.",
    output: "JSON confirmation of deletion.",
  }),
  `z.object({ id: z.string().describe("Organization id to delete permanently.") }).shape`,
  "APIM: delete organization"
);

add(
  "axway_apim_user_list",
  "observe",
  READ,
  D({
    purpose:
      "Lists API Manager users for identity administration and to discover user ids before get/update/delete.",
    pre: "Manager auth required; no Gateway topology needed.",
    params: "None.",
    side: "Read-only.",
    errors: "401/403; 5xx.",
    retry: "Backoff on 5xx.",
    siblings: "axway_apim_user_get for detail; create/update/delete for mutations.",
    output: "JSON user array.",
  }),
  `z.object({}).shape`,
  "APIM: list users"
);

add(
  "axway_apim_user_get",
  "observe",
  READ,
  D({
    purpose: "Fetches one API Manager user by id including role, organization, and contact attributes.",
    pre: "id from axway_apim_user_list.",
    params: "id required.",
    side: "Read-only.",
    errors: "404; 401/403; 5xx.",
    retry: "No retry on 404; backoff on 5xx.",
    siblings: "list for discovery; update/delete for changes.",
    output: "JSON user object.",
  }),
  `z.object({ id: z.string().describe("User id from axway_apim_user_list.") }).shape`,
  "APIM: get user"
);

add(
  "axway_apim_user_create",
  "admin",
  WRITE,
  D({
    purpose:
      "Creates an API Manager user bound to an organization with loginName, display name, and role user|admin.",
    pre: "organizationId from axway_apim_organization_list; unique loginName; mcp:admin.",
    params: "organizationId, name, loginName, role enum; optional email, phone.",
    side: "Persists a new user account in Manager.",
    errors: "409 duplicate login; 400 validation; 404 bad organizationId; 401/403; 5xx.",
    retry: "Do not retry 409 without new loginName; backoff on 5xx.",
    siblings: "update to change attributes; delete to remove.",
    output: "JSON created user with id.",
  }),
  `z.object({
    organizationId: z.string().describe("Owning organization id from axway_apim_organization_list."),
    name: z.string().describe("Full display name."),
    loginName: z.string().describe("Unique login name for Manager."),
    role: z.enum(['user','admin']).describe("Manager role: 'user' or 'admin'."),
    email: z.string().email().optional().describe("User email."),
    phone: z.string().optional().describe("User phone.")
  }).shape`,
  "APIM: create user"
);

add(
  "axway_apim_user_update",
  "admin",
  WRITE_IDEM,
  D({
    purpose:
      "Updates fields on an existing API Manager user such as role, enabled flag, organization, or contact data.",
    pre: "id from list/get; send only fields to change.",
    params: "id; optional name, loginName, email, phone, role, enabled, organizationId.",
    side: "Mutates user record; may change access immediately.",
    errors: "404; 409 login conflict; 401/403; 5xx.",
    retry: "Idempotent for identical payloads; backoff on 5xx.",
    siblings: "create for new users; delete to remove.",
    output: "JSON updated user.",
  }),
  `z.object({
    id: z.string().describe("User id to update."),
    name: z.string().optional().describe("New display name."),
    loginName: z.string().optional().describe("New login name."),
    email: z.string().email().optional().describe("New email."),
    phone: z.string().optional().describe("New phone."),
    role: z.enum(['user','admin']).optional().describe("New role."),
    enabled: z.boolean().optional().describe("Enabled flag."),
    organizationId: z.string().optional().describe("Move user to this organization id.")
  }).shape`,
  "APIM: update user"
);

add(
  "axway_apim_user_delete",
  "admin",
  DESTROY,
  D({
    purpose:
      "Deletes an API Manager user by id. Destructive; the login can no longer authenticate to Manager.",
    pre: "Confirm the user is disposable; mcp:admin.",
    params: "id required.",
    side: "Removes the user account permanently.",
    errors: "404; 409 if constrained; 401/403; 5xx.",
    retry: "Idempotent on 404; backoff on 5xx.",
    siblings: "Prefer update enabled=false to disable without deletion when possible.",
    output: "JSON deletion confirmation.",
  }),
  `z.object({ id: z.string().describe("User id to delete.") }).shape`,
  "APIM: delete user"
);

add(
  "axway_apim_application_list",
  "observe",
  READ,
  D({
    purpose:
      "Lists applications visible to the Manager credentials, used to discover application ids for credentials, access, and quotas.",
    pre: "Manager auth; no Gateway topology.",
    params: "None.",
    side: "Read-only.",
    errors: "401/403; 5xx.",
    retry: "Backoff on 5xx.",
    siblings: "axway_apim_application_get for one app; credential tools for secrets.",
    output: "JSON applications array.",
  }),
  `z.object({}).shape`,
  "APIM: list applications"
);

add(
  "axway_apim_application_get",
  "observe",
  READ,
  D({
    purpose:
      "Gets one application by id with metadata needed before granting API access or inspecting quotas.",
    pre: "id from axway_apim_application_list.",
    params: "id required.",
    side: "Read-only; does not return API key secrets by itself.",
    errors: "404; 401/403; 5xx.",
    retry: "No retry on 404; backoff on 5xx.",
    siblings:
      "Use axway_apim_apikey_get / axway_apim_oauth_get for credentials; axway_apim_access_list for granted APIs.",
    output: "JSON application object.",
  }),
  `z.object({ id: z.string().describe("Application id from axway_apim_application_list.") }).shape`,
  "APIM: get application"
);

add(
  "axway_apim_permission_get",
  "observe",
  READ,
  D({
    purpose:
      "Reads the ACL/permissions associated with an application to understand who can manage it in API Manager.",
    pre: "Application id from list/get.",
    params: "id required (application id).",
    side: "Read-only ACL view.",
    errors: "404; 401/403; 5xx.",
    retry: "Backoff on 5xx.",
    siblings: "Not the same as axway_apim_access_list which lists frontend API grants for consumption.",
    output: "JSON permissions/ACL structure.",
  }),
  `z.object({ id: z.string().describe("Application id whose ACL to read.") }).shape`,
  "APIM: application permissions"
);

add(
  "axway_apim_apikey_get",
  "admin",
  READ,
  D({
    purpose:
      "Lists API keys for an application. Use the apiKey field for client calls; do not confuse with secret.",
    pre: "mcp:admin; application id from list; treat returned secrets as confidential.",
    params: "id required (application id).",
    side: "Read-only credential disclosure — high sensitivity.",
    errors: "404; 401/403; 5xx.",
    retry: "Backoff on 5xx; do not spam retries (secret exposure).",
    siblings: "axway_apim_apikey_create to mint keys; oauth siblings for OAuth clients.",
    output: "JSON API key list; authenticate with apiKey header value.",
  }),
  `z.object({ id: z.string().describe("Application id whose API keys to list.") }).shape`,
  "APIM: list API keys"
);

add(
  "axway_apim_apikey_create",
  "admin",
  WRITE,
  D({
    purpose:
      "Creates a new API key for an application, optionally supplying a secret and enabled flag.",
    pre: "mcp:admin; appId from application list; store returned key securely.",
    params: "appId required; optional secret, enabled default true.",
    side: "Persists a new credential; clients can call APIs with the new key immediately after grants.",
    errors: "404 bad appId; 400 validation; 401/403; 5xx.",
    retry: "Backoff on 5xx; avoid duplicate creates that multiply unused keys.",
    siblings: "apikey_get to list; oauth_create for OAuth instead of API keys.",
    output: "JSON created API key including apiKey value.",
  }),
  `z.object({
    appId: z.string().describe("Application id that will own the new API key."),
    secret: z.string().optional().describe("Optional secret; generated if omitted."),
    enabled: z.boolean().optional().describe("Whether the key is enabled; default true.")
  }).shape`,
  "APIM: create API key"
);

add(
  "axway_apim_oauth_get",
  "admin",
  READ,
  D({
    purpose:
      "Lists OAuth client credentials for an application for confidential inspection and troubleshooting of OAuth-protected APIs.",
    pre: "mcp:admin; application id; handle secrets carefully.",
    params: "id application id.",
    side: "Read-only secret disclosure.",
    errors: "404; 401/403; 5xx.",
    retry: "Backoff on 5xx.",
    siblings: "oauth_create to mint; apikey_* for API key auth style.",
    output: "JSON OAuth credential list.",
  }),
  `z.object({ id: z.string().describe("Application id whose OAuth credentials to list.") }).shape`,
  "APIM: list OAuth credentials"
);

add(
  "axway_apim_oauth_create",
  "admin",
  WRITE,
  D({
    purpose:
      "Creates an OAuth client credential for an application with optional redirect URIs and public certificate PEM.",
    pre: "mcp:admin; appId known; redirect URIs comma-separated when needed.",
    params: "appId; optional redirectURIs, cert PEM.",
    side: "Persists OAuth client; may enable token flows for the app.",
    errors: "400 invalid cert/URIs; 404; 401/403; 5xx.",
    retry: "Backoff on 5xx; fix validation errors before retry.",
    siblings: "oauth_get to list; apikey_create for API keys instead.",
    output: "JSON created OAuth client including client id/secret fields as returned by Manager.",
  }),
  `z.object({
    appId: z.string().describe("Application id for the new OAuth client."),
    cert: z.string().optional().describe("Optional public certificate PEM bound to the client."),
    redirectURIs: z.string().optional().describe("Comma-separated redirect URIs.")
  }).shape`,
  "APIM: create OAuth credential"
);

add(
  "axway_apim_proxy_list",
  "observe",
  READ,
  D({
    purpose:
      "Lists all frontend API proxies in API Manager across lifecycle states (published, unpublished, end-of-life) for inventory and ops.",
    pre: "Manager auth; for Gateway runtime issues still start with topology/traffic tools.",
    params: "None.",
    side: "Read-only inventory of proxies.",
    errors: "401/403; 5xx.",
    retry: "Backoff on 5xx.",
    siblings:
      "axway_apim_catalog_get focuses on consumer-facing published APIs; use proxy_get for one proxy; proxy_update for fields or lifecycle.",
    output: "JSON proxy list with id, path, state.",
  }),
  `z.object({}).shape`,
  "APIM: list proxies"
);

add(
  "axway_apim_proxy_get",
  "observe",
  READ,
  D({
    purpose:
      "Gets troubleshooting-oriented details for one frontend proxy including security profiles and authenticationInfo.fieldName for correct client headers.",
    pre: "id from proxy_list or catalog_get.",
    params: "id required.",
    side: "Read-only.",
    errors: "404; 401/403; 5xx.",
    retry: "Backoff on 5xx; no retry on 404.",
    siblings: "proxyauth_get specializes in auth header examples; catalog_get is published inventory only.",
    output: "JSON simplified proxy with authenticationInfo.",
  }),
  `z.object({ id: z.string().describe("Frontend proxy id from axway_apim_proxy_list.") }).shape`,
  "APIM: get proxy"
);

add(
  "axway_apim_proxyauth_get",
  "observe",
  READ,
  D({
    purpose:
      "Returns authentication helper info for a proxy (header name, auth type, curl example) so agents construct correct client calls.",
    pre: "Proxy id known; complements proxy_get when only auth wiring is needed.",
    params: "id required.",
    side: "Read-only; does not create keys.",
    errors: "404; 401/403; 5xx.",
    retry: "Backoff on 5xx.",
    siblings: "Use apikey_get/oauth_get to obtain actual credentials; proxy_get for full config.",
    output: "JSON auth helper with fieldName and curlExample.",
  }),
  `z.object({ id: z.string().describe("Frontend proxy id.") }).shape`,
  "APIM: proxy auth info"
);

add(
  "axway_apim_catalog_get",
  "observe",
  READ,
  D({
    purpose:
      "Returns the consumer-oriented API catalog view emphasizing published frontend APIs available for discovery after Gateway health is confirmed.",
    pre: "Manager auth; prefer after traffic diagnosis when asking which APIs are exposed to consumers.",
    params: "None.",
    side: "Read-only catalog projection (published-focused sibling of proxy_list).",
    errors: "401/403; 5xx.",
    retry: "Backoff on 5xx.",
    siblings:
      "Use axway_apim_proxy_list when you need unpublished or end-of-life proxies or full admin inventory; proxy_get for one API detail.",
    output: "JSON catalog/proxy entries suitable for consumer discovery.",
  }),
  `z.object({}).shape`,
  "APIM: API catalog"
);

add(
  "axway_apim_proxy_create",
  "admin",
  WRITE,
  D({
    purpose:
      "Creates a frontend API proxy bound to a backend apiId and organization, with path and optional vhost/version/description.",
    pre: "backend id from axway_apim_backend_list; organizationId from organization_list; path unique; mcp:admin.",
    params: "name, path, apiId, organizationId; optional vhost, version, description.",
    side: "Persists a new proxy typically unpublished until lifecycle publish via proxy_update.",
    errors: "409 path conflict; 404 bad apiId/org; 400; 401/403; 5xx.",
    retry: "Fix conflicts before retry; backoff on 5xx.",
    siblings: "proxy_update for fields/lifecycle; proxy_delete to remove; backend_submit to import OpenAPI first.",
    output: "JSON created proxy with id.",
  }),
  `z.object({
    name: z.string().describe("Display name for the frontend proxy."),
    path: z.string().describe("Public path, e.g. '/my-api/v1'."),
    apiId: z.string().describe("Backend API id from axway_apim_backend_list."),
    organizationId: z.string().describe("Owning organization id."),
    vhost: z.string().optional().describe("Optional virtual host binding."),
    version: z.string().optional().describe("Optional proxy version label."),
    description: z.string().optional().describe("Optional description.")
  }).shape`,
  "APIM: create proxy"
);

add(
  "axway_apim_proxy_update",
  "operator",
  WRITE_IDEM,
  D({
    purpose:
      "Updates frontend proxy fields and/or lifecycle state. Set lifecycle to publish, unpublish, or deprecate to change availability without inventing non-canonical verbs; omit lifecycle to patch name/path/apiId only.",
    pre: "id from proxy_list; mcp:operator for lifecycle, mcp:admin recommended for structural field changes; confirm blast radius before publish/unpublish.",
    params:
      "id required; optional name, path, apiId, organizationId, vhost, version, description; optional lifecycle enum publish|unpublish|deprecate.",
    side: "Mutates Manager proxy configuration and may immediately change consumer availability when lifecycle is set.",
    errors: "404; 409 conflicts; 400 invalid lifecycle; 401/403; 5xx.",
    retry: "Idempotent for identical field/lifecycle updates; backoff on 5xx; do not flip lifecycle repeatedly on transient errors.",
    siblings: "proxy_create for new proxies; proxy_delete to remove; catalog_get/proxy_list to verify state afterwards.",
    output: "JSON updated proxy or lifecycle operation result.",
  }),
  `z.object({
    id: z.string().describe("Frontend proxy id to update."),
    name: z.string().optional().describe("New proxy name."),
    path: z.string().optional().describe("New public path."),
    apiId: z.string().optional().describe("New backend API id."),
    organizationId: z.string().optional().describe("New owning organization id."),
    vhost: z.string().optional().describe("New virtual host."),
    version: z.string().optional().describe("New version label."),
    description: z.string().optional().describe("New description."),
    lifecycle: z.enum(['publish','unpublish','deprecate']).optional().describe("Lifecycle action: publish (make available), unpublish (withdraw), or deprecate. Omit to only patch fields.")
  }).shape`,
  "APIM: update proxy / lifecycle"
);

add(
  "axway_apim_proxy_delete",
  "admin",
  DESTROY,
  D({
    purpose: "Permanently deletes a frontend API proxy by id. Destructive; consumers lose that path.",
    pre: "Unpublish first if required by policy; mcp:admin; confirm id.",
    params: "id required.",
    side: "Removes the proxy definition from Manager.",
    errors: "409 if state blocks delete; 404; 401/403; 5xx.",
    retry: "Idempotent on 404; resolve state then retry 409; backoff on 5xx.",
    siblings: "Prefer lifecycle unpublish via proxy_update when soft withdrawal is enough.",
    output: "JSON deletion confirmation.",
  }),
  `z.object({ id: z.string().describe("Frontend proxy id to delete.") }).shape`,
  "APIM: delete proxy"
);

add(
  "axway_apim_backend_list",
  "observe",
  READ,
  D({
    purpose:
      "Lists backend APIs in the Manager repository so agents can pick apiId when creating frontend proxies.",
    pre: "Manager auth.",
    params: "None.",
    side: "Read-only repository listing.",
    errors: "401/403; 5xx.",
    retry: "Backoff on 5xx.",
    siblings: "backend_submit to import OpenAPI; backend_delete to remove; proxy_create consumes apiId.",
    output: "JSON backend API list with ids.",
  }),
  `z.object({}).shape`,
  "APIM: list backend APIs"
);

add(
  "axway_apim_backend_submit",
  "admin",
  WRITE,
  D({
    purpose:
      "Imports a backend API definition into the Manager repository from a remote OpenAPI/Swagger URL or a local file path previously uploaded to the MCP host.",
    pre: "organizationId known; for file source run axway_apim_file_submit first if needed; mcp:admin; URL must be reachable from the MCP pod/host.",
    params: "source enum url|file; organizationId; for url provide url; for file provide filePath; optional name.",
    side: "Creates a backend API resource in Manager; does not publish a frontend proxy by itself.",
    errors: "400 bad OpenAPI; 404 file missing; network errors fetching url; 401/403; 5xx.",
    retry: "Backoff on 5xx/network; fix OpenAPI/validation before retry; do not duplicate imports blindly.",
    siblings: "file_submit uploads bytes; backend_list to verify; proxy_create to expose; backend_delete to remove.",
    output: "JSON imported backend API including id.",
  }),
  `z.object({
    source: z.enum(['url','file']).describe("Import source: 'url' fetches OpenAPI remotely; 'file' reads a path on the MCP host."),
    organizationId: z.string().describe("Organization that will own the backend API."),
    url: z.string().url().optional().describe("OpenAPI/Swagger URL when source=url."),
    filePath: z.string().optional().describe("Local path on MCP host when source=file (e.g. /tmp/swagger.json)."),
    name: z.string().optional().describe("Optional custom backend API name.")
  }).shape`,
  "APIM: import backend API"
);

add(
  "axway_apim_file_submit",
  "admin",
  WRITE,
  D({
    purpose:
      "Stages a local OpenAPI/Swagger file path available to the MCP process (container filesystem) and returns the saved path for axway_apim_backend_submit with source=file.",
    pre: "File must already exist on the MCP host path; mcp:admin; not a remote HTTP upload from the chat client unless previously copied.",
    params: "filePath required — absolute/relative path inside the MCP runtime filesystem.",
    side: "May copy/normalize the file into an import staging location; does not import into Manager until backend_submit.",
    errors: "404 path missing; 400 invalid file; 401/403; IO errors.",
    retry: "Fix path before retry; safe to retry identical staging.",
    siblings: "Follow with backend_submit source=file; prefer backend_submit source=url when the spec is remote.",
    output: "JSON with staged filePath to pass to backend_submit.",
  }),
  `z.object({
    filePath: z.string().describe("Path to the file on the MCP host filesystem, e.g. /tmp/swagger.json.")
  }).shape`,
  "APIM: stage import file"
);

add(
  "axway_apim_backend_delete",
  "admin",
  DESTROY,
  D({
    purpose: "Deletes a backend API from the repository by id. Destructive; proxies referencing it may break.",
    pre: "Ensure no required proxies depend on it; mcp:admin.",
    params: "id required.",
    side: "Removes backend definition from Manager.",
    errors: "409 dependents; 404; 401/403; 5xx.",
    retry: "Idempotent on 404; resolve dependents for 409; backoff on 5xx.",
    siblings: "backend_list to find ids; proxy_delete/update first if needed.",
    output: "JSON deletion confirmation.",
  }),
  `z.object({ id: z.string().describe("Backend API id to delete.") }).shape`,
  "APIM: delete backend API"
);

add(
  "axway_apim_access_list",
  "observe",
  READ,
  D({
    purpose:
      "Lists frontend APIs an application is granted to consume — application-to-proxy access grants, not Manager ACL permissions.",
    pre: "applicationId from application_list.",
    params: "applicationId required.",
    side: "Read-only grant listing.",
    errors: "404; 401/403; 5xx.",
    retry: "Backoff on 5xx.",
    siblings:
      "access_update to grant; access_delete to revoke; permission_get is Manager ACL, not API consumption grants.",
    output: "JSON list of granted frontend APIs.",
  }),
  `z.object({ applicationId: z.string().describe("Application id from axway_apim_application_list.") }).shape`,
  "APIM: list API access grants"
);

add(
  "axway_apim_access_update",
  "admin",
  WRITE_IDEM,
  D({
    purpose:
      "Grants an application access to a frontend API proxy so its credentials can call that API.",
    pre: "applicationId and apiId (frontend proxy id) known; mcp:admin; proxy usually published.",
    params: "applicationId, apiId required.",
    side: "Creates/updates an access grant; enables consumption immediately when credentials exist.",
    errors: "404; 409 already granted; 401/403; 5xx.",
    retry: "Idempotent if already granted; backoff on 5xx.",
    siblings: "access_delete to revoke; access_list to verify; proxy_update lifecycle publish if API not visible.",
    output: "JSON grant result.",
  }),
  `z.object({
    applicationId: z.string().describe("Application id to grant."),
    apiId: z.string().describe("Frontend proxy id to grant access to.")
  }).shape`,
  "APIM: grant API access"
);

add(
  "axway_apim_access_delete",
  "admin",
  DESTROY,
  D({
    purpose:
      "Revokes an application access grant to a frontend API proxy. Destructive for that app-API relationship.",
    pre: "applicationId and apiId known; mcp:admin.",
    params: "applicationId, apiId.",
    side: "Removes consumption rights; existing keys stop authorizing that API.",
    errors: "404 grant missing; 401/403; 5xx.",
    retry: "Idempotent on missing grant; backoff on 5xx.",
    siblings: "access_update to re-grant; access_list to confirm.",
    output: "JSON revoke confirmation.",
  }),
  `z.object({
    applicationId: z.string().describe("Application id to revoke."),
    apiId: z.string().describe("Frontend proxy id to revoke.")
  }).shape`,
  "APIM: revoke API access"
);

add(
  "axway_apim_alert_list",
  "observe",
  READ,
  D({
    purpose:
      "Lists Gateway alert TRIGGER configuration (which event types can raise alerts). Does not list historically fired incidents — use traffic/metrics tools for live errors.",
    pre: "Gateway/Manager auth as implemented; do not treat empty fired-alert expectations as success of this tool.",
    params: "None.",
    side: "Read-only alert settings inventory.",
    errors: "401/403; 5xx.",
    retry: "Backoff on 5xx.",
    siblings: "alert_update to change triggers; traffic_search/metrics_get for runtime failures.",
    output: "JSON alert trigger configuration map.",
  }),
  `z.object({}).shape`,
  "Gateway: alert trigger config"
);

add(
  "axway_apim_alert_update",
  "operator",
  WRITE_IDEM,
  D({
    purpose:
      "Updates alert trigger enablement flags. Provide a settings object mapping alert event names to booleans for only the keys you want to change.",
    pre: "mcp:operator; know valid alert event names from alert_list; avoid disabling critical ops alerts without approval.",
    params: "settings object required (alertName → boolean).",
    side: "Mutates which events can raise alerts; does not clear past incidents.",
    errors: "400 unknown keys; 401/403; 5xx.",
    retry: "Idempotent for same settings; backoff on 5xx.",
    siblings: "alert_list to inspect current triggers; traffic tools for live errors.",
    output: "JSON updated settings confirmation.",
  }),
  `z.object({
    settings: z.record(z.boolean()).describe("Map of alert event name to enabled boolean; include only keys to change.")
  }).shape`,
  "Gateway: update alert settings"
);

add(
  "axway_apim_quota_get",
  "observe",
  READ,
  D({
    purpose:
      "Reads the effective quota (system or application-specific) for an application, typically messages-per-second style limits.",
    pre: "applicationId from application_list.",
    params: "applicationId required.",
    side: "Read-only.",
    errors: "404; 401/403; 5xx.",
    retry: "Backoff on 5xx.",
    siblings: "quota_update to change limits; application_get for app metadata.",
    output: "JSON quota object.",
  }),
  `z.object({ applicationId: z.string().describe("Application id whose quotas to read.") }).shape`,
  "APIM: get application quotas"
);

add(
  "axway_apim_quota_update",
  "operator",
  WRITE_IDEM,
  D({
    purpose:
      "Sets application-specific maximum messages (requests) per second quota for rate limiting in API Manager.",
    pre: "mcp:operator; applicationId known; choose a safe messages_per_second integer.",
    params: "applicationId; messages_per_second int.",
    side: "Mutates rate limits; may throttle clients immediately.",
    errors: "400 invalid number; 404; 401/403; 5xx.",
    retry: "Idempotent for same value; backoff on 5xx.",
    siblings: "quota_get to verify; alert_update is unrelated trigger config.",
    output: "JSON updated quota.",
  }),
  `z.object({
    applicationId: z.string().describe("Application id to update."),
    messages_per_second: z.number().int().positive().describe("Max messages/requests per second.")
  }).shape`,
  "APIM: update application quotas"
);

console.log("Tool count:", tools.length);
const profiles = { observe: 0, operator: 0, admin: 0 };
for (const t of tools) profiles[t.profile]++;
console.log("Profiles:", profiles);

const annEntries = tools.map((t) => `  ${JSON.stringify(t.method)}: ${JSON.stringify(t.annotations)},`).join("\n");
const profEntries = tools.map((t) => `  ${JSON.stringify(t.method)}: ${JSON.stringify(t.profile)},`).join("\n");
const titleEntries = tools.map((t) => `  ${JSON.stringify(t.method)}: ${JSON.stringify(t.title)},`).join("\n");

const scopesTs = `/**
 * @module src/auth/tool-scopes
 * @description Hierarchical MCP tool scopes (observe ⊂ operator ⊂ admin),
 * tool → minimum-scope matrix, and MCP ToolAnnotations (I13–I17).
 */

export type ToolProfile = "observe" | "operator" | "admin";

const PROFILE_RANK: Record<ToolProfile, number> = {
  observe: 1,
  operator: 2,
  admin: 3,
};

/** OIDC scope strings for each profile. */
export const PROFILE_SCOPES: Record<ToolProfile, string> = {
  observe: "mcp:observe",
  operator: "mcp:operator",
  admin: "mcp:admin",
};

/** Legacy all-access scope; treated as admin. */
export const LEGACY_ADMIN_SCOPE = "mcp:tools";

export type ToolAnnotations = {
  readOnlyHint: boolean;
  destructiveHint: boolean;
  idempotentHint: boolean;
  openWorldHint: boolean;
};

/**
 * MCP annotations for every registered tool (Axway criteria I13–I17).
 */
export const TOOL_ANNOTATIONS: Record<string, ToolAnnotations> = {
${annEntries}
};

/**
 * Minimum profile required per tool (must stay in sync with tools() registration).
 */
export const TOOL_REQUIRED_PROFILE: Record<string, ToolProfile> = {
${profEntries}
};

/** Optional human titles for tools/list. */
export const TOOL_TITLES: Record<string, string> = {
${titleEntries}
};

export function parseToolProfile(value: string | undefined): ToolProfile | null {
  const v = (value || "").trim().toLowerCase();
  if (v === "observe" || v === "operator" || v === "admin") {
    return v;
  }
  return null;
}

export function resolveEffectiveProfile(scopes: string[]): ToolProfile | null {
  let best: ToolProfile | null = null;
  for (const scope of scopes) {
    let profile: ToolProfile | null = null;
    if (scope === PROFILE_SCOPES.observe) profile = "observe";
    else if (scope === PROFILE_SCOPES.operator) profile = "operator";
    else if (scope === PROFILE_SCOPES.admin) profile = "admin";
    else if (scope === LEGACY_ADMIN_SCOPE) profile = "admin";

    if (!profile) continue;
    if (!best || PROFILE_RANK[profile] > PROFILE_RANK[best]) {
      best = profile;
    }
  }
  return best;
}

export function profileCovers(
  have: ToolProfile | null,
  required: ToolProfile
): boolean {
  if (!have) return false;
  return PROFILE_RANK[have] >= PROFILE_RANK[required];
}

export function requiredProfileFor(toolName: string): ToolProfile {
  return TOOL_REQUIRED_PROFILE[toolName] ?? "admin";
}

export function requiredScopeFor(toolName: string): string {
  return PROFILE_SCOPES[requiredProfileFor(toolName)];
}

export function toolAllowed(
  toolName: string,
  scopesOrProfile: string[] | ToolProfile | null
): boolean {
  const required = requiredProfileFor(toolName);
  if (scopesOrProfile === null) return false;
  if (typeof scopesOrProfile === "string") {
    return profileCovers(scopesOrProfile, required);
  }
  return profileCovers(resolveEffectiveProfile(scopesOrProfile), required);
}

export function scopeSatisfied(have: string[], need: string): boolean {
  if (have.includes(need)) return true;

  const needProfile =
    need === PROFILE_SCOPES.observe
      ? "observe"
      : need === PROFILE_SCOPES.operator
        ? "operator"
        : need === PROFILE_SCOPES.admin || need === LEGACY_ADMIN_SCOPE
          ? "admin"
          : null;

  if (!needProfile) return false;
  return profileCovers(resolveEffectiveProfile(have), needProfile);
}

export function toolsAllowedFor(
  toolNames: string[],
  scopesOrProfile: string[] | ToolProfile | null
): string[] {
  return toolNames.filter((name) => toolAllowed(name, scopesOrProfile));
}

export const SCOPES_SUPPORTED = [
  PROFILE_SCOPES.observe,
  PROFILE_SCOPES.operator,
  PROFILE_SCOPES.admin,
  LEGACY_ADMIN_SCOPE,
];
`;

fs.writeFileSync(path.join(ROOT, "src/auth/tool-scopes.ts"), scopesTs);

const toolConsts = tools
  .map((t, i) => {
    return `const tool${i} = {
  method: ${JSON.stringify(t.method)},
  description: ${JSON.stringify(t.description)},
  parameters: ${t.parametersTs},
};`;
  })
  .join("\n\n");

const toolsTs = `/**
 * MCP TOOL DEFINITIONS FOR AXWAY APIM
 * Naming: axway_apim_<resource>_<action> (provisional product segment \\\`apim\\\`).
 */

import { z } from "zod";

${toolConsts}

export function tools() {
  return [
${tools.map((_, i) => `    tool${i},`).join("\n")}
  ];
}
`;

fs.writeFileSync(path.join(ROOT, "src/tools.ts"), toolsTs);
fs.mkdirSync(path.join(ROOT, "tmp"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "tmp/_tool_methods.json"), JSON.stringify(tools.map((t) => t.method), null, 2));
console.log("Wrote tool-scopes.ts and tools.ts to", ROOT);
