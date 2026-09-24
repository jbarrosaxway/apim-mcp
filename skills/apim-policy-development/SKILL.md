---
name: apim-policy-development
description: >-
  Guides Axway Policy Studio policy development (filters, listeners, external
  connections, OAuth, KPS, import/export YAML/XML fragments) using the local RAG
  corpus under docs/rag scraped from Axway open docs apim_policydev. Use when the
  user asks to create/edit policies, filters (Connect to URL, Script, Read
  Organization, routing), Portal Alerts, Auth Profiles, Remote Hosts, listeners,
  configuration fragments, Groovy/Script MIME (ContentType/Body.create), or Policy
  Studio workflows. Prefer MCP resource axway://apim/playbook/policy-development
  and RAG markdown over inventing filter or com.vordel.* APIs.
---

# Axway Policy Development (Policy Studio)

Playbook for agents building or changing **API Gateway policies** with Axway docs RAG + this repo’s fragment patterns.

## Bootstrap (outro workspace / agente)

Se a skill ainda não estiver no workspace alvo (ex. **apim-policies**), execute no repo **apim-mcp**:

```powershell
powershell -File scripts/install-policy-dev-skills.ps1 -TargetWorkspace "<path-apim-policies>" -Platform All -Force
```
Ou no Linux/macOS:
```bash
./scripts/install-policy-dev-skills.sh -TargetWorkspace "/path/to/apim-policies" -Platform All -Force
```

Docs: `docs/pt-BR/instalar-skills-policy-dev.md` / `docs/en/install-policy-dev-skills.md`. Anexar sempre `axway://apim/playbook/policy-development` quando o MCP estiver conectado.

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
4. Re-scrape if docs may be stale: `node skills/apim-policy-development/scripts/crawl-policydev-docs.mjs`

## MCP exposure

| Kind | Name |
|------|------|
| Resource | `axway://apim/playbook/policy-development` |
| Resource | `axway://apim/docs/policydev/{slug}` (RAG page by slug) |
| Prompt | `axway_apim_policy_develop` |
| Tool | `axway_apim_fragment_packages_list` — listar pacotes **instalados na imagem** MCP |
| Tool | `axway_apim_fragment_validate` — validar pacote instalado; Tier 0 offline; Tier 1 com gatewayHome |
| Tool | `axway_apim_fragment_validate_submit` — validar pacote **só no workspace do agente** (`files` ou `archiveBase64`) |
| Tool | `axway_apim_fragment_yaml_to_xml` — Tier 1 (YAML→XML Federated); scope **observe** (ficheiros locais/temp; não altera APIM) |
| Tool | `axway_apim_fragment_sync_ps_project` — Tier 0 (alinhar ps-project); scope **observe** (não altera APIM) |
| Tool | `axway_apim_fragment_gateway_resolve` — diagnosticar mapeamento versão→gatewayHome |
| Resource | `axway://apim/policies/packages` — índice de pacotes instalados |

Attach the playbook resource before designing non-trivial policies.

## Policy packages (apim-policies repo)

Policy **implementations** are **not** in apim-mcp. They live in the separate **apim-policies** repo (path configured by the agent/workspace).

| Item | Location |
|------|----------|
| Example package | `apim-policies/policies/example-policy-package/README.md` |
| New package template | `apim-policies/policies/PACKAGE-README-TEMPLATE.md` |
| Shared scripts | `apim-policies/policies/_shared/scripts/` |
| K8s / deploy scripts | `apim-policies/k8s/`, `apim-policies/scripts/` |

Open **apim-policies** for package READMEs, E2E tests, and deploy workflows. Do not copy client-specific packages into apim-mcp.

## Playbook — develop a policy (order)

