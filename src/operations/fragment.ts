/**
 * @module src/operations/fragment
 * @description MCP tools that run local Python scripts for Policy Studio configuration
 * fragments (validate, YAML→XML Federated export, ps-project sync).
 * Requires Python 3 on the MCP host; yaml→XML also requires Axway Gateway (Jython).
 *
 * Tiers:
 * - Tier 0 (offline): static YAML/XML checks — always available without gatewayHome.
 * - Tier 1 (Axway libs): yamles, yaml-frag-to-xml, import dry-run — need resolved gatewayHome.
 */

import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { AxwayApi } from "../api.js";
import { resolveGatewayHome, type GatewayHomeResolution } from "../gateway-homes.js";
import { cleanupAfterFragmentOperation } from "./fragment-cleanup.js";
import {
  assertSandboxPackage,
  bootstrapSandboxScripts,
  createSandboxDir,
  extractArchiveToSandbox,
  FragmentUploadError,
  purgeSandboxDir,
  purgeStaleSandboxes,
  writeSandboxFiles,
  type FragmentSandboxWriteStats,
} from "./fragment-sandbox.js";
import {
  defaultFragmentPackage,
  DEFAULT_XML_REL,
  findRepoRoot,
  EXTERNAL_POLICIES_REPO,
  resolveFragmentPackageRoot,
  resolvePackageScript,
  resolvePsProjectPath,
  resolveXmlOutputPath,
  scanFragmentPackages,
  type FragmentPackageInfo,
} from "./fragment-paths.js";

export {
  defaultFragmentPackage,
  EXTERNAL_POLICIES_REPO,
  FragmentPathSecurityError,
  findRepoRoot,
  isValidFragmentPackage,
  scanFragmentPackages,
} from "./fragment-paths.js";
export { FragmentUploadError } from "./fragment-sandbox.js";

export type FragmentPackagesListResult = {
  repoRoot: string;
  defaultPackage: string;
  fragmentPathHint: string;
  packages: FragmentPackageInfo[];
};

export type FragmentCommonArgs = {
  fragmentPath?: string;
  gatewayHome?: string;
  instanceId?: string;
};

export type FragmentValidateArgs = FragmentCommonArgs & {
  yamlOnly?: boolean;
  xmlOnly?: boolean;
  strict?: boolean;
  regenerateXml?: boolean;
};

export type FragmentValidateSubmitArgs = FragmentValidateArgs & {
  archiveBase64?: string;
  files?: Record<string, string>;
  packageLabel?: string;
};

export type FragmentValidateSubmitResult = ScriptRunResult & {
  sandbox?: {
    sandboxId: string;
    relativePath: string;
    purged: boolean;
    writeStats: FragmentSandboxWriteStats;
    bootstrapScripts?: string[];
    packageLabel?: string;
  };
};

export type FragmentYamlToXmlArgs = FragmentCommonArgs & {
  xmlOutputPath?: string;
};

export type FragmentSyncPsProjectArgs = {
  fragmentPath?: string;
  psProjectPath?: string;
};

export type FragmentGatewayResolveArgs = {
  instanceId?: string;
  gatewayHome?: string;
};

export type ScriptRunResult = {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  command: string[];
  cwd: string;
  script: string;
  resolvedPaths?: Record<string, string>;
  gatewayResolution?: GatewayHomeResolution;
};

/** Read-only discovery of fragment packages under policies/. */
export function listFragmentPackages(): FragmentPackagesListResult {
  const repoRoot = findRepoRoot();
  const defaultPackage = defaultFragmentPackage(repoRoot);
  return {
    repoRoot,
    defaultPackage,
    fragmentPathHint:
      "fragmentPath is the package ROOT (not the fragment/ subdirectory). " +
      "Use a path from axway_apim_fragment_packages_list when packages are mounted under policies/. " +
      `Policy packages live in the separate ${EXTERNAL_POLICIES_REPO} repo — use validate_submit for local-only packages. ` +
      "On the MCP pod, repo root is typically /app.",
    packages: scanFragmentPackages(repoRoot),
  };
}

function pythonCommand(): string {
  if (process.env.PYTHON?.trim()) {
    return process.env.PYTHON.trim();
  }
  return process.platform === "win32" ? "python" : "python3";
}

