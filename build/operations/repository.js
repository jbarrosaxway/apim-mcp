/**
 * @module src/operations/repository
 * @description Este módulo contém as operações (ferramentas) para gerenciar o
 * Repositório de APIs de Backend no Axway API Manager. As APIs de backend são as
 * definições (ex: Swagger/OpenAPI) dos seus serviços reais, que são então
* expostas através de Proxies de API.
 */
/**
 * Transforma o objeto de API de backend bruto em um formato mais limpo e consistente.
 * @param api O objeto de API de backend bruto.
 * @returns Um objeto de API de backend formatado.
 * @internal
 */
function transformBackendApi(api) {
    return {
        backendApiId: api.id,
        name: api.name,
        type: api.type, // e.g., 'swagger', 'wadl'
        basePath: api.basePath,
        organizationId: api.organizationId,
        metadata: {
            createdAt: new Date(api.createdOn).toISOString(),
        }
    };
}
/**
 * Ferramenta para listar todas as APIs de backend do repositório.
 * O `backendApiId` retornado aqui é usado como o `apiId` ao criar um proxy.
 * @param api Instância da classe AxwayApi.
 * @returns Um objeto contendo a lista de APIs de backend.
 */
export async function listBackendApis(api) {
    try {
        const rawApis = await api.listBackendApis();
        const backendApis = rawApis.map(transformBackendApi);
        return {
            count: backendApis.length,
            backendApis: backendApis,
            message: `Encontradas ${backendApis.length} APIs de backend.`,
            relatedTools: [
                ...backendApis.map((bApi) => ({
                    tool_name: 'create_api_proxy',
                    description: `Criar um proxy de API para expor a API de backend '${bApi.name}'.`,
                    parameters: [
                        { name: 'name', value: `${bApi.name} Proxy` },
                        { name: 'path', value: `/${bApi.name.toLowerCase().replace(/\s/g, '-')}` },
                        { name: 'apiId', value: bApi.backendApiId },
                        { name: 'organizationId', value: bApi.organizationId }
                    ]
                })),
                {
                    tool_name: 'import_backend_api_from_url',
                    description: 'Importar uma nova API de backend a partir de uma URL.',
                    parameters: []
                }
            ]
        };
    }
    catch (error) {
        console.error(`Erro ao listar as APIs de backend:`, error);
        throw error;
    }
}
/**
 * Ferramenta para importar uma nova API de backend a partir de uma URL (ex: uma definição Swagger/OpenAPI).
 * @param api Instância da classe AxwayApi.
 * @param url A URL completa da definição da API a ser importada.
 * @param organizationId O ID da organização que será dona desta API de backend.
 * @param name (Opcional) Um nome customizado para a API. Se não fornecido, um será gerado a partir da definição.
 * @returns Um objeto de confirmação com os detalhes da API de backend importada.
 */
export async function importBackendApiFromUrl(api, url, organizationId, name) {
    try {
        const newApi = await api.importBackendApiFromUrl(url, organizationId, name);
        return {
            message: `API de backend '${newApi.name}' importada com sucesso.`,
            backendApi: transformBackendApi(newApi),
            relatedTools: [
                {
                    tool_name: 'create_api_proxy',
                    description: `Criar um proxy para expor a API '${newApi.name}' recém-importada.`,
                    parameters: [
                        { name: 'name', value: `${newApi.name} Proxy` },
                        { name: 'path', value: `/${newApi.name.toLowerCase().replace(/\s/g, '-')}` },
                        { name: 'apiId', value: newApi.id },
                        { name: 'organizationId', value: newApi.organizationId }
                    ]
                },
                {
                    tool_name: 'list_backend_apis',
                    description: 'Ver todas as APIs de backend disponíveis.',
                    parameters: []
                }
            ]
        };
    }
    catch (error) {
        console.error(`Erro ao importar a API de backend da URL ${url}:`, error);
        throw error;
    }
}
/**
 * Ferramenta para importar uma nova API de backend a partir de um arquivo local.
 * @param api Instância da classe AxwayApi.
 * @param filePath O caminho local para o arquivo de definição da API (ex: 'swagger.json').
 * @param organizationId O ID da organização que será dona desta API de backend.
 * @param name (Opcional) Um nome customizado para a API.
 * @returns Um objeto de confirmação com os detalhes da API de backend importada.
 */
export async function importBackendApiFromFile(api, filePath, organizationId, name) {
    try {
        const newApi = await api.importBackendApiFromFile(filePath, organizationId, name);
        return {
            message: `API de backend do arquivo '${filePath}' importada com sucesso.`,
            backendApi: transformBackendApi(newApi),
            relatedTools: [
                {
                    tool_name: 'create_api_proxy',
                    description: `Criar um proxy para expor a API '${newApi.name}' recém-importada.`,
                    parameters: [
                        { name: 'name', value: `${newApi.name} Proxy` },
                        { name: 'path', value: `/${newApi.name.toLowerCase().replace(/\s/g, '-')}` },
                        { name: 'apiId', value: newApi.id },
                        { name: 'organizationId', value: newApi.organizationId }
                    ]
                },
                {
                    tool_name: 'list_backend_apis',
                    description: 'Ver todas as APIs de backend disponíveis.',
                    parameters: []
                }
            ]
        };
    }
    catch (error) {
        console.error(`Erro ao importar a API de backend do arquivo ${filePath}:`, error);
        throw error;
    }
}
/**
 * Ferramenta para deletar uma API de backend do repositório pelo seu ID.
 * @param api Instância da classe AxwayApi.
 * @param id O ID da API de backend a ser deletada.
 * @returns Um objeto de confirmação da exclusão.
 */
export async function deleteBackendApi(api, id) {
    try {
        await api.deleteBackendApi(id);
        return {
            message: `A API de backend com ID '${id}' foi deletada com sucesso.`,
            relatedTools: [
                {
                    tool_name: 'list_backend_apis',
                    description: 'Listar as APIs de backend restantes para confirmar a exclusão.',
                    parameters: []
                }
            ]
        };
    }
    catch (error) {
        console.error(`Erro ao deletar a API de backend ${id}:`, error);
        throw error;
    }
}
/**
 * Tool MCP para upload de arquivo para importação de backend API.
 * Recebe filename e content_base64, salva em /tmp e retorna o caminho salvo.
 */
export async function uploadFileForImport(args) {
    if (!args.filePath) {
        throw new Error('Parâmetro obrigatório: filePath');
    }
    // Apenas retorna o caminho informado, pois o arquivo já está no container
    return { filePath: args.filePath };
}
//# sourceMappingURL=repository.js.map