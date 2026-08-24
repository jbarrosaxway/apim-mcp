/**
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
  "axway_apim_time_get": {"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true},
  "axway_apim_config_get": {"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true},
  "axway_apim_topology_list": {"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true},
  "axway_apim_deployment_archive_get": {"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true},
  "axway_apim_policy_archive_get": {"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true},
  "axway_apim_environment_archive_get": {"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true},
  "axway_apim_envsettings_get": {"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true},
  "axway_apim_group_conf_get": {"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true},
  "axway_apim_deployments_list": {"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true},
  "axway_apim_instancetraffic_get": {"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true},
  "axway_apim_servicetraffic_get": {"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true},
  "axway_apim_metrics_get": {"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true},
  "axway_apim_traffic_search": {"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true},
  "axway_apim_trafficevent_get": {"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true},
  "axway_apim_trafficpayload_get": {"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true},
  "axway_apim_traffictrace_get": {"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true},
  "axway_apim_organization_list": {"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true},
  "axway_apim_organization_get": {"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true},
  "axway_apim_organization_create": {"readOnlyHint":false,"destructiveHint":false,"idempotentHint":false,"openWorldHint":true},
  "axway_apim_organization_update": {"readOnlyHint":false,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true},
  "axway_apim_organization_delete": {"readOnlyHint":false,"destructiveHint":true,"idempotentHint":true,"openWorldHint":true},
  "axway_apim_user_list": {"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true},
  "axway_apim_user_get": {"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true},
  "axway_apim_user_create": {"readOnlyHint":false,"destructiveHint":false,"idempotentHint":false,"openWorldHint":true},
  "axway_apim_user_update": {"readOnlyHint":false,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true},
  "axway_apim_user_delete": {"readOnlyHint":false,"destructiveHint":true,"idempotentHint":true,"openWorldHint":true},
  "axway_apim_application_list": {"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true},
  "axway_apim_application_get": {"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true},
  "axway_apim_permission_get": {"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true},
  "axway_apim_apikey_get": {"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true},
  "axway_apim_apikey_create": {"readOnlyHint":false,"destructiveHint":false,"idempotentHint":false,"openWorldHint":true},
  "axway_apim_oauth_get": {"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true},
  "axway_apim_oauth_create": {"readOnlyHint":false,"destructiveHint":false,"idempotentHint":false,"openWorldHint":true},
  "axway_apim_proxy_list": {"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true},
  "axway_apim_proxy_get": {"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true},
  "axway_apim_proxyauth_get": {"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true},
  "axway_apim_catalog_get": {"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true},
  "axway_apim_proxy_create": {"readOnlyHint":false,"destructiveHint":false,"idempotentHint":false,"openWorldHint":true},
  "axway_apim_proxy_update": {"readOnlyHint":false,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true},
  "axway_apim_proxy_delete": {"readOnlyHint":false,"destructiveHint":true,"idempotentHint":true,"openWorldHint":true},
  "axway_apim_backend_list": {"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true},
  "axway_apim_backend_submit": {"readOnlyHint":false,"destructiveHint":false,"idempotentHint":false,"openWorldHint":true},
  "axway_apim_file_submit": {"readOnlyHint":false,"destructiveHint":false,"idempotentHint":false,"openWorldHint":true},
  "axway_apim_backend_delete": {"readOnlyHint":false,"destructiveHint":true,"idempotentHint":true,"openWorldHint":true},
  "axway_apim_access_list": {"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true},
  "axway_apim_access_update": {"readOnlyHint":false,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true},
  "axway_apim_access_delete": {"readOnlyHint":false,"destructiveHint":true,"idempotentHint":true,"openWorldHint":true},
  "axway_apim_alert_list": {"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true},
  "axway_apim_alert_update": {"readOnlyHint":false,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true},
  "axway_apim_quota_get": {"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true},
  "axway_apim_quota_update": {"readOnlyHint":false,"destructiveHint":false,"idempotentHint":true,"openWorldHint":true},
  "axway_apim_fragment_validate": {"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":false},
  "axway_apim_fragment_yaml_to_xml": {"readOnlyHint":false,"destructiveHint":false,"idempotentHint":true,"openWorldHint":false},
  "axway_apim_fragment_sync_ps_project": {"readOnlyHint":false,"destructiveHint":false,"idempotentHint":true,"openWorldHint":false},
  "axway_apim_fragment_gateway_resolve": {"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":false},
};

/**
 * Minimum profile required per tool (must stay in sync with tools() registration).
 */
