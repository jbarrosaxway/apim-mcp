/**
 * @module src/operations/monitoring
 * @description Este módulo contém as operações (ferramentas) para monitoramento de tráfego
 * no Axway API Gateway. Permite obter métricas de tráfego, pesquisar transações
 * e inspecionar detalhes de eventos específicos, como payloads e traces.
 */
/**
 * Ferramenta para obter um resumo das métricas de tráfego para uma instância específica do API Gateway.
 * @param api Instância da classe AxwayApi.
 * @param instanceId O ID da instância do API Gateway (ex: 'instance-1').
 * @returns Um objeto com o resumo do tráfego para a instância.
 */
export async function getInstanceTraffic(api, instanceId) {
    try {
        const rawTraffic = await api.getInstanceTraffic(instanceId);
        const summary = rawTraffic.summary?.[0] || {};
        return {
            instanceId: instanceId,
            trafficSummary: {
                successes: summary.numSuccess || 0,
                failures: summary.numFailure || 0,
                exceptions: summary.numException || 0,
                averageProcessingTimeMs: summary.avgProcTime || 0,
                minProcessingTimeMs: summary.minProcTime || 0,
                maxProcessingTimeMs: summary.maxProcTime || 0,
                averageBytesSent: summary.avgBytesSent || 0,
                averageBytesReceived: summary.avgBytesRecv || 0
            },
            message: `Resumo do tráfego para a instância ${instanceId} recuperado.`,
            relatedTools: [
                {
                    tool_name: 'get_service_traffic',
                    description: `Obter um detalhamento do tráfego por serviço nesta instância (${instanceId}).`,
                    parameters: [{ name: 'instanceId', value: instanceId }]
                },
                {
                    tool_name: 'list_topology',
                    description: 'Listar a topologia para encontrar outros IDs de instância.',
                    parameters: []
                }
            ]
        };
    }
    catch (error) {
        console.error(`Erro ao obter o tráfego para a instância ${instanceId}:`, error);
        throw error;
    }
}
/**
 * Ferramenta para obter métricas de tráfego para um serviço específico em uma instância do API Gateway.
 * @param api Instância da classe AxwayApi.
 * @param instanceId O ID da instância onde o serviço está sendo executado.
 * @param serviceName O nome exato do serviço (ex: 'Default Services').
 * @returns Um objeto com os detalhes do tráfego para o serviço especificado.
 */
export async function getServiceTraffic(api, instanceId, serviceName) {
    try {
        const rawTraffic = await api.getServiceTraffic(instanceId, serviceName);
        const serviceTraffic = rawTraffic.service?.[0] || {};
        const summary = serviceTraffic.summary || {};
        return {
            instanceId: instanceId,
            serviceName: serviceTraffic.name || serviceName,
            trafficDetails: {
                successes: summary.numSuccess || 0,
                failures: summary.numFailure || 0,
                exceptions: summary.numException || 0,
                averageProcessingTimeMs: summary.avgProcTime || 0,
                minProcessingTimeMs: summary.minProcTime || 0,
                maxProcessingTimeMs: summary.maxProcTime || 0,
                averageBytesSent: summary.avgBytesSent || 0,
                averageBytesReceived: summary.avgBytesRecv || 0
            },
            message: `Resumo do tráfego para o serviço '${serviceName}' na instância ${instanceId} recuperado.`,
            relatedTools: [
                {
                    tool_name: 'get_instance_traffic',
                    description: `Ver o tráfego agregado para a instância inteira (${instanceId}).`,
                    parameters: [{ name: 'instanceId', value: instanceId }]
                },
                {
                    tool_name: 'list_topology',
                    description: 'Descobrir outros serviços e instâncias na topologia.',
                    parameters: []
                }
            ]
        };
    }
    catch (error) {
        console.error(`Error getting traffic for service ${serviceName} on instance ${instanceId}:`, error);
        throw error;
    }
}
/**
 * Ferramenta para obter uma linha do tempo de métricas para uma instância específica do API Gateway.
 * Útil para visualizar tendências ao longo do tempo.
 * @param api Instância da classe AxwayApi.
 * @param instanceId O ID da instância.
 * @param timeline O intervalo de tempo para a consulta (ex: '10m', '1h', '24h').
 * @param metricTypes Um array dos tipos de métrica a serem incluídos (ex: ['successes', 'failures']).
 * @returns Um objeto contendo os dados da linha do tempo formatados.
 */
