/**
 * DEFINIÇÃO DAS TOOLS MCP PARA AXWAY
 *
 * Todas as tools deste MCP são específicas para administração, monitoramento e automação do ambiente Axway API Gateway e Axway API Manager.
 *
 * Use estas ferramentas para:
 * - Gerenciar APIs de backend e proxies de API (frontend) no Axway
 * - Monitorar tráfego, eventos e métricas do API Gateway
 * - Administrar organizações, usuários e aplicações no API Manager
 * - Automatizar operações comuns do ecossistema Axway
 *
 * As tools são mapeadas diretamente para as APIs REST oficiais do Axway API Gateway e API Manager.
 *
 * Exemplos de prompts que serão corretamente correlacionados:
 * - "Liste as APIs publicadas no API Manager"
 * - "Quero monitorar o tráfego do API Gateway"
 * - "Crie um proxy de API para a organização X"
 * - "Liste os usuários do API Manager"
 * - "Obtenha detalhes de uma transação HTTP no gateway"
 *
 * Todas as operações são compatíveis apenas com ambientes Axway.
 */

import { z } from "zod";

const listTopology = {
  method: "list_topology",
  description: "Obtém a topologia do domínio do API Gateway, incluindo grupos e instâncias. Essencial para encontrar IDs de instância.",
  parameters: z.object({}).shape
};

const getMcpServerTime = {
  method: "get_mcp_server_time",
  description: "Obtém o timestamp e o fuso horário atuais do servidor onde o MCP está sendo executado. Fornece uma referência de tempo confiável.",
  parameters: z.object({}).shape
};

const getInstanceTraffic = {
  method: "get_instance_traffic",
  description: "Obtém um resumo das métricas de tráfego para uma instância específica do API Gateway Axway. ATENÇÃO: Em ambientes containerizados (Kubernetes, Docker, etc), o instanceId pode mudar a cada reinício de pod. Sempre consulte a topologia (tool list_topology) antes de usar um instanceId.",
  parameters: z.object({
    instanceId: z.string().describe("O ID da instância do API Gateway (ex: 'instance-1'). Use a tool list_topology para encontrar.")
  }).shape
};

const getServiceTraffic = {
  method: "get_service_traffic",
  description: "Obtém métricas de tráfego para um serviço específico em uma instância do API Gateway Axway. ATENÇÃO: Em ambientes containerizados, o instanceId pode mudar a cada reinício de pod. Consulte a topologia antes de usar.",
  parameters: z.object({
    instanceId: z.string().describe("O ID da instância do API Gateway. Use a tool list_topology para encontrar."),
    serviceName: z.string().describe("O nome do serviço (ex: 'Default Services').")
  }).shape
};

const getInstanceMetricsTimeline = {
  method: "get_instance_metrics_timeline",
  description: "Obtém uma linha do tempo de métricas para uma instância específica do API Gateway Axway. ATENÇÃO: Em ambientes containerizados, o instanceId pode mudar a cada reinício de pod. Consulte a topologia antes de usar.",
  parameters: z.object({
    instanceId: z.string().describe("O ID da instância do API Gateway. Use a tool list_topology para encontrar."),
    timeline: z.string().describe("O intervalo de tempo para a linha do tempo (ex: '10m', '1h')."),
    metricTypes: z.array(z.string()).describe("Os tipos de métricas a serem recuperados (ex: ['successes', 'failures']).")
  }).shape
};

const searchTrafficEvents = {
  method: "search_traffic_events",
  description: "Pesquisa por eventos de tráfego (transações) em uma instância do API Gateway Axway. ATENÇÃO: Em ambientes containerizados, o instanceId pode mudar a cada reinício de pod. Consulte a topologia antes de usar.",
  parameters: z.object({
    instanceId: z.string().describe("O ID da instância do API Gateway. Use a tool list_topology para encontrar."),
    ago: z.string().describe("O intervalo de tempo para a pesquisa (ex: '1h', '24h', '10m')."),
    count: z.number().optional().describe("O número máximo de eventos a serem retornados. Padrão: 100."),
    protocol: z.string().optional().describe("Filtrar por protocolo (ex: 'http', 'https')."),
    searchField: z.string().optional().describe("Campo para pesquisar (ex: 'status', 'leg', 'remoteAddr')."),
    searchValue: z.string().optional().describe("Valor para o campo de pesquisa.")
  }).shape
};

