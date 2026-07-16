/**
 * @module src/index
 * @description Ponto de entrada principal para o servidor Axway MCP (Model-Context-Protocol).
 *
 * Este arquivo é responsável por:
 * 1. Inicializar e configurar o servidor MCP usando o SDK `@modelcontextprotocol/sdk`.
 * 2. Gerenciar sessões e transportes HTTP, incluindo Server-Sent Events (SSE) para comunicação em tempo real.
 * 3. Suportar transporte stdio para comunicação direta via stdin/stdout.
 * 4. Importar todas as operações (ferramentas) dos arquivos no diretório `src/operations`.
 * 5. Registrar cada ferramenta no servidor MCP, mapeando a definição da ferramenta (de `src/tools.ts`)
 *    para sua implementação real.
 * 6. Iniciar o servidor HTTP para escutar as requisições do cliente (ex: um modelo de linguagem).
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "node:http";
import { ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "crypto";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { tools } from "./tools.js";
import { AxwayApi } from "./api.js";
import * as dotenv from 'dotenv';
import { authenticateHttpRequest, handleWellKnown, loadAuthConfig, logAuthStartup, } from "./auth/oidc.js";
import { authInfoFromProfile, getAuthScopes, loadStdioToolProfile, runWithAuth, setFallbackAuth, } from "./auth/context.js";
import { PROFILE_SCOPES, requiredScopeFor, toolAllowed, TOOL_ANNOTATIONS, TOOL_TITLES, } from "./auth/tool-scopes.js";
import { DIAGNOSE_GATEWAY_PROMPT, SERVER_INSTRUCTIONS, } from "./mcp-guidance.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
const SERVER_VERSION = "1.0.17";
dotenv.config();
// All operation imports are correct...
import * as topology from "./operations/topology.js";
import * as system from "./operations/system.js";
import * as monitoring from "./operations/monitoring.js";
import * as organizations from "./operations/organizations.js";
import * as applications from "./operations/applications.js";
import * as users from "./operations/users.js";
import * as proxies from "./operations/proxies.js";
import * as repository from "./operations/repository.js";
import * as access from "./operations/access.js";
import * as alerts from "./operations/alerts.js";
import * as quotas from "./operations/quotas.js";
const SESSION_ID_HEADER_NAME = "mcp-session-id";
/**
 * Servidor MCP customizado para interagir com o ambiente Axway.
 *
 * Estende a classe base `McpServer` para incluir:
 * - Uma instância da `AxwayApi` para comunicação com a plataforma Axway.
 * - Gerenciamento de múltiplos transportes HTTP, um para cada sessão de cliente.
 * - Suporte a transporte stdio para comunicação direta via stdin/stdout.
 */
