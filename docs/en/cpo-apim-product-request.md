# CPO / AETHER request — add product segment `apim`

Languages: [English](cpo-apim-product-request.md) | [Português (Brasil)](../pt-BR/cpo-apim-product-request.md)

**To:** CPO / AETHER (owners of the Axway MCP style guide and `axway-mcp-auditor`)  
**From:** APIM MCP team (`apim-mcp` / Axway API Gateway + API Manager)  
**Subject:** Include `apim` in the canonical product segment set (criterion A10)

## Request

Add **`apim`** to the canonical product segment list used in:

- Style guide Layer 2 / Dimension A (A10)
- `references/criteria.json` (VALID_PRODUCTS / A10 rationale)
- Scanner `audit_manifest.py` (same process documented in the CHANGELOG for `engage`)

After the change, tools and prompts in the format `axway_apim_<resource>_<action|intent>` will no longer fail A10.

## Rationale

- The MCP server covers **Axway API Gateway (ANM)** and **API Manager** — the APIM portfolio, distinct from `fusion`, `st`, `cft`, `b2bi`, `workbench`, `engage`.
- The provisional segment `apim` is already in production in primitive naming (`axway_apim_topology_list`, prompt `axway_apim_gateway_diagnose`, resources `axway://apim/...`).
- Without `apim` on the list, **all** tools generate finding **High A10**, blocking GA-ready despite compliance on other criteria.

## Precedent

`axway-mcp-auditor` CHANGELOG **1.1.0**: *“engage added to the canonical Axway product set”* — same type of extension.

## Proposed acceptance

1. `VALID_PRODUCTS` includes `apim`.
2. Criterion A10 / style guide updated.
3. Auditor release (patch/minor) with CHANGELOG note.
4. APIM teams re-run `audit_manifest.py` and close the documented A10 finding.

## Contact

Repository: `apim-mcp` · current naming: `axway_apim_*` · resources: `axway://apim/`.
