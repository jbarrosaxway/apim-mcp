/**
 * @module src/operations/proxies
 * @description Este módulo contém as operações (ferramentas) para o gerenciamento
 * completo do ciclo de vida de Proxies de API (APIs de Frontend) no Axway API Manager.
 */
import { removeEmptyValues } from "../utils.js";
/**
 * Transforma o objeto de proxy de API detalhado em uma versão simplificada,
 * focada em informações chave para diagnóstico e solução de problemas (troubleshooting).
 * @param rawProxy O objeto de proxy de API bruto retornado pela API.
 * @returns Um objeto simplificado com informações de inbound, outbound e estado.
 * @internal
 */
function transformApiProxyForTroubleshooting(rawProxy) {
    const securityProfile = rawProxy.securityProfiles?.find((p) => p.isDefault);
    const authProfile = rawProxy.authenticationProfiles?.find((p) => p.isDefault);
    const corsProfile = rawProxy.corsProfiles?.find((p) => p.isDefault);
    // Extrair informações de autenticação das configurações de segurança
    const authDevices = securityProfile?.devices || [];
    const apiKeyDevice = authDevices.find((d) => d.type === 'apiKey');
    const oauthDevice = authDevices.find((d) => d.type === 'oauth');
    // Determinar o nome do campo de autenticação baseado nas configurações
    let authFieldName = "X-API-Key"; // Padrão
    if (apiKeyDevice?.properties?.headerName) {
        authFieldName = apiKeyDevice.properties.headerName;
    }
    else if (oauthDevice?.properties?.headerName) {
        authFieldName = oauthDevice.properties.headerName;
    }
    const simplified = {
        id: rawProxy.id,
        name: rawProxy.name,
        path: rawProxy.path,
        vhost: rawProxy.vhost,
        state: rawProxy.state,
        apiId: rawProxy.apiId,
        createdOn: rawProxy.createdOn,
        accessGrantedDate: rawProxy.accessGrantedDate,
        securityProfiles: rawProxy.securityProfiles,
        authenticationInfo: {
            fieldName: authFieldName, // ✅ NOME DO CAMPO para usar em headers
            authType: apiKeyDevice ? 'apiKey' : oauthDevice ? 'oauth' : 'none',
            curlExample: `curl -H "${authFieldName}: YOUR_API_KEY" https://your-api-endpoint`,
            warning: "Consulte as configurações de segurança do proxy para o nome correto do campo"
        },
        troubleshootingInfo: {
            inbound: {
                security: securityProfile?.devices?.map((d) => ({
                    type: d.type,
                    scopes: d.properties?.scopes,
                    headerName: d.properties?.headerName // Nome do campo de autenticação
                })),
                cors: {
                    origins: corsProfile?.origins
                },
                inboundCertificate: rawProxy.caCerts?.some((c) => c.inbound === true) || false
            },
            outbound: {
                backendService: rawProxy.serviceProfiles?._default?.basePath,
                authentication: {
                    type: authProfile?.type,
                    details: rawProxy.outboundProfiles?._default?.authenticationProfile
                },
                outboundCertificate: rawProxy.caCerts?.some((c) => c.outbound === true) || false
            }
        }
    };
    return removeEmptyValues(simplified);
}
/**
 * Ferramenta para listar todos os proxies de API (APIs de Frontend).
 * @param api Instância da classe AxwayApi.
 * @returns Um objeto contendo a lista de proxies de API.
 */
export async function listApiProxies(api) {
    try {
        const rawProxies = await api.listApiProxies();
        // Retorna uma versão simplificada na lista para economizar tokens
        const proxies = rawProxies.map((p) => ({
            id: p.id,
            name: p.name,
            path: p.path,
            state: p.state,
            createdOn: p.createdOn,
            accessGrantedDate: p.accessGrantedDate
        }));
        return {
            count: proxies.length,
            apiProxies: proxies,
            message: `Encontrados ${proxies.length} proxies de API.`,
            relatedTools: [
                ...proxies.map((p) => ({
                    tool_name: 'get_api_proxy',
                    description: `Obter detalhes de troubleshooting para o proxy '${p.name}'.`,
                    parameters: [{ name: 'id', value: p.id }]
                })),
                {
                    tool_name: 'list_backend_apis',
                    description: 'Listar APIs de backend, necessário para criar um novo proxy.',
                    parameters: []
                }
            ]
        };
    }
    catch (error) {
        console.error(`Erro ao listar proxies de API:`, error);
        throw error;
    }
}
/**
 * Ferramenta para obter informações específicas de autenticação de um proxy de API.
 * @param api Instância da classe AxwayApi.
 * @param id O ID do proxy de API.
 * @returns Um objeto contendo informações de autenticação do proxy.
 */
