# Pedido CPO / AETHER — adicionar segmento de produto `apim`

**Para:** CPO / AETHER (owners do Axway MCP style guide e `axway-mcp-auditor`)  
**De:** equipa APIM MCP (`apim-mcp` / Axway API Gateway + API Manager)  
**Assunto:** Incluir `apim` no conjunto canónico de product segments (critério A10)

## Pedido

Adicionar **`apim`** à lista canónica de segmentos de produto usada em:

- Style guide Layer 2 / Dimension A (A10)
- `references/criteria.json` (VALID_PRODUCTS / rationale A10)
- Scanner `audit_manifest.py` (mesmo processo documentado no CHANGELOG para `engage`)

Após a mudança, tools e prompts no formato `axway_apim_<resource>_<action|intent>` deixam de falhar A10.

## Justificação

- O servidor MCP cobre **Axway API Gateway (ANM)** e **API Manager** — portfólio APIM, distinto de `fusion`, `st`, `cft`, `b2bi`, `workbench`, `engage`.
- O segmento provisório `apim` já está em produção no naming das primitives (`axway_apim_topology_list`, prompt `axway_apim_gateway_diagnose`, resources `axway://apim/...`).
- Sem `apim` na lista, **todas** as tools geram finding **High A10**, bloqueando GA-ready apesar de compliance noutros critérios.

## Precedente

CHANGELOG do `axway-mcp-auditor` **1.1.0**: *“engage added to the canonical Axway product set”* — mesmo tipo de extensão.

## Aceite proposto

1. `VALID_PRODUCTS` inclui `apim`.
2. Critério A10 / style guide actualizados.
3. Release do auditor (patch/minor) com nota no CHANGELOG.
4. Equipas APIM re-correm `audit_manifest.py` e fecham o finding A10 documentado.

## Contacto

Repositório: `apim-mcp` · naming actual: `axway_apim_*` · resources: `axway://apim/`.
