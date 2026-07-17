/**
 * @module src/operations/access
 * @description This module contains the operations (tools) for managing access control
 * between Applications and APIs (Proxies) in the Axway API Manager.
 * The functions defined here allow listing, granting, and revoking access.
 */
/**
 * Transforms raw API access data into a cleaner, more structured format.
 * @param access The raw API access object returned by the Axway API.
 * @returns A formatted API access object.
 * @internal
 */
function transformApiAccess(access) {
    return {
        apiAccessId: access.id,
        apiId: access.apiId,
        isEnabled: access.enabled,
        metadata: {
            createdAt: new Date(access.createdOn).toISOString()
        }
    };
}
/**
 * Tool to list all APIs that a given application has access to.
 *
 * @param api AxwayApi class instance used to perform the calls.
 * @param applicationId The ID of the application whose access will be checked.
 * @returns An object containing the application ID and a list of its API accesses,
 *          along with related tool suggestions.
 */
export async function listApiAccess(api, applicationId) {
    try {
        const rawAccessList = await api.listApiAccess(applicationId);
        return {
            applicationId: applicationId,
            apiAccess: rawAccessList.map(transformApiAccess),
            message: `Found ${rawAccessList.length} APIs that application ${applicationId} has access to.`,
            relatedTools: [
                {
                    tool_name: 'grant_api_access',
                    description: `Grant this application (${applicationId}) access to another API.`,
                    parameters: [{ name: 'applicationId', value: applicationId }]
                },
                {
                    tool_name: 'list_api_proxies',
                    description: 'List all available frontend APIs to find other API IDs.',
                    parameters: []
                },
                ...rawAccessList.map((access) => ({
                    tool_name: 'revoke_api_access',
                    description: `Revoke access to the API with ID ${access.apiId}.`,
                    parameters: [
                        { name: 'applicationId', value: applicationId },
                        { name: 'apiId', value: access.apiId }
                    ]
                }))
            ]
        };
    }
    catch (error) {
        console.error(`Error listing API access for application ${applicationId}:`, error);
        throw error;
    }
}
/**
 * Tool to grant an application access to a frontend API (proxy).
 *
 * @param api AxwayApi class instance.
 * @param applicationId The ID of the application that will receive access.
 * @param apiId The API (proxy) ID to which access will be granted.
 * @returns A confirmation object with details of the newly created access.
 */
export async function grantApiAccess(api, applicationId, apiId) {
    try {
        const newAccess = await api.grantApiAccess(applicationId, apiId);
        return {
            message: `API access ${apiId} granted successfully to application ${applicationId}.`,
            apiAccess: transformApiAccess(newAccess),
            relatedTools: [
                {
                    tool_name: 'list_api_access',
                    description: `View all access grants for application ${applicationId}.`,
                    parameters: [{ name: 'applicationId', value: applicationId }]
                },
                {
                    tool_name: 'revoke_api_access',
                    description: `Revoke this newly granted access to API ${apiId}.`,
                    parameters: [
                        { name: 'applicationId', value: applicationId },
                        { name: 'apiId', value: apiId }
                    ]
                }
            ]
        };
    }
    catch (error) {
        console.error(`Error granting API access ${apiId} for application ${applicationId}:`, error);
        throw error;
    }
}
/**
 * Tool to revoke an application's access to an API.
 *
 * @param api AxwayApi class instance.
 * @param applicationId The ID of the application from which access will be revoked.
 * @param apiId The API (proxy) ID from which access will be removed.
 * @returns A confirmation object for the operation.
 */
export async function revokeApiAccess(api, applicationId, apiId) {
    try {
        await api.revokeApiAccess(applicationId, apiId);
        return {
            message: `Access to API '${apiId}' for application '${applicationId}' was revoked successfully.`,
            relatedTools: [
                {
                    tool_name: 'list_api_access',
                    description: `Confirm the change by listing remaining access grants for application ${applicationId}.`,
                    parameters: [{ name: 'applicationId', value: applicationId }]
                }
            ]
        };
    }
    catch (error) {
        console.error(`Error revoking API access ${apiId} for application ${applicationId}:`, error);
        throw error;
    }
}
//# sourceMappingURL=access.js.map