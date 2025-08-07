/**
 * @module src/api
 * @description Este módulo contém a classe `AxwayApi`, que serve como um wrapper centralizado
 * para interagir com as APIs do Axway API Gateway e do Axway API Manager.
 * Ele gerencia a configuração, autenticação e execução de todas as chamadas de API.
 */

import axios, { AxiosRequestConfig, AxiosInstance, AxiosResponse } from "axios";
import { Buffer } from "buffer";
import * as https from "https";
import * as fs from "fs";
import * as path from "path";
import FormData from "form-data";
import { promisify } from 'util';
import * as zlib from 'zlib';

const gunzip = promisify(zlib.gunzip);

/**
 * Classe que encapsula a lógica de comunicação com as APIs da Axway.
 *
 * Configura duas instâncias do Axios:
 * - `apiGateway`: Para interagir com a API de gerenciamento e monitoramento do API Gateway.
 * - `apiManager`: Para interagir com a API do Portal do API Manager.
 *
 * A configuração é lida a partir de variáveis de ambiente.
 * A classe também inclui interceptadores para um tratamento de erros centralizado.
 */
export class AxwayApi {
  private apiGateway: AxiosInstance;
  private apiManager: AxiosInstance;
  private accessToken: string | null = null; // Reservado para uso futuro (ex: OAuth)