const getTrafficEventDetails = {
  method: "get_traffic_event_details",
  description: "Obtém informações detalhadas sobre um evento de tráfego específico (transação) do API Gateway Axway. ATENÇÃO: Em ambientes containerizados, o instanceId pode mudar a cada reinício de pod. Consulte a topologia antes de usar.",
  parameters: z.object({
    instanceId: z.string().describe("O ID da instância do API Gateway. Use a tool list_topology para encontrar."),
    correlationId: z.string().describe("O ID de correlação da transação, obtido de 'search_traffic_events'."),
    protocol: z.string().describe("O protocolo da transação (ex: 'http')."),
    leg: z.number().describe("O 'leg' (segmento) da transação. Geralmente 0."),
    includeDetails: z.boolean().optional().describe("Incluir detalhes da transação. Padrão: true."),
    includeRequestHeaders: z.boolean().optional().describe("Incluir cabeçalhos da requisição. Padrão: true."),
    includeResponseHeaders: z.boolean().optional().describe("Incluir cabeçalhos da resposta. Padrão: true.")
  }).shape
};

const getTrafficEventPayload = {
  method: "get_traffic_event_payload",
  description: "Obtém o payload (corpo) enviado ou recebido para um evento de tráfego do API Gateway Axway. ATENÇÃO: Em ambientes containerizados, o instanceId pode mudar a cada reinício de pod. Consulte a topologia antes de usar.",
  parameters: z.object({
    instanceId: z.string().describe("O ID da instância do API Gateway. Use a tool list_topology para encontrar."),
    correlationId: z.string().describe("O ID de correlação da transação."),
    leg: z.number().describe("O 'leg' (segmento) da transação. Geralmente 0."),
    direction: z.enum(["received", "sent"]).describe("A direção do payload ('received': do cliente, 'sent': para o cliente).")
  }).shape
};

const getTrafficEventTrace = {
  method: "get_traffic_event_trace",
  description: "Obtém os dados de trace (log detalhado) para um evento de tráfego específico do API Gateway Axway. ATENÇÃO: Em ambientes containerizados, o instanceId pode mudar a cada reinício de pod. Consulte a topologia antes de usar.",
  parameters: z.object({
    instanceId: z.string().describe("O ID da instância do API Gateway. Use a tool list_topology para encontrar."),
    correlationId: z.string().describe("O ID de correlação da transação."),
    includeSentData: z.boolean().optional().describe("Incluir dados enviados no trace. Padrão: false."),
    includeReceivedData: z.boolean().optional().describe("Incluir dados recebidos no trace. Padrão: false.")
  }).shape
};

const listOrganizations = {
  method: "list_organizations",
  description: "Obtém a lista de todas as organizações no API Manager.",
  parameters: z.object({}).shape
};

const getOrganization = {
  method: "get_organization",
  description: "Obtém uma organização específica pelo seu ID. Use 'list_organizations' para encontrar IDs.",
  parameters: z.object({
    id: z.string().describe("O ID da organização a ser recuperada.")
  }).shape
};

const createOrganization = {
  method: "create_organization",
  description: "Cria uma nova organização.",
  parameters: z.object({
    name: z.string().describe("O nome da organização."),
    description: z.string().optional().describe("Uma descrição para a organização."),
    email: z.string().optional().describe("O e-mail de contato da organização."),
    phone: z.string().optional().describe("O telefone de contato da organização."),
    enabled: z.boolean().optional().describe("Define se a organização deve ser habilitada. Padrão: true.")
  }).shape
};

const updateOrganization = {
  method: "update_organization",
  description: "Atualiza uma organização existente. Apenas os campos fornecidos serão alterados.",
  parameters: z.object({
    id: z.string().describe("O ID da organização a ser atualizada."),
    name: z.string().optional().describe("O novo nome da organização."),
    description: z.string().optional().describe("A nova descrição para a organização."),
    email: z.string().optional().describe("O novo e-mail de contato."),
    phone: z.string().optional().describe("O novo telefone de contato."),
    enabled: z.boolean().optional().describe("O novo estado de habilitação.")
  }).shape
};

const deleteOrganization = {
  method: "delete_organization",
  description: "Deleta uma organização pelo seu ID.",
  parameters: z.object({
    id: z.string().describe("O ID da organização a ser deletada.")
  }).shape
};

const listUsers = {
  method: "list_users",
  description: "Obtém a lista de todos os usuários.",
  parameters: z.object({}).shape
};

