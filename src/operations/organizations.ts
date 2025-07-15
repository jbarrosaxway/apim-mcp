/**
 * @module src/operations/organizations
 * @description Este módulo contém as operações (ferramentas) para o gerenciamento
 * completo (CRUD) de Organizações no Axway API Manager.
 */

import { AxwayApi } from "../api.js";
import { removeEmptyValues } from "../utils.js";

/**
 * Transforma o objeto de organização bruto da API em um formato mais limpo e consistente.
 * @param org O objeto de organização bruto.
 * @returns Um objeto de organização formatado.
 * @internal
 */
function transformOrganization(org: any) {
  return {
    organizationId: org.id,
    name: org.name,
    description: org.description,
    email: org.email,
    phone: org.phone,
    isEnabled: org.enabled,
    isDevelopment: org.development,
    metadata: {
      createdAt: new Date(org.createdOn).toISOString(),
    }
  };
}

/**
 * Ferramenta para listar todas as organizações no API Manager.
 * @param api Instância da classe AxwayApi.
 * @returns Um objeto contendo a lista de organizações.
 */
export async function listOrganizations(api: AxwayApi) {
  try {
    const rawOrgs = await api.listOrganizations();
    const organizations = rawOrgs.map(transformOrganization);
    return {
      count: organizations.length,
      organizations: organizations,
      message: `Encontradas ${organizations.length} organizações.`,
      relatedTools: [
        ...organizations.map((org: any) => ({
          tool_name: 'get_organization',
          description: `Obter detalhes da organização '${org.name}'.`,
          parameters: [{ name: 'id', value: org.organizationId }]
        })),
        {
          tool_name: 'create_organization',
          description: 'Criar uma nova organização.',
          parameters: [{ name: 'name', value: 'Nova Organização' }]
        }
      ]
    };
  } catch (error) {
    console.error(`Erro ao listar organizações:`, error);
    throw error;
  }
}

/**
 * Ferramenta para obter os detalhes de uma organização específica pelo seu ID.
 * @param api Instância da classe AxwayApi.
 * @param id O ID da organização a ser recuperada.
 * @returns Um objeto contendo os detalhes da organização.
 */
export async function getOrganization(api: AxwayApi, id: string) {
  try {
    const rawOrg = await api.getOrganization(id);
    const organization = transformOrganization(rawOrg);
    return {
      organization: organization,
      relatedTools: [
        {
          tool_name: 'update_organization',
          description: `Atualizar a organização '${organization.name}'.`,
          parameters: [{ name: 'id', value: id }]
        },
        {
          tool_name: 'list_users',
          description: 'Listar todos os usuários para encontrar aqueles que pertencem a esta organização.',
          parameters: []
        },
        {
          tool_name: 'delete_organization',
          description: `Deletar a organização '${organization.name}'.`,
          parameters: [{ name: 'id', value: id }]
        }
      ]
    };
  } catch (error) {
    console.error(`Erro ao obter a organização ${id}:`, error);
    throw error;
  }
}

/**
 * Ferramenta para criar uma nova organização.
 * @param api Instância da classe AxwayApi.
 * @param name O nome da nova organização.
 * @param description (Opcional) Uma descrição para a organização.
 * @param email (Opcional) O e-mail de contato da organização.
 * @param phone (Opcional) O telefone de contato da organização.
 * @param enabled (Opcional) Define se a organização deve ser criada como habilitada. Padrão: true.
 * @returns Um objeto de confirmação com os detalhes da organização criada.
 */
export async function createOrganization(api: AxwayApi, name: string, description?: string, email?: string, phone?: string, enabled: boolean = true) {
  try {
    const newOrg = await api.createOrganization({ name, description, email, phone, enabled });
    return {
      message: `Organização '${newOrg.name}' criada com sucesso.`,
      organization: transformOrganization(newOrg),
      relatedTools: [
        {
          tool_name: 'list_organizations',
          description: 'Ver todas as organizações, incluindo a recém-criada.',
          parameters: []
        },
        {
          tool_name: 'get_organization',
          description: `Ver os detalhes completos da organização '${newOrg.name}'.`,
          parameters: [{ name: 'id', value: newOrg.id }]
        }
      ]
    };
  } catch (error) {
    console.error(`Erro ao criar a organização:`, error);
    throw error;
  }
}

/**
 * Ferramenta para atualizar uma organização existente.
 * Apenas os campos fornecidos serão atualizados.
 * @param api Instância da classe AxwayApi.
 * @param id O ID da organização a ser atualizada.
 * @param name (Opcional) O novo nome para a organização.
 * @param description (Opcional) A nova descrição para a organização.
 * @param email (Opcional) O novo e-mail de contato.
 * @param phone (Opcional) O novo telefone de contato.
 * @param enabled (Opcional) O novo estado de habilitação da organização.
 * @returns Um objeto de confirmação com os detalhes da organização atualizada.
 */
export async function updateOrganization(api: AxwayApi, id: string, name?: string, description?: string, email?: string, phone?: string, enabled?: boolean) {
  try {
    const payload = removeEmptyValues({ name, description, email, phone, enabled });
    if (Object.keys(payload).length === 0) {
      return { message: "Nenhum campo fornecido para atualização. Nenhuma ação foi tomada." };
    }
    const updatedOrg = await api.updateOrganization(id, payload);
    return {
      message: `Organização '${updatedOrg.name}' atualizada com sucesso.`,
      organization: transformOrganization(updatedOrg),
      relatedTools: [
        {
          tool_name: 'get_organization',
          description: 'Ver os detalhes atualizados da organização.',
          parameters: [{ name: 'id', value: id }]
        }
      ]
    };
  } catch (error) {
    console.error(`Erro ao atualizar a organização ${id}:`, error);
    throw error;
  }
}

/**
 * Ferramenta para deletar uma organização.
 * @param api Instância da classe AxwayApi.
 * @param id O ID da organização a ser deletada.
 * @returns Um objeto de confirmação da exclusão.
 */
export async function deleteOrganization(api: AxwayApi, id: string) {
  try {
    await api.deleteOrganization(id);
    return {
      message: `A organização com ID '${id}' foi deletada com sucesso.`,
      relatedTools: [
        {
          tool_name: 'list_organizations',
          description: 'Listar as organizações restantes para confirmar a exclusão.',
          parameters: []
        }
      ]
    };
  } catch (error) {
    console.error(`Erro ao deletar a organização ${id}:`, error);
    throw error;
  }
}
