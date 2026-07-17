/**
 * @module src/operations/monitoring
 * @description This module contains the operations (tools) for traffic monitoring
 * on the Axway API Gateway. It supports retrieving traffic metrics, searching transactions,
 * and inspecting details of specific events such as payloads and traces.
 */
/**
 * Tool to get a traffic metrics summary for a specific API Gateway instance.
 * @param api AxwayApi class instance.
 * @param instanceId The API Gateway instance ID (e.g. 'instance-1').
 * @returns An object with the traffic summary for the instance.
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
            message: `Traffic summary for instance ${instanceId} retrieved.`,
            relatedTools: [
                {
                    tool_name: 'get_service_traffic',
                    description: `Get a per-service traffic breakdown for this instance (${instanceId}).`,
                    parameters: [{ name: 'instanceId', value: instanceId }]
                },
                {
                    tool_name: 'list_topology',
                    description: 'List the topology to find other instance IDs.',
                    parameters: []
                }
            ]
        };
    }
    catch (error) {
        console.error(`Error getting traffic for instance ${instanceId}:`, error);
        throw error;
    }
}
/**
 * Tool to get traffic metrics for a specific service on an API Gateway instance.
 * @param api AxwayApi class instance.
 * @param instanceId The ID of the instance where the service is running.
 * @param serviceName The exact service name (e.g. 'Default Services').
 * @returns An object with traffic details for the specified service.
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
            message: `Traffic summary for service '${serviceName}' on instance ${instanceId} retrieved.`,
            relatedTools: [
                {
                    tool_name: 'get_instance_traffic',
                    description: `View aggregated traffic for the entire instance (${instanceId}).`,
                    parameters: [{ name: 'instanceId', value: instanceId }]
                },
                {
                    tool_name: 'list_topology',
                    description: 'Discover other services and instances in the topology.',
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
 * Tool to get a metrics timeline for a specific API Gateway instance.
 * Useful for visualizing trends over time.
 * @param api AxwayApi class instance.
 * @param instanceId The instance ID.
 * @param timeline The time window for the query (e.g. '10m', '1h', '24h').
 * @param metricTypes An array of metric types to include (e.g. ['successes', 'failures']).
 * @returns An object containing the formatted timeline data.
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
            message: `Metrics timeline for instance ${instanceId} retrieved.`,
            relatedTools: [
                {
                    tool_name: 'get_instance_traffic',
                    description: 'Get a total traffic summary for this instance.',
                    parameters: [{ name: 'instanceId', value: instanceId }]
                },
                {
                    tool_name: 'list_topology',
                    description: 'Find other instance IDs.',
                    parameters: []
                }
            ]
        };
    }
    catch (error) {
        console.error(`Error getting metrics timeline for instance ${instanceId}:`, error);
        throw error;
    }
}
/**
 * Tool to search for traffic events (transactions) on an API Gateway instance.
 * This is the primary starting point for debugging specific issues.
 * @param api AxwayApi class instance.
 * @param args An object with the search arguments.
 * @param args.instanceId The ID of the instance to search on.
 * @param args.ago The lookback period for the search (e.g. '1h', '24h', '10m').
 * @param args.count (Optional) Maximum number of events to return. Default: 100.
 * @param args.protocol (Optional) Filter by protocol (e.g. 'http', 'https').
 * @param args.searchField (Optional) Field to search (e.g. 'status', 'leg', 'remoteAddr').
 * @param args.searchValue (Optional) Value for the search field.
 * @returns A list of transactions matching the search criteria.
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
            message: `Search found ${transactions.length} transactions on instance ${args.instanceId}.`,
            relatedTools: [
                ...transactions.map((tx) => ({
                    tool_name: 'get_traffic_event_details',
                    description: `Get details for the transaction with correlation ID ${tx.corrId}.`,
                    parameters: [
                        { name: 'instanceId', value: args.instanceId },
                        { name: 'protocol', value: tx.protocol },
                        { name: 'correlationId', value: tx.corrId },
                        { name: 'leg', value: '0' } // Assuming leg 0, the most common
                    ]
                })),
                {
                    tool_name: 'list_topology',
                    description: 'Find other instance IDs to search.',
                    parameters: []
                }
            ]
        };
    }
    catch (error) {
        console.error(`Error searching traffic events on instance ${args.instanceId}:`, error);
        throw error;
    }
}
/**
 * Tool to get detailed information about a specific traffic event (transaction),
 * including request and response headers.
 * @param api AxwayApi class instance.
 * @param args An object with the arguments to retrieve the details.
 * @param args.instanceId The instance ID.
 * @param args.correlationId The transaction correlation ID, obtained from `search_traffic_events`.
 * @param args.protocol The transaction protocol (e.g. 'http').
 * @param args.leg The transaction "leg" (segment). Usually 0 for client-gateway communication.
 * @param args.includeDetails (Optional) Include transaction details. Default: true.
 * @param args.includeRequestHeaders (Optional) Include request headers. Default: true.
 * @param args.includeResponseHeaders (Optional) Include response headers. Default: true.
 * @returns An object with the transaction details, request headers, and response headers.
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
                    description: 'Get the REQUEST payload (body) for this transaction.',
                    parameters: [
                        { name: 'instanceId', value: args.instanceId },
                        { name: 'correlationId', value: args.correlationId },
                        { name: 'leg', value: String(args.leg) },
                        { name: 'direction', value: 'received' }
                    ]
                },
                {
                    tool_name: 'get_traffic_event_payload',
                    description: 'Get the RESPONSE payload (body) for this transaction.',
                    parameters: [
                        { name: 'instanceId', value: args.instanceId },
                        { name: 'correlationId', value: args.correlationId },
                        { name: 'leg', value: String(args.leg) },
                        { name: 'direction', value: 'sent' }
                    ]
                },
                {
                    tool_name: 'get_traffic_event_trace',
                    description: 'Get the trace (detailed log) for this transaction.',
                    parameters: [
                        { name: 'instanceId', value: args.instanceId },
                        { name: 'correlationId', value: args.correlationId }
                    ]
                }
            ]
        };
    }
    catch (error) {
        console.error(`Error getting details for traffic event ${args.correlationId}:`, error);
        throw error;
    }
}
/**
 * Tool to get the payload (message body) of a transaction, either request or response.
 * @param api AxwayApi class instance.
 * @param args An object with the arguments.
 * @param args.instanceId The instance ID.
 * @param args.correlationId The transaction correlation ID.
 * @param args.leg The transaction "leg".
 * @param args.direction Payload direction: 'received' (client to gateway) or 'sent' (gateway to client).
 * @returns An object containing the payload as text.
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
                    description: 'View headers and other metadata for this transaction.',
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
        console.error(`Error getting payload for traffic event ${args.correlationId}:`, error);
        throw error;
    }
}
/**
 * Tool to get the trace data (detailed log) for a specific transaction.
 * Very useful for low-level debugging of policies and filters.
 * @param api AxwayApi class instance.
 * @param args An object with the arguments.
 * @param args.instanceId The instance ID.
 * @param args.correlationId The transaction correlation ID.
 * @param args.includeSentData (Optional) Include sent data in the trace. Default: false.
 * @param args.includeReceivedData (Optional) Include received data in the trace. Default: false.
 * @returns An object containing the trace data.
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
            message: `Trace for transaction ${args.correlationId} retrieved.`,
            relatedTools: [
                {
                    tool_name: 'get_traffic_event_details',
                    description: 'View headers and other metadata.',
                    parameters: [
                        { name: 'instanceId', value: args.instanceId },
                        { name: 'correlationId', value: args.correlationId },
                        { name: 'protocol', value: 'http' }, // O protocolo pode precisar ser ajustado
                        { name: 'leg', value: '0' }
                    ]
                },
                {
                    tool_name: 'get_traffic_event_payload',
                    description: 'Get the full request/response payload.',
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
        console.error(`Error getting trace for traffic event ${args.correlationId}:`, error);
        throw error;
    }
}
//# sourceMappingURL=monitoring.js.map