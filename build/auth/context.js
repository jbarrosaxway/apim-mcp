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
        // Auth disabled: ALS holds null but deployment profile may be configured as fallback
        if (fromStore === null && fallbackAuth) {
            return fallbackAuth;
        }
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
        // Auth disabled without deployment profile fallback
        return [PROFILE_SCOPES.observe];
    }
    return info.scopes;
}
export function authInfoFromProfile(profile, subjectPrefix = "stdio") {
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
        subject: `${subjectPrefix}:${profile}`,
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
/**
 * Reads MCP_DEPLOYMENT_PROFILE for HTTP when OIDC is disabled (default observe).
 */
export function loadDeploymentProfile() {
    const parsed = parseToolProfile(process.env.MCP_DEPLOYMENT_PROFILE);
    return parsed ?? "observe";
}
//# sourceMappingURL=context.js.map