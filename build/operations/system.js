/**
 * @module src/operations/system
 * @description Este módulo contém operações (ferramentas) que fornecem informações
 * sobre o próprio sistema MCP, em vez de interagir com o ambiente Axway.
 */
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
//# sourceMappingURL=system.js.map