```
Progress:
- [ ] 1. Clarify goal (Send alert? Receive HTTP? Lookup local APIM? Route?)
- [ ] 2. RAG: open matching docs/rag pages (filters, listeners, import)
- [ ] 3. Choose filter types (prefer API Management Read * for local registry reads)
- [ ] 4. Author YAML fragment (estrutura 3b: Root, System, types junction, HTTP listener, `_fragment.yaml`)
- [ ] 5. Validate: checklist → yamles → PS import; MCP conforme árvore abaixo
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
| YAML fragment folder | Policy Studio YAML project | `_parent.yaml` Root + `META-INF/_fragment.yaml` (`addIfAbsent` / `addOrReplace`) |
| XML fragment `.xml` | Policy Studio XML / FED | Export via Federated Entity Store — never ship YAML inside `realizedTypes` |
| Passwords | YAML import | `Entity Store Configuration` + `passphraseTest`; BasicProfile com placeholder `httpAuthPass` |

Repo examples: **apim-policies** repo (e.g. `example-policy-package/`). Template: `apim-policies/policies/PACKAGE-README-TEMPLATE.md`.

### 3b. Configuration Fragment — estrutura importável (PS 7.7)

Obrigatório para import YAML sem *Could not load YAML Entity Store*:

| Item | Detalhe |
|------|---------|
| `fragment/_parent.yaml` | `type: Root` |
| Cadeia `_parent` | `Service` → `NetService`; serviço HTTP → `HTTP`; `Policies/{grupo}` → `CircuitContainer` |
| `System/` | `Filter Categories`, `Policy Categories`, `Entity Store Configuration` |
| `META-INF/types/` | Junction via `apim-policies/policies/_shared/scripts/link-meta-inf-types.ps1` → BlankConfiguration do **GatewayHome alinhado ao productVersion do ambiente alvo**; **não commitar** |
| Listeners | `HTTP` + `InetInterface` (porta) + `XMLFirewall` (path) — padrão `portaltraffic`; **nunca** `CircuitContainer` no nó de serviço |
| `_fragment.yaml` | `addIfAbsent` = ancestrais (`/System`, `/Environment Configuration/Service`); `addOrReplace` = políticas/serviço/auth — **sem overlap** de PKs |
| PKs | Não listar PKs inválidos (ex. `//contact` se filho já está em `//api/v1,*`) |
| Passphrase | `passphraseTest: aHR0cDsvL3d3dy52b3JkZWwuY29t` + `httpAuthPass: Y2hhbmdlbWU=` em BasicProfile |
| Groovy | Cada `{{file "…groovy"}}` → ficheiro existente em `…-Files/`; **não inventar** `import` Axway |

### Groovy / Script filter — imports (obrigatório)

**Nunca inventar classes `com.vordel.*`.** Só usar APIs vistas em scripts que já compilam no Gateway (repo `policies/`, Script library do PS, RAG).

| Precisa de… | Usar | **Não** usar |
|-------------|------|--------------|
| Trace em circuito | **TraceFilter** inline no FilterCircuit (`traceMsg`, `traceAttributes`, `traceBody`, `doIndent`, `traceLevel`) | Groovy `Trace.info`; policy separada só para trace; `CircuitDelegateFilter` → trace (YamlPK import) |
| Log em script | `import com.vordel.trace.Trace` → `Trace.info` / `debug` / `error` (só quando TraceFilter não couber) | `com.vordel.trace.Tracker` (não existe) |
| Body JSON outbound | Groovy → atributo (ex. `outbound.json`) → **ChangeMessageFilter** `name: Set Message` | `Body.create` no Groovy se Set Message existe downstream |
| Body HTTP (fallback) | `Body`, `ContentType(Authority.MIME, …)`, `HeaderSet` + `ByteArrayContentSource` (só sem Set Message) | `ContentType(String,String)`; `Body.create(ct, true)` |
| Headers MIME | `HeaderSet.getHeaders(String)` | `getHeaderValues(String)` (não existe no Gateway) |
| JSON | `org.codehaus.jettison.json.*` ou APIs MIME já usadas no repo | |
| `envSettings.props` | **Set Attribute** com `${env.NOME}` → depois `msg.get("attr")` no Groovy | `Tracker.getProperty`, `System.getenv` para `env.*` |

#### Trace — TraceFilter inline

Para trace em circuitos de policy, usar **`type: TraceFilter`** como filho **inline** do `FilterCircuit` — **não** policy FilterCircuit separada só para trace, **não** `CircuitDelegateFilter` para delegar a um circuito de trace.

Campos: `traceMsg`, `traceAttributes`, `traceBody`, `doIndent`, `traceLevel` (ex. `5`).

#### Padrão preferido: Groovy → JSON attribute → Set Message

