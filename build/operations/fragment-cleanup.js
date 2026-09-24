/**
 * @module src/operations/fragment-cleanup
 * @description Purges ephemeral fragment artifacts (XML exports, yamles traces, MCP test files) to avoid disk exhaustion.
 */
import fs from "fs";
import path from "path";
import { findRepoRoot, scanFragmentPackages, } from "./fragment-paths.js";
import { purgeStaleSandboxes } from "./fragment-sandbox.js";
const DEFAULT_MAX_AGE_MS = 86_400_000; // 24h
const DEFAULT_INTERVAL_MS = 3_600_000; // 1h
function parsePositiveInt(value, fallback) {
    if (!value?.trim())
        return fallback;
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
function parseOptionalPositiveInt(value) {
    if (!value?.trim())
        return undefined;
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
function parseBool(value, fallback) {
    if (value === undefined || value === "")
        return fallback;
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized))
        return true;
    if (["0", "false", "no", "off"].includes(normalized))
        return false;
    return fallback;
}
export function loadFragmentCleanupConfig() {
    return {
        enabled: parseBool(process.env.FRAGMENT_CLEANUP_ENABLED, true),
        maxAgeMs: parsePositiveInt(process.env.FRAGMENT_ARTIFACT_MAX_AGE_MS, DEFAULT_MAX_AGE_MS),
        intervalMs: parsePositiveInt(process.env.FRAGMENT_CLEANUP_INTERVAL_MS, DEFAULT_INTERVAL_MS),
        maxXmlBytesPerPackage: parseOptionalPositiveInt(process.env.FRAGMENT_MAX_XML_BYTES_PER_PACKAGE),
    };
}
function isYamlesTrace(name) {
    return name === "yamles.trc" || /^yamles\.trc\.\d+$/.test(name);
}
function isMcpTestXml(name) {
    return name.endsWith("-mcp-test.xml");
}
function safeStat(filePath) {
    try {
        return fs.statSync(filePath);
    }
    catch {
        return undefined;
    }
}
function tryUnlink(filePath, result) {
    try {
        const stat = safeStat(filePath);
        if (!stat?.isFile())
            return;
        fs.unlinkSync(filePath);
        result.deletedFiles.push(filePath);
        result.freedBytes += stat.size;
    }
    catch (err) {
        result.errors.push(`${filePath}: ${err instanceof Error ? err.message : String(err)}`);
    }
}
function collectXmlFiles(xmlDir) {
    if (!fs.existsSync(xmlDir))
        return [];
    let names = [];
    try {
        names = fs.readdirSync(xmlDir);
    }
    catch {
        return [];
    }
    const files = [];
    for (const name of names) {
        if (!name.endsWith(".xml"))
            continue;
        const filePath = path.join(xmlDir, name);
        const stat = safeStat(filePath);
        if (!stat?.isFile())
            continue;
        files.push({ path: filePath, mtimeMs: stat.mtimeMs, size: stat.size });
    }
    return files;
}
function purgeXmlDir(xmlDir, maxAgeMs, maxXmlBytes, now, result) {
    const files = collectXmlFiles(xmlDir);
    for (const file of files) {
        if (now - file.mtimeMs >= maxAgeMs) {
            tryUnlink(file.path, result);
        }
    }
    if (!maxXmlBytes)
        return;
    const remaining = collectXmlFiles(xmlDir)
        .map((f) => {
        const stat = safeStat(f.path);
        return stat
            ? { path: f.path, mtimeMs: stat.mtimeMs, size: stat.size }
            : null;
    })
        .filter((f) => f !== null);
    let total = remaining.reduce((sum, f) => sum + f.size, 0);
    if (total <= maxXmlBytes)
        return;
    remaining.sort((a, b) => a.mtimeMs - b.mtimeMs);
    for (const file of remaining) {
        if (total <= maxXmlBytes)
            break;
        const stat = safeStat(file.path);
        if (!stat)
            continue;
        tryUnlink(file.path, result);
        total -= stat.size;
    }
}
function purgeDirectoryByAge(dir, maxAgeMs, now, matcher, result) {
    if (!fs.existsSync(dir))
        return;
    let names = [];
    try {
        names = fs.readdirSync(dir);
    }
    catch {
        return;
    }
    for (const name of names) {
        if (!matcher(name))
            continue;
        const filePath = path.join(dir, name);
        const stat = safeStat(filePath);
        if (!stat?.isFile())
            continue;
        if (now - stat.mtimeMs >= maxAgeMs) {
            tryUnlink(filePath, result);
        }
    }
}
/**
 * Scans whitelisted package trees and repo root for ephemeral fragment artifacts.
 */
