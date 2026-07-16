#!/usr/bin/env node
/**
 * Export initialize + tools/list (+ prompts/list, resources/list) from a live MCP HTTP server.
 * Usage:
 *   node scripts/export-mcp-manifest.mjs [baseUrl] [bearerToken]
 * Env:
 *   MCP_URL          default http://127.0.0.1:3000
 *   MCP_BEARER_TOKEN optional Authorization Bearer
 * Writes: tmp/mcp_manifest.json
 */

import fs from "node:fs";
import path from "node:path";

const baseUrl = (process.argv[2] || process.env.MCP_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const token = process.argv[3] || process.env.MCP_BEARER_TOKEN || "";
const mcpUrl = baseUrl.endsWith("/mcp") ? baseUrl : `${baseUrl}/mcp`;

function headers(sessionId) {
  const h = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (token) h.Authorization = `Bearer ${token}`;
  if (sessionId) h["Mcp-Session-Id"] = sessionId;
  return h;
}

function parseBody(contentType, raw) {
  if (contentType.includes("text/event-stream")) {
    const lines = raw.split(/\r?\n/);
    for (const line of lines) {
      if (line.startsWith("data:")) {
        const data = line.slice(5).trim();
        if (data && data !== "[DONE]") return JSON.parse(data);
      }
    }
    throw new Error("No SSE data payload found");
  }
  return JSON.parse(raw);
}

async function rpc(method, params, sessionId, id) {
  const res = await fetch(mcpUrl, {
    method: "POST",
    headers: headers(sessionId),
    body: JSON.stringify({ jsonrpc: "2.0", method, params: params || {}, id }),
  });
  const raw = await res.text();
  const newSession = res.headers.get("mcp-session-id") || sessionId;
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} on ${method}: ${raw.slice(0, 400)}`);
  }
  const body = parseBody(res.headers.get("content-type") || "", raw);
  if (body.error) {
    throw new Error(`${method} RPC error: ${JSON.stringify(body.error)}`);
  }
  return { result: body.result, sessionId: newSession };
}

async function notify(method, params, sessionId) {
  await fetch(mcpUrl, {
    method: "POST",
    headers: headers(sessionId),
    body: JSON.stringify({ jsonrpc: "2.0", method, params: params || {} }),
  });
}

const outDir = path.join(process.cwd(), "tmp");
fs.mkdirSync(outDir, { recursive: true });

console.error(`Exporting MCP manifest from ${mcpUrl}`);

let sessionId;
const init = await rpc(
  "initialize",
  {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "export-mcp-manifest", version: "1.0.0" },
  },
  undefined,
  1
);
sessionId = init.sessionId;
await notify("notifications/initialized", {}, sessionId);

const tools = await rpc("tools/list", {}, sessionId, 2);
let prompts = { prompts: [] };
let resources = { resources: [] };
try {
  prompts = (await rpc("prompts/list", {}, sessionId, 3)).result || prompts;
} catch (e) {
  console.error(`prompts/list skipped: ${e.message}`);
}
try {
  resources = (await rpc("resources/list", {}, sessionId, 4)).result || resources;
} catch (e) {
  console.error(`resources/list skipped: ${e.message}`);
}

const manifest = {
  fetchedAt: new Date().toISOString(),
  serverUrl: mcpUrl,
  initialize: init.result,
  tools: tools.result?.tools || [],
  prompts: prompts.prompts || [],
  resources: resources.resources || [],
};

const outPath = path.join(outDir, "mcp_manifest.json");
fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2));
console.error(
  `Wrote ${outPath} (tools=${manifest.tools.length}, prompts=${manifest.prompts.length}, resources=${manifest.resources.length})`
);
console.log(outPath);
