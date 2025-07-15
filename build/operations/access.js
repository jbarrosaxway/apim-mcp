/**
 * @module src/operations/access
 * @description Este módulo contém as operações (ferramentas) para gerenciar o controle de acesso
 * entre Aplicações e APIs (Proxies) no Axway API Manager.
 * As funções aqui definidas permitem listar, conceder e revogar o acesso.
 */
/**
 * Transforma os dados brutos de acesso à API em um formato mais limpo e estruturado.
 * @param access O objeto de acesso à API bruto retornado pela API da Axway.
 * @returns Um objeto de acesso à API formatado.
 * @internal
 */
function transformApiAccess(access) {
    return {
        apiAccessId: access.id,
        apiId: access.apiId,
        isEnabled: access.enabled,
        metadata: {
            createdAt: new Date(access.createdOn).toISOString()
        }
    };
}
/**
 * Ferramenta para listar todas as APIs às quais uma determinada aplicação tem acesso.
 *
 * @param api Instância da classe AxwayApi para realizar as chamadas.
 * @param applicationId O ID da aplicação para a qual o acesso será verificado.
 * @returns Um objeto contendo o ID da aplicação e uma lista de seus acessos a APIs,
 *          juntamente com sugestões de ferramentas relacionadas.
 */
export async function listApiAccess(api, applicationId) {
    try {
        const rawAccessList = await api.listApiAccess(applicationId);
        return {
            applicationId: applicationId,
            apiAccess: rawAccessList.map(transformApiAccess),
            message: `Found ${rawAccessList.length} APIs that application ${applicationId} has access to.`,
            relatedTools: [
                {
                    tool_name: 'grant_api_access',
                    description: `Conceder a esta aplicação (${applicationId}) acesso a outra API.`,
                    parameters: [{ name: 'applicationId', value: applicationId }]
                },
                {
                    tool_name: 'list_api_proxies',
                    description: 'Listar todas as APIs de frontend disponíveis para encontrar outros IDs de API.',
                    parameters: []
                },
                ...rawAccessList.map((access) => ({
                    tool_name: 'revoke_api_access',
                    description: `Revogar o acesso à API com ID ${access.apiId}.`,
                    parameters: [
                        { name: 'applicationId', value: applicationId },
                        { name: 'apiId', value: access.apiId }
                    ]
                }))
            ]
        };
    }
    catch (error) {
        console.error(`Erro ao listar o acesso à API para a aplicação ${applicationId}:`, error);
        throw error;
    }
}
/**
 * Ferramenta para conceder a uma aplicação acesso a uma API de frontend (proxy).
 *
 * @param api Instância da classe AxwayApi.
 * @param applicationId O ID da aplicação que receberá o acesso.
 * @param apiId O ID da API (proxy) à qual o acesso será concedido.
 * @returns Um objeto de confirmação com detalhes do novo acesso criado.
 */
export async function grantApiAccess(api, applicationId, apiId) {
    try {
        const newAccess = await api.grantApiAccess(applicationId, apiId);
        return {
            message: `Acesso à API ${apiId} concedido com sucesso para a aplicação ${applicationId}.`,
            apiAccess: transformApiAccess(newAccess),
            relatedTools: [
                {
                    tool_name: 'list_api_access',
                    description: `Ver todos os acessos para a aplicação ${applicationId}.`,
                    parameters: [{ name: 'applicationId', value: applicationId }]
                },
                {
                    tool_name: 'revoke_api_access',
                    description: `Revogar este acesso recém-criado à API ${apiId}.`,
                    parameters: [
                        { name: 'applicationId', value: applicationId },
                        { name: 'apiId', value: apiId }
                    ]
                }
            ]
        };
    }
    catch (error) {
        console.error(`Erro ao conceder acesso à API ${apiId} para a aplicação ${applicationId}:`, error);
        throw error;
    }
}
/**
 * Ferramenta para revogar o acesso de uma aplicação a uma API.
 *
 * @param api Instância da classe AxwayApi.
 * @param applicationId O ID da aplicação da qual o acesso será revogado.
 * @param apiId O ID da API (proxy) da qual o acesso será removido.
 * @returns Um objeto de confirmação da operação.
 */
export async function revokeApiAccess(api, applicationId, apiId) {
    try {
        await api.revokeApiAccess(applicationId, apiId);
        return {
            message: `O acesso à API '${apiId}' para a aplicação '${applicationId}' foi revogado com sucesso.`,
            relatedTools: [
                {
                    tool_name: 'list_api_access',
                    description: `Confirmar a alteração listando os acessos restantes para a aplicação ${applicationId}.`,
                    parameters: [{ name: 'applicationId', value: applicationId }]
                }
            ]
        };
    }
    catch (error) {
        console.error(`Erro ao revogar o acesso à API ${apiId} da aplicação ${applicationId}:`, error);
        throw error;
    }
}
//# sourceMappingURL=access.js.map