export function cleanupFragmentArtifacts(config = loadFragmentCleanupConfig()) {
    const result = {
        enabled: config.enabled,
        deletedFiles: [],
        freedBytes: 0,
        skipped: [],
        errors: [],
    };
    if (!config.enabled) {
        result.skipped.push("cleanup disabled (FRAGMENT_CLEANUP_ENABLED=false)");
        return result;
    }
    const repoRoot = findRepoRoot();
    const now = Date.now();
    const packages = scanFragmentPackages(repoRoot);
    for (const pkg of packages) {
        const packageRoot = pkg.absolutePath;
        const xmlDir = path.join(packageRoot, "fragment-xml");
        purgeXmlDir(xmlDir, config.maxAgeMs, config.maxXmlBytesPerPackage, now, result);
        purgeDirectoryByAge(packageRoot, config.maxAgeMs, now, isYamlesTrace, result);
        purgeDirectoryByAge(packageRoot, config.maxAgeMs, now, isMcpTestXml, result);
        purgeDirectoryByAge(xmlDir, config.maxAgeMs, now, isMcpTestXml, result);
    }
    // yamles.trc* at repo root (yamles may run with cwd = repo)
    purgeDirectoryByAge(repoRoot, config.maxAgeMs, now, isYamlesTrace, result);
    const sandboxPurge = purgeStaleSandboxes(config.maxAgeMs);
    for (const dir of sandboxPurge.purged) {
        result.deletedFiles.push(dir);
    }
    for (const err of sandboxPurge.errors) {
        result.errors.push(err);
    }
    return result;
}
let schedulerStarted = false;
let schedulerTimer;
function logCleanupSummary(result, context) {
    if (!result.enabled)
        return;
    if (result.deletedFiles.length === 0 && result.errors.length === 0)
        return;
    const mb = (result.freedBytes / (1024 * 1024)).toFixed(2);
    console.error(`[fragment-cleanup] ${context}: removed ${result.deletedFiles.length} file(s), freed ~${mb} MiB` +
        (result.errors.length > 0 ? `, ${result.errors.length} error(s)` : ""));
}
/** Run cleanup once (non-blocking). */
export function runFragmentCleanupAsync(context = "scheduled") {
    const config = loadFragmentCleanupConfig();
    setImmediate(() => {
        try {
            const result = cleanupFragmentArtifacts(config);
            logCleanupSummary(result, context);
        }
        catch (err) {
            console.error(`[fragment-cleanup] ${context} failed:`, err instanceof Error ? err.message : err);
        }
    });
}
/** Light cleanup after fragment write operations. */
export function cleanupAfterFragmentOperation() {
    runFragmentCleanupAsync("post-operation");
}
/**
 * Startup hook: initial purge + optional periodic interval.
 * Safe to call multiple times (only one interval is registered).
 */
export function startFragmentCleanupScheduler() {
    const config = loadFragmentCleanupConfig();
    if (!config.enabled) {
        console.error("[fragment-cleanup] disabled via FRAGMENT_CLEANUP_ENABLED");
        return;
    }
    runFragmentCleanupAsync("startup");
    if (schedulerStarted)
        return;
    schedulerStarted = true;
    if (config.intervalMs > 0) {
        schedulerTimer = setInterval(() => {
            runFragmentCleanupAsync("interval");
        }, config.intervalMs);
        if (typeof schedulerTimer.unref === "function") {
            schedulerTimer.unref();
        }
        console.error(`[fragment-cleanup] periodic purge every ${config.intervalMs}ms (max age ${config.maxAgeMs}ms)`);
    }
}
/** Test helper: stop periodic cleanup. */
export function stopFragmentCleanupScheduler() {
    if (schedulerTimer) {
        clearInterval(schedulerTimer);
        schedulerTimer = undefined;
    }
    schedulerStarted = false;
}
//# sourceMappingURL=fragment-cleanup.js.map