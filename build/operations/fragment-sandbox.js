/**
 * @module src/operations/fragment-sandbox
 * @description Ephemeral sandbox under policies/.sandbox/ for uploaded fragment packages.
 */
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { FragmentPathSecurityError, findRepoRoot, isValidFragmentPackage, } from "./fragment-paths.js";
export const SANDBOX_DIR_NAME = ".sandbox";
export const DEFAULT_UPLOAD_MAX_BYTES = 10 * 1024 * 1024; // 10 MiB
export const DEFAULT_UPLOAD_MAX_FILES = 500;
export const DEFAULT_SANDBOX_MAX_AGE_MS = 3_600_000; // 1h
/** Generic validator copied when upload lacks scripts/validate-fragment.py. */
export const GENERIC_VALIDATE_SCRIPT_REL = "resources/fragment/scripts/validate-fragment-generic.py";
export class FragmentUploadError extends Error {
    constructor(message) {
        super(message);
        this.name = "FragmentUploadError";
    }
}
function parsePositiveInt(value, fallback) {
    if (!value?.trim())
        return fallback;
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
export function uploadMaxBytes() {
    return parsePositiveInt(process.env.FRAGMENT_UPLOAD_MAX_BYTES, DEFAULT_UPLOAD_MAX_BYTES);
}
export function uploadMaxFiles() {
    return parsePositiveInt(process.env.FRAGMENT_UPLOAD_MAX_FILES, DEFAULT_UPLOAD_MAX_FILES);
}
export function sandboxMaxAgeMs() {
    return parsePositiveInt(process.env.FRAGMENT_SANDBOX_MAX_AGE_MS, DEFAULT_SANDBOX_MAX_AGE_MS);
}
export function sandboxRootDir(repoRoot) {
    return path.join(repoRoot, "policies", SANDBOX_DIR_NAME);
}
function containsTraversalSegment(input) {
    const normalized = input.replace(/\\/g, "/");
    return normalized.split("/").some((seg) => seg === ".." || seg === "");
}
function normalizeRelativePath(relPath) {
    const normalized = relPath.replace(/\\/g, "/").replace(/^\/+/, "");
    if (!normalized || containsTraversalSegment(normalized)) {
        throw new FragmentPathSecurityError(`Fragment upload rejected (security): invalid relative path "${relPath}"`);
    }
    if (path.isAbsolute(normalized)) {
        throw new FragmentPathSecurityError(`Fragment upload rejected (security): absolute paths are not allowed: "${relPath}"`);
    }
    return normalized;
}
function assertWithinSandbox(sandboxRoot, targetPath, relPath) {
    const base = path.resolve(sandboxRoot);
    const target = path.resolve(targetPath);
    const rel = path.relative(base, target);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
        throw new FragmentPathSecurityError([
            "Fragment upload rejected (security): path must stay under sandbox root.",
            `  path: ${relPath}`,
            `  resolved: ${target}`,
            `  sandbox: ${base}`,
        ].join("\n"));
    }
}
function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}
function copyFileSync(src, dest) {
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
}
/** Creates policies/.sandbox/{uuid}/ and returns absolute + relative paths. */
export function createSandboxDir(repoRoot, packageLabel) {
    const sandboxRoot = sandboxRootDir(repoRoot);
    ensureDir(sandboxRoot);
    const safeLabel = packageLabel?.trim().replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 64);
    const sandboxId = safeLabel ? `${safeLabel}-${randomUUID()}` : randomUUID();
    const absolutePath = path.join(sandboxRoot, sandboxId);
    ensureDir(absolutePath);
    const relativePath = path
        .relative(repoRoot, absolutePath)
        .split(path.sep)
        .join("/");
    return { sandboxId, absolutePath, relativePath, label: safeLabel || undefined };
}
export function writeSandboxFiles(sandboxRoot, files, decodeBase64 = true) {
    const maxBytes = uploadMaxBytes();
    const maxFiles = uploadMaxFiles();
    const entries = Object.entries(files);
    if (entries.length === 0) {
        throw new FragmentUploadError("No files provided in upload");
    }
    if (entries.length > maxFiles) {
        throw new FragmentUploadError(`Upload rejected: ${entries.length} files exceeds limit of ${maxFiles}`);
    }
    let totalBytes = 0;
    let fileCount = 0;
    for (const [relPath, content] of entries) {
        const normalized = normalizeRelativePath(relPath);
        const dest = path.join(sandboxRoot, normalized);
        assertWithinSandbox(sandboxRoot, dest, normalized);
        const buffer = decodeBase64 ? Buffer.from(content, "base64") : Buffer.from(content);
        totalBytes += buffer.length;
        if (totalBytes > maxBytes) {
            throw new FragmentUploadError(`Upload rejected: total size exceeds ${maxBytes} bytes (FRAGMENT_UPLOAD_MAX_BYTES)`);
        }
        ensureDir(path.dirname(dest));
        fs.writeFileSync(dest, buffer);
        fileCount += 1;
    }
    return { fileCount, totalBytes };
}
function parseTarOctal(field) {
    const str = field.toString("utf8").replace(/\0/g, "").trim();
    if (!str)
        return 0;
    return Number.parseInt(str, 8);
}
function readTarHeader(buffer, offset) {
    if (offset + 512 > buffer.length)
        return null;
    const header = buffer.subarray(offset, offset + 512);
    if (header.every((b) => b === 0))
        return null;
    const prefix = header.subarray(345, 500).toString("utf8").replace(/\0/g, "");
    const baseName = header.subarray(0, 100).toString("utf8").replace(/\0/g, "");
    let name = prefix ? `${prefix}/${baseName}` : baseName;
    let size = parseTarOctal(header.subarray(124, 136));
    const type = String.fromCharCode(header[156] ?? 0);
    let nextOffset = offset + 512;
    if (type === "L" && size > 0) {
        name = buffer.subarray(nextOffset, nextOffset + size).toString("utf8").replace(/\0/g, "");
        nextOffset += Math.ceil(size / 512) * 512;
        if (nextOffset + 512 > buffer.length) {
            return { name, size: 0, type: "0", nextOffset };
        }
        const fileHeader = buffer.subarray(nextOffset, nextOffset + 512);
        nextOffset += 512;
        size = parseTarOctal(fileHeader.subarray(124, 136));
        const fileType = String.fromCharCode(fileHeader[156] ?? 0);
        return { name, size, type: fileType, nextOffset };
    }
    return { name, size, type, nextOffset };
}
function extractTarToSandbox(tarBuffer, sandboxRoot) {
    const maxBytes = uploadMaxBytes();
    const maxFiles = uploadMaxFiles();
    let totalBytes = 0;
    let fileCount = 0;
    let offset = 0;
    while (offset < tarBuffer.length) {
        const entry = readTarHeader(tarBuffer, offset);
        if (!entry)
            break;
        offset = entry.nextOffset;
        const { name, size, type } = entry;
        if (!name) {
            offset += Math.ceil(size / 512) * 512;
            continue;
        }
        if (type === "5") {
            const normalized = normalizeRelativePath(name);
            const dest = path.join(sandboxRoot, normalized);
            assertWithinSandbox(sandboxRoot, dest, normalized);
            ensureDir(dest);
            offset += Math.ceil(size / 512) * 512;
            continue;
        }
        if (type !== "0" && type !== "\0" && type !== "") {
            offset += Math.ceil(size / 512) * 512;
            continue;
        }
        const normalized = normalizeRelativePath(name);
        const dest = path.join(sandboxRoot, normalized);
        assertWithinSandbox(sandboxRoot, dest, normalized);
        if (size > 0) {
            if (fileCount + 1 > maxFiles) {
                throw new FragmentUploadError(`Archive rejected: exceeds ${maxFiles} files (FRAGMENT_UPLOAD_MAX_FILES)`);
            }
            totalBytes += size;
            if (totalBytes > maxBytes) {
                throw new FragmentUploadError(`Archive rejected: exceeds ${maxBytes} bytes (FRAGMENT_UPLOAD_MAX_BYTES)`);
            }
            const content = tarBuffer.subarray(offset, offset + size);
            ensureDir(path.dirname(dest));
            fs.writeFileSync(dest, content);
            fileCount += 1;
        }
        else {
            ensureDir(dest);
        }
        offset += Math.ceil(size / 512) * 512;
    }
    return { fileCount, totalBytes };
}
export function extractArchiveToSandbox(sandboxRoot, archiveBase64) {
    let raw;
    try {
        raw = Buffer.from(archiveBase64, "base64");
    }
    catch {
        throw new FragmentUploadError("Invalid base64 in archiveBase64");
    }
    if (raw.length === 0) {
        throw new FragmentUploadError("Empty archive");
    }
    if (raw.length > uploadMaxBytes()) {
        throw new FragmentUploadError(`Archive rejected: compressed size exceeds ${uploadMaxBytes()} bytes`);
    }
    let tarBuffer;
    try {
        tarBuffer = zlib.gunzipSync(raw);
    }
    catch {
        throw new FragmentUploadError("Failed to decompress archive — expected gzip-compressed tar (.tar.gz)");
    }
    if (tarBuffer.length > uploadMaxBytes() * 4) {
        throw new FragmentUploadError("Decompressed archive exceeds size limit");
    }
    return extractTarToSandbox(tarBuffer, sandboxRoot);
}
/** Copy generic validate script when upload lacks scripts/validate-fragment.py. */
export function bootstrapSandboxScripts(repoRoot, sandboxRoot) {
    const validateScript = path.join(sandboxRoot, "scripts", "validate-fragment.py");
    if (fs.existsSync(validateScript)) {
        return [];
    }
    const genericSrc = path.join(repoRoot, GENERIC_VALIDATE_SCRIPT_REL);
    if (!fs.existsSync(genericSrc)) {
        return [];
    }
    const destScripts = path.join(sandboxRoot, "scripts");
    fs.mkdirSync(destScripts, { recursive: true });
    copyFileSync(genericSrc, validateScript);
    return ["validate-fragment.py (generic bootstrap)"];
}
export function assertSandboxPackage(sandboxRoot) {
    if (!isValidFragmentPackage(sandboxRoot)) {
        throw new FragmentUploadError([
            "Uploaded package is not a valid fragment package.",
            "  requirement: directory must contain fragment/ and/or scripts/validate-fragment.py",
            "  hint: tar should include fragment/ tree (META-INF, Policies, etc.) at package root",
        ].join("\n"));
    }
}
/** Remove a single sandbox directory (best-effort). */
export function purgeSandboxDir(sandboxPath) {
    try {
        if (fs.existsSync(sandboxPath)) {
            fs.rmSync(sandboxPath, { recursive: true, force: true });
            return true;
        }
    }
    catch {
        // best-effort
    }
    return false;
}
/** Purge all sandboxes older than maxAgeMs under policies/.sandbox/. */
export function purgeStaleSandboxes(maxAgeMs = sandboxMaxAgeMs()) {
    const repoRoot = findRepoRoot();
    const sandboxRoot = sandboxRootDir(repoRoot);
    const purged = [];
    const errors = [];
    if (!fs.existsSync(sandboxRoot)) {
        return { purged, errors };
    }
    const now = Date.now();
    let entries = [];
    try {
        entries = fs.readdirSync(sandboxRoot, { withFileTypes: true });
    }
    catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
        return { purged, errors };
    }
    for (const entry of entries) {
        if (!entry.isDirectory())
            continue;
        const dirPath = path.join(sandboxRoot, entry.name);
        try {
            const stat = fs.statSync(dirPath);
            if (now - stat.mtimeMs >= maxAgeMs) {
                fs.rmSync(dirPath, { recursive: true, force: true });
                purged.push(dirPath);
            }
        }
        catch (err) {
            errors.push(`${dirPath}: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    return { purged, errors };
}
//# sourceMappingURL=fragment-sandbox.js.map