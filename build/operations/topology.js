/**
 * @module src/operations/topology
 * @description Este módulo contém as operações (ferramentas) para descobrir a topologia
 * do domínio do Axway API Gateway. A topologia inclui informações sobre grupos e instâncias.
 */
/**
 * Ferramenta para listar a topologia do domínio do API Gateway.
 *
 * Esta função é fundamental para a descoberta do ambiente, fornecendo os IDs de instância
 * necessários para a maioria das outras ferramentas de monitoramento e tráfego.
 *
 * @param api Instância da classe AxwayApi.
 * @returns Um objeto contendo informações do domínio e uma lista de grupos com suas respectivas instâncias.
 */
export async function listTopology(api) {
    try {
        const response = await api.listTopology();
        // Os dados da topologia estão aninhados sob a chave 'result'.
        const rawTopology = response.result;
        if (!rawTopology) {
            throw new Error("Falha ao recuperar dados da topologia. A API retornou uma estrutura de resposta inválida.");
        }
        const groups = rawTopology.groups || [];
        if (!Array.isArray(groups)) {
            console.warn("A propriedade 'groups' da topologia não é um array:", groups);
            return { message: "Nenhum grupo encontrado na topologia.", groups: [] };
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
            message: `Topologia recuperada com ${transformedGroups.length} grupo(s) e ${allInstances.length} instância(s).`,
            relatedTools: [
                ...allInstances.map((inst) => ({
                    tool_name: 'get_instance_traffic',
                    description: `Obter métricas de tráfego para a instância '${inst.instanceName}'.`,
                    parameters: [{ name: 'instanceId', value: inst.instanceId }]
                })),
                ...allInstances.map((inst) => ({
                    tool_name: 'search_traffic_events',
                    description: `Pesquisar eventos de tráfego recentes na instância '${inst.instanceName}'.`,
                    parameters: [
                        { name: 'instanceId', value: inst.instanceId },
                        { name: 'ago', value: '10m' }
                    ]
                }))
            ]
        };
    }
    catch (error) {
        console.error("Erro ao listar a topologia:", error);
        throw error;
    }
}
//# sourceMappingURL=topology.js.map