/**
 * @module src/operations/quotas
 * @description This module contains the operations (tools) for managing
 * API usage quotas for applications in the Axway API Manager.
 */
/**
 * Transforms the raw API quota object into a cleaner, more readable format.
 * @param quota O objeto de cota bruto.
 * @returns A formatted quota object with its restrictions.
 * @internal
 */
function transformQuota(quota) {
    // O objeto de cota pode ser complexo, simplificamos para o essencial
    const restrictions = quota.restrictions?.map((r) => ({
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
 * Tool to get the effective quota (system or custom) for a specific application.
 * @param api AxwayApi class instance.
 * @param applicationId The ID of the application whose quota will be retrieved.
 * @returns An object containing the application quota details.
 */
export async function getApplicationQuotas(api, applicationId) {
    try {
        const rawQuota = await api.getApplicationQuotas(applicationId);
        return {
            applicationId: applicationId,
            quota: transformQuota(rawQuota),
            relatedTools: [
                {
                    tool_name: 'update_application_quotas',
                    description: `Modify quotas for application ${applicationId}.`,
                    parameters: [
                        { name: 'applicationId', value: applicationId },
                        { name: 'messages_per_second', value: '10' }
                    ]
                },
                {
                    tool_name: 'list_applications',
                    description: 'List other applications to check their quotas.',
                    parameters: []
                }
            ]
        };
    }
    catch (error) {
        console.error(`Error getting quotas for application ${applicationId}:`, error);
        throw error;
    }
}
/**
 * Tool to update an application quota to a specific number of messages per second.
 *
 * This is a simplified tool that creates a single restriction for all APIs (`*`)
 * and all methods (`*`) with the provided limit.
 *
 * @param api AxwayApi class instance.
 * @param applicationId The ID of the application whose quota will be updated.
 * @param messages_per_second The maximum number of messages (requests) per second.
 * @returns A confirmation object for the operation.
 */
export async function updateApplicationQuotas(api, applicationId, messages_per_second) {
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
            message: `Quotas for application ${applicationId} updated successfully to ${messages_per_second} messages/second.`,
            relatedTools: [
                {
                    tool_name: 'get_application_quotas',
                    description: `Verify the quota changes for application ${applicationId}.`,
                    parameters: [{ name: 'applicationId', value: applicationId }]
                }
            ]
        };
    }
    catch (error) {
        console.error(`Error updating quotas for application ${applicationId}:`, error);
        throw error;
    }
}
//# sourceMappingURL=quotas.js.map