/**
 * @module src/operations/metrics
 * @description Este módulo contém a operação (ferramenta) para obter relatórios de métricas
 * do Axway API Manager, permitindo a análise de uso de APIs e aplicações.
 */
/**
 * Transforma os dados brutos de métricas da API em um formato mais limpo e estruturado.
 * @param data O array de dados de métricas bruto retornado pela API.
 * @returns Um array de objetos de métrica formatados.
 * @internal
 */
function transformMetrics(data) {
    if (!Array.isArray(data)) {
        console.warn("A função transformMetrics esperava um array, mas recebeu:", typeof data);
        return [];
    }
    return data.map(item => ({
        name: item.name || 'N/A',
        successes: item.successes || 0,
        failures: item.failures || 0,
        exceptions: item.exceptions || 0,
        numMessages: item.numMessages || 0,
        avgProcTime: item.avgProcTime || 0,
    }));
}
/**
 * Ferramenta para obter um relatório de resumo para métricas de aplicação ou API.
 *
 * @param api Instância da classe AxwayApi.
 * @param params Um objeto contendo os parâmetros para a consulta de métricas.
 * @param params.type O tipo de relatório, 'app' para aplicações ou 'api' para APIs.
 * @param params.level O nível de detalhe do relatório (0 ou 1 para drill-through).
 * @param params.from A data/hora de início para o relatório (formato ISO-8601).
 * @param params.to A data/hora de término para o relatório (formato ISO-8601).
 * @param params.client (Opcional) Array de IDs de cliente para filtrar.
 * @param params.service (Opcional) Array de nomes de serviço para filtrar.
 * @param params.method (Opcional) Nome de um método específico para filtrar.
 * @param params.organization (Opcional) Nome ou ID de uma organização para filtrar.
 * @param params.reportsubtype (Opcional) Subtipo do relatório, como 'trafficAll'.
 * @returns Um objeto contendo a lista de métricas formatadas e ferramentas relacionadas.
 */
export async function getMetrics(api, params) {
    const rawMetrics = await api.getMetrics(params);
    const transformedMetrics = transformMetrics(rawMetrics);
    // Extrai nomes de apps ou APIs para usar nas ferramentas relacionadas
    const clientNames = transformedMetrics.map(m => m.name).filter(name => name !== 'N/A');
    return {
        metrics: transformedMetrics,
        message: `Relatório de métricas gerado com ${transformedMetrics.length} resultados.`,
        relatedTools: [
            {
                tool_name: "list_alerts",
                description: "Verificar se há alertas de sistema que possam estar relacionados a falhas ou exceções vistas nas métricas.",
                parameters: []
            },
            ...clientNames.map(name => ({
                tool_name: "get_application_quotas",
                description: `Verificar as cotas da aplicação '${name}' (se for uma aplicação).`,
                parameters: [{ name: "applicationId", value: name }] // Assumindo que o nome pode ser usado como ID ou que o usuário o substituirá
            }))
        ]
    };
}
//# sourceMappingURL=metrics.js.map