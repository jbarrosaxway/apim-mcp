/**
 * @module src/playbook
 * @description MCP-exposed playbooks (Gateway root-cause + Policy Studio development).
 * Loaded from bundled skills when present; falls back to embedded summaries.
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
/** Embedded fallback when skill files are not on disk (e.g. dev without .cursor copy). */
export const GATEWAY_CODE_ANALYSIS_PLAYBOOK_FALLBACK = `# Axway Gateway — playbook MCP (FED + análise pelo agente)

## Objetivo
Recuperar evidência live (MCP tools) + **FED deployado** via ANM. Decompilação e grep no bytecode ficam com o **agente chamador** (shell local ou no pod).

## Ordem obrigatória
1. \`axway_apim_topology_list\` — \`productVersion\`, \`instanceId\`
2. \`axway_apim_proxy_get\` / tráfego (\`traffic_search\` → \`traffictrace_get\`) se houver sintoma HTTP
3. **\`axway_apim_deployment_archive_get\`** — FED (.fed) via Deployment API Axway
4. Agente: extrair ZIP, grep políticas (\`PrimaryStore.xml\`, \`EnvSettingsStore.xml\`), opcional CFR nos JARs da mesma versão

## FED — Axway Deployment API (swagger tag Deployment API)
| Endpoint | Uso |
|----------|-----|
| \`GET /deployment/archive/service/{serviceID}\` | **Primário** — Deployment Archive (.fed) |
| \`GET /router/service/{instance}/api/configuration/archive\` | **Fallback** — EMT / Externally Managed Topology (405) |
| \`GET /deployment/domain/deployments\` | Metadados; \`archiveID\` em \`rootProperties.Id\` |

\`serviceID\` = \`instanceId\` de \`topology_list\`. Resposta: \`result.data\` (base64) → arquivo \`.fed\` (ZIP).

## Tool MCP
\`axway_apim_deployment_archive_get\`
- \`instanceId\` (opcional se uma instância)
- \`savePath\` — persiste no filesystem do servidor MCP (ex. \`/workspace/gateway.fed\`)
- \`returnBase64\` — default true sem \`savePath\`; devolve base64 até 8 MB para agentes remotos

## Após o FED (agente chamador, não MCP)
- Extrair: \`unzip\` ou \`.cursor/skills/apim-gateway-code-analysis/scripts/extract-fed.sh\`
- Correlacionar invoke/routing do \`proxy_get\` com filtros no FED
- Decompile seletivo: \`find-in-jars.py\`, \`decompile-classes.sh\` + CFR/JARs \`system/lib/\` da versão da topologia

## Prompt MCP irmão
\`axway_apim_api_rootcause_analyze\` — playbook expandido com placeholders de API/sintoma.
`;
export const POLICY_DEVELOPMENT_PLAYBOOK_FALLBACK = `# Axway Policy Development — playbook MCP

## Objetivo
Desenvolver policies no Policy Studio (filters, listeners, OAuth, KPS, fragments YAML/XML) usando a skill \`apim-policy-development\` e o corpus RAG em \`docs/rag/\`.

## Bootstrap — ambiente Cursor para autorar policies
1. No repo **apim-mcp**: \`scripts/install-policy-dev-skills.ps1 -TargetWorkspace <apim-policies> -Force\` (copia skill+RAG+rule; opcional \`-Scope Global\`, \`-Mode Junction\`).
2. Confirmar MCP Axway em \`.cursor/mcp.json\` (snippet gerado se necessário).
3. Anexar este resource (\`axway://apim/playbook/policy-development\`) ou prompt \`axway_apim_policy_develop\`.
4. Políticas reais: repo **apim-policies** — validar com \`axway_apim_fragment_validate_submit\`. Não copiar policies client-specific para o MCP.
Docs: \`docs/pt-BR/instalar-skills-policy-dev.md\`.

## Ordem
1. Clarificar objetivo (alert Send, HTTP Receive, lookup local APIM, routing)
2. Abrir páginas RAG (\`axway://apim/docs/policydev/{slug}\` ou ficheiros em \`.cursor/skills/apim-policy-development/docs/rag/\`)
3. Preferir filtros **API Management Read *** para leituras locais do registry
4. Autor YAML/XML fragment; validar (checklist → yamles → PS import → MCP). Ver skill secção «Configuration Fragment importável».

## Estrutura fragment importável (PS 7.7)

- \`fragment/_parent.yaml\` (Root); Service=NetService; HTTP service=HTTP; Policies=CircuitContainer
- System: Filter Categories, Policy Categories, Entity Store Configuration (\`passphraseTest: aHR0cDsvL3d3dy52b3JkZWwuY29t\` — passphrase vazia)
- \`META-INF/types\` — junction (\`link-meta-inf-types.ps1\` → Blank do **gatewayHome alinhado ao productVersion do target**); não commitar; não copiar árvore (MAX_PATH)
- Listeners: HTTP + InetInterface + XMLFirewall (portaltraffic); nunca CircuitContainer no serviço
- \`_fragment.yaml\`: addIfAbsent (ancestrais) vs addOrReplace (políticas) sem overlap de PKs
- BasicProfile: \`httpAuthPass: Y2hhbmdlbWU=\` (placeholder changeme) — **obrigatório** para Auth Profiles importarem
- Cada \`{{file "…groovy"}}\` → ficheiro no disco

## Type catalog versions (ambiente alvo)

Antes de importar no target: versões de tipo (\`RemoteHost\`, Cache, etc.) = Entity Store **desse** ambiente, **não** guess da install Axway local do agente.

1. Preferir MCP: \`axway_apim_topology_list\` → \`productVersion\`/\`instanceId\` → \`axway_apim_deployment_archive_get\` (FED) → extrair → ler \`version\` em \`META-INF/types\` (ou fed2yaml). Opcional: comparar com \`realizedTypes\` / types do fragmento/tar.gz.
2. Alternativa: Blank do \`gatewayHome\` via \`axway_apim_fragment_gateway_resolve\` / \`config/axway-gateway-homes.json\` **só** se \`productVersion\` = topologia.
3. Sintoma mismatch: \`Cannot import due to version mismatch for type 'RemoteHost'… upgrading from 20 to 21\` (números **exemplo** Blank 7.7 — ler versão real no FED/types do target).
4. Fix: regenerar fragment/XML/tar com catálogo do target; nunca bump cego de \`version\`.

## Groovy — não inventar APIs \`com.vordel.*\`

| Usar | Não usar |
|------|----------|
| **TraceFilter** inline (\`traceMsg\`, \`traceAttributes\`, \`traceBody\`, \`doIndent\`, \`traceLevel\`) | Groovy \`Trace.info\` para trace de circuito; \`CircuitDelegateFilter\` → trace (YamlPK) |
| Groovy → attribute JSON → **Set Message** (\`ChangeMessageFilter\`) → Connect \`body: \${content.body}\` | \`Body.create\` no Groovy se Set Message downstream |
| \`new ContentType(ContentType.Authority.MIME, "application/json")\` + \`Body.create(null, ct, ByteArrayContentSource(bytes))\` | \`new ContentType("application", "json")\` / \`Body.create(ct, true)\` |
| \`HeaderSet.getHeaders(name)\` | \`getHeaderValues(name)\` (não existe) |
| Set Attribute \`\${env.X}\` → \`msg.get\` | \`Tracker.getProperty\` / inventar env |

## Exemplos de pacotes (repo externo)

Implementações completas vivem no repo **apim-policies** (separado deste MCP):

| Pacote | Uso |
|--------|-----|
| \`example-policy-package\` | Exemplo genérico no repo externo — README do pacote (não vive neste MCP) |

Abrir o workspace **apim-policies** para scripts de validação, deploy e detalhes de cada pacote. Não copiar implementações client-specific para o MCP.

## Validação de fragments (MCP)

**Árvore de decisão** — não inventar \`fragmentPath\`:

| Situação | Tools |
|----------|-------|
| Pacote já na imagem MCP | \`axway_apim_fragment_packages_list\` → \`axway_apim_fragment_validate\`(\`fragmentPath\`) |
| Política só no workspace do agente | \`axway_apim_fragment_validate_submit\` |

**\`fragmentPath\`** (só pacotes instalados): package ROOT relativo ao repo, ex. \`policies/my-package\` — **não** o subdir \`fragment/\`. Nunca usar paths inventados (\`/app/teste/...\`, \`/tmp\`, \`../\`). Pacotes vivem no repo **apim-policies** (montar em \`/app/policies/\` ou usar \`validate_submit\`).

**\`validate_submit\`** (política local): sem rebuild da imagem.
- **Preferir \`files\`**: mapa \`relativePath → base64\` (ler ficheiros do path do utilizador, codificar, submeter).
- **Ou \`archiveBase64\`**: tar.gz do package root se já existir ou agente pode criar com \`tar\`.
- \`packageLabel\` opcional (logs/sandbox id).

**Workflow agente (política local):** ler ficheiros do path do utilizador → construir \`files\` com paths relativos ao package root → \`validate_submit\`.

**Limites de segurança:** 500 ficheiros, 10 MB total; sandbox ephemeral em \`policies/.sandbox/\` (purge automático).

**Tiers:** Tier 0 offline (Python 3); Tier 1 yamles/import dry-run com \`gatewayHome\` (\`axway_apim_fragment_gateway_resolve\`). XML: \`axway_apim_fragment_yaml_to_xml\` (Tier 1, observe). Sync ps-project: \`axway_apim_fragment_sync_ps_project\` (Tier 0, observe). Resource: \`axway://apim/policies/packages\`.
5. Mutações APIM (POST/PUT/DELETE) via ConnectToURL; leituras preferir Read * / DAO local

## Docs
Fonte: https://docs.axway.com/bundle/axway-open-docs/page/docs/apim_policydev/index.html
Manifest RAG: \`.cursor/skills/apim-policy-development/docs/rag/_manifest.md\`

## Prompt
\`axway_apim_policy_develop\`
`;
const GATEWAY_PLAYBOOK_CANDIDATES = [
    path.join(process.cwd(), ".cursor/skills/apim-gateway-code-analysis/SKILL.md"),
    path.join(moduleDir, "..", ".cursor/skills/apim-gateway-code-analysis/SKILL.md"),
];
const POLICY_PLAYBOOK_CANDIDATES = [
    path.join(process.cwd(), ".cursor/skills/apim-policy-development/SKILL.md"),
    path.join(moduleDir, "..", ".cursor/skills/apim-policy-development/SKILL.md"),
];
const POLICY_RAG_DIRS = [
    path.join(process.cwd(), ".cursor/skills/apim-policy-development/docs/rag"),
    path.join(moduleDir, "..", ".cursor/skills/apim-policy-development/docs/rag"),
];
function readFirstExisting(candidates) {
    for (const candidate of candidates) {
        try {
            if (fs.existsSync(candidate)) {
                return fs.readFileSync(candidate, "utf8");
            }
        }
        catch {
            /* try next */
        }
    }
    return null;
}
/** Loads the full skill markdown for MCP resource \`axway://apim/playbook/gateway-code-analysis\`. */
export function loadGatewayCodeAnalysisPlaybook() {
    return readFirstExisting(GATEWAY_PLAYBOOK_CANDIDATES) ?? GATEWAY_CODE_ANALYSIS_PLAYBOOK_FALLBACK;
}
/** Loads Policy Studio development playbook for \`axway://apim/playbook/policy-development\`. */
export function loadPolicyDevelopmentPlaybook() {
    return readFirstExisting(POLICY_PLAYBOOK_CANDIDATES) ?? POLICY_DEVELOPMENT_PLAYBOOK_FALLBACK;
}
function resolveRagDir() {
    for (const dir of POLICY_RAG_DIRS) {
        try {
            if (fs.existsSync(dir))
                return dir;
        }
        catch {
            /* next */
        }
    }
    return null;
}
/** List RAG doc slugs (filename without .md, excluding _manifest*). */
export function listPolicyDevDocSlugs() {
    const dir = resolveRagDir();
    if (!dir)
        return [];
    return fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
        .map((f) => f.replace(/\.md$/, ""))
        .sort();
}
/** Load one RAG markdown page by slug for \`axway://apim/docs/policydev/{slug}\`. */
export function loadPolicyDevDoc(slug) {
    if (!slug || slug.includes("..") || slug.includes("/") || slug.includes("\\")) {
        return null;
    }
    const dir = resolveRagDir();
    if (!dir)
        return null;
    const file = path.join(dir, `${slug}.md`);
    try {
        if (fs.existsSync(file))
            return fs.readFileSync(file, "utf8");
    }
    catch {
        return null;
    }
    return null;
}
//# sourceMappingURL=playbook.js.map