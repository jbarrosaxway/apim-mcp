/**
 * @module src/auth/oidc
 * @description OAuth 2.1 Resource Server helpers for the MCP HTTP transport.
 *
 * When MCP_AUTH_MODE=oidc the server:
 * - Serves RFC 9728 Protected Resource Metadata at /.well-known/oauth-protected-resource
 * - Requires a Bearer JWT on MCP requests
 * - Validates the JWT against the OIDC issuer JWKS (jose)
 *
 * The MCP server never opens a browser; the MCP client drives Authorization Code + PKCE.
 */
import { createRemoteJWKSet, jwtVerify } from "jose";
import { SCOPES_SUPPORTED, scopeSatisfied } from "./tool-scopes.js";
let cachedConfig = null;
let jwks = null;
let resolvedJwksUri = null;
function parseBoolishTrue(value) {
    const v = (value || "").toLowerCase();
    return v === "true" || v === "1" || v === "yes";
}
/**
 * Loads auth configuration from environment variables.
 * Throws if MCP_AUTH_MODE=oidc and required vars are missing.
 */
export function loadAuthConfig() {
    if (cachedConfig) {
        return cachedConfig;
    }
    const authDisabled = parseBoolishTrue(process.env.MCP_AUTH_DISABLED);
    const rawMode = (process.env.MCP_AUTH_MODE || "none").toLowerCase();
    const mode = authDisabled || rawMode === "none" || rawMode === "off" ? "none" : "oidc";
    // Entry gate: default mcp:observe when OIDC is on (hierarchical — admin/operator also satisfy).
    const rawRequired = process.env.MCP_REQUIRED_SCOPES !== undefined
        ? process.env.MCP_REQUIRED_SCOPES
        : mode === "oidc"
            ? "mcp:observe"
            : "";
    const requiredScopes = rawRequired
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    if (mode === "none") {
        cachedConfig = { mode, requiredScopes };
        return cachedConfig;
    }
    const issuer = process.env.OIDC_ISSUER?.replace(/\/$/, "");
    const audience = process.env.OIDC_AUDIENCE;
    const resourceUrl = (process.env.MCP_RESOURCE_URL ||
        process.env.OIDC_AUDIENCE ||
        "").replace(/\/$/, "");
    const jwksUri = process.env.OIDC_JWKS_URI;
    if (!issuer) {
        throw new Error("MCP_AUTH_MODE=oidc requires OIDC_ISSUER");
    }
    if (!audience && !resourceUrl) {
        throw new Error("MCP_AUTH_MODE=oidc requires OIDC_AUDIENCE and/or MCP_RESOURCE_URL");
    }
    cachedConfig = {
        mode,
        issuer,
        audience: audience || resourceUrl,
        resourceUrl: resourceUrl || audience,
        jwksUri,
        requiredScopes,
    };
    return cachedConfig;
}
/** Reset caches (tests / reload). */
export function resetAuthCaches() {
    cachedConfig = null;
    jwks = null;
    resolvedJwksUri = null;
}
async function resolveJwksUri(config) {
    if (config.jwksUri) {
        return config.jwksUri;
    }
    if (resolvedJwksUri) {
        return resolvedJwksUri;
    }
    const discoveryUrl = `${config.issuer}/.well-known/openid-configuration`;
    const res = await fetch(discoveryUrl);
    if (!res.ok) {
        throw new Error(`Failed to fetch OIDC discovery from ${discoveryUrl}: ${res.status}`);
    }
    const meta = (await res.json());
    if (!meta.jwks_uri) {
        throw new Error(`OIDC discovery missing jwks_uri at ${discoveryUrl}`);
    }
    resolvedJwksUri = meta.jwks_uri;
    return resolvedJwksUri;
}
async function getJwks(config) {
    if (!jwks) {
        const uri = await resolveJwksUri(config);
        jwks = createRemoteJWKSet(new URL(uri));
    }
    return jwks;
}
function extractScopes(payload) {
    const scopes = new Set();
    if (typeof payload.scope === "string") {
        payload.scope.split(/\s+/).filter(Boolean).forEach((s) => scopes.add(s));
    }
    if (Array.isArray(payload.scp)) {
        payload.scp.filter((s) => typeof s === "string").forEach((s) => scopes.add(s));
    }
    return [...scopes];
}
function audienceMatches(tokenAud, expected) {
    if (!tokenAud)
        return false;
    const list = Array.isArray(tokenAud) ? tokenAud : [tokenAud];
    return list.includes(expected);
}
/**
 * Verifies a Bearer access token JWT against the configured OIDC issuer.
 */