export async function getProxyAuthenticationInfo(api, id) {
    try {
        const rawProxy = await api.getApiProxy(id);
        const securityProfile = rawProxy.securityProfiles?.find((p) => p.isDefault);
        const authDevices = securityProfile?.devices || [];
        // Extrair informações de autenticação
        const apiKeyDevice = authDevices.find((d) => d.type === 'apiKey');
        const oauthDevice = authDevices.find((d) => d.type === 'oauth');
        // Determinar o nome do campo de autenticação
        let authFieldName = "X-API-Key"; // Padrão
        let authType = "none";
        if (apiKeyDevice?.properties?.headerName) {
            authFieldName = apiKeyDevice.properties.headerName;
            authType = "apiKey";
        }
        else if (oauthDevice?.properties?.headerName) {
            authFieldName = oauthDevice.properties.headerName;
            authType = "oauth";
        }
        return {
            proxyId: id,
            proxyName: rawProxy.name,
            proxyPath: rawProxy.path,
            authenticationInfo: {
                type: authType,
                fieldName: authFieldName,
                curlExample: `curl -H "${authFieldName}: YOUR_API_KEY" https://your-api-endpoint`,
                curlWithApiKey: `curl -H "${authFieldName}: YOUR_API_KEY" ${rawProxy.vhost}${rawProxy.path}`,
                warning: "Use o campo 'apiKey' das credenciais, NÃO use o campo 'secret'",
                securityDevices: authDevices.map((d) => ({
                    type: d.type,
                    headerName: d.properties?.headerName,
                    scopes: d.properties?.scopes
                }))
            },
            message: `Informações de autenticação para o proxy '${rawProxy.name}'. Use o header '${authFieldName}' para autenticação.`,
            relatedTools: [
                {
                    tool_name: 'get_api_keys_for_application',
                    description: 'Obter API Keys para usar com este proxy.',
                    parameters: []
                },
                {
                    tool_name: 'get_api_proxy',
                    description: `Obter detalhes completos do proxy '${rawProxy.name}'.`,
                    parameters: [{ name: 'id', value: id }]
                }
            ]
        };
    }
    catch (error) {
        console.error(`Erro ao obter informações de autenticação do proxy ${id}:`, error);
        throw error;
    }
}
/**
 * Ferramenta para obter detalhes de um proxy de API específico, formatado para troubleshooting.
 * @param api Instância da classe AxwayApi.
 * @param id O ID do proxy de API a ser recuperado.
 * @returns Um objeto contendo os detalhes simplificados do proxy.
 */
export async function getApiProxy(api, id) {
    try {
        const rawProxy = await api.getApiProxy(id);
        const apiProxy = transformApiProxyForTroubleshooting(rawProxy);
        return {
            apiProxy: apiProxy,
            relatedTools: [
                {
                    tool_name: 'update_api_proxy',
                    description: `Atualizar o proxy '${apiProxy.name}'.`,
                    parameters: [{ name: 'id', value: id }]
                },
                {
                    tool_name: 'list_api_access',
                    description: `Ver quais aplicações têm acesso a este proxy.`,
                    parameters: [{ name: 'applicationId', value: 'ALL' }] // O usuário precisará substituir
                },
                {
                    tool_name: 'publish_api',
                    description: `Publicar o proxy '${apiProxy.name}' para torná-lo ativo.`,
                    parameters: [{ name: 'id', value: id }]
                },
                {
                    tool_name: 'delete_api_proxy',
                    description: `Deletar o proxy '${apiProxy.name}'.`,
                    parameters: [{ name: 'id', value: id }]
                }
            ]
        };
    }
    catch (error) {
        console.error(`Erro ao obter o proxy de API ${id}:`, error);
        throw error;
    }
}
/**
 * Ferramenta para criar um novo proxy de API (API de Frontend).
 * @param api Instância da classe AxwayApi.
 * @param name O nome do novo proxy.
 * @param path O caminho de exposição do proxy (ex: '/my-api/v1').
 * @param apiId O ID da API de Backend a ser exposta por este proxy.
 * @param organizationId O ID da organização que será dona do proxy.
 * @returns Um objeto de confirmação com os detalhes do proxy criado.
 */
export async function createApiProxy(api, name, path, apiId, organizationId) {
    try {
        const newProxy = await api.createApiProxy({ name, path, apiId, organizationId });
        return {
            message: `Proxy de API '${newProxy.name}' criado com sucesso.`,
            apiProxy: newProxy,
            relatedTools: [
                {
                    tool_name: 'get_api_proxy',
                    description: 'Ver os detalhes do proxy recém-criado.',
                    parameters: [{ name: 'id', value: newProxy.id }]
                },
                {
                    tool_name: 'publish_api',
                    description: `Publicar o proxy '${newProxy.name}' para ativá-lo.`,
                    parameters: [{ name: 'id', value: newProxy.id }]
                }
            ]
        };
    }
    catch (error) {
        console.error(`Erro ao criar o proxy de API:`, error);
        throw error;
    }
}
/**
 * Ferramenta para atualizar um proxy de API existente. Apenas os campos fornecidos serão alterados.
 * @param api Instância da classe AxwayApi.
 * @param id O ID do proxy a ser atualizado.
 * @param name (Opcional) O novo nome para o proxy.
 * @param path (Opcional) O novo caminho para o proxy.
 * @param apiId (Opcional) O novo ID da API de backend.
 * @returns Um objeto de confirmação com os detalhes do proxy atualizado.
 */
