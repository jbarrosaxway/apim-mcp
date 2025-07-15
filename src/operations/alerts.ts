/**
 * @module src/operations/alerts
 * @description Este módulo contém as operações (ferramentas) para gerenciar as configurações
 * de alertas no Axway API Gateway. Permite listar e atualizar quais tipos de eventos
 * devem gerar um alerta.
 */

import { AxwayApi } from "../api.js";

/**
 * Ferramenta para listar a configuração de todos os gatilhos de alerta.
 *
 * Esta função não lista os alertas que já ocorreram, mas sim a configuração que
 * define se um tipo de evento (ex: 'CircuitBreakerHalfOpen') está habilitado
 * para gerar um alerta ou não.
 *
 * @param api Instância da classe AxwayApi.
 * @returns Um objeto contendo a lista de configurações de alerta e um resumo explicativo.
 */
export async function listAlerts(api: AxwayApi) {
  try {
    const alertSettings = await api.listAlerts();
    const formattedSettings = Object.entries(alertSettings).map(([key, value]) => {
      return {
        event: key,
        isEnabled: value
      };
    });

    return {
      alertConfiguration: formattedSettings,
      summary: "Esta ferramenta lista a configuração que define quais eventos irão disparar um alerta. Ela não lista os alertas já disparados.",
      relatedTools: [
        {
          tool_name: 'update_alert_settings',
          description: 'Habilitar ou desabilitar um ou mais gatilhos de alerta.',
          parameters: [
            { name: 'settings', value: '{"ServiceBody": true, "CertAboutToExpire": false}' }
          ]
        }
      ]
    };
  } catch (error) {
    console.error(`Erro ao listar as configurações de alerta:`, error);
    throw error;
  }
}

/**
 * Ferramenta para atualizar a configuração dos gatilhos de alerta.
 *
 * @param api Instância da classe AxwayApi.
 * @param settings Um objeto JSON onde cada chave é o nome de um evento de alerta
 *                 e o valor é um booleano (`true` para habilitar, `false` para desabilitar).
 *                 Exemplo: `{"ServiceBody": true, "CertAboutToExpire": false}`
 * @returns Um objeto confirmando a atualização e mostrando a nova configuração.
 */
export async function updateAlertSettings(api: AxwayApi, settings: any) {
  try {
    const updatedSettings = await api.updateAlertSettings(settings);
    const formattedSettings = Object.entries(updatedSettings).map(([key, value]) => {
      return {
        event: key,
        isEnabled: value
      };
    });
    return {
      message: "Configurações de alerta atualizadas com sucesso.",
      alertConfiguration: formattedSettings,
      relatedTools: [
        {
          tool_name: 'list_alerts',
          description: 'Verificar a configuração atualizada de todos os alertas.',
          parameters: []
        }
      ]
    };
  } catch (error) {
    console.error(`Erro ao atualizar as configurações de alerta:`, error);
    throw error;
  }
} 