Para montar body JSON outbound, **não** usar `Body.create` no Groovy quando o circuito tem **ChangeMessageFilter** downstream:

1. **Groovy** monta JSON string → atributo de mensagem (ex. `msg.put("outbound.json", …)`)
2. **ChangeMessageFilter** `name: Set Message`, `outputContentType: application/json`, `body: ${outbound.json}`
3. **TraceFilter** inline (opcional)
4. **Connect to URL**: `body: ${content.body}`, `sendReceivedContentHeaders: false`

Exemplos completos: **apim-policies** → `example-policy-package/README.md` (ou README do pacote em questão).

#### Portal API v1.4 payloads

Consultar OpenAPI do ambiente (`api-manager-*.json` / docs Axway) e exemplos validados no README do pacote em **apim-policies**.

#### `ContentType` / `Body.create` (fallback — só quando **não** há Set Message downstream)

JAR: `apigateway/system/lib/plugins/vordel-mime-*.jar`. Construtor real:

```java
public ContentType(Authority authorityCT, String basicMime)  // Authority: MIME | URI
public static Body create(HeaderSet headers, ContentType ct, ContentSource source)
```

Padrão correto (Groovy):

```groovy
import com.vordel.mime.Body
import com.vordel.mime.ContentType
import com.vordel.dwe.ByteArrayContentSource

def ct = new ContentType(ContentType.Authority.MIME, "application/json")
def body = Body.create(null, ct, new ByteArrayContentSource(payload.getBytes("UTF-8")))
msg.put("content.body", body)
```

**Connect to URL após body inbound consumido (Receive):** ver exemplos em **apim-policies** (Set Message + Prepare Outbound + Connect localhost:8075).

**JSR223 Groovy:** `def` no nível do script **não** fica visível em métodos auxiliares (`MissingPropertyException`). Constantes usadas em helpers → variável local **dentro** do método.

```groovy
import com.vordel.mime.HeaderSet
msg.put("http.headers", headers)  // Content-Type + Content-Length
msg.put("http.content.headers", new HeaderSet())
```

**Não** usar (falha em runtime — aborta Portal Alert / circuit):

```groovy
new ContentType("application", "json")   // Could not find matching constructor
Body.create(ct, true); body.write(...); body.rewind()  // create(ct,boolean) não existe
```

**Sintoma em Traffic Monitor (Portal Alert):** entidade APIM criada (INFO), depois policy `On Application Approved` (ou similar) → filter Scripting Language **ABORTED** → HTTP **500** na UI; trace: `Could not find matching constructor for: com.vordel.mime.ContentType(String, String)`. A app/org pode existir no registry; o alerta/sync falhou no envelope.

**Sintoma Portal API (resposta errada):** alert Send síncrono + Connect ao peer pode substituir a resposta Portal. Ver fix com **Store Message** / **Restore Message** no README do pacote em **apim-policies**.

Erros típicos:

```
unable to resolve class com.vordel.trace.Tracker
Could not find matching constructor for: com.vordel.mime.ContentType(String, String)
```

Checklist Script filter:
1. Copiar imports de um `.groovy` existente no mesmo pacote ou Script Group (ver **apim-policies**).
2. Preferir filtros Axway (Set Attribute, Connect to URL) a lógica inventada no script.
3. `def invoke(msg)` obrigatório; variáveis locais (não globais).
4. Confirmar que cada `{{file "…groovy"}}` existe no disco.
5. APIs `com.vordel.mime.*`: confirmar no JAR (`plugins/vordel-mime-*.jar`) / CFR — não inventar construtores.
6. Após corrigir `.groovy`, regenerar XML Federated (`yaml-frag-to-xml` / `axway_apim_fragment_yaml_to_xml`) — o XML embute o script; YAML sozinho não actualiza FED XML.

Referências de layout: `BlankConfiguration-VordelGateway`, FactoryConfiguration `portaltraffic`, `config`.

#### Erros de import → correção

