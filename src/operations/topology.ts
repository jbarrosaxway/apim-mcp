/**
 * @module src/operations/topology
 * @description This module contains the operations (tools) for discovering the topology
 * of the Axway API Gateway domain. Topology includes information about groups and instances.
 */

import * as fs from "fs";
import * as path from "path";
import { Buffer } from "buffer";
import { AxwayApi } from "../api.js";

/** Max FED size returned inline as base64 in tool JSON (remote agents without savePath). */
const MAX_INLINE_FED_BASE64_BYTES = 8 * 1024 * 1024;

async function resolveInstanceId(api: AxwayApi, instanceId?: string): Promise<string> {
  if (instanceId) return instanceId;
  const response = await api.listTopology();
  const groups = response.result?.groups || [];
  const instances = groups.flatMap((group: any) =>
    (group.services || []).map((service: any) => ({
      instanceId: service.id,
      instanceName: service.name,
    }))
  );
  if (instances.length === 0) {
    throw new Error("No Gateway instances found in topology.");
  }
  if (instances.length > 1) {
    const list = instances.map((i: any) => `${i.instanceName} (${i.instanceId})`).join(", ");
    throw new Error(`Multiple instances found; specify instanceId. Available: ${list}`);
  }
  return instances[0].instanceId;
}

/**
 * Tool to list the API Gateway domain topology.
 *
 * This function is essential for environment discovery, providing the instance IDs
 * needed by most other monitoring and traffic tools.
 *
 * @param api AxwayApi class instance.
 * @returns An object containing domain information and a list of groups with their instances.
 */
export async function listTopology(api: AxwayApi) {
  try {
    const response = await api.listTopology();

    // Topology data is nested under the 'result' key.
    const rawTopology = response.result;

    if (!rawTopology) {
      throw new Error("Failed to retrieve topology data. The API returned an invalid response structure.");
    }
    
    const groups = rawTopology.groups || [];
    if (!Array.isArray(groups)) {
      console.warn("Topology 'groups' property is not an array:", groups);
      return { message: "No groups found in the topology.", groups: [] };
    }

    const transformedGroups = groups.map((group: any) => {
      const instances = group.services || [];
      return {
        groupId: group.id,
        groupName: group.name,
        instances: Array.isArray(instances) ? instances.map((service: any) => ({
          instanceId: service.id,
          instanceName: service.name,
          instanceType: service.type,
          tags: service.tags
        })) : []
      };
    });

    const allInstances = transformedGroups.flatMap((g: any) => g.instances);

    return {
      domainInfo: {
        domainId: rawTopology.id,
        productVersion: rawTopology.productVersion,
      },
      groupCount: transformedGroups.length,
      instanceCount: allInstances.length,
      groups: transformedGroups,
      message: `Topology retrieved with ${transformedGroups.length} group(s) and ${allInstances.length} instance(s).`,
      relatedTools: [
        ...allInstances.map((inst: any) => ({
          tool_name: "axway_apim_deployment_archive_get",
          description: `Download deployed FED for instance '${inst.instanceName}'.`,
          parameters: [{ name: "instanceId", value: inst.instanceId }],
        })),
        ...allInstances.map((inst: any) => ({
          tool_name: "get_instance_traffic",
          description: `Get traffic metrics for instance '${inst.instanceName}'.`,
          parameters: [{ name: "instanceId", value: inst.instanceId }],
        })),
        ...allInstances.map((inst: any) => ({
          tool_name: "search_traffic_events",
          description: `Search recent traffic events on instance '${inst.instanceName}'.`,
          parameters: [
            { name: "instanceId", value: inst.instanceId },
            { name: "ago", value: "10m" },
          ],
        })),
      ],
    };
  } catch (error) {
    console.error("Error listing topology:", error);
    throw error;
  }
}

/**
 * Downloads the Deployment Archive (.fed) for a Gateway instance via Axway ANM APIs.
 * Primary: Deployment API; fallback: Routing API configuration archive (EMT / 405).
 */
