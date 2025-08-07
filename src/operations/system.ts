/**
 * @module src/operations/system
 * @description Este módulo contém operações (ferramentas) que fornecem informações
 * sobre o próprio sistema MCP, em vez de interagir com o ambiente Axway.
 */

import { AxwayApi } from '../api.js';

/**
 * Ferramenta para obter o timestamp e o fuso horário atuais do servidor onde o MCP está sendo executado.
 * Útil para verificar a sanidade do sistema e para obter uma referência de tempo confiável.
 *
 * @returns Um objeto contendo a data e hora em diferentes formatos e o fuso horário IANA.
 */
export async function getMcpServerTime() {
  const now = new Date();
  
  // Intl.DateTimeFormat é usado para obter o nome do fuso horário IANA (ex: 'America/Sao_Paulo').
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return {
    iso_utc: now.toISOString(),
    human_readable_local: now.toLocaleString(),
    timezone: timeZone,
    note: "Esta é a hora atual do servidor onde o MCP (Model-Context-Protocol) está em execução."
  };
}

/**
 * Obtém a configuração do API Manager.
 * Esta ferramenta acessa o endpoint `/config` do API Manager para recuperar
 * informações sobre a configuração do sistema, incluindo políticas globais,
 * configurações de segurança, limites de sessão, etc.
 *
 * @returns Promise<any> - A configuração completa do API Manager
 */
export async function getManagerConfig() {
  const api = new AxwayApi();
  const config = await api.getManagerConfig();
  
  return {
    message: "Configuração do API Manager recuperada com sucesso",
    configuration: config,
    curlExample: `curl '${process.env.AXWAY_MANAGER_URL}/config?request.preventCache=${Date.now()}' \\
  --compressed \\
  -H 'Accept: application/json' \\
  -H 'X-Requested-With: XMLHttpRequest' \\
  -H 'Authorization: Basic ${Buffer.from(`${process.env.AXWAY_MANAGER_USERNAME}:${process.env.AXWAY_MANAGER_PASSWORD}`).toString('base64')}'`,
    note: "Esta configuração inclui políticas globais, configurações de segurança, limites de sessão e outras configurações do sistema."
  };
} 