const getUser = {
  method: "get_user",
  description: "Obtém um usuário específico pelo seu ID. Use 'list_users' para encontrar IDs.",
  parameters: z.object({
    id: z.string().describe("O ID do usuário a ser recuperado.")
  }).shape
};

const createUser = {
  method: "create_user",
  description: "Cria um novo usuário.",
  parameters: z.object({
    organizationId: z.string().describe("O ID da organização à qual o usuário pertence."),
    name: z.string().describe("O nome completo do usuário."),
    loginName: z.string().describe("O nome de login para o usuário."),
    role: z.enum(['user', 'admin']).describe("O papel do usuário ('user' ou 'admin')."),
    email: z.string().optional().describe("O e-mail de contato do usuário."),
    phone: z.string().optional().describe("O telefone de contato do usuário.")
  }).shape
};

const updateUser = {
  method: "update_user",
  description: "Atualiza um usuário existente. Apenas os campos fornecidos serão alterados.",
  parameters: z.object({
    id: z.string().describe("O ID do usuário a ser atualizado."),
    name: z.string().optional().describe("O novo nome completo."),
    loginName: z.string().optional().describe("O novo nome de login."),
    email: z.string().optional().describe("O novo e-mail."),
    phone: z.string().optional().describe("O novo telefone."),
    role: z.enum(['user', 'admin']).optional().describe("O novo papel do usuário."),
    enabled: z.boolean().optional().describe("O novo estado de habilitação."),
    organizationId: z.string().optional().describe("O novo ID da organização.")
  }).shape
};

const deleteUser = {
  method: "delete_user",
  description: "Deleta um usuário pelo seu ID.",
  parameters: z.object({
    id: z.string().describe("O ID do usuário a ser deletado.")
  }).shape
};

const listApplications = {
  method: "list_applications",
  description: "Obtém a lista de todas as aplicações visíveis ao usuário autenticado.",
  parameters: z.object({}).shape
};

const getApplication = {
  method: "get_application",
  description: "Obtém uma aplicação específica pelo seu ID. Use 'list_applications' para encontrar IDs.",
  parameters: z.object({
    id: z.string().describe("O ID da aplicação a ser recuperada.")
  }).shape
};

const getApiKeysForApplication = {
  method: "get_api_keys_for_application",
  description: "Obtém as API Keys associadas a uma aplicação específica.",
  parameters: z.object({
    id: z.string().describe("O ID da aplicação cujas API Keys devem ser retornadas.")
  }).shape
};

const createApiKey = {
  method: "create_api_key",
  description: "Cria uma nova API Key para uma aplicação específica.",
  parameters: z.object({
    appId: z.string().describe("O ID da aplicação para a qual criar a API Key."),
    secret: z.string().optional().describe("O segredo para a API Key. Se não fornecido, um será gerado."),
    enabled: z.boolean().optional().describe("Define se a API Key deve ser habilitada. Padrão: true.")
  }).shape
};

const getOAuthCredentialsForApplication = {
  method: "get_oauth_credentials_for_application",
  description: "Obtém as credenciais OAuth associadas a uma aplicação específica.",
  parameters: z.object({
    id: z.string().describe("O ID da aplicação cujas credenciais OAuth devem ser retornadas.")
  }).shape
};

const createOAuthCredential = {
  method: "create_oauth_credential",
  description: "Cria uma nova credencial OAuth (client ID e segredo) para a aplicação.",
  parameters: z.object({
    appId: z.string().describe("O ID da aplicação para a qual criar a credencial."),
    cert: z.string().optional().describe("O certificado público (em formato PEM) a ser associado ao cliente."),
    redirectURIs: z.string().optional().describe("Uma lista de URIs de redirecionamento separadas por vírgulas.")
  }).shape
};

const getPermissionsForApplication = {
  method: "get_permissions_for_application",
  description: "Obtém a lista de controle de acesso (ACL) para uma aplicação específica.",
  parameters: z.object({
    id: z.string().describe("O ID da aplicação cujas permissões devem ser retornadas.")
  }).shape
};

const listApiProxies = {
  method: "list_api_proxies",
  description: "Obtém a lista de todos os proxies de API (APIs de frontend).",
  parameters: z.object({}).shape
};

const getApiProxy = {
  method: "get_api_proxy",
  description: "Obtém um proxy de API específico pelo seu ID. Use 'list_api_proxies' para encontrar IDs.",
  parameters: z.object({
    id: z.string().describe("O ID do proxy de API a ser recuperado.")
  }).shape
};

