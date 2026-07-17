#!/usr/bin/env node
/**
 * Build an audit-ready MCP manifest from local tool definitions (no live server).
 * Writes tmp/mcp_manifest.json
 */
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { tools } from "../build/tools.js";
import {
  TOOL_ANNOTATIONS,
  TOOL_TITLES,
} from "../build/auth/tool-scopes.js";
import { SERVER_INSTRUCTIONS, DIAGNOSE_GATEWAY_PROMPT } from "../build/mcp-guidance.js";

const toolList = tools().map((t) => ({
  name: t.method,
  title: TOOL_TITLES[t.method],
  description: t.description,
  inputSchema: zodToJsonSchema(z.object(t.parameters), { strictUnions: true }),
  annotations: TOOL_ANNOTATIONS[t.method],
}));

const manifest = {
  serverInfo: {
    name: "axway-mcp",
    version: "1.0.17",
    description:
      "Axway API Gateway (ANM) + API Manager: diagnostics (topology, traffic, errors, metrics), monitoring, and APIM administration",
  },
  protocolVersion: "2025-03-26",
  capabilities: {
    tools: {},
    prompts: {},
    resources: {},
  },
  instructions: SERVER_INSTRUCTIONS,
  tools: toolList,
  prompts: [
    {
      name: "axway_apim_gateway_diagnose",
      title: "Diagnosticar API Gateway Axway",
      description:
        "Use when the user asks whether the Axway API Gateway/ANM has a problem, failure, outage, errors, or latency. Chains axway_apim_topology_list → metrics → traffic search → proxies. Side effects: none (read-only guidance). Sibling: call the named tools directly for ad-hoc checks.",
      arguments: [
        {
          name: "symptom",
          description: "Natural-language symptom (e.g. HTTP 500, slow responses)",
          required: false,
        },
        {
          name: "timeWindow",
          description: "Event lookback window such as 1h or 24h; default 1h",
          required: false,
        },
      ],
    },
  ],
  resources: [
    {
      uri: "axway://apim/topology",
      name: "apim_topology",
      description:
        "Live Gateway topology snapshot including groups, instances, current instance identifiers, and product version. Data shape matches the axway_apim_topology_list tool output and is intended for URI-based context attachment. Always refresh after Kubernetes or Docker pod restarts because instance identifiers rotate. This is a live read against ANM, not a historical snapshot store. On 5xx or network timeouts retry with exponential backoff; on empty topology verify AXWAY_GATEWAY_URL before repeating.",
      mimeType: "application/json",
    },
    {
      uri: "axway://apim/proxies",
      name: "apim_proxies",
      description:
        "Live inventory of frontend API proxies with id, path, and lifecycle state for attaching catalog context by URI. Prefer axway_apim_proxy_list or axway_apim_catalog_get when the agent needs filtered workflows or sibling disambiguation. This resource returns a live Manager read, not a cached offline export. Retry transient 5xx with backoff; fix Manager credentials on 401/403 instead of blind retries. Use axway://apim/proxies/{id} for a single proxy detail document.",
      mimeType: "application/json",
    },
    {
      uri: "axway://apim/proxies/{id}",
      name: "apim_proxy",
      description:
        "Live troubleshooting detail for one frontend API proxy addressed by id in the URI path. The JSON shape matches axway_apim_proxy_get including security and authenticationInfo.fieldName hints for client headers. Obtain ids from axway://apim/proxies or axway_apim_proxy_list first. This is a live Manager read; missing ids return not-found rather than stale cache. Retry 5xx with backoff; do not retry 404 without a new id.",
      mimeType: "application/json",
    },
    {
      uri: "axway://apim/instances/{instance_id}/traffic",
      name: "apim_instance_traffic",
      description:
        "Live aggregate traffic counters for one Gateway instance identified by instance_id in the URI. Resolve instance_id from axway://apim/topology or axway_apim_topology_list immediately before reading because containerized deployments rotate identifiers after restart. Data shape aligns with axway_apim_instancetraffic_get. This is a live metrics read, not a stored timeseries archive. On empty or not-found results refresh topology then retry once; use exponential backoff for 5xx.",
      mimeType: "application/json",
    },
  ],
  _audit_meta: {
    source_url: "local-build",
    fetched_at: new Date().toISOString(),
    manifest_scope: "default",
    scope_description: "All tools from src/tools.ts (admin view)",
    note_a10:
      "Product segment 'apim' is provisional pending CPO approval; see docs/cpo-apim-product-request.md",
  },
};

const outDir = path.join(process.cwd(), "tmp");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "mcp_manifest.json");
fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2));
console.log(`Wrote ${outPath} (${toolList.length} tools)`);
// silence unused
void DIAGNOSE_GATEWAY_PROMPT;
