# Policy development — reference

## Official docs root

https://docs.axway.com/bundle/axway-open-docs/page/docs/apim_policydev/index.html

## Local RAG

- Index: [docs/rag/_manifest.md](docs/rag/_manifest.md)
- Re-crawl: `node scripts/crawl-policydev-docs.mjs` (Playwright; waits for `article#zDocsContent`)

## Slug → MCP URI

File `docs/rag/apigw_polref__api_mgr_ps_filters.md` → `axway://apim/docs/policydev/apigw_polref__api_mgr_ps_filters`

## High-value RAG pages (authoring)

| Topic | Typical slug |
|-------|----------------|
| Configure policies | `apigw_poldev__general_manual_policy` |
| Import/export config | `apigw_poldev__general_import` |
| Sample policies | `apigw_poldev__sample_policies` |
| Selectors | `apigw_poldev__general_selector` |
| HTTP services / listeners | `apigw_gw_instances__general_services` |
| Relative paths | `apigw_gw_instances__general_relative_path` |
| Remote hosts | `apigw_gw_instances__general_remote_hosts` |
| Auth repositories | `apigw_external_connections__common_user_store` |
| Routing filters | `apigw_polref__routing_common` |
| Utility filters | `apigw_polref__utility_common` |
| API management filters | `apigw_polref__api_mgr_ps_filters` |
| Attribute filters | `apigw_polref__attributes_manipulate` |

## Fragment conventions (this repo)

See `policies/client-registry-sync/` for a complete Send/Receive example using Portal Alerts, Read * filters, listeners, Auth Profiles, and Federated XML export.

MCP tools (when MCP host has repo + Python 3):

| Tier | Tools |
|------|-------|
| 0 (offline) | `axway_apim_fragment_validate`, `axway_apim_fragment_sync_ps_project` |
| 1 (Axway libs) | validate com yamles/import dry-run, `axway_apim_fragment_yaml_to_xml` |

Mapeamento `productVersion` → `gatewayHome`: `config/axway-gateway-homes.json` (ver `config/axway-gateway-homes.example.json`), env `AXWAY_GATEWAY_VERSION_MAP`, ou `AXWAY_GATEWAY_HOME`. Diagnóstico: `axway_apim_fragment_gateway_resolve`.