const createApiProxy = {
  method: "create_api_proxy",
  description: "Cria um novo proxy de API (API de frontend).",
  parameters: z.object({
    name: z.string().describe("O nome do novo proxy de API."),
    path: z.string().describe("O caminho que identifica o proxy de API (ex: '/meu-api/v1')."),
    apiId: z.string().describe("O ID da API de Backend a ser proxyada. Nota: pode ser necessária uma ferramenta para listar APIs de Backend (apirepo)."),
    organizationId: z.string().describe("O ID da organização que possui o proxy de API."),
    vhost: z.string().optional().describe("Um host virtual ao qual o proxy de API está vinculado."),
    version: z.string().optional().describe("A versão do proxy de API."),
    description: z.string().optional().describe("Uma descrição para o proxy de API.")
  }).shape
};

const updateApiProxy = {
  method: "update_api_proxy",
  description: "Atualiza um proxy de API existente. Apenas os campos fornecidos serão alterados.",
  parameters: z.object({
    id: z.string().describe("O ID do proxy de API a ser atualizado."),
    name: z.string().optional().describe("O novo nome para o proxy de API."),
    path: z.string().optional().describe("O novo caminho para o proxy de API."),
    apiId: z.string().optional().describe("O novo ID da API de Backend a ser proxyada."),
    organizationId: z.string().optional().describe("O novo ID da organização que possui o proxy de API."),
    vhost: z.string().optional().describe("Um novo host virtual para o proxy de API."),
    version: z.string().optional().describe("A nova versão para o proxy de API."),
    description: z.string().optional().describe("Uma nova descrição para o proxy de API.")
  }).shape
};

const deleteApiProxy = {
  method: "delete_api_proxy",
  description: "Deleta um proxy de API pelo seu ID.",
  parameters: z.object({
    id: z.string().describe("O ID do proxy de API a ser deletado.")
  }).shape
};

const publishApi = {
  method: "publish_api",
  description: "Publica um proxy de API, tornando-o disponível para consumo.",
  parameters: z.object({
    id: z.string().describe("O ID do proxy de API a ser publicado.")
  }).shape
};

const unpublishApi = {
  method: "unpublish_api",
  description: "Despublica um proxy de API, tornando-o indisponível.",
  parameters: z.object({
    id: z.string().describe("O ID do proxy de API a ser despublicado.")
  }).shape
};

const deprecateApi = {
  method: "deprecate_api",
  description: "Marca um proxy de API como obsoleto (deprecated).",
  parameters: z.object({
    id: z.string().describe("O ID do proxy de API a ser marcado como obsoleto.")
  }).shape
};

const listBackendApis = {
  method: "list_backend_apis",
  description: "Obtém a lista de todas as APIs de backend do repositório de APIs. Útil para encontrar o apiId para criar proxies de API.",
  parameters: z.object({}).shape
};

const importBackendApiFromUrl = {
  method: "import_backend_api_from_url",
  description: "Importa uma API de backend de uma URL (ex: uma definição Swagger/OpenAPI).",
  parameters: z.object({
    url: z.string().describe("A URL da definição da API a ser importada."),
    organizationId: z.string().describe("O ID da organização que será proprietária da nova API de backend."),
    name: z.string().optional().describe("Um nome personalizado para a API de backend. Se não fornecido, um nome será gerado a partir da definição da API.")
  }).shape
};

const importBackendApiFromFile = {
  method: "import_backend_api_from_file",
  description: "Importa uma API de backend a partir de um arquivo local (ex: Swagger/OpenAPI). O parâmetro filePath deve ser o caminho local do arquivo no host onde o MCP está rodando. Só funciona para execução local, não em Docker.",
  parameters: z.object({
    filePath: z.string().describe("Caminho local do arquivo Swagger/OpenAPI no host (ex: ./swagger.json)"),
    organizationId: z.string().describe("ID da organização que será dona da API"),
    name: z.string().optional().describe("Nome customizado para a API de backend (opcional)")
  }).shape
};

const deleteBackendApi = {
  method: "delete_backend_api",
  description: "Deleta uma API de backend pelo seu ID.",
  parameters: z.object({
    id: z.string().describe("O ID da API de backend a ser deletada.")
  }).shape
};

const listApiAccess = {
  method: "list_api_access",
  description: "Lista todas as APIs de frontend que a aplicação fornecida tem acesso.",
  parameters: z.object({
    applicationId: z.string().describe("O ID da aplicação. Use 'list_applications' para encontrar IDs.")
  }).shape
};

