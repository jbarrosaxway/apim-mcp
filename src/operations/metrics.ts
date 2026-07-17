/**
 * @module src/operations/metrics
 * @description This module contains the operation (tool) for retrieving metrics reports
 * from the Axway API Manager, enabling analysis of API and application usage.
 */

import { AxwayApi } from '../api.js';

/**
 * Interface representing an individual metric item after transformation.
 */
export interface Metric {
    name: string;
    successes: number;
    failures: number;
    exceptions: number;
    numMessages: number;
    avgProcTime: number;
}

/**
 * Transforms raw API metrics data into a cleaner, more structured format.
 * @param data The raw metrics data array returned by the API.
 * @returns An array of formatted metric objects.
 * @internal
 */
function transformMetrics(data: any[]): Metric[] {
    if (!Array.isArray(data)) {
        console.warn("transformMetrics expected an array, but received:", typeof data);
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
 * Tool to get a summary report for application or API metrics.
 *
 * @param api AxwayApi class instance.
 * @param params An object containing the parameters for the metrics query.
 * @param params.type Report type: 'app' for applications or 'api' for APIs.
 * @param params.level Report detail level (0 or 1 for drill-through).
 * @param params.from Report start date/time (ISO-8601 format).
 * @param params.to Report end date/time (ISO-8601 format).
 * @param params.client (Optional) Array of client IDs to filter.
 * @param params.service (Optional) Array of service names to filter.
 * @param params.method (Optional) Name of a specific method to filter.
 * @param params.organization (Optional) Organization name or ID to filter.
 * @param params.reportsubtype (Optional) Report subtype, such as 'trafficAll'.
 * @returns An object containing the formatted metrics list and related tools.
 */
export async function getMetrics(
    api: AxwayApi,
    params: {
        type: 'app' | 'api';
        level: 0 | 1;
        from: string;
        to: string;
        client?: string[];
        service?: string[];
        method?: string;
        organization?: string;
        reportsubtype?: 'original' | 'trafficAll' | 'trafficSubset';
    }
): Promise<{ metrics: Metric[]; message: string; relatedTools: any[] }> {
    const rawMetrics = await api.getMetrics(params);
    const transformedMetrics = transformMetrics(rawMetrics);
    
    // Extract app or API names for use in related tools
    const clientNames = transformedMetrics.map(m => m.name).filter(name => name !== 'N/A');
    
    return {
        metrics: transformedMetrics,
        message: `Metrics report generated with ${transformedMetrics.length} results.`,
        relatedTools: [
            {
                tool_name: "list_alerts",
                description: "Check for system alerts that may relate to failures or exceptions seen in the metrics.",
                parameters: []
            },
            ...clientNames.map(name => ({
                tool_name: "get_application_quotas",
                description: `Check quotas for application '${name}' (if it is an application).`,
                parameters: [{ name: "applicationId", value: name }] // Assuming the name can be used as ID or that the user will replace it
            }))
        ]
    };
} 