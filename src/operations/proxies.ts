/**
 * @module src/operations/proxies
 * @description Este módulo contém as operações (ferramentas) para o gerenciamento
 * completo do ciclo de vida de Proxies de API (APIs de Frontend) no Axway API Manager.
 */

import { AxwayApi } from "../api.js";
import { removeEmptyValues } from "../utils.js";

/**
 * Transforma o objeto de proxy de API detalhado em uma versão simplificada,
 * focada em informações chave para diagnóstico e solução de problemas (troubleshooting).
 * @param rawProxy O objeto de proxy de API bruto retornado pela API.
 * @returns Um objeto simplificado com informações de inbound, outbound e estado.
 * @internal
 */
function transformApiProxyForTroubleshooting(rawProxy: any): any {
  const securityProfile = rawProxy.securityProfiles?.find((p: any) => p.isDefault);
  const authProfile = rawProxy.authenticationProfiles?.find((p: any) => p.isDefault);
  const corsProfile = rawProxy.corsProfiles?.find((p: any) => p.isDefault);

  const simplified = {
    id: rawProxy.id,
    name: rawProxy.name,
    path: rawProxy.path,
    vhost: rawProxy.vhost,
    state: rawProxy.state,
    apiId: rawProxy.apiId,
    createdOn: rawProxy.createdOn,
    accessGrantedDate: rawProxy.accessGrantedDate,
    securityProfiles: rawProxy.securityProfiles, // Adicionando o campo crucial
    troubleshootingInfo: {
      inbound: {
        security: securityProfile?.devices?.map((d: any) => ({
          type: d.type,
          scopes: d.properties?.scopes
        })),
        cors: {
          origins: corsProfile?.origins
        },
        inboundCertificate: rawProxy.caCerts?.some((c: any) => c.inbound === true) || false
      },
      outbound: {
        backendService: rawProxy.serviceProfiles?._default?.basePath,
        authentication: {
          type: authProfile?.type,
          details: rawProxy.outboundProfiles?._default?.authenticationProfile
        },
        outboundCertificate: rawProxy.caCerts?.some((c: any) => c.outbound === true) || false
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
export async function listApiProxies(api: AxwayApi) {
  try {
    const rawProxies = await api.listApiProxies();
    // Retorna uma versão simplificada na lista para economizar tokens
    const proxies = rawProxies.map((p: any) => ({
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
        ...proxies.map((p: any) => ({
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
  } catch (error) {
    console.error(`Erro ao listar proxies de API:`, error);
    throw error;
  }
}

/**
 * Ferramenta para obter detalhes de um proxy de API específico, formatado para troubleshooting.
 * @param api Instância da classe AxwayApi.
 * @param id O ID do proxy de API a ser recuperado.
 * @returns Um objeto contendo os detalhes simplificados do proxy.
 */
export async function getApiProxy(api: AxwayApi, id: string) {
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
  } catch (error) {
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
export async function createApiProxy(api: AxwayApi, name: string, path: string, apiId: string, organizationId: string) {
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
  } catch (error) {
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
export async function updateApiProxy(api: AxwayApi, id: string, name?: string, path?: string, apiId?: string) {
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
  } catch (error) {
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
export async function deleteApiProxy(api: AxwayApi, id: string) {
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
  } catch (error) {
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
export async function publishApi(api: AxwayApi, id: string) {
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
  } catch (error) {
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
export async function unpublishApi(api: AxwayApi, id: string) {
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
  } catch (error) {
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
export async function deprecateApi(api: AxwayApi, id: string) {
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
  } catch (error) {
    console.error(`Erro ao marcar o proxy de API como obsoleto ${id}:`, error);
    throw error;
  }
} 