function jythonCommand(gatewayHome: string): string {
  const gateway = path.join(gatewayHome, "apigateway");
  if (process.platform === "win32") {
    const bat = path.join(gateway, "Win32", "bin", "jython.bat");
    if (fs.existsSync(bat)) return bat;
  } else {
    for (const plat of ["posix", "Linux.x86_64", "Linux.aarch64", "MacOSX"]) {
      const candidate = path.join(gateway, plat, "bin", "jython");
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  throw new Error(
    `Jython not found under ${gatewayHome}/apigateway — verify gatewayHome mapping or pass an explicit path`
  );
}

async function resolveLibGatewayHome(
  api: AxwayApi | undefined,
  args: FragmentCommonArgs,
  requireLib: boolean
): Promise<GatewayHomeResolution> {
  return resolveGatewayHome(api, {
    gatewayHome: args.gatewayHome,
    instanceId: args.instanceId,
    requireLib,
  });
}

function runProcess(
  command: string[],
  cwd: string,
  extraEnv?: Record<string, string>
): Promise<ScriptRunResult> {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, ...extraEnv };
    const proc = spawn(command[0], command.slice(1), {
      cwd,
      env,
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    proc.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on("error", (err) => reject(err));
    proc.on("close", (code) => {
      const exitCode = code ?? 1;
      resolve({
        success: exitCode === 0,
        exitCode,
        stdout,
        stderr,
        command,
        cwd,
        script: command.join(" "),
      });
    });
  });
}

/**
 * Read-only: resolves productVersion (optional) and gatewayHome for Tier 1 fragment ops.
 */
export async function resolveFragmentGateway(
  api: AxwayApi | undefined,
  args: FragmentGatewayResolveArgs = {}
): Promise<GatewayHomeResolution & { tiers: { tier0: string; tier1: string } }> {
  const resolution = await resolveGatewayHome(api, {
    gatewayHome: args.gatewayHome,
    instanceId: args.instanceId,
    requireLib: false,
  });
  return {
    ...resolution,
    tiers: {
      tier0:
        "Tier 0 (offline): axway_apim_fragment_validate sem strict/regenerateXml; axway_apim_fragment_sync_ps_project — Python 3 apenas.",
      tier1:
        "Tier 1 (Axway libs): yamles, yaml-frag-to-xml, import dry-run — exige gatewayHome resolvido (mapeamento, env ou parâmetro).",
    },
  };
}

/**
 * Validates Policy Studio configuration fragment YAML/XML (offline + optional Axway checks).
 */
export async function validateFragment(
  api: AxwayApi | undefined,
  args: FragmentValidateArgs = {}
): Promise<ScriptRunResult> {
  const repoRoot = findRepoRoot();
  const packageRoot = resolveFragmentPackageRoot(repoRoot, args.fragmentPath);
  const scriptPath = resolvePackageScript(packageRoot, "validate-fragment.py");
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`validate-fragment.py not found: ${scriptPath}`);
  }

  const needsLib = Boolean(args.strict || args.regenerateXml);
  const gatewayResolution = await resolveLibGatewayHome(api, args, needsLib);
  const gatewayHome = gatewayResolution.gatewayHome;

  const fragmentYamlDir = path.join(packageRoot, "fragment");
  const xmlPath = path.join(packageRoot, DEFAULT_XML_REL);

  const cmd = [
    pythonCommand(),
    scriptPath,
    "--fragment",
    fragmentYamlDir,
    "--xml",
    xmlPath,
  ];

  if (args.yamlOnly) cmd.push("--yaml-only");
  if (args.xmlOnly) cmd.push("--xml-only");
  if (args.strict) cmd.push("--strict");
  if (args.regenerateXml) cmd.push("--regenerate-xml");

  if (gatewayHome) {
    cmd.push("--gateway-home", gatewayHome);
  }

  const result = await runProcess(cmd, packageRoot, gatewayHome
    ? { AXWAY_GATEWAY_HOME: gatewayHome }
    : undefined);

  result.gatewayResolution = gatewayResolution;
  result.resolvedPaths = {
    repoRoot,
    packageRoot,
    fragmentYamlDir,
    xmlPath,
    gatewayHome: gatewayHome ?? "(not set — Tier 0 offline only)",
    tier: gatewayHome ? "1" : "0",
  };

  if (result.success && args.regenerateXml) {
    cleanupAfterFragmentOperation();
  }

  return result;
}

/**
 * Validates an uploaded fragment package (tar.gz base64 or files map) in an ephemeral sandbox.
 * Sandbox is always purged after validation (success or failure).
 */
export async function validateFragmentSubmit(
  api: AxwayApi | undefined,
  args: FragmentValidateSubmitArgs = {}
): Promise<FragmentValidateSubmitResult> {
  const hasArchive = Boolean(args.archiveBase64?.trim());
  const hasFiles = Boolean(args.files && Object.keys(args.files).length > 0);

  if (!hasArchive && !hasFiles) {
    throw new FragmentUploadError(
      "Provide archiveBase64 (tar.gz) or files (map of relative path → base64 content)"
    );
  }
  if (hasArchive && hasFiles) {
    throw new FragmentUploadError(
      "Provide only one of archiveBase64 or files, not both"
    );
  }

  const repoRoot = findRepoRoot();
  purgeStaleSandboxes();

  const sandbox = createSandboxDir(repoRoot, args.packageLabel);
  let writeStats: FragmentSandboxWriteStats = { fileCount: 0, totalBytes: 0 };
  let bootstrapScripts: string[] = [];
  let output: FragmentValidateSubmitResult | undefined;

  try {
    if (hasArchive) {
      writeStats = extractArchiveToSandbox(
        sandbox.absolutePath,
        args.archiveBase64!
      );
    } else {
      writeStats = writeSandboxFiles(sandbox.absolutePath, args.files!);
    }

    bootstrapScripts = bootstrapSandboxScripts(repoRoot, sandbox.absolutePath);
    assertSandboxPackage(sandbox.absolutePath);

    const result = await validateFragment(api, {
      ...args,
      fragmentPath: sandbox.relativePath,
    });

    output = {
      ...result,
      sandbox: {
        sandboxId: sandbox.sandboxId,
        relativePath: sandbox.relativePath,
        purged: false,
        writeStats,
        bootstrapScripts: bootstrapScripts.length > 0 ? bootstrapScripts : undefined,
        packageLabel: sandbox.label,
      },
    };
    return output;
  } finally {
    const purged = purgeSandboxDir(sandbox.absolutePath);
    if (output?.sandbox) {
      output.sandbox.purged = purged;
    }
    purgeStaleSandboxes(0);
  }
}