| Mensagem | Fix |
|----------|-----|
| Could not load YAML Entity Store | `META-INF/types` (junction via `link-meta-inf-types.ps1`) |
| NetService does not allow CircuitContainer | Serviço = `HTTP`, não `CircuitContainer` |
| Override and addition directive sets cannot overlap | Separar `addIfAbsent` vs `addOrReplace` |
| No Passphrase Details | Entity Store + `passphraseTest` + BasicProfile `httpAuthPass: Y2hhbmdlbWU=` |
| No YAML entity found for PK … | YAML ausente ou PK errada em `_fragment.yaml` |
| Cannot resolve reference /Policies/… | Policy/`_parent.yaml` ausente ou nome divergente |
| `fragmentPath` rejected (security) | `validate_submit` + `files`, não path Windows em `fragment_validate` |
| `ContentType(String, String)` / Script ABORTED / Alert 500 | Preferir Set Message; fallback: `ContentType(Authority.MIME, …)` + `Body.create(null, ct, ByteArrayContentSource)` |
| `getHeaderValues` / MissingMethodException em HeaderSet | Usar `headers.getHeaders(name)` (Prepare Outbound APIM Call) |
| Portal **400 Bad Request** / Connect to URL sem body (só `Expect: 100-continue`) | Set Message + Prepare Outbound (`Content-Length`); limpar `http.content.headers`; URL `https://localhost:8075` |
| Portal **409** upsert / loop bidirecional | Aceitar **409** no soft-call → marcar idempotência → 200 |
| Loop enable/disable após status PUT | Marcar “já sincronizado” antes do PUT; skip call se já no estado alvo |
| `${var}` em string Groovy = selector Axway | Usar `+ var +` (concatenação); validar script embutido no `PrimaryStore.xml` após export FED |
| `unable to resolve class …Tracker` | TraceFilter para trace; `com.vordel.trace.Trace` só em script; env via Set Attribute `${env.*}` |
| `Unable to find YamlPK …/Trace After …` | TraceFilter **inline**; regenerar XML Federated — não `CircuitDelegateFilter` para trace |
| `Widget is disposed` (import XML) | Erro UI Eclipse/SWT — ver log PS; passphrase **vazia**; XML = `fragment-xml/*-fragment.xml` via `yaml-frag-to-xml.py` |
| Import `from-yaml.xml` mid-step | **Não** importar export intermédio — só XML final Federated |
| `Cannot import due to version mismatch for type 'RemoteHost'` (ex. 20→21) | Versões de tipo vêm do **ambiente alvo** (FED/types), não de guess local — ver §5 |

### 4. Validate

Prefer MCP tools when the agent runs against this MCP server (Python 3 on MCP host). **Não depende de yamles no PC do utilizador** — Tier 1 usa Gateway no container (`/opt/Axway`).

#### Ladder de validação (ordem)

1. **Checklist estático** — estrutura, `_fragment.yaml`, groovy, types (ver secção 3b)
2. **`yamles validate -s yaml:file:./fragment`** — local com Axway **ou** MCP Tier 1
3. **Policy Studio** — File → Import → Configuration Fragment → pasta `fragment/`
4. **MCP** — pacote na imagem: `packages_list` → `fragment_validate`; só local: `validate_submit` + mapa `files`

#### Árvore de decisão (não inventar `fragmentPath`)

```
Pacote na imagem MCP?  → packages_list → fragment_validate(fragmentPath)
Política só local?     → validate_submit:
                           Preferir files: { "fragment/META-INF/_fragment.yaml": "<base64>", ... }
                           Ou archiveBase64 se já tem tar.gz ou agente pode criar tar localmente
Nunca inventar fragmentPath como /app/teste/... no MCP
```

| Situação | Tool | `fragmentPath` / upload |
|----------|------|-------------------------|
| Instalado na imagem | `axway_apim_fragment_packages_list` → `axway_apim_fragment_validate` | `fragmentPath` = package ROOT (from packages_list) |
| Só no workspace do agente | `axway_apim_fragment_validate_submit` | `files` map ou `archiveBase64`; opcional `packageLabel` |

**`fragmentPath` (pacotes instalados):** raiz do pacote relativa ao repo — **não** o subdiretório `fragment/`. Paths fora de `policies/` (whitelist) são rejeitados.

#### Workflow agente — política local (`validate_submit`)

1. Ler ficheiros do path indicado pelo utilizador (ex. `C:\projeto\minha-policy\fragment\...`).
2. Construir mapa `files` com paths **relativos ao package root** e conteúdo em base64.
3. Chamar `axway_apim_fragment_validate_submit` com `files` (preferido) ou `archiveBase64`.