export async function updateApiProxy(api, id, name, path, apiId) {
    try {
        const payload = removeEmptyValues({ name, path, apiId });
        if (Object.keys(payload).length === 0) {
            return { message: "Nenhum campo fornecido para atualização. Nenhuma ação foi tomada." };
        }
        const updatedProxy = await api.updateApiProxy(id, payload);
        return {
            message: `Proxy de API '${updatedProxy.name}' atualizado com sucesso.`,
            apiProxy: updatedProxy,
            relatedTools: [
                {
                    tool_name: 'get_api_proxy',
                    description: 'Ver os detalhes atualizados do proxy.',
                    parameters: [{ name: 'id', value: id }]
                }
            ]
        };
    }
    catch (error) {
        console.error(`Erro ao atualizar o proxy de API ${id}:`, error);
        throw error;
    }
}
/**
 * Ferramenta para deletar um proxy de API pelo seu ID.
 * @param api Instância da classe AxwayApi.
 * @param id O ID do proxy a ser deletado.
 * @returns Um objeto de confirmação da exclusão.
 */
export async function deleteApiProxy(api, id) {
    try {
        await api.deleteApiProxy(id);
        return {
            message: `O proxy de API com ID '${id}' foi deletado com sucesso.`,
            relatedTools: [
                {
                    tool_name: 'list_api_proxies',
                    description: 'Listar os proxies restantes para confirmar a exclusão.',
                    parameters: []
                }
            ]
        };
    }
    catch (error) {
        console.error(`Erro ao deletar o proxy de API ${id}:`, error);
        throw error;
    }
}
/**
 * Ferramenta para publicar um proxy de API, tornando-o disponível para consumo.
 * @param api Instância da classe AxwayApi.
 * @param id O ID do proxy a ser publicado.
 * @returns Um objeto de confirmação da publicação.
 */
export async function publishApi(api, id) {
    try {
        const result = await api.publishApi(id);
        return {
            message: `O proxy de API com ID '${id}' foi publicado com sucesso.`,
            details: result,
            relatedTools: [
                {
                    tool_name: 'get_api_proxy',
                    description: 'Ver o estado atualizado do proxy.',
                    parameters: [{ name: 'id', value: id }]
                },
                {
                    tool_name: 'unpublish_api',
                    description: 'Reverter a publicação (despublicar).',
                    parameters: [{ name: 'id', value: id }]
                }
            ]
        };
    }
    catch (error) {
        console.error(`Erro ao publicar o proxy de API ${id}:`, error);
        throw error;
    }
}
/**
 * Ferramenta para despublicar um proxy de API, tornando-o indisponível.
 * @param api Instância da classe AxwayApi.
 * @param id O ID do proxy a ser despublicado.
 * @returns Um objeto de confirmação da operação.
 */
export async function unpublishApi(api, id) {
    try {
        const result = await api.unpublishApi(id);
        return {
            message: `O proxy de API com ID '${id}' foi despublicado com sucesso.`,
            details: result,
            relatedTools: [
                {
                    tool_name: 'get_api_proxy',
                    description: 'Ver o estado atualizado do proxy.',
                    parameters: [{ name: 'id', value: id }]
                },
                {
                    tool_name: 'publish_api',
                    description: 'Publicar novamente o proxy.',
                    parameters: [{ name: 'id', value: id }]
                }
            ]
        };
    }
    catch (error) {
        console.error(`Erro ao despublicar o proxy de API ${id}:`, error);
        throw error;
    }
}
/**
 * Ferramenta para marcar um proxy de API como obsoleto (deprecated).
 * @param api Instância da classe AxwayApi.
 * @param id O ID do proxy a ser marcado como obsoleto.
 * @returns Um objeto de confirmação da operação.
 */
export async function deprecateApi(api, id) {
    try {
        const result = await api.deprecateApi(id);
        return {
            message: `O proxy de API com ID '${id}' foi marcado como obsoleto com sucesso.`,
            details: result,
            relatedTools: [
                {
                    tool_name: 'get_api_proxy',
                    description: 'Ver o estado atualizado do proxy.',
                    parameters: [{ name: 'id', value: id }]
                }
            ]
        };
    }
    catch (error) {
        console.error(`Erro ao marcar o proxy de API como obsoleto ${id}:`, error);
        throw error;
    }
}
//# sourceMappingURL=proxies.js.map