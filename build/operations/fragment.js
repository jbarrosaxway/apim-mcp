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
import { fileURLToPath } from "url";
import { resolveGatewayHome } from "../gateway-homes.js";
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_FRAGMENT_PACKAGE = "policies/client-registry-sync";
const DEFAULT_XML_REL = "fragment-xml/client-registry-sync-fragment.xml";
const DEFAULT_PS_PROJECT_REL = "ps-project-with-sync";
/** Locate repo root (directory containing policies/client-registry-sync). */
export function findRepoRoot() {
    const candidates = [
        process.cwd(),
        path.join(moduleDir, "..", ".."),
        path.join(moduleDir, ".."),
    ];
    for (const candidate of candidates) {
        const pkg = path.join(candidate, DEFAULT_FRAGMENT_PACKAGE);
        if (fs.existsSync(pkg)) {
            return candidate;
        }
    }
    return process.cwd();
}
function resolvePackageRoot(repoRoot, fragmentPath) {
    const rel = fragmentPath?.trim() || DEFAULT_FRAGMENT_PACKAGE;
    const resolved = path.isAbsolute(rel) ? rel : path.join(repoRoot, rel);
    if (!fs.existsSync(resolved)) {
        throw new Error(`Fragment package path not found: ${resolved}`);
    }
    return resolved;
}
function pythonCommand() {
    if (process.env.PYTHON?.trim()) {
        return process.env.PYTHON.trim();
    }
    return process.platform === "win32" ? "python" : "python3";
}
function jythonCommand(gatewayHome) {
    const gateway = path.join(gatewayHome, "apigateway");
    if (process.platform === "win32") {
        const bat = path.join(gateway, "Win32", "bin", "jython.bat");
        if (fs.existsSync(bat))
            return bat;
    }
    else {
        for (const plat of ["posix", "Linux.x86_64", "Linux.aarch64", "MacOSX"]) {
            const candidate = path.join(gateway, plat, "bin", "jython");
            if (fs.existsSync(candidate))
                return candidate;
        }
    }
    throw new Error(`Jython not found under ${gatewayHome}/apigateway — verify gatewayHome mapping or pass an explicit path`);
}
async function resolveLibGatewayHome(api, args, requireLib) {
    return resolveGatewayHome(api, {
        gatewayHome: args.gatewayHome,
        instanceId: args.instanceId,
        requireLib,
    });
}
function runProcess(command, cwd, extraEnv) {
    return new Promise((resolve, reject) => {
        const env = { ...process.env, ...extraEnv };
        const proc = spawn(command[0], command.slice(1), {
            cwd,
            env,
            windowsHide: true,
        });
        let stdout = "";
        let stderr = "";
        proc.stdout?.on("data", (chunk) => {
            stdout += chunk.toString();
        });
        proc.stderr?.on("data", (chunk) => {
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
export async function resolveFragmentGateway(api, args = {}) {
    const resolution = await resolveGatewayHome(api, {
        gatewayHome: args.gatewayHome,
        instanceId: args.instanceId,
        requireLib: false,
    });
    return {
        ...resolution,
        tiers: {
            tier0: "Tier 0 (offline): axway_apim_fragment_validate sem strict/regenerateXml; axway_apim_fragment_sync_ps_project — Python 3 apenas.",
            tier1: "Tier 1 (Axway libs): yamles, yaml-frag-to-xml, import dry-run — exige gatewayHome resolvido (mapeamento, env ou parâmetro).",
        },
    };
}
/**

 * Validates Client Registry Sync fragment YAML/XML (offline + optional Axway checks).

 */
export async function validateFragment(api, args = {}) {
    const repoRoot = findRepoRoot();
    const packageRoot = resolvePackageRoot(repoRoot, args.fragmentPath);
    const scriptsDir = path.join(packageRoot, "scripts");
    const scriptPath = path.join(scriptsDir, "validate-fragment.py");
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
    if (args.yamlOnly)
        cmd.push("--yaml-only");
    if (args.xmlOnly)
        cmd.push("--xml-only");
    if (args.strict)
        cmd.push("--strict");
    if (args.regenerateXml)
        cmd.push("--regenerate-xml");
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
    return result;
}
/**

 * Regenerates Policy Studio-compatible XML from YAML via Federated Entity Store (Jython).

 */
export async function fragmentYamlToXml(api, args = {}) {
    const repoRoot = findRepoRoot();
    const packageRoot = resolvePackageRoot(repoRoot, args.fragmentPath);
    const scriptsDir = path.join(packageRoot, "scripts");
    const scriptPath = path.join(scriptsDir, "yaml-frag-to-xml.py");
    if (!fs.existsSync(scriptPath)) {
        throw new Error(`yaml-frag-to-xml.py not found: ${scriptPath}`);
    }
    const gatewayResolution = await resolveLibGatewayHome(api, args, true);
    const gatewayHome = gatewayResolution.gatewayHome;
    const fragmentYamlDir = path.join(packageRoot, "fragment");
    const xmlOut = args.xmlOutputPath?.trim()
        ? path.isAbsolute(args.xmlOutputPath)
            ? args.xmlOutputPath
            : path.join(repoRoot, args.xmlOutputPath)
        : path.join(packageRoot, DEFAULT_XML_REL);
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
    return result;
}
/**

 * Copies canonical fragment/ tree into ps-project-with-sync/ for Policy Studio alignment.

 */
export async function syncPsProjectFromFragment(args = {}) {
    const repoRoot = findRepoRoot();
    const packageRoot = resolvePackageRoot(repoRoot, args.fragmentPath);
    const scriptsDir = path.join(packageRoot, "scripts");
    const scriptPath = path.join(scriptsDir, "sync-ps-project-from-fragment.py");
    if (!fs.existsSync(scriptPath)) {
        throw new Error(`sync-ps-project-from-fragment.py not found: ${scriptPath}`);
    }
    const fragmentYamlDir = path.join(packageRoot, "fragment");
    const psProject = args.psProjectPath?.trim()
        ? path.isAbsolute(args.psProjectPath)
            ? args.psProjectPath
            : path.join(repoRoot, args.psProjectPath)
        : path.join(packageRoot, DEFAULT_PS_PROJECT_REL);
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
    return result;
}
//# sourceMappingURL=fragment.js.map