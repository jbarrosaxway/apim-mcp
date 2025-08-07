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
import { randomUUID } from "crypto";
import { tools } from "./tools.js";
import { AxwayApi } from "./api.js";
import * as dotenv from 'dotenv';
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
import * as metrics from './operations/metrics.js';
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
            version: "1.0.0",
            description: "Ferramentas para gerenciar e analisar configurações e tráfego do Axway API Gateway"
        });
        this.api = new AxwayApi();
        this.transportMode = transportMode;
        this.registerTools();
        // Apenas configurar limpeza de sessões se estiver no modo HTTP
        if (this.transportMode === 'http') {
            setInterval(() => {
                this.cleanupOldSessions();
            }, 5 * 60 * 1000);
        }
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
            this.tool(tool.method, tool.description, tool.parameters, async (args) => {
                try {
                    let result;
                    // O switch case roteia a chamada da ferramenta para a implementação correta.
                    switch (tool.method) {
                        // system.ts
                        case "get_mcp_server_time":
                            result = await system.getMcpServerTime();
                            break;
                        case "get_manager_config":
                            result = await system.getManagerConfig();
                            break;
                        // topology.ts
                        case "list_topology":
                            result = await topology.listTopology(this.api);
                            break;
                        // monitoring.ts
                        case "get_instance_traffic":
                            result = await monitoring.getInstanceTraffic(this.api, args.instanceId);
                            break;
                        case "get_service_traffic":
                            result = await monitoring.getServiceTraffic(this.api, args.instanceId, args.serviceName);
                            break;
                        case "get_instance_metrics_timeline":
                            result = await monitoring.getInstanceMetricsTimeline(this.api, args.instanceId, args.timeline, args.metricTypes);
                            break;
                        case "search_traffic_events":
                            result = await monitoring.searchTrafficEvents(this.api, args);
                            break;
                        case "get_traffic_event_details":
                            result = await monitoring.getTrafficEventDetails(this.api, args);
                            break;
                        case "get_traffic_event_payload":
                            result = await monitoring.getTrafficEventPayload(this.api, args);
                            break;
                        case "get_traffic_event_trace":
                            result = await monitoring.getTrafficEventTrace(this.api, args);
                            break;
                        // organizations.ts
                        case "list_organizations":
                            result = await organizations.listOrganizations(this.api);
                            break;
                        case "get_organization":
                            result = await organizations.getOrganization(this.api, args.id);
                            break;
                        case "create_organization":
                            result = await organizations.createOrganization(this.api, args.name, args.description, args.email, args.phone, args.enabled);
                            break;
                        case "update_organization":
                            result = await organizations.updateOrganization(this.api, args.id, args.name, args.description, args.email, args.phone, args.enabled);
                            break;
                        case "delete_organization":
                            result = await organizations.deleteOrganization(this.api, args.id);
                            break;
                        // users.ts
                        case "list_users":
                            result = await users.listUsers(this.api);
                            break;
                        case "get_user":
                            result = await users.getUser(this.api, args.id);
                            break;
                        case "create_user":
                            result = await users.createUser(this.api, args.organizationId, args.name, args.loginName, args.role, args.email, args.phone);
                            break;
                        case "update_user":
                            result = await users.updateUser(this.api, args.id, args.name, args.loginName, args.email, args.phone, args.role, args.enabled, args.organizationId);
                            break;
                        case "delete_user":
                            result = await users.deleteUser(this.api, args.id);
                            break;
                        // applications.ts
                        case "list_applications":
                            result = await applications.listApplications(this.api);
                            break;
                        case "get_application":
                            result = await applications.getApplication(this.api, args.id);
                            break;
                        case "get_api_keys_for_application":
                            result = await applications.getApiKeysForApplication(this.api, args.id);
                            break;
                        case "create_api_key":
                            result = await applications.createApiKey(this.api, args.appId, args.enabled, args.secret);
                            break;
                        case "get_oauth_credentials_for_application":
                            result = await applications.getOAuthCredentialsForApplication(this.api, args.id);
                            break;
                        case "create_oauth_credential":
                            result = await applications.createOAuthCredential(this.api, args.appId, args.redirectURIs, args.cert);
                            break;
                        case "get_permissions_for_application":
                            result = await applications.getPermissionsForApplication(this.api, args.id);
                            break;
                        // proxies.ts
                        case "list_api_proxies":
                            result = await proxies.listApiProxies(this.api);
                            break;
                        case "get_api_proxy":
                            result = await proxies.getApiProxy(this.api, args.id);
                            break;
                        case "get_proxy_authentication_info":
                            result = await proxies.getProxyAuthenticationInfo(this.api, args.id);
                            break;
                        case "create_api_proxy":
                            result = await proxies.createApiProxy(this.api, args.name, args.path, args.apiId, args.organizationId);
                            break;
                        case "update_api_proxy":
                            result = await proxies.updateApiProxy(this.api, args.id, args.name, args.path, args.apiId);
                            break;
                        case "delete_api_proxy":
                            result = await proxies.deleteApiProxy(this.api, args.id);
                            break;
                        case "publish_api":
                            result = await proxies.publishApi(this.api, args.id);
                            break;
                        case "unpublish_api":
                            result = await proxies.unpublishApi(this.api, args.id);
                            break;
                        case "deprecate_api":
                            result = await proxies.deprecateApi(this.api, args.id);
                            break;
                        // repository.ts
                        case "list_backend_apis":
                            result = await repository.listBackendApis(this.api);
                            break;
                        case "import_backend_api_from_url":
                            result = await repository.importBackendApiFromUrl(this.api, args.url, args.organizationId, args.name);
                            break;
                        case "delete_backend_api":
                            result = await repository.deleteBackendApi(this.api, args.id);
                            break;
                        case "import_backend_api_from_file":
                            result = await repository.importBackendApiFromFile(this.api, args.filePath, args.organizationId, args.name);
                            break;
                        case "upload_file_for_import":
                            result = await repository.uploadFileForImport(args);
                            break;
                        // access.ts
                        case "list_api_access":
                            result = await access.listApiAccess(this.api, args.applicationId);
                            break;
                        case "grant_api_access":
                            result = await access.grantApiAccess(this.api, args.applicationId, args.apiId);
                            break;
                        case "revoke_api_access":
                            result = await access.revokeApiAccess(this.api, args.applicationId, args.apiId);
                            break;
                        // alerts.ts
                        case "list_alerts":
                            result = await alerts.listAlerts(this.api);
                            break;
                        case "update_alert_settings":
                            result = await alerts.updateAlertSettings(this.api, args.settings);
                            break;
                        // quotas.ts
                        case "get_application_quotas":
                            result = await quotas.getApplicationQuotas(this.api, args.applicationId);
                            break;
                        case "update_application_quotas":
                            result = await quotas.updateApplicationQuotas(this.api, args.applicationId, args.messages_per_second);
                            break;
                        case "get_api_catalog":
                            result = await proxies.listApiProxies(this.api); // Alias for list_api_proxies
                            break;
                        // metrics.ts
                        case "get_metrics":
                            result = await metrics.getMetrics(this.api, args);
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
                    const errorMessage = error.response?.data?.errors?.[0]?.message || error.message || "An unknown error occurred.";
                    // Retornar um erro estruturado para o LLM
                    return {
                        content: [{
                                type: 'text',
                                text: JSON.stringify({ error: `Execution failed: ${errorMessage}` })
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
        // Modo stdio: comunicação direta via stdin/stdout
        console.error('Axway MCP Server iniciado em modo stdio');
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
        await server.connect(stdioTransport);
        console.error('Axway MCP Server pronto para comunicação via stdio');
    }
    else {
        // Modo HTTP: servidor web com StreamableHTTP
        const port = process.env.PORT || 3000;
        const httpServer = createServer((req, res) => {
            server.handleRequest(req, res).catch(err => {
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