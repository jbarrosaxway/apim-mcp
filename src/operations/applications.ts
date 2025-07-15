/**
 * @module src/operations/applications
 * @description Este módulo contém as operações (ferramentas) para gerenciar Aplicações no Axway API Manager.
 * Inclui funcionalidades para listar e obter detalhes de aplicações, bem como gerenciar
 * suas credenciais, como API Keys e clientes OAuth.
 */

import { AxwayApi } from "../api.js";

/**
 * Transforma o objeto de aplicação bruto da API em um formato mais limpo e consistente.
 * @param app O objeto de aplicação bruto.
 * @returns Um objeto de aplicação formatado.
 * @internal
 */
function transformApplication(app: any) {
  return {
    applicationId: app.id,
    name: app.name,
    description: app.description,
    isEnabled: app.enabled,
    organizationId: app.organizationId,
    metadata: {
      createdAt: new Date(app.createdOn).toISOString(),
    }
  };
}

/**
 * Transforma o objeto de API Key bruto da API em um formato mais limpo.
 * @param key O objeto de API Key bruto.
 * @returns Um objeto de API Key formatado.
 * @internal
 */
function transformApiKey(key: any) {
  return {
    apiKeyId: key.id,
    apiKey: key.apiKey,
    secret: key.secret,
    isEnabled: key.enabled,
    isCorsEnabled: key.cors,
    metadata: {
      createdAt: new Date(key.createdOn).toISOString(),
    }
  };
}

/**
 * Transforma o objeto de credencial OAuth bruto da API em um formato mais limpo.
 * @param cred O objeto de credencial OAuth bruto.
 * @returns Um objeto de credencial OAuth formatado.
 * @internal
 */
function transformOAuthCredential(cred: any) {
  return {
    credentialId: cred.id,
    clientId: cred.id, // In Axway, client_id is the same as the credential ID
    secret: cred.secret,
    type: cred.type,
    isEnabled: cred.enabled,
    redirectUrls: cred.redirectURIs || [],
    certificate: cred.cert,
    metadata: {
      createdAt: new Date(cred.createdOn).toISOString(),
    }
  };
}

/**
 * Transforma o objeto de permissão bruto da API em um formato mais limpo.
 * @param perm O objeto de permissão bruto.
 * @returns Um objeto de permissão formatado.
 * @internal
 */
function transformPermission(perm: any) {
  return {
    permissionId: perm.id,
    apiId: perm.apiId,
    isEnabled: perm.enabled,
    // Note: Further details about the API require a separate call
  };
}

/**
 * Ferramenta para listar todas as aplicações visíveis para o usuário autenticado.
 * @param api Instância da classe AxwayApi.
 * @returns Um objeto contendo a lista de aplicações formatadas.
 */
export async function listApplications(api: AxwayApi) {
  try {
    const rawApps = await api.listApplications();
    const applications = rawApps.map(transformApplication);
    return {
      count: applications.length,
      applications: applications,
      message: `Found ${applications.length} applications.`,
      relatedTools: [
        ...applications.map((app: any) => ({
          tool_name: 'get_application',
          description: `Obter detalhes da aplicação '${app.name}'.`,
          parameters: [{ name: 'id', value: app.applicationId }]
        })),
        {
          tool_name: 'list_organizations',
          description: 'Listar organizações para entender a qual organização cada aplicação pertence.',
          parameters: []
        }
      ]
    };
  } catch (error) {
    console.error(`Erro ao listar aplicações:`, error);
    throw error;
  }
}

/**
 * Ferramenta para obter os detalhes de uma aplicação específica pelo seu ID.
 * @param api Instância da classe AxwayApi.
 * @param id O ID da aplicação a ser recuperada.
 * @returns Um objeto contendo os detalhes da aplicação.
 */
export async function getApplication(api: AxwayApi, id: string) {
  try {
    const rawApp = await api.getApplication(id);
    const application = transformApplication(rawApp);
    return {
      application: application,
      relatedTools: [
        {
          tool_name: 'get_api_keys_for_application',
          description: `Gerenciar as API Keys da aplicação '${application.name}'.`,
          parameters: [{ name: 'id', value: id }]
        },
        {
          tool_name: 'get_oauth_credentials_for_application',
          description: `Gerenciar os clientes OAuth da aplicação '${application.name}'.`,
          parameters: [{ name: 'id', value: id }]
        },
        {
          tool_name: 'list_api_access',
          description: `Ver a quais APIs a aplicação '${application.name}' tem acesso.`,
          parameters: [{ name: 'applicationId', value: id }]
        }
      ]
    };
  } catch (error) {
    console.error(`Erro ao obter a aplicação ${id}:`, error);
    throw error;
  }
}

/**
 * Ferramenta para obter as API Keys associadas a uma aplicação específica.
 * @param api Instância da classe AxwayApi.
 * @param id O ID da aplicação.
 * @returns Um objeto contendo a lista de API Keys da aplicação.
 */