export async function getDeploymentArchive(
  api: AxwayApi,
  instanceId?: string,
  savePath?: string,
  returnBase64?: boolean
) {
  const serviceId = await resolveInstanceId(api, instanceId);
  const { payload: response, source } = await api.getFedArchive(serviceId);

  if (response.errors?.length) {
    throw new Error(`Deployment API errors: ${JSON.stringify(response.errors)}`);
  }

  const packaged = packageBinaryArchive({
    response,
    kind: "fed",
    fileExtension: ".fed",
    savePath,
    returnBase64,
    endpoint: source === "deployment-api"
      ? "GET /deployment/archive/service/{serviceID}"
      : "GET /router/service/{instance}/api/configuration/archive",
    identity: { instanceId: serviceId, source },
  });

  return {
    ...packaged,
    axwayEndpoints: {
      primary: "GET /deployment/archive/service/{serviceID}",
      fallback: "GET /router/service/{instance}/api/configuration/archive",
      used: packaged.endpoint,
    },
    agentNextSteps: [
      "Decode dataBase64 to a .fed file (ZIP) or use savedPath on the MCP host.",
      "Extract XML: unzip or scripts/extract-fed.sh (see axway://apim/playbook/gateway-code-analysis).",
      "Correlate proxy_get (invoke/routing) with PrimaryStore.xml and EnvSettingsStore.xml.",
      "Decompile Gateway JARs (same productVersion as topology) in the calling agent environment — not via MCP tools.",
    ],
    playbookResource: "axway://apim/playbook/gateway-code-analysis",
    message: `Deployment archive (.fed) retrieved for instance ${serviceId} (${packaged.byteLength} bytes) via ${source}.`,
  };
}

type ArchiveKind = "fed" | "policy" | "environment";

function packageBinaryArchive(opts: {
  response: any;
  kind: ArchiveKind;
  fileExtension: string;
  savePath?: string;
  returnBase64?: boolean;
  endpoint: string;
  identity: Record<string, unknown>;
}) {
  const b64 = opts.response.result?.data;
  if (!b64 || typeof b64 !== "string") {
    throw new Error(
      `${opts.kind} archive response missing result.data (base64 payload).`
    );
  }

  const bytes = Buffer.from(b64, "base64");
  let savedPath: string | null = null;

  if (opts.savePath) {
    fs.mkdirSync(path.dirname(opts.savePath), { recursive: true });
    fs.writeFileSync(opts.savePath, bytes);
    savedPath = opts.savePath;
  }

  const includeBase64 = opts.returnBase64 ?? !opts.savePath;
  const inlineAllowed =
    includeBase64 && bytes.length <= MAX_INLINE_FED_BASE64_BYTES;

  return {
    ...opts.identity,
    kind: opts.kind,
    fileExtension: opts.fileExtension,
    endpoint: opts.endpoint,
    rootProperties: opts.response.result?.rootProperties,
    byteLength: bytes.length,
    decoded: true,
    savedPath,
    dataBase64: inlineAllowed ? b64 : undefined,
    dataBase64Omitted: includeBase64 && !inlineAllowed
      ? `Archive exceeds ${MAX_INLINE_FED_BASE64_BYTES} bytes; pass savePath on the MCP server filesystem.`
      : undefined,
  };
}

async function resolveArchiveTarget(
  api: AxwayApi,
  args: { instanceId?: string; groupId?: string; archiveId?: string }
): Promise<
  | { mode: "service"; serviceId: string }
  | { mode: "group"; groupId: string; archiveId: string }
> {
  if (args.groupId && args.archiveId) {
    return { mode: "group", groupId: args.groupId, archiveId: args.archiveId };
  }
  if (args.groupId || args.archiveId) {
    throw new Error("Provide both groupId and archiveId, or use instanceId.");
  }
  const serviceId = await resolveInstanceId(api, args.instanceId);
  return { mode: "service", serviceId };
}

/** Policy Archive (.pol) for an instance or group/archiveId. */
export async function getPolicyArchive(
  api: AxwayApi,
  args: {
    instanceId?: string;
    groupId?: string;
    archiveId?: string;
    savePath?: string;
    returnBase64?: boolean;
  }
) {
  try {
    const target = await resolveArchiveTarget(api, args);
    const response =
      target.mode === "service"
        ? await api.getPolicyArchiveByService(target.serviceId)
        : await api.getPolicyArchiveByGroup(target.groupId, target.archiveId);

    if (response.errors?.length) {
      throw new Error(`Policy archive API errors: ${JSON.stringify(response.errors)}`);
    }

    const endpoint =
      target.mode === "service"
        ? "GET /deployment/archive/policy/service/{serviceID}"
        : "GET /deployment/archive/policy/{groupID}/{archiveID}";

    const packaged = packageBinaryArchive({
      response,
      kind: "policy",
      fileExtension: ".pol",
      savePath: args.savePath,
      returnBase64: args.returnBase64,
      endpoint,
      identity: target.mode === "service"
        ? { instanceId: target.serviceId }
        : { groupId: target.groupId, archiveId: target.archiveId },
    });

    return {
      ...packaged,
      message: `Policy archive (.pol) retrieved (${packaged.byteLength} bytes) via ${endpoint}.`,
      relatedTools: [
        { tool_name: "axway_apim_environment_archive_get", description: "Download matching .env archive." },
        { tool_name: "axway_apim_deployment_archive_get", description: "Download merged .fed for the instance." },
      ],
    };
  } catch (error: any) {
    throwEmtHint(error, "policy archive (.pol)", "axway_apim_deployment_archive_get");
  }
}

