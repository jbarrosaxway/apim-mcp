/**
 * @module src/auth/context
 * @description Per-request auth context (AsyncLocalStorage) for tool authorization.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { parseToolProfile, PROFILE_SCOPES, } from "./tool-scopes.js";
const authStorage = new AsyncLocalStorage();
/** Fallback used when ALS is empty (stdio profile / auth disabled). */
let fallbackAuth = undefined;
export function runWithAuth(auth, fn) {
    return authStorage.run(auth, fn);
}
export function setFallbackAuth(auth) {
    fallbackAuth = auth;
}
export function getAuthInfo() {
    const fromStore = authStorage.getStore();
    if (fromStore !== undefined) {
        return fromStore;
    }
    return fallbackAuth;
}
export function getAuthScopes() {
    const info = getAuthInfo();
    if (info === undefined) {
        // No context configured → treat as full admin (dev / miswire safety for local)
        return [PROFILE_SCOPES.admin];
    }
    if (info === null) {
        // Auth disabled (MCP_AUTH_MODE=none) → full access
        return [PROFILE_SCOPES.admin];
    }
    return info.scopes;
}
export function authInfoFromProfile(profile) {
    const scopes = [];
    if (profile === "admin") {
        scopes.push(PROFILE_SCOPES.admin);
    }
    else if (profile === "operator") {
        scopes.push(PROFILE_SCOPES.operator);
    }
    else {
        scopes.push(PROFILE_SCOPES.observe);
    }
    return {
        subject: `stdio:${profile}`,
        scopes,
        expiresAt: Math.floor(Date.now() / 1000) + 365 * 24 * 3600,
        payload: {},
    };
}
/**
 * Reads MCP_TOOL_PROFILE for stdio (default admin).
 */
export function loadStdioToolProfile() {
    const parsed = parseToolProfile(process.env.MCP_TOOL_PROFILE);
    return parsed ?? "admin";
}
//# sourceMappingURL=context.js.map