export const TOOL_REQUIRED_PROFILE: Record<string, ToolProfile> = {
  "axway_apim_time_get": "observe",
  "axway_apim_config_get": "observe",
  "axway_apim_topology_list": "observe",
  "axway_apim_deployment_archive_get": "observe",
  "axway_apim_policy_archive_get": "observe",
  "axway_apim_environment_archive_get": "observe",
  "axway_apim_envsettings_get": "observe",
  "axway_apim_group_conf_get": "observe",
  "axway_apim_deployments_list": "observe",
  "axway_apim_instancetraffic_get": "observe",
  "axway_apim_servicetraffic_get": "observe",
  "axway_apim_metrics_get": "observe",
  "axway_apim_traffic_search": "observe",
  "axway_apim_trafficevent_get": "observe",
  "axway_apim_trafficpayload_get": "observe",
  "axway_apim_traffictrace_get": "observe",
  "axway_apim_organization_list": "observe",
  "axway_apim_organization_get": "observe",
  "axway_apim_organization_create": "admin",
  "axway_apim_organization_update": "admin",
  "axway_apim_organization_delete": "admin",
  "axway_apim_user_list": "observe",
  "axway_apim_user_get": "observe",
  "axway_apim_user_create": "admin",
  "axway_apim_user_update": "admin",
  "axway_apim_user_delete": "admin",
  "axway_apim_application_list": "observe",
  "axway_apim_application_get": "observe",
  "axway_apim_permission_get": "observe",
  "axway_apim_apikey_get": "admin",
  "axway_apim_apikey_create": "admin",
  "axway_apim_oauth_get": "admin",
  "axway_apim_oauth_create": "admin",
  "axway_apim_proxy_list": "observe",
  "axway_apim_proxy_get": "observe",
  "axway_apim_proxyauth_get": "observe",
  "axway_apim_catalog_get": "observe",
  "axway_apim_proxy_create": "admin",
  "axway_apim_proxy_update": "operator",
  "axway_apim_proxy_delete": "admin",
  "axway_apim_backend_list": "observe",
  "axway_apim_backend_submit": "admin",
  "axway_apim_file_submit": "admin",
  "axway_apim_backend_delete": "admin",
  "axway_apim_access_list": "observe",
  "axway_apim_access_update": "admin",
  "axway_apim_access_delete": "admin",
  "axway_apim_alert_list": "observe",
  "axway_apim_alert_update": "operator",
  "axway_apim_quota_get": "observe",
  "axway_apim_quota_update": "operator",
  "axway_apim_fragment_validate": "observe",
  "axway_apim_fragment_yaml_to_xml": "operator",
  "axway_apim_fragment_sync_ps_project": "operator",
  "axway_apim_fragment_gateway_resolve": "observe",
};

/** Optional human titles for tools/list. */
export const TOOL_TITLES: Record<string, string> = {
  "axway_apim_time_get": "MCP server time",
  "axway_apim_config_get": "API Manager config",
  "axway_apim_topology_list": "Gateway: topology (1st step)",
  "axway_apim_deployment_archive_get": "Gateway: retrieve deployed FED archive",
  "axway_apim_policy_archive_get": "Gateway: retrieve Policy Archive (.pol)",
  "axway_apim_environment_archive_get": "Gateway: retrieve Environment Archive (.env)",
  "axway_apim_envsettings_get": "Gateway: environmentalized settings (JSON)",
  "axway_apim_group_conf_get": "Gateway: read group conf file",
  "axway_apim_deployments_list": "Gateway: list domain deployments / archive IDs",
  "axway_apim_instancetraffic_get": "Gateway: instance traffic summary",
  "axway_apim_servicetraffic_get": "Gateway: service traffic",
  "axway_apim_metrics_get": "Gateway: metrics timeline",
  "axway_apim_traffic_search": "Gateway: search traffic events",
  "axway_apim_trafficevent_get": "Gateway: traffic event detail",
  "axway_apim_trafficpayload_get": "Gateway: traffic payload",
  "axway_apim_traffictrace_get": "Gateway: traffic trace",
  "axway_apim_organization_list": "APIM: list organizations",
  "axway_apim_organization_get": "APIM: get organization",
  "axway_apim_organization_create": "APIM: create organization",
  "axway_apim_organization_update": "APIM: update organization",
  "axway_apim_organization_delete": "APIM: delete organization",
  "axway_apim_user_list": "APIM: list users",
  "axway_apim_user_get": "APIM: get user",
  "axway_apim_user_create": "APIM: create user",
  "axway_apim_user_update": "APIM: update user",
  "axway_apim_user_delete": "APIM: delete user",
  "axway_apim_application_list": "APIM: list applications",
  "axway_apim_application_get": "APIM: get application",
  "axway_apim_permission_get": "APIM: application permissions",
  "axway_apim_apikey_get": "APIM: list API keys",
  "axway_apim_apikey_create": "APIM: create API key",
  "axway_apim_oauth_get": "APIM: list OAuth credentials",
  "axway_apim_oauth_create": "APIM: create OAuth credential",
  "axway_apim_proxy_list": "APIM: list proxies",
  "axway_apim_proxy_get": "APIM: get proxy",
  "axway_apim_proxyauth_get": "APIM: proxy auth info",
  "axway_apim_catalog_get": "APIM: API catalog",
  "axway_apim_proxy_create": "APIM: create proxy",
  "axway_apim_proxy_update": "APIM: update proxy / lifecycle",
  "axway_apim_proxy_delete": "APIM: delete proxy",
  "axway_apim_backend_list": "APIM: list backend APIs",
  "axway_apim_backend_submit": "APIM: import backend API",
  "axway_apim_file_submit": "APIM: stage import file",
  "axway_apim_backend_delete": "APIM: delete backend API",
  "axway_apim_access_list": "APIM: list API access grants",
  "axway_apim_access_update": "APIM: grant API access",
  "axway_apim_access_delete": "APIM: revoke API access",
  "axway_apim_alert_list": "Gateway: alert trigger config",
  "axway_apim_alert_update": "Gateway: update alert settings",
  "axway_apim_quota_get": "APIM: get application quotas",
  "axway_apim_quota_update": "APIM: update application quotas",
  "axway_apim_fragment_validate": "Fragment: validate YAML/XML",
  "axway_apim_fragment_yaml_to_xml": "Fragment: YAML to XML (Federated)",
  "axway_apim_fragment_sync_ps_project": "Fragment: sync ps-project",
  "axway_apim_fragment_gateway_resolve": "Fragment: resolve gatewayHome (tiers)",
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