/** Environment Archive (.env) for an instance or group/archiveId. */
export async function getEnvironmentArchive(
  api: AxwayApi,
  args: {
    instanceId?: string;
    groupId?: string;
    archiveId?: string;
    savePath?: string;
    returnBase64?: boolean;
  }
) {
  try {
    const target = await resolveArchiveTarget(api, args);
    const response =
      target.mode === "service"
        ? await api.getEnvironmentArchiveByService(target.serviceId)
        : await api.getEnvironmentArchiveByGroup(target.groupId, target.archiveId);

    if (response.errors?.length) {
      throw new Error(`Environment archive API errors: ${JSON.stringify(response.errors)}`);
    }

    const endpoint =
      target.mode === "service"
        ? "GET /deployment/archive/environment/service/{serviceID}"
        : "GET /deployment/archive/environment/{groupID}/{archiveID}";

    const packaged = packageBinaryArchive({
      response,
      kind: "environment",
      fileExtension: ".env",
      savePath: args.savePath,
      returnBase64: args.returnBase64,
      endpoint,
      identity: target.mode === "service"
        ? { instanceId: target.serviceId }
        : { groupId: target.groupId, archiveId: target.archiveId },
    });

    return {
      ...packaged,
      message: `Environment archive (.env) retrieved (${packaged.byteLength} bytes) via ${endpoint}.`,
      relatedTools: [
        { tool_name: "axway_apim_policy_archive_get", description: "Download matching .pol archive." },
        { tool_name: "axway_apim_envsettings_get", description: "Get environmentalized settings as JSON." },
      ],
    };
  } catch (error: any) {
    throwEmtHint(error, "environment archive (.env)", "axway_apim_deployment_archive_get");
  }
}

/** Environmentalized settings (JSON entities, not a ZIP). */
export async function getEnvSettings(
  api: AxwayApi,
  args: { instanceId?: string; groupId?: string; archiveId?: string }
) {
  try {
    const target = await resolveArchiveTarget(api, args);
    const response =
      target.mode === "service"
        ? await api.getEnvSettingsByService(target.serviceId)
        : await api.getEnvSettingsByGroup(target.groupId, target.archiveId);

    if (response.errors?.length) {
      throw new Error(`Env settings API errors: ${JSON.stringify(response.errors)}`);
    }

    const endpoint =
      target.mode === "service"
        ? "GET /deployment/envsettings/service/{serviceID}"
        : "GET /deployment/envsettings/{groupID}/{archiveID}";

    return {
      ...(target.mode === "service"
        ? { instanceId: target.serviceId }
        : { groupId: target.groupId, archiveId: target.archiveId }),
      endpoint,
      envSettings: response.result ?? null,
      message: `Environmentalized settings retrieved via ${endpoint}.`,
      relatedTools: [
        { tool_name: "axway_apim_environment_archive_get", description: "Download .env archive binary." },
        { tool_name: "axway_apim_deployment_archive_get", description: "Download full .fed." },
      ],
    };
  } catch (error: any) {
    throwEmtHint(error, "environmentalized settings", "axway_apim_deployment_archive_get");
  }
}

/**
 * Reads a file from the group's conf directory (internal ANM API; may contain secrets).
 */
export async function getGroupConfFile(
  api: AxwayApi,
  groupId: string,
  filename: string,
  savePath?: string,
  returnBase64?: boolean
) {
  if (!groupId?.trim() || !filename?.trim()) {
    throw new Error("groupId and filename are required.");
  }
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    throw new Error("filename must be a simple name without path separators.");
  }

  try {
    const response = await api.getGroupConfFile(groupId, filename);
    if (response.errors?.length) {
      throw new Error(`Group conf API errors: ${JSON.stringify(response.errors)}`);
    }

    const result = response.result;
    if (result == null) {
      throw new Error("Group conf response missing result.");
    }

    const endpoint = "GET /deployment/group/conf/{groupID}/{filename}";
    const asString = typeof result === "string" ? result : JSON.stringify(result);

    // Prefer treating result as base64 when it decodes cleanly to non-empty bytes.
    let bytes: Buffer | null = null;
    try {
      const decoded = Buffer.from(asString, "base64");
      if (decoded.length > 0 && asString.replace(/\s/g, "").length % 4 === 0) {
        bytes = decoded;
      }
    } catch {
      bytes = null;
    }

    let savedPath: string | null = null;
    if (savePath && bytes) {
      fs.mkdirSync(path.dirname(savePath), { recursive: true });
      fs.writeFileSync(savePath, bytes);
      savedPath = savePath;
    } else if (savePath && !bytes) {
      fs.mkdirSync(path.dirname(savePath), { recursive: true });
      fs.writeFileSync(savePath, asString, "utf8");
      savedPath = savePath;
    }

    const includeBase64 = returnBase64 ?? !savePath;
    const inlineAllowed =
      includeBase64 && bytes != null && bytes.length <= MAX_INLINE_FED_BASE64_BYTES;

    return {
      groupId,
      filename,
      endpoint,
      sensitive: true,
      note: "Axway marks this as an internal method used by managedomain; response may contain secrets.",
      byteLength: bytes?.length,
      contentType: bytes ? "base64-decoded-file" : "string",
      content: bytes ? undefined : asString,
      savedPath,
      dataBase64: inlineAllowed ? asString : undefined,
      dataBase64Omitted: includeBase64 && bytes && !inlineAllowed
        ? `File exceeds ${MAX_INLINE_FED_BASE64_BYTES} bytes; pass savePath on the MCP server filesystem.`
        : undefined,
      message: `Group conf file '${filename}' retrieved for group ${groupId}.`,
      relatedTools: [
        { tool_name: "axway_apim_deployments_list", description: "List deployments / archive IDs for groups." },
        { tool_name: "axway_apim_topology_list", description: "Resolve groupId from topology." },
      ],
    };
  } catch (error: any) {
    throwEmtHint(error, "group conf file", "axway_apim_deployment_archive_get");
  }
}

