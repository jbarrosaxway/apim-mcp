/**

 * @module src/operations/fragment-paths

 * @description Path validation for fragment MCP tools — prevents traversal and writes outside whitelisted package trees.

 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
/** External policy packages repo (not shipped with MCP by default). */
export const EXTERNAL_POLICIES_REPO = "apim-policies";
export const DEFAULT_XML_REL = "fragment-xml/fragment.xml";
export const DEFAULT_PS_PROJECT_REL = "ps-project";
/** Raised when a path is rejected for security reasons (traversal, outside whitelist, invalid package). */
export class FragmentPathSecurityError extends Error {
    constructor(message) {
        super(message);
        this.name = "FragmentPathSecurityError";
    }
}
/** Locate MCP server repo root (directory containing build/index.js or package.json). */
export function findRepoRoot() {
    const candidates = [
        process.cwd(),
        path.join(moduleDir, "..", ".."),
        path.join(moduleDir, ".."),
    ];
    for (const candidate of candidates) {
        const resolved = path.resolve(candidate);
        if (fs.existsSync(path.join(resolved, "build", "index.js")) ||
            fs.existsSync(path.join(resolved, "package.json"))) {
            return resolved;
        }
    }
    return path.resolve(process.cwd());
}
/** First installed package under policies/, or empty string if none. */
export function defaultFragmentPackage(repoRoot) {
    const packages = scanFragmentPackages(repoRoot);
    const marked = packages.find((pkg) => pkg.default);
    if (marked)
        return marked.relativePath;
    return packages[0]?.relativePath ?? "";
}
function toRepoRelativePath(repoRoot, absolutePath) {
    const rel = path.relative(repoRoot, absolutePath);
    return rel.split(path.sep).join("/");
}
/** True when directory has fragment/ and/or scripts/validate-fragment.py (aligned with packages_list). */
export function isValidFragmentPackage(packageRoot) {
    const hasYamlFragment = fs.existsSync(path.join(packageRoot, "fragment"));
    const hasScripts = fs.existsSync(path.join(packageRoot, "scripts", "validate-fragment.py"));
    return hasYamlFragment || hasScripts;
}
function packageHasXml(packageRoot) {
    const xmlDir = path.join(packageRoot, "fragment-xml");
    if (!fs.existsSync(xmlDir))
        return false;
    try {
        return fs.readdirSync(xmlDir).some((name) => name.endsWith(".xml"));
    }
    catch {
        return false;
    }
}
/** Scan policies/ for YAML fragment packages (fragment/ and/or validate-fragment.py). */
export function scanFragmentPackages(repoRoot) {
    const policiesDir = path.join(repoRoot, "policies");
    if (!fs.existsSync(policiesDir)) {
        return [];
    }
    let entries = [];
    try {
        entries = fs
            .readdirSync(policiesDir, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name);
    }
    catch {
        return [];
    }
    const packages = [];
    for (const name of entries.sort()) {
        if (name === ".sandbox" || name.startsWith(".")) {
            continue;
        }
        const packageRoot = path.join(policiesDir, name);
        if (!isValidFragmentPackage(packageRoot)) {
            continue;
        }
        const relativePath = toRepoRelativePath(repoRoot, packageRoot);
        packages.push({
            relativePath,
            absolutePath: packageRoot,
            hasYamlFragment: fs.existsSync(path.join(packageRoot, "fragment")),
            hasXml: packageHasXml(packageRoot),
            hasScripts: fs.existsSync(path.join(packageRoot, "scripts", "validate-fragment.py")),
            default: packages.length === 0,
        });
    }
    return packages;
}
function containsTraversalSegment(input) {
    const normalized = input.replace(/\\/g, "/");
    return normalized.split("/").some((seg) => seg === "..");
}
function isPoliciesRelativePath(requested) {
    const normalized = requested.replace(/\\/g, "/").replace(/^\/+/, "");
    return (normalized.startsWith("policies/") ||
        normalized === "policies" ||
        normalized.split("/").includes("policies"));
}
function assertWithinBase(baseDir, resolved, paramName, requested) {
    const base = path.resolve(baseDir);
    const target = path.resolve(resolved);
    const rel = path.relative(base, target);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
        const hints = [];
        if (paramName === "fragmentPath" && !isPoliciesRelativePath(requested)) {
            hints.push("  hint: For local-only packages use axway_apim_fragment_validate_submit with files map, not fragmentPath.");
        }
        hints.push("  hint: Use axway_apim_fragment_packages_list for whitelisted package paths under policies/.");
        hints.push(`  hint: Policy packages live in the separate ${EXTERNAL_POLICIES_REPO} repo — mount at /app/policies or use validate_submit.`);
        throw new FragmentPathSecurityError([
            `Fragment path rejected (security): ${paramName} must stay under ${base}.`,
            `  requested: ${requested}`,
            `  resolved: ${target}`,
            `  allowed base: ${base}`,
            ...hints,
        ].join("\n"));
    }
}
function formatPackageNotFoundError(repoRoot, requested, resolved) {
    const packages = scanFragmentPackages(repoRoot);
    const available = packages.length > 0
        ? packages.map((pkg) => pkg.relativePath).join(", ")
        : `(none under policies/ — mount ${EXTERNAL_POLICIES_REPO} or use validate_submit)`;
    return [
        "Fragment package path not found.",
        `  requested: ${requested}`,
        `  resolved: ${resolved}`,
        `  repoRoot: ${repoRoot}`,
        `  available packages: ${available}`,
        "  hint: Call axway_apim_fragment_packages_list. For local packages use axway_apim_fragment_validate_submit.",
    ].join("\n");
}
/**

 * Resolves and validates fragmentPath to a package root under {repoRoot}/policies/.

 */