export async function getInstanceMetricsTimeline(api, instanceId, timeline, metricTypes) {
    try {
        const rawResult = await api.getInstanceMetricsTimeline(instanceId, timeline, metricTypes);
        const result = rawResult.result || {};
        const series = result.series || [];
        const formattedMetrics = {};
        series.forEach((s) => {
            if (s.name && s.data) {
                formattedMetrics[s.name] = s.data;
            }
        });
        const firstSeries = series[0] || {};
        return {
            instanceId: result.id || instanceId,
            timelineName: result.name || "N/A",
            metrics: formattedMetrics,
            metadata: {
                pointIntervalMs: firstSeries.pointInterval,
                pointStartTimestamp: new Date(firstSeries.pointStart).toISOString()
            },
            message: `Linha do tempo de métricas para a instância ${instanceId} recuperada.`,
            relatedTools: [
                {
                    tool_name: 'get_instance_traffic',
                    description: 'Obter um resumo do tráfego total para esta instância.',
                    parameters: [{ name: 'instanceId', value: instanceId }]
                },
                {
                    tool_name: 'list_topology',
                    description: 'Encontrar outros IDs de instância.',
                    parameters: []
                }
            ]
        };
    }
    catch (error) {
        console.error(`Erro ao obter a linha do tempo de métricas para a instância ${instanceId}:`, error);
        throw error;
    }
}
/**
 * Ferramenta para pesquisar eventos de tráfego (transações) em uma instância do API Gateway.
 * Este é o ponto de partida principal para depurar problemas específicos.
 * @param api Instância da classe AxwayApi.
 * @param args Um objeto com os argumentos da pesquisa.
 * @param args.instanceId O ID da instância onde a pesquisa será feita.
 * @param args.ago O período de tempo para a pesquisa (ex: '1h', '24h', '10m').
 * @param args.count (Opcional) O número máximo de eventos a serem retornados. Padrão: 100.
 * @param args.protocol (Opcional) Filtrar por protocolo (ex: 'http', 'https').
 * @param args.searchField (Opcional) Campo para pesquisar (ex: 'status', 'leg', 'remoteAddr').
 * @param args.searchValue (Opcional) Valor para o campo de pesquisa.
 * @returns Uma lista de transações que correspondem aos critérios de pesquisa.
 */
export async function searchTrafficEvents(api, args) {
    try {
        const params = new URLSearchParams({
            format: 'json',
            ago: args.ago,
            count: (args.count || 100).toString(),
        });
        if (args.protocol) {
            params.append('protocol', args.protocol);
        }
        if (args.searchField && args.searchValue) {
            params.append('field', args.searchField);
            params.append('value', args.searchValue);
        }
        const result = await api.searchTrafficEvents(args.instanceId, params);
        const transactions = result.data || [];
        return {
            instanceId: args.instanceId,
            transactionCount: transactions.length,
            transactions: transactions,
            message: `Pesquisa encontrou ${transactions.length} transações na instância ${args.instanceId}.`,
            relatedTools: [
                ...transactions.map((tx) => ({
                    tool_name: 'get_traffic_event_details',
                    description: `Obter detalhes para a transação com ID de correlação ${tx.corrId}.`,
                    parameters: [
                        { name: 'instanceId', value: args.instanceId },
                        { name: 'protocol', value: tx.protocol },
                        { name: 'correlationId', value: tx.corrId },
                        { name: 'leg', value: '0' } // Assumindo leg 0, o mais comum
                    ]
                })),
                {
                    tool_name: 'list_topology',
                    description: 'Encontrar outros IDs de instância para pesquisar.',
                    parameters: []
                }
            ]
        };
    }
    catch (error) {
        console.error(`Erro ao pesquisar eventos de tráfego na instância ${args.instanceId}:`, error);
        throw error;
    }
}
/**
 * Ferramenta para obter informações detalhadas sobre um evento de tráfego específico (transação),
 * incluindo cabeçalhos de requisição e resposta.
 * @param api Instância da classe AxwayApi.
 * @param args Um objeto com os argumentos para obter os detalhes.
 * @param args.instanceId O ID da instância.
 * @param args.correlationId O ID de correlação da transação, obtido de `search_traffic_events`.
 * @param args.protocol O protocolo da transação (ex: 'http').
 * @param args.leg O "leg" (segmento) da transação. Normalmente é 0 para a comunicação cliente-gateway.
 * @param args.includeDetails (Opcional) Incluir detalhes da transação. Padrão: true.
 * @param args.includeRequestHeaders (Opcional) Incluir cabeçalhos da requisição. Padrão: true.
 * @param args.includeResponseHeaders (Opcional) Incluir cabeçalhos da resposta. Padrão: true.
 * @returns Um objeto com os detalhes, cabeçalhos de requisição e resposta da transação.
 */