Paths típicos no mapa `files`:

- `fragment/META-INF/_fragment.yaml`
- `fragment/Policies/.../*.yaml`
- `scripts/validate-fragment.py` (opcional; MCP copia `resources/fragment/scripts/validate-fragment-generic.py` se ausente)

**Limites:** máx. **500 ficheiros**, **10 MB** total; sandbox ephemeral em `policies/.sandbox/` (purge automático após validação).

#### Tiers de validação

| Tier | Tools | Requisitos |
|------|-------|------------|
| **0 — Offline** | `axway_apim_fragment_validate`, `axway_apim_fragment_validate_submit`, `axway_apim_fragment_sync_ps_project` | Python 3 apenas |
| **1 — Axway libs** | yamles/import dry-run via validate; `axway_apim_fragment_yaml_to_xml` | `gatewayHome` resolvido: parâmetro, `instanceId`+mapeamento, `AXWAY_GATEWAY_HOME`, ou `config/axway-gateway-homes.json` |

Diagnóstico de mapeamento: `axway_apim_fragment_gateway_resolve`. Copiar `config/axway-gateway-homes.example.json` → `config/axway-gateway-homes.json`.

Local shell equivalents:

```bat
yamles validate -s yaml:file:.\fragment -p ""
# Package-specific scripts: see apim-policies/policies/<package>/scripts/
```

### 5. Import

Policy Studio → **File → Import → Configuration Fragment**.

| Formato | O que importar |
|---------|----------------|
| **YAML** | Pasta `fragment/` com `META-INF/types` junction do **target** (`link-meta-inf-types.ps1`) |
| **XML** | Só `fragment-xml/*-fragment.xml` gerado por `yaml-frag-to-xml.py` / `axway_apim_fragment_yaml_to_xml` — **não** `from-yaml.xml` intermédio |
| Passphrase | **Vazia** (`passphraseTest` no fragmento) |