export function resolveFragmentPackageRoot(repoRoot, fragmentPath) {
    const policiesDir = path.resolve(repoRoot, "policies");
    const fallback = defaultFragmentPackage(repoRoot);
    const requested = fragmentPath?.trim() || fallback;
    if (!requested) {
        throw new Error([
            "fragmentPath is required — no packages installed under policies/.",
            `  hint: Mount ${EXTERNAL_POLICIES_REPO} at /app/policies in the MCP image, or use axway_apim_fragment_validate_submit for ad-hoc uploads.`,
            "  hint: Call axway_apim_fragment_packages_list to see installed packages.",
        ].join("\n"));
    }
    if (containsTraversalSegment(requested)) {
        throw new FragmentPathSecurityError([
            "Fragment path rejected (security): path traversal (..) is not allowed.",
            `  requested: ${requested}`,
            "  hint: Use a package path from axway_apim_fragment_packages_list.",
        ].join("\n"));
    }
    const resolved = path.resolve(path.isAbsolute(requested) ? requested : path.join(repoRoot, requested));
    assertWithinBase(policiesDir, resolved, "fragmentPath", requested);
    if (!fs.existsSync(resolved)) {
        throw new Error(formatPackageNotFoundError(repoRoot, requested, resolved));
    }
    if (!isValidFragmentPackage(resolved)) {
        throw new FragmentPathSecurityError([
            "Fragment path rejected (security): not a valid fragment package.",
            `  requested: ${requested}`,
            `  resolved: ${resolved}`,
            `  requirement: directory must contain fragment/ and/or scripts/validate-fragment.py`,
            `  hint: Call axway_apim_fragment_packages_list for whitelisted packages.`,
        ].join("\n"));
    }
    return resolved;
}
/**

 * Resolves xmlOutputPath under {packageRoot}/fragment-xml/ only.

 */
export function resolveXmlOutputPath(_repoRoot, packageRoot, xmlOutputPath) {
    const xmlDir = path.join(packageRoot, "fragment-xml");
    const requested = xmlOutputPath?.trim();
    if (!requested) {
        const xmlDirExists = fs.existsSync(xmlDir);
        if (xmlDirExists) {
            const existing = fs
                .readdirSync(xmlDir)
                .find((name) => name.endsWith(".xml"));
            if (existing) {
                return path.join(packageRoot, "fragment-xml", existing);
            }
        }
        return path.join(packageRoot, DEFAULT_XML_REL);
    }
    if (containsTraversalSegment(requested)) {
        throw new FragmentPathSecurityError([
            "Fragment path rejected (security): xmlOutputPath traversal (..) is not allowed.",
            `  requested: ${requested}`,
            `  hint: Output must be under fragment-xml/ inside the package tree.`,
        ].join("\n"));
    }
    const resolved = path.resolve(path.isAbsolute(requested)
        ? requested
        : path.join(packageRoot, requested));
    assertWithinBase(xmlDir, resolved, "xmlOutputPath", requested);
    return resolved;
}
/**

 * Resolves psProjectPath under {packageRoot}/ only.

 */
export function resolvePsProjectPath(_repoRoot, packageRoot, psProjectPath) {
    const requested = psProjectPath?.trim();
    if (!requested) {
        return path.join(packageRoot, DEFAULT_PS_PROJECT_REL);
    }
    if (containsTraversalSegment(requested)) {
        throw new FragmentPathSecurityError([
            "Fragment path rejected (security): psProjectPath traversal (..) is not allowed.",
            `  requested: ${requested}`,
            `  hint: ps-project path must stay inside the fragment package directory.`,
        ].join("\n"));
    }
    const resolved = path.resolve(path.isAbsolute(requested)
        ? requested
        : path.join(packageRoot, requested));
    assertWithinBase(packageRoot, resolved, "psProjectPath", requested);
    return resolved;
}
/** Validates that a script path is under {packageRoot}/scripts/ (defense in depth). */
export function resolvePackageScript(packageRoot, scriptName) {
    const scriptsDir = path.join(packageRoot, "scripts");
    const resolved = path.resolve(scriptsDir, scriptName);
    assertWithinBase(scriptsDir, resolved, "script", scriptName);
    return resolved;
}
//# sourceMappingURL=fragment-paths.js.map