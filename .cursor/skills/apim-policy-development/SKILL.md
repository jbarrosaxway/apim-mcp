---
name: apim-policy-development
description: >-
  Guides Axway Policy Studio policy development (filters, listeners, external
  connections, OAuth, KPS, import/export YAML/XML fragments) using the local RAG
  corpus under docs/rag scraped from Axway open docs apim_policydev. Use when the
  user asks to create/edit policies, filters (Connect to URL, Script, Read
  Organization, routing), Portal Alerts, Auth Profiles, Remote Hosts, listeners,
  configuration fragments, or Policy Studio workflows. Prefer MCP resource
  axway://apim/playbook/policy-development and RAG markdown over inventing filter
  behavior.
---

# Axway Policy Development (Policy Studio)

Playbook for agents building or changing **API Gateway policies** with Axway docs RAG + this repo’s fragment patterns.

## When to load

- Create/change policies, filters, listeners, Remote Hosts, Auth Profiles, Portal Alerts
- Import/export configuration fragments (YAML or XML)
- OAuth / KPS / external connections in Policy Studio
- Questions about filter semantics (routing, script, API Management Read *)

## RAG corpus (source of truth for product docs)

Local mirror of [Develop in Policy Studio](https://docs.axway.com/bundle/axway-open-docs/page/docs/apim_policydev/index.html) and child pages:

| Path | Use |
|------|-----|
| [docs/rag/_manifest.md](docs/rag/_manifest.md) | Index of all scraped pages |
| [docs/rag/*.md](docs/rag/) | One file per docs page (frontmatter `source:` = canonical URL) |

**Rules for RAG use**

1. Open `_manifest.md`, pick the page(s) matching the task.
2. `Read` those `.md` files — treat body text as the product documentation.
3. Cite the `source:` URL when answering the user.
4. Re-scrape if docs may be stale: `node .cursor/skills/apim-policy-development/scripts/crawl-policydev-docs.mjs`

## MCP exposure

| Kind | Name |
|------|------|
| Resource | `axway://apim/playbook/policy-development` |
| Resource | `axway://apim/docs/policydev/{slug}` (RAG page by slug) |
| Prompt | `axway_apim_policy_develop` |
| Tool | `axway_apim_fragment_validate` — Tier 0 offline; Tier 1 com gatewayHome mapeado |
| Tool | `axway_apim_fragment_yaml_to_xml` — Tier 1 (YAML→XML Federated) |
| Tool | `axway_apim_fragment_sync_ps_project` — Tier 0 (alinhar ps-project) |
| Tool | `axway_apim_fragment_gateway_resolve` — diagnosticar mapeamento versão→gatewayHome |

Attach the playbook resource before designing non-trivial policies.

## Playbook — develop a policy (order)

```
Progress:
- [ ] 1. Clarify goal (Send alert? Receive HTTP? Lookup local APIM? Route?)
- [ ] 2. RAG: open matching docs/rag pages (filters, listeners, import)
- [ ] 3. Choose filter types (prefer API Management Read * for local registry reads)
- [ ] 4. Author YAML fragment (or XML via Federated re-export)
- [ ] 5. Validate via MCP `axway_apim_fragment_validate` (or shell scripts on dev machine)
- [ ] 6. YAML→XML: `axway_apim_fragment_yaml_to_xml` if target is XML FED
- [ ] 7. Optional: `axway_apim_fragment_sync_ps_project` before opening ps-project in Policy Studio
- [ ] 8. Import into Policy Studio project / FED
```

### 1. Goal → pattern

| Goal | Pattern |
|------|---------|
| React to API Manager event | Portal Alerts → Send policy (enrich with **Read Organization/Application/…**) → HTTP to peer |
| Accept sync/admin HTTP | Listener + path → Receive policies |
| Lookup org/app/proxy **on same** APIM | **Read Organization** (`selects: Name`\|`ID`), Read Application, Read API Proxy — not ConnectToURL |
| Mutate APIM registry | Portal REST via ConnectToURL / Call Local APIM (POST/PUT/DELETE) |
| Call another Gateway | RemoteHost + Auth Profile + ConnectToURL |

### 2. Filter selection (high value)

Prefer product filters over custom script when docs + palette cover the need:

- **API Management**: Read Organization, Read Application, Read Application Credential, Read API Proxy, Read API Access
- **Routing**: Connect to URL, Connection, Change Message
- **Utility**: Set Attribute, Script (Groovy/JS), Circuit Shortcut, False/True
- **Attributes**: Compare Attribute, etc. — see RAG `apigw_polref__*`

Only **Read Organization** supports lookup by **Name** (`selects: Name`). App/Proxy Read filters are **ID-only**; for cross-env name resolve use local DAO/script or Portal search REST.

### 3. Authoring formats

| Format | When | Notes |
|--------|------|-------|
| YAML fragment folder | Policy Studio YAML project | `_parent.yaml` Root + `META-INF/_fragment.yaml` (`addOrReplace`) |
| XML fragment `.xml` | Policy Studio XML / FED | Export via Federated Entity Store — never ship YAML inside `realizedTypes` |
| Passwords | Always | Omit encrypted `httpAuthPass` from fragments; set in PS after import |

Repo example: `policies/client-registry-sync/` (YAML + `fragment-xml/` + validate scripts).

### 4. Validate

Prefer MCP tools when the agent runs against this MCP server (Python 3 on MCP host):

| Tier | Tools | Requisitos |
|------|-------|------------|
| **0 — Offline** | `axway_apim_fragment_validate` (default), `axway_apim_fragment_sync_ps_project` | Python 3 apenas |
| **1 — Axway libs** | `yamles`/import dry-run via validate; `axway_apim_fragment_yaml_to_xml` | `gatewayHome` resolvido: parâmetro, `instanceId`+mapeamento, `AXWAY_GATEWAY_HOME`, ou `config/axway-gateway-homes.json` |

Diagnóstico de mapeamento: `axway_apim_fragment_gateway_resolve`. Copiar `config/axway-gateway-homes.example.json` → `config/axway-gateway-homes.json`.

Local shell equivalents:

```bat
yamles validate -s yaml:file:.\fragment -p ""
policies\client-registry-sync\scripts\validate-xml-fragment.bat
```

Regenerate XML from YAML (Federated path):

```bat
jython policies\client-registry-sync\scripts\yaml-frag-to-xml.py
```

### 5. Import

Policy Studio → **File → Import → Configuration Fragment** → YAML folder or XML file.

## Agent deliverables

When building policies for the user, deliver:

1. Short design (flow diagram or bullet chain of filters)
2. Files (YAML and/or XML fragment)
3. Post-import checklist (hosts, ports, Auth Profiles, alerts enabled)
4. Doc citations (`source:` URLs from RAG frontmatter)

## Related

- Skill `apim-gateway-code-analysis` — diagnose live APIs + FED + decompile (not for authoring)
- MCP tools `axway_apim_*` — live Manager/Gateway data while designing receive paths / alerts
- Slug cheat sheet: [reference.md](reference.md)