export async function getApiKeysForApplication(api: AxwayApi, id: string) {
  try {
    const rawKeys = await api.getApiKeysForApplication(id);
    const apiKeys = rawKeys.map(transformApiKey);
    return {
      applicationId: id,
      count: apiKeys.length,
      apiKeys: apiKeys,
      message: `A aplicação ${id} tem ${apiKeys.length} API Keys.`,
      relatedTools: [
        {
          tool_name: 'create_api_key',
          description: `Criar uma nova API Key para a aplicação ${id}.`,
          parameters: [
            { name: 'appId', value: id },
            { name: 'enabled', value: 'true' }
          ]
        }
      ]
    };
  } catch (error) {
    console.error(`Erro ao obter as API Keys para a aplicação ${id}:`, error);
    throw error;
  }
}

/**
 * Ferramenta para criar uma nova API Key para uma aplicação específica.
 * @param api Instância da classe AxwayApi.
 * @param appId O ID da aplicação para a qual a chave será criada.
 * @param enabled (Opcional) Define se a chave deve ser criada como habilitada. Padrão: `true`.
 * @param secret (Opcional) Um segredo customizado para a API Key. Se não for fornecido, um será gerado.
 * @returns Um objeto contendo a nova API Key criada.
 */
export async function createApiKey(api: AxwayApi, appId: string, enabled: boolean = true, secret?: string) {
  try {
    const newKey = await api.createApiKey(appId, { enabled, secret });
    return {
      message: "API Key criada com sucesso.",
      apiKey: transformApiKey(newKey),
      relatedTools: [
        {
          tool_name: 'get_api_keys_for_application',
          description: `Ver todas as API Keys para a aplicação ${appId}.`,
          parameters: [{ name: 'id', value: appId }]
        }
      ]
    };
  } catch (error) {
    console.error(`Erro ao criar API Key para a aplicação ${appId}:`, error);
    throw error;
  }
}

/**
 * Ferramenta para obter as credenciais OAuth (clientes) associadas a uma aplicação.
 * @param api Instância da classe AxwayApi.
 * @param id O ID da aplicação.
 * @returns Um objeto contendo a lista de credenciais OAuth da aplicação.
 */
export async function getOAuthCredentialsForApplication(api: AxwayApi, id: string) {
  try {
    const rawCreds = await api.getOAuthCredentialsForApplication(id);
    const oauthCredentials = rawCreds.map(transformOAuthCredential);
    return {
      applicationId: id,
      count: oauthCredentials.length,
      oauthCredentials: oauthCredentials,
      message: `A aplicação ${id} tem ${oauthCredentials.length} credenciais OAuth.`,
      relatedTools: [
        {
          tool_name: 'create_oauth_credential',
          description: `Criar uma nova credencial OAuth para a aplicação ${id}.`,
          parameters: [{ name: 'appId', value: id }]
        }
      ]
    };
  } catch (error) {
    console.error(`Erro ao obter as credenciais OAuth para a aplicação ${id}:`, error);
    throw error;
  }
}

/**
 * Ferramenta para criar uma nova credencial OAuth (cliente) para uma aplicação.
 * @param api Instância da classe AxwayApi.
 * @param appId O ID da aplicação para a qual a credencial será criada.
 * @param redirectURIs (Opcional) Uma lista de URIs de redirecionamento separadas por vírgula.
 * @param cert (Opcional) O certificado público (em formato PEM) a ser associado ao cliente.
 * @returns Um objeto contendo a nova credencial OAuth criada.
 */
export async function createOAuthCredential(api: AxwayApi, appId: string, redirectURIs?: string, cert?: string) {
  try {
    const newCred = await api.createOAuthCredential(appId, { redirectURIs, cert });
    return {
      message: "Credencial OAuth criada com sucesso.",
      oauthCredential: transformOAuthCredential(newCred),
      relatedTools: [
        {
          tool_name: 'get_oauth_credentials_for_application',
          description: `Ver todas as credenciais para a aplicação ${appId}.`,
          parameters: [{ name: 'id', value: appId }]
        }
      ]
    };
  } catch (error) {
    console.error(`Erro ao criar a credencial OAuth para a aplicação ${appId}:`, error);
    throw error;
  }
}

/**
 * Ferramenta para obter a lista de permissões (ACL) para uma aplicação específica.
 * Esta função é principalmente para depuração, pois `listApiAccess` é mais útil.
 * @param api Instância da classe AxwayApi.
 * @param id O ID da aplicação.
 * @returns Um objeto contendo a lista de permissões da aplicação.
 */
export async function getPermissionsForApplication(api: AxwayApi, id:string) {
  try {
    const rawPerms = await api.getPermissionsForApplication(id);
    const permissions = rawPerms.map(transformPermission);
    return {
      applicationId: id,
      permissions: permissions,
      message: `Encontradas ${permissions.length} regras de permissão para a aplicação ${id}.`,
      relatedTools: [
        {
          tool_name: 'list_api_access',
          description: 'Obter detalhes completos sobre as APIs que esta aplicação pode acessar.',
          parameters: [{ name: 'applicationId', value: id }]
        },
        {
          tool_name: 'grant_api_access',
          description: 'Gerenciar permissões concedendo acesso a uma API.',
          parameters: [{ name: 'applicationId', value: id }]
        }
      ]
    };
  } catch (error) {
    console.error(`Erro ao obter as permissões para a aplicação ${id}:`, error);
    throw error;
  }
}
