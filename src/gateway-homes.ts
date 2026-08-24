/**
 * @module src/gateway-homes
 * @description Resolves local Axway Gateway install paths (gatewayHome) from productVersion
 * mappings for Tier 1 fragment tools (yamles, Federated YAML→XML, import dry-run).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { AxwayApi } from "./api.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export type GatewayHomeMapping = {
  productVersion: string;
  gatewayHome: string;
};

export type GatewayHomesConfig = {
  mappings: GatewayHomeMapping[];
  defaultGatewayHome?: string | null;
};

export type GatewayHomeResolvedVia =
  | "explicit"
  | "instanceId"
  | "env"
  | "singleMapping"
  | "defaultGatewayHome"
  | "none";

export type GatewayHomeResolution = {
  gatewayHome?: string;
  productVersion?: string;
  instanceId?: string;
  resolvedVia: GatewayHomeResolvedVia;
  tier: 0 | 1;
  configPath?: string;
  message: string;
};

const CONFIG_REL = "config/axway-gateway-homes.json";

function repoConfigCandidates(): string[] {
  return [
    path.join(process.cwd(), CONFIG_REL),
    path.join(moduleDir, "..", CONFIG_REL),
  ];
}

function normalizeHome(home: string): string {
  return path.normalize(home.trim());
}

function homeExists(home: string): boolean {
  try {
    return fs.existsSync(home);
  } catch {
    return false;
  }
}

function parseConfigJson(raw: string, source: string): GatewayHomesConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON in ${source}: ${(err as Error).message}`);
  }

  if (Array.isArray(parsed)) {
    return { mappings: parsed as GatewayHomeMapping[], defaultGatewayHome: null };
  }

  const obj = parsed as GatewayHomesConfig;
  return {
    mappings: Array.isArray(obj.mappings) ? obj.mappings : [],
    defaultGatewayHome: obj.defaultGatewayHome ?? null,
  };
}

/** Loads version→gatewayHome mappings from env and config file. */
export function loadGatewayHomesConfig(): {
  config: GatewayHomesConfig;
  configPath?: string;
  source: string;
} {
  const envMap = process.env.AXWAY_GATEWAY_VERSION_MAP?.trim();
  if (envMap) {
    return {
      config: parseConfigJson(envMap, "AXWAY_GATEWAY_VERSION_MAP"),
      source: "AXWAY_GATEWAY_VERSION_MAP",
    };
  }

  for (const candidate of repoConfigCandidates()) {
    if (fs.existsSync(candidate)) {
      const raw = fs.readFileSync(candidate, "utf8");
      return {
        config: parseConfigJson(raw, candidate),
        configPath: candidate,
        source: candidate,
      };
    }
  }

  return { config: { mappings: [], defaultGatewayHome: null }, source: "(none)" };
}

function pickExistingHome(candidates: string[]): string | undefined {
  const normalized = [...new Set(candidates.map(normalizeHome).filter(Boolean))];
  const existing = normalized.filter(homeExists);
  if (existing.length === 1) return existing[0];
  if (existing.length > 1) {
    const onPlatform =
      process.platform === "win32"
        ? existing.find((h) => /^[a-zA-Z]:\\/.test(h) || h.includes("\\"))
        : existing.find((h) => h.startsWith("/"));
    return onPlatform ?? existing[0];
  }
  return normalized[0];
}

function lookupByProductVersion(
  config: GatewayHomesConfig,
  productVersion: string
): string | undefined {
  const matches = config.mappings.filter(
    (m) => m.productVersion?.trim() === productVersion.trim()
  );
  if (matches.length === 0) return undefined;
  return pickExistingHome(matches.map((m) => m.gatewayHome));
}

async function fetchProductVersion(
  api: AxwayApi,
  instanceId?: string
): Promise<{ productVersion: string; instanceId?: string }> {
  const response = await api.listTopology();
  const rawTopology = response.result;
  if (!rawTopology?.productVersion) {
    throw new Error(
      "Topology response missing productVersion — cannot resolve gatewayHome from instanceId."
    );
  }

  if (instanceId) {
    const groups = rawTopology.groups || [];
    const instances = groups.flatMap((g: { services?: { id: string }[] }) => g.services || []);
    const found = instances.some((s: { id: string }) => s.id === instanceId);
    if (!found) {
      throw new Error(
        `instanceId '${instanceId}' not found in topology. Call axway_apim_topology_list for current IDs.`
      );
    }
    return { productVersion: rawTopology.productVersion, instanceId };
  }

  return { productVersion: rawTopology.productVersion };
}