Exemplo completo: **apim-policies/policies/example-policy-package/** (YAML + XML FED).

#### Type catalog versions (obrigatório antes de importar no target)

Antes de ship/import de um Configuration Fragment no Gateway/PS do **ambiente alvo**, as versões do catálogo de tipos (`RemoteHost`, Cache, etc.) têm de coincidir com o Entity Store **desse** ambiente — **não** com um guess a partir da install Axway local do agente.

**Como obter do ambiente (via MCP):**

1. Preferir live: `axway_apim_topology_list` → `productVersion` / `instanceId` → `axway_apim_deployment_archive_get` (FED) → extrair (agente) → inspecionar `META-INF/types` / defs (ou YAML fed2yaml) pela `version` do tipo (ex. RemoteHost). Opcional: comparar com `realizedTypes` / `META-INF/types` do fragmento ou tar.gz.
2. Se houver mapeamento Gateway home (`axway_apim_fragment_gateway_resolve` / `config/axway-gateway-homes.json`): usar BlankConfiguration `META-INF/types` desse `gatewayHome` **só** se o `productVersion` for o da topologia — ainda ancorado no env, não numa cópia aleatória local.
3. **Não** assumir que o build Axway no PC do agente = lab/prod. Sintoma: `Cannot import due to version mismatch for type 'RemoteHost'. Changing version is not allowed upgrading from 20 to 21.` (números **exemplo** de um catálogo Blank 7.7 — ler a versão real no FED/types do target).
4. Fix: regenerar fragment/tar.gz com catálogo alinhado à versão do **target**; ou importar XML Federated regenerado contra esse gatewayHome. Nunca bump cego de campos `version` sem os fields dessa versão de tipo.

### Groovy — **não** usar `${variável}` em strings do script

O Gateway pré-processa `${…}` no **texto do script** como selector Axway (não como GString Groovy). Ex.: `path = "/applications/${targetAppId}/extclients"` → `applications/[invalid field]/extclients` em runtime.

| Errado | Correto |
|--------|---------|
| `"/api/.../applications/${targetAppId}/extclients"` | `"/api/.../applications/" + targetAppId + "/extclients"` |

Padrão do repo: `Build App Status Request`, `Build Delete App Request` usam concatenação. Após editar `.groovy`, regenerar XML Federated.

**FED/XML:** import repetido do fragment XML pode **não** substituir scripts já embutidos em `PrimaryStore.xml` — validar no projeto (`PrimaryStore.xml` ou grep no pod) antes de `export-fed`. Se necessário, patch manual + re-export.

## Headless Policy Studio (sem UI)

Policy Studio **não tem CLI de import** — usar **yamles** + Jython **EntityStoreAPI** no `GatewayHome` alinhado à topologia.

| Projeto | ES | Import | Export |
|---------|-----|--------|--------|
| **YAML project** | YAML (`yamles`) | `yamles import -s fragment -t <yaml-project> -ar -c -r` (**1×**; reimport → `DuplicateKeysException`) | `tar` do project → `yaml.tar.gz` |
| **Federated/XML** | Federated/XML | Jython `importConf` no `configs.xml` (repetível) | `DeploymentArchive(<fed-project>)` → `.fed` (**não** `configs.xml` isolado) |

Scripts de import/export: ver README do pacote em **apim-policies** (ex. `example-policy-package`).

**PRD `yaml.tar.gz`:** baseline do pod (snapshot) → `yamles upgrade` → **single** `yamles import` do `fragment/` (fix type `Cache` se v2→v3). Não re-exportar o projeto YAML após múltiplos imports.

## Deploy K8s e operações por pacote

Deploy, K8s manifests, KPS matrices, E2E tests: ver **apim-policies** repo.

| Item | Location |
|------|----------|
| Deploy script | `apim-policies/scripts/deploy-gateway-fed.ps1` |
| K8s / E2E / README | `apim-policies/k8s/`, `apim-policies/policies/<package>/` |

## Logs e trace (foco apimgr)

```bash
kubectl logs -n axway deploy/apim-gateway-apimgr -c apigateway --since=10m
```

Portal alerts no trace: `Filter status PASSED/FAILED`, `correlationId` no header `X-CorrelationID`. Payload completo: Traffic Monitor no pod ou MCP `axway_apim_traffic_search`.

**grep útil (genérico):** nomes de filtros/políticas do pacote, `Connect to URL`, `[invalid field]`, falhas de Scripting Language.

**Test entities no pod:** Portal `curl -sk -u apiadmin:changeme https://localhost:8075/api/portal/v1.4/...`; KPS `curl -sk -u admin:changeme https://localhost:8090/api/router/service/INSTANCE/api/kps/...`

## Loop de correção (policy package — apim-policies)

1. Reproduzir (E2E script do pacote ou Portal/curl)
2. Fix fragment groovy/yaml no repo **apim-policies**
3. Regenerar XML Federated se necessário
4. Validar (`validate-fragment.py` ou MCP `validate_submit`)
5. Deploy via `apim-policies/scripts/deploy-gateway-fed.ps1` (ver README do pacote)

## Ao corrigir bug de policy (obrigatório)

Após fix em fragment no repo **apim-policies**, actualizar README do pacote e validar:

```
Progress:
- [ ] 1. Corrigir YAML / .groovy / Connect fields em apim-policies
- [ ] 2. Actualizar apim-policies/policies/{pacote}/README.md
- [ ] 3. Regenerar XML Federated se necessário
- [ ] 4. Validar: validate-fragment.py ou axway_apim_fragment_validate_submit
- [ ] 5. Deploy via scripts do pacote (apim-policies/scripts/)
```

Se guidance MCP genérica mudar, actualizar skill/reference/playbook em **apim-mcp** e `npm run build`.

## Agent deliverables

When building policies for the user, deliver:

1. Short design (flow diagram or bullet chain of filters)
2. Files (YAML and/or XML fragment)
3. Post-import checklist (hosts, ports, Auth Profiles, alerts enabled)
4. Doc citations (`source:` URLs from RAG frontmatter)
5. Após fix: docs/skill/playbook/mcp-guidance/validador actualizados (secção acima)

## Related

- Skill `apim-gateway-code-analysis` — diagnose live APIs + FED + decompile (not for authoring)
- MCP tools `axway_apim_*` — live Manager/Gateway data while designing receive paths / alerts
- Slug cheat sheet: [reference.md](reference.md)