export async function getTrafficEventDetails(api, args) {
    try {
        const params = new URLSearchParams({ format: 'json' });
        if (args.includeDetails !== false)
            params.append('details', '1');
        if (args.includeRequestHeaders !== false)
            params.append('rheaders', '1');
        if (args.includeResponseHeaders !== false)
            params.append('sheaders', '1');
        const result = await api.getTrafficEventDetails(args.instanceId, args.protocol, args.correlationId, args.leg, params);
        return {
            correlationId: args.correlationId,
            details: result.details || {},
            requestHeaders: result.rheaders || [],
            responseHeaders: result.sheaders || [],
            relatedTools: [
                {
                    tool_name: 'get_traffic_event_payload',
                    description: 'Obter o payload (corpo) da REQUISIÇÃO para esta transação.',
                    parameters: [
                        { name: 'instanceId', value: args.instanceId },
                        { name: 'correlationId', value: args.correlationId },
                        { name: 'leg', value: String(args.leg) },
                        { name: 'direction', value: 'received' }
                    ]
                },
                {
                    tool_name: 'get_traffic_event_payload',
                    description: 'Obter o payload (corpo) da RESPOSTA para esta transação.',
                    parameters: [
                        { name: 'instanceId', value: args.instanceId },
                        { name: 'correlationId', value: args.correlationId },
                        { name: 'leg', value: String(args.leg) },
                        { name: 'direction', value: 'sent' }
                    ]
                },
                {
                    tool_name: 'get_traffic_event_trace',
                    description: 'Obter o trace (log detalhado) para esta transação.',
                    parameters: [
                        { name: 'instanceId', value: args.instanceId },
                        { name: 'correlationId', value: args.correlationId }
                    ]
                }
            ]
        };
    }
    catch (error) {
        console.error(`Erro ao obter detalhes para o evento de tráfego ${args.correlationId}:`, error);
        throw error;
    }
}
/**
 * Ferramenta para obter o payload (corpo da mensagem) de uma transação, seja da requisição ou da resposta.
 * @param api Instância da classe AxwayApi.
 * @param args Um objeto com os argumentos.
 * @param args.instanceId O ID da instância.
 * @param args.correlationId O ID de correlação da transação.
 * @param args.leg O "leg" da transação.
 * @param args.direction A direção do payload: 'received' (do cliente para o gateway) ou 'sent' (do gateway para o cliente).
 * @returns Um objeto contendo o payload como texto.
 */
export async function getTrafficEventPayload(api, args) {
    try {
        const payloadText = await api.getTrafficEventPayload(args.instanceId, args.correlationId, args.leg, args.direction);
        return {
            correlationId: args.correlationId,
            direction: args.direction,
            leg: args.leg,
            payload: payloadText,
            relatedTools: [
                {
                    tool_name: 'get_traffic_event_details',
                    description: 'Ver cabeçalhos e outros metadados para esta transação.',
                    parameters: [
                        { name: 'instanceId', value: args.instanceId },
                        { name: 'correlationId', value: args.correlationId },
                        { name: 'protocol', value: 'http' }, // O protocolo pode precisar ser ajustado
                        { name: 'leg', value: String(args.leg) }
                    ]
                }
            ]
        };
    }
    catch (error) {
        console.error(`Erro ao obter o payload para o evento de tráfego ${args.correlationId}:`, error);
        throw error;
    }
}
/**
 * Ferramenta para obter os dados de trace (log detalhado) de uma transação específica.
 * Muito útil para depuração de baixo nível de políticas e filtros.
 * @param api Instância da classe AxwayApi.
 * @param args Um objeto com os argumentos.
 * @param args.instanceId O ID da instância.
 * @param args.correlationId O ID de correlação da transação.
 * @param args.includeSentData (Opcional) Incluir dados enviados no trace. Padrão: false.
 * @param args.includeReceivedData (Opcional) Incluir dados recebidos no trace. Padrão: false.
 * @returns Um objeto contendo os dados de trace.
 */
export async function getTrafficEventTrace(api, args) {
    try {
        const params = new URLSearchParams({ format: 'json' });
        params.append('sentData', args.includeSentData ? '1' : '0');
        params.append('receivedData', args.includeReceivedData ? '1' : '0');
        const result = await api.getTrafficEventTrace(args.instanceId, args.correlationId, params);
        return {
            correlationId: args.correlationId,
            trace: result || [],
            message: `Trace para a transação ${args.correlationId} recuperado.`,
            relatedTools: [
                {
                    tool_name: 'get_traffic_event_details',
                    description: 'Ver cabeçalhos e outros metadados.',
                    parameters: [
                        { name: 'instanceId', value: args.instanceId },
                        { name: 'correlationId', value: args.correlationId },
                        { name: 'protocol', value: 'http' }, // O protocolo pode precisar ser ajustado
                        { name: 'leg', value: '0' }
                    ]
                },
                {
                    tool_name: 'get_traffic_event_payload',
                    description: 'Obter o payload completo da requisição/resposta.',
                    parameters: [
                        { name: 'instanceId', value: args.instanceId },
                        { name: 'correlationId', value: args.correlationId },
                        { name: 'leg', value: '0' },
                        { name: 'direction', value: 'received' }
                    ]
                }
            ]
        };
    }
    catch (error) {
        console.error(`Erro ao obter o trace para o evento de tráfego ${args.correlationId}:`, error);
        throw error;
    }
}
//# sourceMappingURL=monitoring.js.map