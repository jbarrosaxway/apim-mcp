/**
 * @module src/operations/topology
 * @description This module contains the operations (tools) for discovering the topology
 * of the Axway API Gateway domain. Topology includes information about groups and instances.
 */
/**
 * Tool to list the API Gateway domain topology.
 *
 * This function is essential for environment discovery, providing the instance IDs
 * needed by most other monitoring and traffic tools.
 *
 * @param api AxwayApi class instance.
 * @returns An object containing domain information and a list of groups with their instances.
 */
export async function listTopology(api) {
    try {
        const response = await api.listTopology();
        // Topology data is nested under the 'result' key.
        const rawTopology = response.result;
        if (!rawTopology) {
            throw new Error("Failed to retrieve topology data. The API returned an invalid response structure.");
        }
        const groups = rawTopology.groups || [];
        if (!Array.isArray(groups)) {
            console.warn("Topology 'groups' property is not an array:", groups);
            return { message: "No groups found in the topology.", groups: [] };
        }
        const transformedGroups = groups.map((group) => {
            const instances = group.services || [];
            return {
                groupId: group.id,
                groupName: group.name,
                instances: Array.isArray(instances) ? instances.map((service) => ({
                    instanceId: service.id,
                    instanceName: service.name,
                    instanceType: service.type,
                    tags: service.tags
                })) : []
            };
        });
        const allInstances = transformedGroups.flatMap((g) => g.instances);
        return {
            domainInfo: {
                domainId: rawTopology.id,
                productVersion: rawTopology.productVersion,
            },
            groupCount: transformedGroups.length,
            instanceCount: allInstances.length,
            groups: transformedGroups,
            message: `Topology retrieved with ${transformedGroups.length} group(s) and ${allInstances.length} instance(s).`,
            relatedTools: [
                ...allInstances.map((inst) => ({
                    tool_name: 'get_instance_traffic',
                    description: `Get traffic metrics for instance '${inst.instanceName}'.`,
                    parameters: [{ name: 'instanceId', value: inst.instanceId }]
                })),
                ...allInstances.map((inst) => ({
                    tool_name: 'search_traffic_events',
                    description: `Search recent traffic events on instance '${inst.instanceName}'.`,
                    parameters: [
                        { name: 'instanceId', value: inst.instanceId },
                        { name: 'ago', value: '10m' }
                    ]
                }))
            ]
        };
    }
    catch (error) {
        console.error("Error listing topology:", error);
        throw error;
    }
}
//# sourceMappingURL=topology.js.map