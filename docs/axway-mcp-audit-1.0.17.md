# Audit Axway MCP — apim-mcp 1.0.17

**Data:** 2026-07-16  
**Manifest:** `tmp/mcp_manifest.json` (45 tools, 4 resources, 1 prompt)  
**Auditor:** `vendor/axway-mcp-auditor` (criteria v2.5)

## Resultado (excluindo A10 / A14 do segmento `apim`)

| Métrica | Valor |
|---------|-------|
| Compliance | **94** / 100 |
| Comprehension | **100** / 100 |
| Critical | **0** |
| High | **0** |
| Medium | 2 (K4 protocolVersion not latest; K5 listChanged) |

Meta GA-ready (≥70, 0 Critical, ≤3 High) **cumprida** para tudo excepto o finding conhecido de produto.

## Finding conhecido (documentado)

**A10 / A14 — product segment `apim`:** o scanner só aceita `{fusion, st, cft, b2bi, workbench, engage}`.  
Todas as primitives `axway_apim_*` e URIs `axway://apim/...` geram High A10/A14 até a CPO adicionar `apim` (ver [cpo-apim-product-request.md](cpo-apim-product-request.md)).

Com A10/A14 incluídos, o score bruto fica Blocked (dezenas de High A10) — esperado e **não** tratado como regressão de implementação.

## Como reproduzir

```bash
npm run build
node scripts/build-local-manifest.mjs
python vendor/axway-mcp-auditor/scripts/normalize_manifest.py tmp/mcp_manifest.json -o tmp/mcp_manifest.normalized.json
# Em Windows: garantir C:\tmp existe (output hard-coded do auditor)
python vendor/axway-mcp-auditor/scripts/audit_manifest.py tmp/mcp_manifest.normalized.json
python vendor/axway-mcp-auditor/scripts/scoring.py --deterministic C:/tmp/mcp_deterministic_findings.json
```

Ou contra o servidor HTTP: `node scripts/export-mcp-manifest.mjs <url> <bearer>`.
