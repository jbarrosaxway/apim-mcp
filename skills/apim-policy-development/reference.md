# Policy development — reference

## Official docs root

https://docs.axway.com/bundle/axway-open-docs/page/docs/apim_policydev/index.html

## Local RAG (apim-mcp)

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

## Policy packages (external repo)

Policy **implementations** live in the separate **apim-policies** repo — not in apim-mcp.

| Item | Location |
|------|----------|
| Example package | `apim-policies/policies/example-policy-package/` |
| New package template | `apim-policies/policies/PACKAGE-README-TEMPLATE.md` |
| Shared scripts (link-meta-inf-types, etc.) | `apim-policies/policies/_shared/scripts/` |
| Generic MCP validator (shipped in MCP image) | `apim-mcp/resources/fragment/scripts/validate-fragment-generic.py` |

Open the **apim-policies** workspace for package READMEs, E2E tests, and deploy workflows. Do not copy client-specific packages into apim-mcp.

## Configuration Fragment — import checklist (PS 7.7)

| Requisito | Notas |
|-----------|-------|
| `fragment/_parent.yaml` | `type: Root` |
| `_parent` chain | Service=`NetService`; HTTP service=`HTTP`; Policies=`CircuitContainer` |
| `System/*` | Filter Categories, Policy Categories, Entity Store Configuration |
| `META-INF/types/` | Junction: `link-meta-inf-types.ps1` → Blank do **gatewayHome = productVersion do target** — não commitar |
| Listeners | `HTTP` + `InetInterface` + `XMLFirewall` — não `CircuitContainer` no serviço |
| `_fragment.yaml` | `addIfAbsent` (ancestrais) vs `addOrReplace` (políticas) — sem overlap de PKs |
| Passphrase | `passphraseTest: aHR0cDsvL3d3dy52b3JkZWwuY29t`; BasicProfile `httpAuthPass: Y2hhbmdlbWU=` |
| Groovy | Ficheiro no disco para cada `{{file "…groovy"}}`; **não inventar** APIs Axway |

## Groovy / MIME (generic)

| Pattern | Notes |
|---------|-------|
| Trace | **TraceFilter** inline — not Groovy `Trace.info` for circuit trace |
| Body JSON | Groovy → attribute → **Set Message** → Connect `${content.body}` |
| MIME fallback | `ContentType(Authority.MIME, "application/json")` + `Body.create(null, ct, ByteArrayContentSource(bytes))` |
| Forbidden | `ContentType(String,String)`, `Body.create(ct,true)`, `getHeaderValues`, `Tracker.getProperty` |

## MCP fragment tools

| Situation | Tool |
|-----------|------|
| Package mounted in MCP image at `/app/policies/` | `axway_apim_fragment_packages_list` → `axway_apim_fragment_validate` |
| Package only on agent workspace | `axway_apim_fragment_validate_submit` (`files` or `archiveBase64`) |

- `fragmentPath` = package ROOT (e.g. `policies/my-package`), not `fragment/`
- Without `scripts/validate-fragment.py`, MCP copies `resources/fragment/scripts/validate-fragment-generic.py`
- Sandbox: `policies/.sandbox/` (ephemeral, auto-purged)

## Type catalog versions

Before import on target: read type versions from target FED (`axway_apim_deployment_archive_get` → extract `META-INF/types`), not from agent's local Axway install.

Symptom: `Cannot import due to version mismatch for type 'RemoteHost'…` — regenerate fragment against target catalog.

## Example MCP calls

```json
{ "tool": "axway_apim_fragment_validate_submit", "arguments": { "packageLabel": "my-policy", "files": { "fragment/META-INF/_fragment.yaml": "<base64>" } } }
```

```json
{ "tool": "axway_apim_fragment_packages_list", "arguments": {} }
```