function throwEmtHint(error: any, what: string, fallbackTool: string): never {
  if (isEmtBlocked(error)) {
    throw new Error(
      `Cannot download ${what}: Externally Managed Topology (EMT) blocks this Deployment API method (HTTP 405). ` +
        `Use ${fallbackTool} for the merged .fed (supported under EMT). Original: ${error.message || error}`
    );
  }
  throw error;
}

/** Domain-wide deployment metadata including archive IDs per instance. */
export async function listDomainDeployments(api: AxwayApi) {
  try {
    const response = await api.listDomainDeployments();
    if (response.errors?.length) {
      throw new Error(`Domain deployments API errors: ${JSON.stringify(response.errors)}`);
    }

    return {
      endpoint: "GET /deployment/domain/deployments",
      source: "deployment-api",
      deployments: response.result ?? response,
      message:
        "Domain deployment details retrieved. archiveID is typically rootProperties.Id on each instance entry.",
      relatedTools: [
        {
          tool_name: "axway_apim_deployment_archive_get",
          description: "Download .fed by instanceId (preferred) or use groupId+archiveId variants on policy/env tools.",
        },
        {
          tool_name: "axway_apim_policy_archive_get",
          description: "Download .pol with groupId + archiveId from this listing.",
        },
        {
          tool_name: "axway_apim_environment_archive_get",
          description: "Download .env with groupId + archiveId from this listing.",
        },
      ],
    };
  } catch (error: any) {
    if (!isEmtBlocked(error)) throw error;

    // EMT: Deployment API list is unavailable — collect archiveId via Configuration API per instance.
    const topo = await listTopology(api);
    const instances = (topo.groups || []).flatMap((g: any) =>
      (g.instances || []).map((inst: any) => ({
        groupId: g.groupId,
        groupName: g.groupName,
        ...inst,
      }))
    );

    const deployments: any[] = [];
    for (const inst of instances) {
      try {
        const encoded = encodeURIComponent(inst.instanceId);
        const res = await api.getGateway(
          `/router/service/${encoded}/api/configuration/archiveId`
        );
        deployments.push({
          groupId: inst.groupId,
          instanceId: inst.instanceId,
          instanceName: inst.instanceName,
          instanceType: inst.instanceType,
          archiveId: res.data?.result ?? res.data,
          source: "routing-api-archiveId",
        });
      } catch (instErr: any) {
        deployments.push({
          groupId: inst.groupId,
          instanceId: inst.instanceId,
          instanceName: inst.instanceName,
          error: instErr.message || String(instErr),
        });
      }
    }

    return {
      endpoint: "GET /router/service/{instance}/api/configuration/archiveId",
      source: "routing-api-fallback",
      emtNote:
        "GET /deployment/domain/deployments returned 405 (Externally Managed Topology). Fell back to per-instance archiveId via Configuration API.",
      deployments,
      message:
        "EMT domain: archive IDs collected per instance via Routing/Configuration API. Policy/env/group-conf Deployment API downloads are typically also blocked under EMT — use axway_apim_deployment_archive_get (.fed) instead.",
      relatedTools: [
        {
          tool_name: "axway_apim_deployment_archive_get",
          description: "Download .fed (works under EMT via Deployment API or Routing API fallback).",
        },
      ],
    };
  }
}

function isEmtBlocked(error: any): boolean {
  const status =
    error.response?.status ??
    Number((String(error.message).match(/Status (\d{3})/) || [])[1]);
  const text = String(error.message || "");
  return (
    status === 405 ||
    status === 501 ||
    /externally managed topology/i.test(text)
  );
}