class AxwayMcpServer extends McpServer {
    api;
    transports = {};
    sessionTimestamps = {};
    transportMode = 'http';
    constructor(transportMode = 'http') {
        super({
            name: "axway-mcp",
            version: SERVER_VERSION,
            description: "Axway API Gateway (ANM) + API Manager: diagnóstico (topologia, tráfego, erros, métricas), monitorização e administração APIM",
        }, { instructions: SERVER_INSTRUCTIONS });
        this.api = new AxwayApi();
        this.transportMode = transportMode;
        this.registerDiagnosticPrompt();
        this.registerTools();
        this.registerApimResources();
        this.installScopedToolsListHandler();
        // Apenas configurar limpeza de sessões se estiver no modo HTTP
        if (this.transportMode === 'http') {
            setInterval(() => {
                this.cleanupOldSessions();
            }, 5 * 60 * 1000);
        }
    }
    /** MCP prompt: playbook explícito para perguntas de saúde/problema no Gateway. */
    registerDiagnosticPrompt() {
        this.registerPrompt("axway_apim_gateway_diagnose", {
            title: "Diagnosticar API Gateway Axway",
            description: "Use when the user asks whether the Axway API Gateway/ANM has a problem, failure, outage, errors, or latency. Chains axway_apim_topology_list → metrics → traffic search → proxies. Side effects: none (read-only guidance). Sibling: call the named tools directly for ad-hoc checks.",
            argsSchema: {
                symptom: z
                    .string()
                    .optional()
                    .describe("Natural-language symptom (e.g. HTTP 500, slow responses)"),
                timeWindow: z
                    .string()
                    .optional()
                    .describe("Event lookback window such as 1h or 24h; default 1h"),
            },
        }, async ({ symptom, timeWindow }) => {
            const text = DIAGNOSE_GATEWAY_PROMPT.replace("{{symptom}}", symptom || "(não especificado)").replace("{{timeWindow}}", timeWindow || "1h");
            return {
                messages: [{ role: "user", content: { type: "text", text } }],
            };
        });
    }
    /** Minimal axway://apim resources for URI-addressable live reads. */
    registerApimResources() {
        const readJson = (data) => ({
            contents: [
                {
                    uri: "",
                    mimeType: "application/json",
                    text: JSON.stringify(data, null, 2),
                },
            ],
        });
        this.resource("apim_topology", "axway://apim/topology", {
            description: "Live Gateway topology snapshot including groups, instances, current instance identifiers, and product version. Data shape matches the axway_apim_topology_list tool output and is intended for URI-based context attachment. Always refresh after Kubernetes or Docker pod restarts because instance identifiers rotate. This is a live read against ANM, not a historical snapshot store. On 5xx or network timeouts retry with exponential backoff; on empty topology verify AXWAY_GATEWAY_URL before repeating.",
            mimeType: "application/json",
        }, async (uri) => {
            const data = await topology.listTopology(this.api);
            const result = readJson(data);
            result.contents[0].uri = uri.href;
            return result;
        });
        this.resource("apim_proxies", "axway://apim/proxies", {
            description: "Live inventory of frontend API proxies with id, path, and lifecycle state for attaching catalog context by URI. Prefer axway_apim_proxy_list or axway_apim_catalog_get when the agent needs filtered workflows or sibling disambiguation. This resource returns a live Manager read, not a cached offline export. Retry transient 5xx with backoff; fix Manager credentials on 401/403 instead of blind retries. Use axway://apim/proxies/{id} for a single proxy detail document.",
            mimeType: "application/json",
        }, async (uri) => {
            const data = await proxies.listApiProxies(this.api);
            const result = readJson(data);
            result.contents[0].uri = uri.href;
            return result;
        });
        this.resource("apim_proxy", new ResourceTemplate("axway://apim/proxies/{id}", {
            list: undefined,
        }), {
            description: "Live troubleshooting detail for one frontend API proxy addressed by id in the URI path. The JSON shape matches axway_apim_proxy_get including security and authenticationInfo.fieldName hints for client headers. Obtain ids from axway://apim/proxies or axway_apim_proxy_list first. This is a live Manager read; missing ids return not-found rather than stale cache. Retry 5xx with backoff; do not retry 404 without a new id.",
            mimeType: "application/json",
        }, async (uri, variables) => {
            const id = String(variables.id || "");
            const data = await proxies.getApiProxy(this.api, id);
            const result = readJson(data);
            result.contents[0].uri = uri.href;
            return result;
        });
        this.resource("apim_instance_traffic", new ResourceTemplate("axway://apim/instances/{instance_id}/traffic", {
            list: undefined,
        }), {
            description: "Live aggregate traffic counters for one Gateway instance identified by instance_id in the URI. Resolve instance_id from axway://apim/topology or axway_apim_topology_list immediately before reading because containerized deployments rotate identifiers after restart. Data shape aligns with axway_apim_instancetraffic_get. This is a live metrics read, not a stored timeseries archive. On empty or not-found results refresh topology then retry once; use exponential backoff for 5xx.",
            mimeType: "application/json",
        }, async (uri, variables) => {
            const instanceId = String(variables.instance_id || variables.instanceId || "");
            const data = await monitoring.getInstanceTraffic(this.api, instanceId);
            const result = readJson(data);
            result.contents[0].uri = uri.href;
            return result;
        });
    }
    /**
     * Substitui tools/list para anunciar apenas tools permitidas pelo scope efectivo,
     * incluindo annotations Axway (I13–I17).
     */
    installScopedToolsListHandler() {
        this.server.setRequestHandler(ListToolsRequestSchema, () => {
            const scopes = getAuthScopes();
            const allowed = tools().filter((t) => toolAllowed(t.method, scopes));
            return {
                tools: allowed.map((t) => {
                    const schema = zodToJsonSchema(z.object(t.parameters), {
                        strictUnions: true,
                    });
                    return {
                        name: t.method,
                        title: TOOL_TITLES[t.method],
                        description: t.description,
                        inputSchema: schema,
                        annotations: TOOL_ANNOTATIONS[t.method],
                    };
                }),
            };
        });
    }
    cleanupOldSessions() {
        const now = Date.now();
        const maxAge = 30 * 60 * 1000;
        Object.keys(this.sessionTimestamps).forEach(sessionId => {
            if (now - this.sessionTimestamps[sessionId] > maxAge) {
                delete this.transports[sessionId];
                delete this.sessionTimestamps[sessionId];
                console.log(`StreamableHTTP: Cleaned up old session: ${sessionId}`);
            }
        });
    }
    getSessionIdFromHeaders(headers) {
        const variations = [
            SESSION_ID_HEADER_NAME,
            SESSION_ID_HEADER_NAME.toLowerCase(),
            SESSION_ID_HEADER_NAME.toUpperCase(),
            'mcp-session-id',
            'mcp-session-id'.toLowerCase(),
            'mcp-session-id'.toUpperCase()
        ];
        for (const variation of variations) {
            if (headers[variation]) {
                return headers[variation];
            }
        }
        return undefined;
    }
    isInitializeRequest(body) {
        const check = (data) => data?.method === 'initialize';
        if (Array.isArray(body)) {
            return body.some(check);
        }
        return check(body);
    }
    async handleRequest(req, res) {
        console.log(`StreamableHTTP: ${req.method} ${req.url} - Headers:`, Object.keys(req.headers));
        console.log(`StreamableHTTP: Current sessions before request: ${Object.keys(this.transports).join(', ')}`);
        const chunks = [];
        for await (const chunk of req) {
            chunks.push(chunk);
        }
        const body = Buffer.concat(chunks).toString();
        const jsonBody = body ? JSON.parse(body) : null;
        if (req.method === 'GET') {
            const sessionId = this.getSessionIdFromHeaders(req.headers);
            console.log(`StreamableHTTP: GET request received, sessionId: ${sessionId || 'none'}`);
            console.log(`StreamableHTTP: Available sessions: ${Object.keys(this.transports).join(', ')}`);
            if (sessionId && this.transports[sessionId]) {
                console.log(`StreamableHTTP: Attaching client to SSE stream for session ${sessionId}`);
                await this.transports[sessionId].handleRequest(req, res);
                return;
            }
            if (sessionId && !this.transports[sessionId]) {
                console.log(`StreamableHTTP: Invalid session ID: ${sessionId}`);
                res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({
                    error: 'Invalid session ID',
                    message: 'The provided session ID is no longer valid. Please reinitialize the connection.'
                }));
                return;
            }
            console.log(`StreamableHTTP: No session ID provided for GET request`);
            res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({
                error: 'No session ID',
                message: 'GET requests require a valid session ID. Please initialize the connection first.'
            }));
            return;
        }
        if (req.method === 'POST') {
            const sessionId = this.getSessionIdFromHeaders(req.headers);
            console.log(`StreamableHTTP: POST request received, sessionId: ${sessionId || 'none'}`);
            console.log(`StreamableHTTP: Request body:`, jsonBody ? JSON.stringify(jsonBody).substring(0, 200) + '...' : 'null');
            let transport;
            if (sessionId && this.transports[sessionId]) {
                console.log(`StreamableHTTP: Using existing session: ${sessionId}`);
                this.sessionTimestamps[sessionId] = Date.now();
                transport = this.transports[sessionId];
                await transport.handleRequest(req, res, jsonBody);
                return;
            }
            if (!sessionId && this.isInitializeRequest(jsonBody)) {
                console.log(`StreamableHTTP: Creating new session for initialize request`);
                const generatedSessionId = randomUUID();
                console.log(`StreamableHTTP: Generated sessionId: ${generatedSessionId}`);
                transport = new StreamableHTTPServerTransport({
                    sessionIdGenerator: () => generatedSessionId,
                });
                await this.connect(transport);
                // Define o sessionId manualmente no transport
                transport.sessionId = generatedSessionId;
                console.log(`StreamableHTTP: Transport sessionId after manual set: ${transport.sessionId}`);
                if (transport.sessionId) {
                    res.setHeader(SESSION_ID_HEADER_NAME, transport.sessionId);
                    console.log(`StreamableHTTP: New session created: ${transport.sessionId}`);
                    this.transports[transport.sessionId] = transport;
                    this.sessionTimestamps[transport.sessionId] = Date.now();
                    const sessionId = transport.sessionId; // Captura o valor para usar no onclose
                    transport.onclose = () => {
                        delete this.transports[sessionId];
                        delete this.sessionTimestamps[sessionId];
                        console.log(`StreamableHTTP: Session ${sessionId} closed and removed.`);
                    };
                    console.log(`StreamableHTTP: Session ${transport.sessionId} stored, total sessions: ${Object.keys(this.transports).length}`);
                }
                await transport.handleRequest(req, res, jsonBody);
                console.log(`StreamableHTTP: After handleRequest, sessions: ${Object.keys(this.transports).join(', ')}`);
                return;
            }
            if (sessionId && !this.transports[sessionId]) {
                console.log(`StreamableHTTP: Invalid session ID for POST: ${sessionId}`);
                res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({
                    error: 'Invalid session ID',
                    message: 'The provided session ID is no longer valid. Please reinitialize the connection.'
                }));
                return;
            }
            console.log(`StreamableHTTP: Invalid POST request - no session ID and not initialize`);
            res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({
                error: 'Invalid request',
                message: 'POST requests require a valid session ID or must be an initialize request.'
            }));
            return;
        }
        console.log(`StreamableHTTP: Method not allowed: ${req.method}`);
        res.writeHead(405, { 'Allow': 'GET, POST' }).end('Method Not Allowed');
    }
    /**
     * Registra todas as ferramentas definidas em `src/tools.ts` no servidor MCP.
     * Este método itera sobre cada definição de ferramenta e a mapeia para sua
     * função de implementação correspondente no diretório `src/operations`.
     * @internal
     */
    registerTools() {
        tools().forEach(tool => {
            const annotations = TOOL_ANNOTATIONS[tool.method] || {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
                openWorldHint: true,
            };
            this.tool(tool.method, tool.description, tool.parameters, annotations, async (args) => {
                try {
                    const scopes = getAuthScopes();
                    if (!toolAllowed(tool.method, scopes)) {
                        const need = requiredScopeFor(tool.method);
                        console.warn(`[Authz] Denied tool=${tool.method} need=${need} scopes=${scopes.join(" ") || "(none)"}`);
                        return {
                            content: [{
                                    type: 'text',
                                    text: JSON.stringify({
                                        error: `Forbidden: requires scope ${need} (or higher). Have: ${scopes.join(" ") || "(none)"}. Hierarchy: ${PROFILE_SCOPES.admin} ⊃ ${PROFILE_SCOPES.operator} ⊃ ${PROFILE_SCOPES.observe}. Retry after obtaining a token with the required scope; do not retry the same call with identical credentials.`,
                                    }),
                                }],
                            isError: true,
                        };
                    }
                    let result;
                    switch (tool.method) {
                        case "axway_apim_time_get":
                            result = await system.getMcpServerTime();
                            break;
                        case "axway_apim_config_get":
                            result = await system.getManagerConfig();
                            break;
                        case "axway_apim_topology_list":
                            result = await topology.listTopology(this.api);
                            break;
                        case "axway_apim_instancetraffic_get":
                            result = await monitoring.getInstanceTraffic(this.api, args.instanceId);
                            break;
                        case "axway_apim_servicetraffic_get":
                            result = await monitoring.getServiceTraffic(this.api, args.instanceId, args.serviceName);
                            break;
                        case "axway_apim_metrics_get":
                            result = await monitoring.getInstanceMetricsTimeline(this.api, args.instanceId, args.timeline, args.metricTypes);
                            break;
                        case "axway_apim_traffic_search":
                            result = await monitoring.searchTrafficEvents(this.api, args);
                            break;
                        case "axway_apim_trafficevent_get":
                            result = await monitoring.getTrafficEventDetails(this.api, args);
                            break;
                        case "axway_apim_trafficpayload_get":
                            result = await monitoring.getTrafficEventPayload(this.api, args);
                            break;
                        case "axway_apim_traffictrace_get":
                            result = await monitoring.getTrafficEventTrace(this.api, args);
                            break;
                        case "axway_apim_organization_list":
                            result = await organizations.listOrganizations(this.api);
                            break;
                        case "axway_apim_organization_get":
                            result = await organizations.getOrganization(this.api, args.id);
                            break;
                        case "axway_apim_organization_create":
                            result = await organizations.createOrganization(this.api, args.name, args.description, args.email, args.phone, args.enabled);
                            break;
                        case "axway_apim_organization_update":
                            result = await organizations.updateOrganization(this.api, args.id, args.name, args.description, args.email, args.phone, args.enabled);
                            break;
                        case "axway_apim_organization_delete":
                            result = await organizations.deleteOrganization(this.api, args.id);
                            break;
                        case "axway_apim_user_list":
                            result = await users.listUsers(this.api);
                            break;
                        case "axway_apim_user_get":
                            result = await users.getUser(this.api, args.id);
                            break;
                        case "axway_apim_user_create":
                            result = await users.createUser(this.api, args.organizationId, args.name, args.loginName, args.role, args.email, args.phone);
                            break;
                        case "axway_apim_user_update":
                            result = await users.updateUser(this.api, args.id, args.name, args.loginName, args.email, args.phone, args.role, args.enabled, args.organizationId);
                            break;
                        case "axway_apim_user_delete":
                            result = await users.deleteUser(this.api, args.id);
                            break;
                        case "axway_apim_application_list":
                            result = await applications.listApplications(this.api);
                            break;
                        case "axway_apim_application_get":
                            result = await applications.getApplication(this.api, args.id);
                            break;
                        case "axway_apim_apikey_get":
                            result = await applications.getApiKeysForApplication(this.api, args.id);
                            break;
                        case "axway_apim_apikey_create":
                            result = await applications.createApiKey(this.api, args.appId, args.enabled, args.secret);
                            break;
                        case "axway_apim_oauth_get":
                            result = await applications.getOAuthCredentialsForApplication(this.api, args.id);
                            break;
                        case "axway_apim_oauth_create":
                            result = await applications.createOAuthCredential(this.api, args.appId, args.redirectURIs, args.cert);
                            break;
                        case "axway_apim_permission_get":
                            result = await applications.getPermissionsForApplication(this.api, args.id);
                            break;
                        case "axway_apim_proxy_list":
                            result = await proxies.listApiProxies(this.api);
                            break;
                        case "axway_apim_proxy_get":
                            result = await proxies.getApiProxy(this.api, args.id);
                            break;
                        case "axway_apim_proxyauth_get":
                            result = await proxies.getProxyAuthenticationInfo(this.api, args.id);
                            break;
                        case "axway_apim_proxy_create":
                            result = await proxies.createApiProxy(this.api, args.name, args.path, args.apiId, args.organizationId);
                            break;
                        case "axway_apim_proxy_update":
                            if (args.lifecycle === "publish") {
                                result = await proxies.publishApi(this.api, args.id);
                            }
                            else if (args.lifecycle === "unpublish") {
                                result = await proxies.unpublishApi(this.api, args.id);
                            }
                            else if (args.lifecycle === "deprecate") {
                                result = await proxies.deprecateApi(this.api, args.id);
                            }
                            else {
                                result = await proxies.updateApiProxy(this.api, args.id, args.name, args.path, args.apiId);
                            }
                            break;
                        case "axway_apim_proxy_delete":
                            result = await proxies.deleteApiProxy(this.api, args.id);
                            break;
                        case "axway_apim_backend_list":
                            result = await repository.listBackendApis(this.api);
                            break;
                        case "axway_apim_backend_submit":
                            if (args.source === "file") {
                                if (!args.filePath) {
                                    throw new Error("filePath is required when source=file");
                                }
                                result = await repository.importBackendApiFromFile(this.api, args.filePath, args.organizationId, args.name);
                            }
                            else {
                                if (!args.url) {
                                    throw new Error("url is required when source=url");
                                }
                                result = await repository.importBackendApiFromUrl(this.api, args.url, args.organizationId, args.name);
                            }
                            break;
                        case "axway_apim_backend_delete":
                            result = await repository.deleteBackendApi(this.api, args.id);
                            break;
                        case "axway_apim_file_submit":
                            result = await repository.uploadFileForImport(args);
                            break;
                        case "axway_apim_access_list":
                            result = await access.listApiAccess(this.api, args.applicationId);
                            break;
                        case "axway_apim_access_update":
                            result = await access.grantApiAccess(this.api, args.applicationId, args.apiId);
                            break;
                        case "axway_apim_access_delete":
                            result = await access.revokeApiAccess(this.api, args.applicationId, args.apiId);
                            break;
                        case "axway_apim_alert_list":
                            result = await alerts.listAlerts(this.api);
                            break;
                        case "axway_apim_alert_update":
                            result = await alerts.updateAlertSettings(this.api, args.settings);
                            break;
                        case "axway_apim_quota_get":
                            result = await quotas.getApplicationQuotas(this.api, args.applicationId);
                            break;
                        case "axway_apim_quota_update":
                            result = await quotas.updateApplicationQuotas(this.api, args.applicationId, args.messages_per_second);
                            break;
                        case "axway_apim_catalog_get":
                            result = await proxies.getApiCatalog(this.api);
                            break;
                        default:
                            throw new Error(`Tool '${tool.method}' is defined but not implemented in the server.`);
                    }
                    return {
                        content: [{
                                type: 'text',
                                text: JSON.stringify(result)
                            }]
                    };
                }
                catch (error) {
                    console.error(`Error executing tool '${tool.method}':`, error);
                    const getSafeErrorMessage = (err) => {
                        if (err?.response?.data?.errors?.[0]?.message) {
                            return err.response.data.errors[0].message;
                        }
                        if (err?.response?.data?.message) {
                            return err.response.data.message;
                        }
                        if (err?.response?.statusText) {
                            return `${err.response.status} ${err.response.statusText}`;
                        }
                        if (err?.message) {
                            return err.message;
                        }
                        if (err?.code) {
                            return `Error code: ${err.code}`;
                        }
                        return "An unknown error occurred.";
                    };
                    const status = error?.response?.status;
                    const errorMessage = getSafeErrorMessage(error);
                    const retryHint = status && status >= 500
                        ? "Retryable: use exponential backoff on 5xx/network timeouts."
                        : status && status >= 400 && status < 500
                            ? "Not retryable as-is: fix parameters or authorization before retrying."
                            : "If the failure looks transient (timeout/network), retry with exponential backoff; otherwise fix inputs.";
                    return {
                        content: [{
                                type: 'text',
                                text: JSON.stringify({
                                    error: `Execution failed: ${errorMessage}`,
                                    httpStatus: status || null,
                                    retry: retryHint,
                                })
                            }]
                    };
                }
            });
        });
    }
}
/**
 * Função principal que inicializa e inicia o servidor.
 * Detecta automaticamente se deve usar transporte stdio ou HTTP baseado no ambiente.
 */