/**
 * Regenerates Policy Studio-compatible XML from YAML via Federated Entity Store (Jython).
 */
export async function fragmentYamlToXml(
  api: AxwayApi | undefined,
  args: FragmentYamlToXmlArgs = {}
): Promise<ScriptRunResult> {
  const repoRoot = findRepoRoot();
  const packageRoot = resolveFragmentPackageRoot(repoRoot, args.fragmentPath);
  const scriptPath = resolvePackageScript(packageRoot, "yaml-frag-to-xml.py");
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`yaml-frag-to-xml.py not found: ${scriptPath}`);
  }

  const gatewayResolution = await resolveLibGatewayHome(api, args, true);
  const gatewayHome = gatewayResolution.gatewayHome!;

  const fragmentYamlDir = path.join(packageRoot, "fragment");
  const xmlOut = resolveXmlOutputPath(repoRoot, packageRoot, args.xmlOutputPath);

  const jython = jythonCommand(gatewayHome);
  const cmd = [
    jython,
    scriptPath,
    "--fragment",
    fragmentYamlDir,
    "--xml-output",
    xmlOut,
    "--gateway-home",
    gatewayHome,
  ];

  const result = await runProcess(cmd, packageRoot, {
    AXWAY_GATEWAY_HOME: gatewayHome,
  });

  result.gatewayResolution = gatewayResolution;
  result.resolvedPaths = {
    repoRoot,
    packageRoot,
    fragmentYamlDir,
    xmlOutputPath: xmlOut,
    gatewayHome,
    tier: "1",
  };

  if (result.success) {
    cleanupAfterFragmentOperation();
  }

  return result;
}

/**
 * Copies canonical fragment/ tree into ps-project-with-sync/ for Policy Studio alignment.
 */
export async function syncPsProjectFromFragment(
  args: FragmentSyncPsProjectArgs = {}
): Promise<ScriptRunResult> {
  const repoRoot = findRepoRoot();
  const packageRoot = resolveFragmentPackageRoot(repoRoot, args.fragmentPath);
  const scriptPath = resolvePackageScript(
    packageRoot,
    "sync-ps-project-from-fragment.py"
  );
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`sync-ps-project-from-fragment.py not found: ${scriptPath}`);
  }

  const fragmentYamlDir = path.join(packageRoot, "fragment");
  const psProject = resolvePsProjectPath(repoRoot, packageRoot, args.psProjectPath);

  const cmd = [
    pythonCommand(),
    scriptPath,
    "--fragment-path",
    fragmentYamlDir,
    "--ps-project-path",
    psProject,
  ];

  const result = await runProcess(cmd, packageRoot);

  result.resolvedPaths = {
    repoRoot,
    packageRoot,
    fragmentYamlDir,
    psProjectPath: psProject,
    tier: "0",
  };

  if (result.success) {
    cleanupAfterFragmentOperation();
  }

  return result;
}

/** Markdown listing for axway://apim/policies/packages resource. */
export function formatFragmentPackagesResource(): string {
  const data = listFragmentPackages();
  const lines = [
    "# Fragment packages (policies/)",
    "",
    `Repo root: \`${data.repoRoot}\``,
    `Default package: \`${data.defaultPackage}\``,
    "",
    data.fragmentPathHint,
    "",
    "Fragment tools only accept whitelisted packages under `policies/`. Generated XML and trace files are ephemeral and purged by age on the MCP host.",
    "",
    "Discover live via tool `axway_apim_fragment_packages_list` before validate/yaml_to_xml when fragmentPath is unknown.",
    "",
  ];
  if (data.packages.length === 0) {
    lines.push("_No fragment packages found under policies/._");
  } else {
    lines.push("| Package | default | YAML fragment | XML export | validate script |");
    lines.push("|---------|---------|---------------|------------|-----------------|");
    for (const pkg of data.packages) {
      lines.push(
        `| \`${pkg.relativePath}\` | ${pkg.default ? "yes" : "no"} | ${pkg.hasYamlFragment ? "yes" : "no"} | ${pkg.hasXml ? "yes" : "no"} | ${pkg.hasScripts ? "yes" : "no"} |`
      );
    }
  }
  return lines.join("\n");
}