  /**
   * Inicializa as instâncias do cliente de API para o Gateway e o Manager.
   *
   * - Lê as URLs e credenciais das variáveis de ambiente (ex: `AXWAY_GATEWAY_URL`).
   * - Configura a autenticação Basic para ambas as instâncias.
   * - Desabilita a validação de certificado SSL (`rejectUnauthorized: false`) para
   *   facilitar o uso em ambientes de desenvolvimento e demonstração com certificados autoassinados.
   * - Adiciona interceptadores de resposta para padronizar o tratamento de erros de API.
   * - Emite avisos no console se as variáveis de ambiente necessárias não estiverem definidas.
   */
  constructor() {
    // Agente para desabilitar a validação de certificado SSL.
    // ATENÇÃO: Use apenas em ambientes controlados e de desenvolvimento.
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false,
    });

    // API Gateway Configuration
    const gatewayUrl = process.env.AXWAY_GATEWAY_URL;
    const gatewayUsername = process.env.AXWAY_GATEWAY_USERNAME;
    const gatewayPassword = process.env.AXWAY_GATEWAY_PASSWORD;

    // API Manager Configuration
    const managerUrl = process.env.AXWAY_MANAGER_URL;
    const managerUsername = process.env.AXWAY_MANAGER_USERNAME;
    const managerPassword = process.env.AXWAY_MANAGER_PASSWORD;

    // Check for API Gateway variables
    if (!gatewayUrl || !gatewayUsername || !gatewayPassword) {
      console.error(`Warning: Missing API Gateway environment variables. Please set AXWAY_GATEWAY_URL, AXWAY_GATEWAY_USERNAME, and AXWAY_GATEWAY_PASSWORD.`);
      this.apiGateway = axios.create(); // Dummy instance
    } else {
        const gatewayAuthHeader = `Basic ${Buffer.from(`${gatewayUsername}:${gatewayPassword}`).toString("base64")}`;
        this.apiGateway = axios.create({
            baseURL: gatewayUrl,
            headers: {
                "Authorization": gatewayAuthHeader,
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            httpsAgent,
        });
    }

    // Check for API Manager variables
    if (!managerUrl || !managerUsername || !managerPassword) {
        console.error(`Warning: Missing API Manager environment variables. Please set AXWAY_MANAGER_URL, AXWAY_MANAGER_USERNAME, and AXWAY_MANAGER_PASSWORD.`);
        this.apiManager = axios.create(); // Dummy instance
    } else {
        const managerAuthHeader = `Basic ${Buffer.from(`${managerUsername}:${managerPassword}`).toString("base64")}`;
        this.apiManager = axios.create({
            baseURL: managerUrl,
            headers: {
                "Authorization": managerAuthHeader,
                "Accept": "application/json",
            },
            httpsAgent,
        });
    }

    // Add interceptors for logging/error handling to both instances
    [this.apiGateway, this.apiManager].forEach(instance => {
        if (instance.defaults.baseURL) { // Only add interceptors to properly configured instances
            instance.interceptors.response.use(response => {
                return response;
            }, error => {
                console.error("[MCP-ERROR] API request failed.");

                if (error.response) {
                    const errorData = error.response.data;
                    let errorMessage = `API Error (Status ${error.response.status})`;
            
                    if (typeof errorData === 'object' && errorData !== null) {
                      const errorDetails = errorData.errors && errorData.errors[0] ? errorData.errors[0].message : (errorData.message || JSON.stringify(errorData));
                      errorMessage += `: ${errorDetails}`;
                    } else if (typeof errorData === 'string') {
                      errorMessage += `: ${errorData.substring(0, 200)}`;
                    }
            
                    throw new Error(errorMessage);

                  } else if (error.request) {
                    throw new Error("Erro de Rede: Nenhuma resposta recebida da API Axway. Verifique sua conexão e a configuração do endpoint da API.");
                  
                  } else {
                    throw new Error(`Erro na Solicitação: ${error.message}. Verifique os parâmetros da sua solicitação e tente novamente.`);
                  }
            });
        }
    });
  }

  private async logAndRequest(instance: AxiosInstance, config: AxiosRequestConfig) {
    const { method, url, data } = config;
    console.log(`\n[AxwayApi] REQUEST: ${method?.toUpperCase()} ${instance.defaults.baseURL}${url}`);
    if (data) {
      console.log(`[AxwayApi] Request Body: ${JSON.stringify(data, null, 2)}`);
    }
    try {
      const response: AxiosResponse = await instance.request(config);
      console.log(`[AxwayApi] RESPONSE (${response.status}): ${JSON.stringify(response.data, null, 2)}`);
      return response;
    } catch (error: any) {
      if (error.response) {
        console.error(`[AxwayApi] ERROR RESPONSE (${error.response.status}): ${JSON.stringify(error.response.data, null, 2)}`);
      } else {
        console.error(`[AxwayApi] ERROR: ${error.message}`);
      }
      throw error;
    }
  }

  // Exemplo de uso para um método GET
  async getGateway(path: string, config?: AxiosRequestConfig) {
    return this.logAndRequest(this.apiGateway, { ...config, method: 'get', url: path });
  }

  // Exemplo de uso para um método POST
  async postGateway(path: string, data?: any, config?: AxiosRequestConfig) {
    return this.logAndRequest(this.apiGateway, { ...config, method: 'post', url: path, data });
  }

  // --- Métodos da API de Topologia ---

  /**
   * Obtém a topologia do domínio do API Gateway, incluindo grupos e instâncias.
   * @returns Uma promessa que resolve para os dados da topologia.
   */
  async listTopology(): Promise<any> {
    const response = await this.apiGateway.get("/topology");
    return response.data;
  }

  // --- Métodos da API de Monitoramento ---

  /**
   * Obtém um resumo do tráfego para uma instância específica do API Gateway.
   * @param instanceId O ID da instância do API Gateway (ex: 'instance-1').
   * @returns Uma promessa que resolve para as métricas de resumo do tráfego.
   */
  async getInstanceTraffic(instanceId: string): Promise<any> {
    const response = await this.apiGateway.get(`/router/service/${instanceId}/api/monitoring/summary`);
    return response.data;
  }

  /**
   * Obtém métricas de tráfego para um serviço específico em uma instância do API Gateway.
   * @param instanceId O ID da instância.
   * @param serviceName O nome do serviço (ex: 'Default Services').
   * @returns Uma promessa que resolve para as métricas do serviço.
   */
  async getServiceTraffic(instanceId: string, serviceName: string): Promise<any> {
    const encodedServiceName = encodeURIComponent(serviceName);
    const path = `/router/service/${instanceId}/api/monitoring/metrics/summary?metricGroupType=Service&name=${encodedServiceName}`;
    const response = await this.apiGateway.get(path);
    return response.data;
  }

  /**
   * Obtém uma linha do tempo de métricas para uma instância específica.
   * @param instanceId O ID da instância.
   * @param timeline O intervalo de tempo para a linha do tempo (ex: '10m', '1h').
   * @param metricTypes Os tipos de métrica a serem recuperados (ex: ['successes', 'failures']).
   * @returns Uma promessa que resolve para os dados da linha do tempo.
   */
  async getInstanceMetricsTimeline(instanceId: string, timeline: string, metricTypes: string[]): Promise<any> {
    const params = new URLSearchParams();
    params.append('timeline', timeline);
    metricTypes.forEach(metric => {
      params.append('metricType', metric);
    });
    const path = `/router/service/${instanceId}/api/monitoring/metrics/timeline?${params.toString()}`;
    const response = await this.apiGateway.get(path);
    return response.data;
  }

  /**
   * Pesquisa por eventos de tráfego (transações) em uma instância.
   * @param instanceId O ID da instância.
   * @param params Um objeto `URLSearchParams` contendo os filtros de pesquisa.
   * @returns Uma promessa que resolve para a lista de eventos de tráfego encontrados.
   */
  async searchTrafficEvents(instanceId: string, params: URLSearchParams): Promise<any> {
    const path = `/router/service/${instanceId}/ops/search?${params.toString()}`;
    const response = await this.apiGateway.get(path);
    return response.data;
  }

  /**
   * Obtém detalhes para um evento de tráfego específico.
   * @param instanceId O ID da instância.
   * @param protocol O protocolo da transação (ex: 'http').
   * @param correlationId O ID de correlação da transação.
   * @param leg O "leg" (segmento) da transação, geralmente 0.
   * @param params Parâmetros adicionais, como `includeHeaders`.
   * @returns Uma promessa que resolve para os detalhes da transação.
   */
  async getTrafficEventDetails(instanceId: string, protocol: string, correlationId: string, leg: number, params: URLSearchParams): Promise<any> {
    const path = `/router/service/${instanceId}/ops/${protocol}/${correlationId}/${leg}/getinfo?${params.toString()}`;
    const response = await this.apiGateway.get(path);
    return response.data;
  }

  /**
   * Obtém o payload (carga útil) de uma transação.
   * @param instanceId O ID da instância.
   * @param correlationId O ID de correlação da transação.
   * @param leg O "leg" da transação.
   * @param direction A direção do payload ('received' do cliente, 'sent' para o cliente).
   * @returns Uma promessa que resolve para o conteúdo do payload como texto.
   */
  async getTrafficEventPayload(instanceId: string, correlationId: string, leg: number, direction: 'received' | 'sent'): Promise<any> {
    const path = `/router/service/${instanceId}/ops/stream/${correlationId}/${leg}/${direction}`;
    const response = await this.apiGateway.get(path, { responseType: 'text' });
    return response.data;
  }

  /**
   * Obtém os dados de rastreamento (trace) para uma transação.
   * @param instanceId O ID da instância.
   * @param correlationId O ID de correlação da transação.
   * @param params Parâmetros adicionais, como `includeSentData`.
   * @returns Uma promessa que resolve para os dados de trace.
   */
  async getTrafficEventTrace(instanceId: string, correlationId: string, params: URLSearchParams): Promise<any> {
    const path = `/router/service/${instanceId}/ops/trace/${correlationId}?${params.toString()}`;
    const response = await this.apiGateway.get(path);
    return response.data;
  }

  // --- Métodos do API Manager (Organizações) ---

  /**
   * Lista todas as organizações no API Manager.
   * @returns Uma promessa que resolve para a lista de organizações.
   */
  async listOrganizations(): Promise<any> {
    const response = await this.apiManager.get('/organizations');
    return response.data;
  }

  /**
   * Obtém uma organização específica pelo seu ID.
   * @param id O ID da organização.
   * @returns Uma promessa que resolve para os dados da organização.
   */
  async getOrganization(id: string): Promise<any> {
    const response = await this.apiManager.get(`/organizations/${id}`);
    return response.data;
  }

  /**
   * Cria uma nova organização.
   * @param organizationData Um objeto contendo os dados da nova organização (nome, descrição, etc.).
   * @returns Uma promessa que resolve para os dados da organização criada.
   */
  async createOrganization(organizationData: any): Promise<any> {
    const response = await this.apiManager.post('/organizations', organizationData, { headers: { 'Content-Type': 'application/json' } });
    return response.data;
  }

  /**
   * Atualiza uma organização existente.
   * @param id O ID da organização a ser atualizada.
   * @param organizationData Um objeto com os campos a serem atualizados.
   * @returns Uma promessa que resolve para os dados da organização atualizada.
   */
  async updateOrganization(id: string, organizationData: any): Promise<any> {
    const response = await this.apiManager.put(`/organizations/${id}`, organizationData, { headers: { 'Content-Type': 'application/json' } });
    return response.data;
  }

  /**
   * Deleta uma organização pelo seu ID.
   * @param id O ID da organização a ser deletada.
   * @returns Uma promessa que resolve quando a operação é concluída.
   */
  async deleteOrganization(id: string): Promise<any> {
    const response = await this.apiManager.delete(`/organizations/${id}`);
    return response.data;
  }

  // --- Métodos do API Manager (Usuários) ---

  /**
   * Lista todos os usuários.
   * @returns Uma promessa que resolve para a lista de usuários.
   */
  async listUsers(): Promise<any> {
    const response = await this.apiManager.get('/users');
    return response.data;
  }

  /**
   * Obtém um usuário específico pelo seu ID.
   * @param id O ID do usuário.
   * @returns Uma promessa que resolve para os dados do usuário.
   */
  async getUser(id: string): Promise<any> {
    const response = await this.apiManager.get(`/users/${id}`);
    return response.data;
  }

  /**
   * Cria um novo usuário.
   * @param userData Um objeto contendo os dados do novo usuário.
   * @returns Uma promessa que resolve para os dados do usuário criado.
   */
  async createUser(userData: any): Promise<any> {
    const response = await this.apiManager.post('/users', userData, { headers: { 'Content-Type': 'application/json' } });
    return response.data;
  }

  /**
   * Atualiza um usuário existente.
   * @param id O ID do usuário a ser atualizado.
   * @param userData Um objeto com os campos a serem atualizados.
   * @returns Uma promessa que resolve para os dados do usuário atualizado.
   */
  async updateUser(id: string, userData: any): Promise<any> {
    const response = await this.apiManager.put(`/users/${id}`, userData, { headers: { 'Content-Type': 'application/json' } });
    return response.data;
  }

  /**
   * Deleta um usuário pelo seu ID.
   * @param id O ID do usuário a ser deletado.
   * @returns Uma promessa que resolve quando a operação é concluída.
   */
  async deleteUser(id: string): Promise<any> {
    const response = await this.apiManager.delete(`/users/${id}`);
    return response.data;
  }

  // --- Métodos do API Manager (Aplicações) ---

  /**
   * Lista todas as aplicações visíveis para o usuário autenticado.
   * @returns Uma promessa que resolve para a lista de aplicações.
   */
  async listApplications(): Promise<any> {
    const response = await this.apiManager.get('/applications');
    return response.data;
  }

  /**
   * Obtém uma aplicação específica pelo seu ID.
   * @param id O ID da aplicação.
   * @returns Uma promessa que resolve para os dados da aplicação.
   */
  async getApplication(id: string): Promise<any> {
    const response = await this.apiManager.get(`/applications/${id}`);
    return response.data;
  }

  /**
   * Obtém as API Keys associadas a uma aplicação.
   * @param id O ID da aplicação.
   * @returns Uma promessa que resolve para a lista de API Keys.
   */
  async getApiKeysForApplication(id: string): Promise<any> {
    const response = await this.apiManager.get(`/applications/${id}/apikeys`);
    return response.data;
  }

  /**
   * Obtém as credenciais OAuth associadas a uma aplicação.
   * @param id O ID da aplicação.
   * @returns Uma promessa que resolve para as credenciais OAuth.
   */
  async getOAuthCredentialsForApplication(id: string): Promise<any> {
    const response = await this.apiManager.get(`/applications/${id}/oauth`);
    return response.data;
  }

  /**
   * Cria uma nova API Key para uma aplicação.
   * @param appId O ID da aplicação.
   * @param apiKeyData Dados para a nova API Key (ex: segredo, estado 'enabled').
   * @returns Uma promessa que resolve para os dados da API Key criada.
   */
  async createApiKey(appId: string, apiKeyData: any): Promise<any> {
    const response = await this.apiManager.post(`/applications/${appId}/apikeys`, apiKeyData, { headers: { 'Content-Type': 'application/json' } });
    return response.data;
  }

  /**
   * Cria uma nova credencial OAuth (client ID e secret) para uma aplicação.
   * @param appId O ID da aplicação.
   * @param credentialData Dados para a nova credencial (ex: URIs de redirecionamento).
   * @returns Uma promessa que resolve para a credencial criada.
   */
  async createOAuthCredential(appId: string, credentialData: any): Promise<any> {
    const response = await this.apiManager.post(`/applications/${appId}/oauth`, credentialData, { headers: { 'Content-Type': 'application/json' } });
    return response.data;
  }

  /**
   * Obtém a lista de permissões (ACL) para uma aplicação.
   * @param id O ID da aplicação.
   * @returns Uma promessa que resolve para a lista de permissões.
   */
  async getPermissionsForApplication(id: string): Promise<any> {
    const response = await this.apiManager.get(`/applications/${id}/permissions`);
    return response.data;
  }

  // --- Métodos do API Manager (Proxies de API) ---

  /**
   * Lista todas os proxies de API (APIs de Frontend).
   * @returns Uma promessa que resolve para a lista de proxies.
   */
  async listApiProxies(): Promise<any> {
    const response = await this.apiManager.get('/proxies');
    return response.data;
  }

  /**
   * Obtém um proxy de API específico pelo seu ID.
   * @param id O ID do proxy.
   * @returns Uma promessa que resolve para os dados do proxy.
   */
  async getApiProxy(id: string): Promise<any> {
    const response = await this.apiManager.get(`/proxies/${id}`);
    return response.data;
  }

  /**
   * Cria um novo proxy de API.
   * @param proxyData Dados para o novo proxy (nome, caminho, ID da API de backend, etc.).
   * @returns Uma promessa que resolve para os dados do proxy criado.
   */
  async createApiProxy(proxyData: any): Promise<any> {
    const response = await this.apiManager.post('/proxies', proxyData, { headers: { 'Content-Type': 'application/json' } });
    return response.data;
  }

  /**
   * Atualiza um proxy de API existente.
   * @param id O ID do proxy a ser atualizado.
   * @param proxyData Um objeto com os campos a serem atualizados.
   * @returns Uma promessa que resolve para os dados do proxy atualizado.
   */
  async updateApiProxy(id: string, proxyData: any): Promise<any> {
    const response = await this.apiManager.put(`/proxies/${id}`, proxyData, { headers: { 'Content-Type': 'application/json' } });
    return response.data;
  }

  /**
   * Deleta um proxy de API pelo seu ID.
   * @param id O ID do proxy a ser deletado.
   * @returns Uma promessa que resolve quando a operação é concluída.
   */
  async deleteApiProxy(id: string): Promise<any> {
    const response = await this.apiManager.delete(`/proxies/${id}`);
    return response.data;
  }

  /**
   * Publica um proxy de API, tornando-o disponível para consumo.
   * @param id O ID da API a ser publicada.
   * @returns Uma promessa que resolve quando a API é publicada.
   */
  async publishApi(id: string): Promise<any> {
    const response = await this.apiManager.post(
      `/proxies/${id}/publish`,
      new URLSearchParams(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    return response.data;
  }

  /**
   * Despublica um proxy de API, tornando-o indisponível.
   * @param id O ID da API a ser despublicada.
   * @returns Uma promessa que resolve quando a API é despublicada.
   */
  async unpublishApi(id: string): Promise<any> {
    const response = await this.apiManager.post(
      `/proxies/${id}/unpublish`,
      new URLSearchParams(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    return response.data;
  }

  /**
   * Marca um proxy de API como obsoleto (deprecated).
   * @param id O ID da API a ser marcada como obsoleta.
   * @returns Uma promessa que resolve quando a API é marcada como obsoleta.
   */
  async deprecateApi(id: string): Promise<any> {
    const payload = { "state": "deprecated" };
    const response = await this.apiManager.post(`/proxies/${id}/state`, payload, {
      headers: { 'Content-Type': 'application/json' }
    });
    return response.data;
  }

  // --- Métodos do API Manager (Repositório de APIs de Backend) ---

  /**
   * Lista todas as APIs de backend do repositório.
   * @returns Uma promessa que resolve para a lista de APIs de backend.
   */
  async listBackendApis(): Promise<any> {
    const response = await this.apiManager.get('/apirepo');
    return response.data;
  }

  /**
   * Importa uma API de backend a partir de uma URL (ex: Swagger/OpenAPI).
   * @param url A URL da definição da API.
   * @param organizationId O ID da organização que será dona da API.
   * @param name Um nome customizado opcional para a API de backend.
   * @returns Uma promessa que resolve para os dados da API importada.
   */
  async importBackendApiFromUrl(url: string, organizationId: string, name?: string): Promise<any> {
    const form = new FormData();
    form.append('type', 'url');
    form.append('url', url);
    form.append('organizationId', organizationId);
    if (name) {
      form.append('name', name);
    }
    const response = await this.apiManager.post('/apirepo/import', form, { headers: form.getHeaders() });
    return response.data;
  }

  /**
   * Importa uma API de backend a partir de um arquivo local.
   * @param filePath O caminho para o arquivo de definição da API (ex: swagger.json).
   * @param organizationId O ID da organização que será dona da API.
   * @param name Um nome customizado opcional para a API de backend.
   * @returns Uma promessa que resolve para os dados da API importada.
   */
  async importBackendApiFromFile(filePath: string, organizationId: string, name?: string): Promise<any> {
    const form = new FormData();
    form.append('type', 'file');
    form.append('file', fs.createReadStream(filePath));
    form.append('organizationId', organizationId);
    if (name) {
      form.append('name', name);
    }
    const response = await this.apiManager.post('/apirepo/import', form, { headers: form.getHeaders() });
    return response.data;
  }

  /**
   * Deleta uma API de backend do repositório.
   * @param id O ID da API de backend a ser deletada.
   * @returns Uma promessa que resolve quando a operação é concluída.
   */
  async deleteBackendApi(id: string): Promise<any> {
    const response = await this.apiManager.delete(`/apirepo/${id}`);
    return response.data;
  }

  // --- Métodos do API Manager (Controle de Acesso) ---

  /**
   * Lista todas as APIs de frontend às quais uma aplicação tem acesso.
   * @param applicationId O ID da aplicação.
   * @returns Uma promessa que resolve para a lista de APIs com acesso.
   */
  async listApiAccess(applicationId: string): Promise<any> {
    const response = await this.apiManager.get(`/applications/${applicationId}/apis`);
    return response.data;
  }

  /**
   * Concede a uma aplicação acesso a uma API de frontend.
   * @param applicationId O ID da aplicação.
   * @param apiId O ID do proxy de API (frontend) ao qual o acesso será concedido.
   * @returns Uma promessa que resolve quando o acesso é concedido.
   */
  async grantApiAccess(applicationId: string, apiId: string): Promise<any> {
    const payload = {
      apiId: apiId,
      enabled: true,
    };
    const response = await this.apiManager.post(`/applications/${applicationId}/apis`, payload, {
      headers: { 'Content-Type': 'application/json' }
    });
    return response.data;
  }

  /**
   * Revoga o acesso de uma aplicação a uma API de frontend.
   * @param applicationId O ID da aplicação.
   * @param apiId O ID do proxy de API do qual o acesso será revogado.
   * @returns Uma promessa que resolve quando o acesso é revogado.
   */
  async revokeApiAccess(applicationId: string, apiId: string): Promise<any> {
    const response = await this.apiManager.delete(`/applications/${applicationId}/apis/${apiId}`);
    return response.data;
  }

  // --- Outros Métodos ---

  /**
   * Lista a configuração de quais eventos disparam alertas.
   * @returns Uma promessa que resolve para a configuração de alertas.
   */
  async listAlerts(): Promise<any> {
    const response = await this.apiGateway.get('/alerts');
    return response.data;
  }

  /**
   * Atualiza a configuração de gatilhos de alerta.
   * @param settings Um objeto onde as chaves são os nomes dos alertas e os valores são booleanos.
   * @returns Uma promessa que resolve quando a configuração é atualizada.
   */
  async updateAlertSettings(settings: any): Promise<any> {
    const response = await this.apiGateway.put('/alerts', settings, { headers: { 'Content-Type': 'application/json' } });
    return response.data;
  }

  /**
   * Obtém as cotas de aplicação (sistema ou customizada).
   * @param applicationId O ID da aplicação.
   * @returns Uma promessa que resolve para a configuração de cotas da aplicação.
   */
  async getApplicationQuotas(applicationId: string): Promise<any> {
    const response = await this.apiManager.get(`/quotas/applications/${applicationId}`);
    return response.data;
  }

  /**
   * Atualiza as cotas para uma aplicação específica.
   * @param applicationId O ID da aplicação.
   * @param quotaData O objeto de cota a ser aplicado.
   * @returns Uma promessa que resolve quando as cotas são atualizadas.
   */
  async updateApplicationQuotas(applicationId: string, quotaData: any): Promise<any> {
    const response = await this.apiManager.put(`/quotas/applications/${applicationId}`, quotaData, { headers: { 'Content-Type': 'application/json' } });
    return response.data;
  }

  /**
   * Obtém um relatório de resumo para métricas de aplicação ou API.
   * @param params Parâmetros para filtrar o relatório de métricas.
   * @returns Uma promessa que resolve para os dados do relatório.
   */
  async getMetrics({ type, level, from, to, client, service, method, organization, reportsubtype }: any): Promise<any> {
    const params = new URLSearchParams({
      type,
      level: level.toString(),
      from,
      to,
    });
    if (reportsubtype) params.append('reportsubtype', reportsubtype);
    if (client) client.forEach((c: string) => params.append('client', c));
    if (service) service.forEach((s: string) => params.append('service', s));
    if (method) params.append('method', method);
    if (organization) params.append('organization', organization);

    const path = `/reports?${params.toString()}`;
    const response = await this.apiManager.get(path);
    return response.data;
  }

  /**
   * Obtém a configuração do API Manager.
   * Esta operação acessa o endpoint `/config` do API Manager para recuperar
   * informações sobre a configuração do sistema, incluindo políticas globais,
   * configurações de segurança, limites de sessão, etc.
   *
   * @returns Promise<any> - A configuração completa do API Manager
   */
  async getManagerConfig(): Promise<any> {
    try {
      const timestamp = Date.now();
      const params = new URLSearchParams();
      params.append('request.preventCache', timestamp.toString());

      return await this.logAndRequest(this.apiManager, {
        method: 'GET',
        url: `/config?${params.toString()}`,
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
    } catch (error) {
      console.error('Error getting API Manager configuration:', error);
      throw error;
    }
  }
}