function libUnavailableMessage(productVersion?: string): string {
  if (productVersion) {
    return (
      `No gatewayHome mapping for productVersion ${productVersion}. Offline checks only (Tier 0). ` +
      `Configure ${CONFIG_REL}, set AXWAY_GATEWAY_VERSION_MAP / AXWAY_GATEWAY_HOME, or pass gatewayHome.`
    );
  }
  return (
    "No gatewayHome resolved. Tier 1 (Axway libs) unavailable. " +
    `Configure ${CONFIG_REL}, set AXWAY_GATEWAY_VERSION_MAP / AXWAY_GATEWAY_HOME, or pass gatewayHome.`
  );
}

export type ResolveGatewayHomeArgs = {
  gatewayHome?: string;
  instanceId?: string;
  requireLib?: boolean;
};

/**
 * Resolves gatewayHome for fragment tools.
 * Priority: explicit gatewayHome → instanceId+topology → AXWAY_GATEWAY_HOME → single mapping → defaultGatewayHome.
 */
export async function resolveGatewayHome(
  api: AxwayApi | undefined,
  args: ResolveGatewayHomeArgs = {}
): Promise<GatewayHomeResolution> {
  const { config, configPath, source } = loadGatewayHomesConfig();
  let productVersion: string | undefined;
  let instanceId = args.instanceId?.trim() || undefined;

  if (args.gatewayHome?.trim()) {
    const gatewayHome = normalizeHome(args.gatewayHome);
    return {
      gatewayHome,
      productVersion,
      instanceId,
      resolvedVia: "explicit",
      tier: 1,
      configPath,
      message: `Using explicit gatewayHome (${gatewayHome}).`,
    };
  }

  if (instanceId) {
    if (!api) {
      const msg =
        "instanceId requires live Gateway topology (AXWAY_GATEWAY_* credentials). " +
        "Pass gatewayHome or configure AXWAY_GATEWAY_HOME / axway-gateway-homes.json.";
      if (args.requireLib) throw new Error(msg);
      return {
        instanceId,
        resolvedVia: "none",
        tier: 0,
        configPath,
        message: msg,
      };
    }
    const topo = await fetchProductVersion(api, instanceId);
    productVersion = topo.productVersion;
    instanceId = topo.instanceId ?? instanceId;
    const mapped = lookupByProductVersion(config, productVersion);
    if (mapped) {
      return {
        gatewayHome: mapped,
        productVersion,
        instanceId,
        resolvedVia: "instanceId",
        tier: 1,
        configPath,
        message: `Resolved gatewayHome for productVersion ${productVersion} via mapping (${source}).`,
      };
    }
    if (args.requireLib) {
      throw new Error(libUnavailableMessage(productVersion));
    }
    return {
      productVersion,
      instanceId,
      resolvedVia: "none",
      tier: 0,
      configPath,
      message: libUnavailableMessage(productVersion),
    };
  }

  const envHome = process.env.AXWAY_GATEWAY_HOME?.trim();
  if (envHome) {
    const gatewayHome = normalizeHome(envHome);
    return {
      gatewayHome,
      resolvedVia: "env",
      tier: 1,
      configPath,
      message: `Using AXWAY_GATEWAY_HOME (${gatewayHome}).`,
    };
  }

  if (config.mappings.length === 1 && config.mappings[0].gatewayHome?.trim()) {
    const gatewayHome = normalizeHome(config.mappings[0].gatewayHome);
    productVersion = config.mappings[0].productVersion?.trim() || undefined;
    return {
      gatewayHome,
      productVersion,
      resolvedVia: "singleMapping",
      tier: 1,
      configPath,
      message: `Using sole mapping entry (${gatewayHome}) from ${source}.`,
    };
  }

  if (config.defaultGatewayHome?.trim()) {
    const gatewayHome = normalizeHome(config.defaultGatewayHome);
    return {
      gatewayHome,
      resolvedVia: "defaultGatewayHome",
      tier: 1,
      configPath,
      message: `Using defaultGatewayHome from ${source}.`,
    };
  }

  if (args.requireLib) {
    throw new Error(libUnavailableMessage(productVersion));
  }

  return {
    productVersion,
    instanceId,
    resolvedVia: "none",
    tier: 0,
    configPath,
    message: libUnavailableMessage(productVersion),
  };
}