async function main() {
    // Detectar o modo de transporte baseado em variáveis de ambiente ou argumentos
    const useStdio = process.env.TRANSPORT_MODE === 'stdio' ||
        process.argv.includes('--stdio') ||
        process.argv.includes('-s');
    const transportMode = useStdio ? 'stdio' : 'http';
    const server = new AxwayMcpServer(transportMode);
    if (transportMode === 'stdio') {
        // Modo stdio: perfil via MCP_TOOL_PROFILE (default admin); sem OIDC
        const profile = loadStdioToolProfile();
        const stdioAuth = authInfoFromProfile(profile);
        setFallbackAuth(stdioAuth);
        console.error(`Axway MCP Server iniciado em modo stdio (MCP_TOOL_PROFILE=${profile})`);
        const stdioTransport = new StdioServerTransport();
        stdioTransport.onclose = () => {
            console.error('Conexão stdio fechada');
            process.exit(0);
        };
        stdioTransport.onerror = (error) => {
            console.error('Erro na conexão stdio:', error);
            process.exit(1);
        };
        // connect() já chama start() automaticamente
        await runWithAuth(stdioAuth, () => server.connect(stdioTransport));
        console.error('Axway MCP Server pronto para comunicação via stdio');
    }
    else {
        // Modo HTTP: servidor web com StreamableHTTP
        // Fail-fast se OIDC estiver mal configurado
        loadAuthConfig();
        logAuthStartup();
        // MCP_AUTH_MODE=none → getAuthScopes trata null como admin
        setFallbackAuth(null);
        const port = process.env.PORT || 3000;
        const httpServer = createServer((req, res) => {
            // RFC 9728 Protected Resource Metadata (sem autenticação)
            if (handleWellKnown(req, res)) {
                return;
            }
            (async () => {
                const authResult = await authenticateHttpRequest(req, res);
                if (authResult === false) {
                    return; // 401/403 já escrito
                }
                // authResult is AuthInfo | null (null = auth disabled)
                await runWithAuth(authResult, () => server.handleRequest(req, res));
            })().catch(err => {
                console.error("Error handling request:", err);
                if (!res.writableEnded) {
                    res.writeHead(500).end("Internal Server Error");
                }
            });
        });
        httpServer.listen({ port: port, host: '0.0.0.0' }, () => {
            console.log(`Axway MCP Server is running on http://0.0.0.0:${port}`);
        });
    }
}
main().catch(console.error);
//# sourceMappingURL=index.js.map