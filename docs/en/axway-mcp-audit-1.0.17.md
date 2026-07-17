# Axway MCP audit — apim-mcp 1.0.17

Languages: [English](axway-mcp-audit-1.0.17.md) | [Português (Brasil)](../pt-BR/axway-mcp-audit-1.0.17.md)

**Date:** 2026-07-16  
**Manifest:** `tmp/mcp_manifest.json` (45 tools, 4 resources, 1 prompt)  
**Auditor:** `vendor/axway-mcp-auditor` (criteria v2.5)

## Result (excluding A10 / A14 for the `apim` segment)

| Metric | Value |
|--------|-------|
| Compliance | **94** / 100 |
| Comprehension | **100** / 100 |
| Critical | **0** |
| High | **0** |
| Medium | 2 (K4 protocolVersion not latest; K5 listChanged) |

GA-ready target (≥70, 0 Critical, ≤3 High) **met** for everything except the known product finding.

## Known finding (documented)

**A10 / A14 — product segment `apim`:** the scanner only accepts `{fusion, st, cft, b2bi, workbench, engage}`.  
All `axway_apim_*` primitives and `axway://apim/...` URIs generate High A10/A14 until CPO adds `apim` (see [cpo-apim-product-request.md](cpo-apim-product-request.md)).

With A10/A14 included, the raw score is Blocked (dozens of High A10) — expected and **not** treated as an implementation regression.

## How to reproduce

```bash
npm run build
node scripts/build-local-manifest.mjs
python vendor/axway-mcp-auditor/scripts/normalize_manifest.py tmp/mcp_manifest.json -o tmp/mcp_manifest.normalized.json
# On Windows: ensure C:\tmp exists (auditor hard-coded output)
python vendor/axway-mcp-auditor/scripts/audit_manifest.py tmp/mcp_manifest.normalized.json
python vendor/axway-mcp-auditor/scripts/scoring.py --deterministic C:/tmp/mcp_deterministic_findings.json
```

Or against the HTTP server: `node scripts/export-mcp-manifest.mjs <url> <bearer>`.