const grantApiAccess = {
  method: "grant_api_access",
  description: "Concede a uma aplicação acesso a uma API de frontend.",
  parameters: z.object({
    applicationId: z.string().describe("O ID da aplicação para conceder acesso. Use 'list_applications' para encontrar IDs."),
    apiId: z.string().describe("O ID da API de frontend (proxy) para conceder acesso. Use 'list_api_proxies' para encontrar IDs.")
  }).shape
};

const revokeApiAccess = {
  method: "revoke_api_access",
  description: "Revoga o acesso de uma aplicação a uma API de frontend.",
  parameters: z.object({
    applicationId: z.string().describe("O ID da aplicação para revogar o acesso. Use 'list_applications' para encontrar IDs."),
    apiId: z.string().describe("O ID da API de frontend (proxy) da qual revogar o acesso.")
  }).shape
};

const listAlerts = {
  method: "list_alerts",
  description: "Lista a configuração de quais eventos irão disparar um alerta.",
  parameters: z.object({}).shape
};

const updateAlertSettings = {
  method: "update_alert_settings",
  description: "Atualiza a configuração do gatilho de alerta. Forneça um objeto JSON com os nomes dos alertas como chaves e true/false como valores.",
  parameters: z.object({
    settings: z.object({}).describe("Um objeto JSON onde as chaves são nomes de eventos de alerta e os valores são booleanos. Inclua apenas as configurações que deseja alterar.")
  }).shape
};

const getApplicationQuotas = {
  method: "get_application_quotas",
  description: "Obtém a cota efetiva (do sistema ou específica da aplicação) para uma aplicação específica.",
  parameters: z.object({
    applicationId: z.string().describe("O ID da aplicação para a qual recuperar as cotas. Use 'list_applications' para encontrar IDs.")
  }).shape
};

const updateApplicationQuotas = {
  method: "update_application_quotas",
  description: "Atualiza as cotas para uma aplicação específica para um máximo de mensagens por segundo.",
  parameters: z.object({
    applicationId: z.string().describe("O ID da aplicação para a qual atualizar as cotas."),
    messages_per_second: z.number().int().describe("O número máximo de mensagens (requisições) por segundo.")
  }).shape
};

const getApiCatalog = {
  method: "get_api_catalog",
  description: "Obtém o catálogo de todas as APIs de frontend publicadas disponíveis para consumo. Este é um alias para 'list_api_proxies'.",
  parameters: z.object({}).shape
};

const uploadFileForImport = {
  method: 'upload_file_for_import',
  description: 'Faz upload de um arquivo local (ex: Swagger) para o MCP, informando o caminho do arquivo no sistema de arquivos do container. Retorna o caminho salvo para ser usado na importação.',
  parameters: z.object({
    filePath: z.string().describe("Caminho do arquivo local no container (ex: /tmp/swagger.json)")
  }).shape
};

/**
 * Observação importante para todas as tools que usam instanceId:
 * Em ambientes containerizados (Kubernetes, Docker, etc), o nome da instância (instanceId) pode mudar a cada reinício de pod.
 * Sempre consulte a topologia (tool list_topology) antes de usar um instanceId para garantir que está usando o valor correto e atual.
 * Exemplo de prompt: "Liste a topologia para saber o instanceId atual do gateway."
 */
export function tools() {
  return [
    listTopology,
    getMcpServerTime,
    getInstanceTraffic,
    getServiceTraffic,
    getInstanceMetricsTimeline,
    searchTrafficEvents,
    getTrafficEventDetails,
    getTrafficEventPayload,
    getTrafficEventTrace,
    listOrganizations,
    getOrganization,
    createOrganization,
    updateOrganization,
    deleteOrganization,
    listUsers,
    getUser,
    createUser,
    updateUser,
    deleteUser,
    listApplications,
    getApplication,
    getApiKeysForApplication,
    createApiKey,
    getOAuthCredentialsForApplication,
    createOAuthCredential,
    getPermissionsForApplication,
    listApiProxies,
    getApiProxy,
    createApiProxy,
    updateApiProxy,
    deleteApiProxy,
    publishApi,
    unpublishApi,
    deprecateApi,
    listBackendApis,
    importBackendApiFromUrl,
    deleteBackendApi,
    importBackendApiFromFile,
    listApiAccess,
    grantApiAccess,
    revokeApiAccess,
    listAlerts,
    updateAlertSettings,
    getApplicationQuotas,
    updateApplicationQuotas,
    getApiCatalog,
    uploadFileForImport
  ];
}