export async function verifyAccessToken(token) {
    const config = loadAuthConfig();
    if (config.mode !== "oidc" || !config.issuer || !config.audience) {
        throw new Error("OIDC auth is not configured");
    }
    const keySet = await getJwks(config);
    const { payload } = await jwtVerify(token, keySet, {
        issuer: config.issuer,
        // Audience checked manually to also accept MCP_RESOURCE_URL when distinct
    });
    const expectedAudiences = new Set([config.audience, config.resourceUrl].filter(Boolean));
    const audOk = [...expectedAudiences].some((a) => audienceMatches(payload.aud, a));
    // Keycloak often puts client_id in azp and resource audience via mapper;
    // also accept azp when it matches a known public client used for tests (optional soft check skipped).
    if (!audOk && !parseBoolishTrue(process.env.OIDC_SKIP_AUDIENCE_CHECK)) {
        const err = new Error("Token audience mismatch");
        err.code = "invalid_token";
        throw err;
    }
    if (!payload.exp) {
        const err = new Error("Token missing exp");
        err.code = "invalid_token";
        throw err;
    }
    const scopes = extractScopes(payload);
    const missing = config.requiredScopes.filter((s) => !scopeSatisfied(scopes, s));
    if (missing.length > 0) {
        const err = new Error(`Insufficient scope. Missing: ${missing.join(", ")} (have: ${scopes.join(" ") || "none"}; mcp:operator/mcp:admin/mcp:tools also satisfy mcp:observe)`);
        err.code = "insufficient_scope";
        throw err;
    }
    return {
        subject: String(payload.sub || ""),
        clientId: typeof payload.azp === "string"
            ? payload.azp
            : typeof payload.client_id === "string"
                ? payload.client_id
                : undefined,
        scopes,
        expiresAt: payload.exp,
        payload,
    };
}
function resourceMetadataUrl(config, req) {
    if (config.resourceUrl) {
        return `${config.resourceUrl}/.well-known/oauth-protected-resource`;
    }
    const host = req.headers.host || "localhost";
    const proto = req.headers["x-forwarded-proto"] ||
        (parseBoolishTrue(process.env.MCP_TLS_TERMINATED) ? "https" : "http");
    return `${proto}://${host}/.well-known/oauth-protected-resource`;
}
function buildWwwAuthenticate(config, req, error, errorDescription) {
    const parts = [
        `Bearer realm="mcp"`,
        `resource_metadata="${resourceMetadataUrl(config, req)}"`,
    ];
    if (config.requiredScopes.length) {
        parts.push(`scope="${config.requiredScopes.join(" ")}"`);
    }
    if (error) {
        parts.push(`error="${error}"`);
    }
    if (errorDescription) {
        parts.push(`error_description="${errorDescription.replace(/"/g, "'")}"`);
    }
    return parts.join(", ");
}
function writeOAuthError(res, status, config, req, error, message) {
    res.writeHead(status, {
        "Content-Type": "application/json",
        "WWW-Authenticate": buildWwwAuthenticate(config, req, error, message),
        "Cache-Control": "no-store",
    });
    res.end(JSON.stringify({ error, error_description: message }));
}
/**
 * Serves RFC 9728 Protected Resource Metadata (and path-aware variant).
 * Returns true if the request was handled.
 */
export function handleWellKnown(req, res) {
    const config = loadAuthConfig();
    if (config.mode !== "oidc") {
        return false;
    }
    const url = req.url || "";
    const pathOnly = url.split("?")[0];
    const isPrm = pathOnly === "/.well-known/oauth-protected-resource" ||
        pathOnly === "/.well-known/oauth-protected-resource/" ||
        pathOnly.startsWith("/.well-known/oauth-protected-resource/");
    if (!isPrm || req.method !== "GET") {
        return false;
    }
    const body = {
        resource: config.resourceUrl || config.audience,
        authorization_servers: [config.issuer],
        bearer_methods_supported: ["header"],
        scopes_supported: SCOPES_SUPPORTED,
        resource_documentation: "https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization",
    };
    res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60",
    });
    res.end(JSON.stringify(body));
    return true;
}
/**
 * When auth mode is oidc, validates Authorization: Bearer … .
 * Returns AuthInfo on success, null if auth disabled, or writes error response and returns false.
 */
export async function authenticateHttpRequest(req, res) {
    const config = loadAuthConfig();
    if (config.mode === "none") {
        return null;
    }
    const header = req.headers.authorization;
    if (!header || !/^Bearer\s+/i.test(header)) {
        writeOAuthError(res, 401, config, req, "invalid_token", "Missing or malformed Authorization Bearer token");
        return false;
    }
    const token = header.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
        writeOAuthError(res, 401, config, req, "invalid_token", "Empty Bearer token");
        return false;
    }
    try {
        return await verifyAccessToken(token);
    }
    catch (e) {
        const code = e?.code;
        if (code === "insufficient_scope") {
            writeOAuthError(res, 403, config, req, "insufficient_scope", e.message);
            return false;
        }
        writeOAuthError(res, 401, config, req, "invalid_token", e?.message || "Token validation failed");
        return false;
    }
}
/**
 * Logs auth mode at process start (HTTP transport only).
 */
export function logAuthStartup() {
    const config = loadAuthConfig();
    if (config.mode === "none") {
        const disabledVia = parseBoolishTrue(process.env.MCP_AUTH_DISABLED) ? "MCP_AUTH_DISABLED" : "MCP_AUTH_MODE";
        const profile = (process.env.MCP_DEPLOYMENT_PROFILE || "observe").trim();
        console.log(`[Auth] ${disabledVia}=none/off — HTTP MCP endpoints are not protected by OIDC; tool profile=${profile} (MCP_DEPLOYMENT_PROFILE)`);
        return;
    }
    console.log(`[Auth] MCP_AUTH_MODE=oidc issuer=${config.issuer} audience=${config.audience} resource=${config.resourceUrl} scopes=${config.requiredScopes.join(" ") || "(none)"}`);
}
//# sourceMappingURL=oidc.js.map