/**
 * @module src/operations/users
 * @description Este módulo contém as operações (ferramentas) para o gerenciamento
 * completo (CRUD) de Usuários no Axway API Manager.
 */

import { AxwayApi } from "../api.js";
import { removeEmptyValues } from "../utils.js";

/**
 * Transforma o objeto de usuário bruto da API em um formato mais limpo e consistente.
 * @param user O objeto de usuário bruto.
 * @returns Um objeto de usuário formatado.
 * @internal
 */
function transformUser(user: any) {
  return {
    userId: user.id,
    name: user.name,
    loginName: user.loginName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isEnabled: user.enabled,
    organizationId: user.organizationId,
    metadata: {
      createdAt: new Date(user.createdOn).toISOString(),
    }
  };
}

/**
 * Ferramenta para listar todos os usuários.
 * @param api Instância da classe AxwayApi.
 * @returns Um objeto contendo a lista de usuários.
 */
export async function listUsers(api: AxwayApi) {
  try {
    const rawUsers = await api.listUsers();
    if (!Array.isArray(rawUsers)) {
      throw new Error("A resposta da API para listar usuários não era um array como esperado.");
    }
    const users = rawUsers.map(transformUser);
    return {
      count: users.length,
      users: users,
      message: `Encontrados ${users.length} usuários.`,
      relatedTools: [
        ...users.map((user: any) => ({
          tool_name: 'get_user',
          description: `Obter detalhes do usuário '${user.name}'.`,
          parameters: [{ name: 'id', value: user.userId }]
        })),
        {
          tool_name: 'create_user',
          description: 'Criar um novo usuário.',
          parameters: []
        }
      ]
    };
  } catch (error) {
    console.error(`Erro ao listar usuários:`, error);
    throw error;
  }
}

/**
 * Ferramenta para obter os detalhes de um usuário específico pelo seu ID.
 * @param api Instância da classe AxwayApi.
 * @param id O ID do usuário a ser recuperado.
 * @returns Um objeto contendo os detalhes do usuário.
 */
export async function getUser(api: AxwayApi, id: string) {
  try {
    const rawUser = await api.getUser(id);
    const user = transformUser(rawUser);
    return {
      user: user,
      relatedTools: [
        {
          tool_name: 'update_user',
          description: `Atualizar os detalhes do usuário '${user.name}'.`,
          parameters: [{ name: 'id', value: id }]
        },
        {
          tool_name: 'delete_user',
          description: `Deletar o usuário '${user.name}'.`,
          parameters: [{ name: 'id', value: id }]
        },
        {
          tool_name: 'get_organization',
          description: `Ver detalhes da organização (ID: ${user.organizationId}) à qual este usuário pertence.`,
          parameters: [{ name: 'id', value: user.organizationId }]
        }
      ]
    };
  } catch (error) {
    console.error(`Erro ao obter o usuário ${id}:`, error);
    throw error;
  }
}

/**
 * Ferramenta para criar um novo usuário.
 * @param api Instância da classe AxwayApi.
 * @param organizationId O ID da organização à qual o usuário pertencerá.
 * @param name O nome completo do usuário.
 * @param loginName O nome de login para o usuário.
 * @param role O papel do usuário (ex: 'user' ou 'admin').
 * @param email (Opcional) O e-mail de contato do usuário.
 * @param phone (Opcional) O telefone de contato do usuário.
 * @returns Um objeto de confirmação com os detalhes do usuário criado.
 */
export async function createUser(api: AxwayApi, organizationId: string, name: string, loginName: string, role: 'user' | 'admin', email?: string, phone?: string) {
  try {
    const newUser = await api.createUser({ organizationId, name, loginName, role, email, phone });
    return {
      message: `Usuário '${newUser.loginName}' criado com sucesso.`,
      user: transformUser(newUser),
      relatedTools: [
        {
          tool_name: 'list_users',
          description: 'Ver todos os usuários, incluindo o recém-criado.',
          parameters: []
        },
        {
          tool_name: 'get_user',
          description: `Ver os detalhes completos do usuário '${newUser.loginName}'.`,
          parameters: [{ name: 'id', value: newUser.id }]
        }
      ]
    };
  } catch (error) {
    console.error(`Erro ao criar o usuário:`, error);
    throw error;
  }
}

/**
 * Ferramenta para atualizar um usuário existente. Apenas os campos fornecidos serão alterados.
 * @param api Instância da classe AxwayApi.
 * @param id O ID do usuário a ser atualizado.
 * @param name (Opcional) O novo nome completo.
 * @param loginName (Opcional) O novo nome de login.
 * @param email (Opcional) O novo e-mail.
 * @param phone (Opcional) O novo telefone.
 * @param role (Opcional) O novo papel ('user' ou 'admin').
 * @param enabled (Opcional) O novo estado de habilitação.
 * @param organizationId (Opcional) O novo ID da organização.
 * @returns Um objeto de confirmação com os detalhes do usuário atualizado.
 */
export async function updateUser(api: AxwayApi, id: string, name?: string, loginName?: string, email?: string, phone?: string, role?: 'user' | 'admin', enabled?: boolean, organizationId?: string) {
  try {
    const payload = removeEmptyValues({ name, loginName, email, phone, role, enabled, organizationId });
    if (Object.keys(payload).length === 0) {
      return { message: "Nenhum campo fornecido para atualização. Nenhuma ação foi tomada." };
    }
    const updatedUser = await api.updateUser(id, payload);
    return {
      message: `Usuário '${updatedUser.loginName}' atualizado com sucesso.`,
      user: transformUser(updatedUser),
      relatedTools: [
        {
          tool_name: 'get_user',
          description: 'Ver os detalhes atualizados do usuário.',
          parameters: [{ name: 'id', value: id }]
        }
      ]
    };
  } catch (error) {
    console.error(`Erro ao atualizar o usuário ${id}:`, error);
    throw error;
  }
}

/**
 * Ferramenta para deletar um usuário pelo seu ID.
 * @param api Instância da classe AxwayApi.
 * @param id O ID do usuário a ser deletado.
 * @returns Um objeto de confirmação da exclusão.
 */
export async function deleteUser(api: AxwayApi, id: string) {
  try {
    await api.deleteUser(id);
    return {
      message: `Usuário com ID '${id}' foi deletado com sucesso.`,
      relatedTools: [
        {
          tool_name: 'list_users',
          description: 'Listar os usuários restantes para confirmar a exclusão.',
          parameters: []
        }
      ]
    };
  } catch (error) {
    console.error(`Erro ao deletar o usuário ${id}:`, error);
    throw error;
  }
}
