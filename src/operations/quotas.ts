/**
 * @module src/operations/quotas
 * @description Este módulo contém as operações (ferramentas) para gerenciar as
 * cotas de uso de API para aplicações no Axway API Manager.
 */

import { AxwayApi } from "../api.js";

/**
 * Transforma o objeto de cota bruto da API em um formato mais limpo e legível.
 * @param quota O objeto de cota bruto.
 * @returns Um objeto de cota formatado com suas restrições.
 * @internal
 */
function transformQuota(quota: any) {
  // O objeto de cota pode ser complexo, simplificamos para o essencial
  const restrictions = quota.restrictions?.map((r: any) => ({
    apiId: r.api,
    method: r.method,
    type: r.type, // e.g., 'messages', 'mb'
    config: {
      period: r.config.period,
      per: r.config.per,
      wait: r.config.wait
    }
  }));

  return {
    quotaId: quota.id,
    type: quota.type, // e.g., 'APPLICATION' or 'SYSTEM'
    name: quota.name,
    description: quota.description,
    isSystemQuota: quota.system,
    restrictions: restrictions || []
  };
}

/**
 * Ferramenta para obter a cota efetiva (de sistema ou customizada) para uma aplicação específica.
 * @param api Instância da classe AxwayApi.
 * @param applicationId O ID da aplicação para a qual a cota será recuperada.
 * @returns Um objeto contendo os detalhes da cota da aplicação.
 */
export async function getApplicationQuotas(api: AxwayApi, applicationId: string) {
  try {
    const rawQuota = await api.getApplicationQuotas(applicationId);
    return {
      applicationId: applicationId,
      quota: transformQuota(rawQuota),
      relatedTools: [
        {
          tool_name: 'update_application_quotas',
          description: `Modificar as cotas para a aplicação ${applicationId}.`,
          parameters: [
            { name: 'applicationId', value: applicationId },
            { name: 'messages_per_second', value: '10' }
          ]
        },
        {
          tool_name: 'list_applications',
          description: 'Listar outras aplicações para verificar suas cotas.',
          parameters: []
        }
      ]
    };
  } catch (error) {
    console.error(`Erro ao obter as cotas para a aplicação ${applicationId}:`, error);
    throw error;
  }
}

/**
 * Ferramenta para atualizar a cota de uma aplicação para um número específico de mensagens por segundo.
 *
 * Esta é uma ferramenta simplificada que cria uma única restrição para todas as APIs (`*`)
 * e todos os métodos (`*`) com o limite fornecido.
 *
 * @param api Instância da classe AxwayApi.
 * @param applicationId O ID da aplicação para a qual a cota será atualizada.
 * @param messages_per_second O número máximo de mensagens (requisições) por segundo.
 * @returns Um objeto de confirmação da operação.
 */
export async function updateApplicationQuotas(api: AxwayApi, applicationId: string, messages_per_second: number) {
  try {
    const quotaData = {
      restrictions: [
        {
          api: "*",
          method: "*",
          type: "messages",
          config: {
            period: "second",
            per: messages_per_second,
            wait: true
          }
        }
      ]
    };
    await api.updateApplicationQuotas(applicationId, { restrictions: [quotaData.restrictions[0]] }); // A API espera um objeto com a propriedade 'restrictions'
    return {
      message: `Cotas para a aplicação ${applicationId} atualizadas com sucesso para ${messages_per_second} mensagens/segundo.`,
      relatedTools: [
        {
          tool_name: 'get_application_quotas',
          description: `Verificar as alterações na cota da aplicação ${applicationId}.`,
          parameters: [{ name: 'applicationId', value: applicationId }]
        }
      ]
    };
  } catch (error: any) {
    console.error(`Erro ao atualizar as cotas para a aplicação ${applicationId}:`, error);
    throw error;
  }
} 