/**
 * @module src/operations/proxies
 * @description This module contains the operations (tools) for managing
 * completo do ciclo de vida de Proxies de API (APIs de Frontend) no Axway API Manager.
 */

import { AxwayApi } from "../api.js";
import { removeEmptyValues } from "../utils.js";

/**
 * Transforms the detailed API proxy object into a simplified version,
 * focused on key information for diagnosis and troubleshooting.
 * @param rawProxy The raw API proxy object returned by the API.
 * @returns A simplified object with inbound, outbound, and state information.
 * @internal
 */
function transformApiProxyForTroubleshooting(rawProxy: any): any {
  const securityProfile = rawProxy.securityProfiles?.find((p: any) => p.isDefault);
  const authProfile = rawProxy.authenticationProfiles?.find((p: any) => p.isDefault);
  const corsProfile = rawProxy.corsProfiles?.find((p: any) => p.isDefault);

  // Extract authentication information from security settings
  const authDevices = securityProfile?.devices || [];
  const apiKeyDevice = authDevices.find((d: any) => d.type === 'apiKey');
  const oauthDevice = authDevices.find((d: any) => d.type === 'oauth');
  
  // Determine the authentication field name based on settings
  let authFieldName = "X-API-Key"; // Default
  if (apiKeyDevice?.properties?.headerName) {
    authFieldName = apiKeyDevice.properties.headerName;
  } else if (oauthDevice?.properties?.headerName) {
    authFieldName = oauthDevice.properties.headerName;
  }

  const simplified = {
    id: rawProxy.id,
    name: rawProxy.name,
    path: rawProxy.path,
    vhost: rawProxy.vhost,
    state: rawProxy.state,
    apiId: rawProxy.apiId,
    createdOn: rawProxy.createdOn,
    accessGrantedDate: rawProxy.accessGrantedDate,
    securityProfiles: rawProxy.securityProfiles,
    authenticationInfo: {
      fieldName: authFieldName, // ✅ NOME DO CAMPO para usar em headers
      authType: apiKeyDevice ? 'apiKey' : oauthDevice ? 'oauth' : 'none',
      curlExample: `curl -H "${authFieldName}: YOUR_API_KEY" https://your-api-endpoint`,
      warning: "Check the proxy security settings for the correct field name"
    },
    troubleshootingInfo: {
      inbound: {
        security: securityProfile?.devices?.map((d: any) => ({
          type: d.type,
          scopes: d.properties?.scopes,
          headerName: d.properties?.headerName // Authentication field name
        })),
        cors: {
          origins: corsProfile?.origins
        },
        inboundCertificate: rawProxy.caCerts?.some((c: any) => c.inbound === true) || false
      },
      outbound: {
        backendService: rawProxy.serviceProfiles?._default?.basePath,
        authentication: {
          type: authProfile?.type,
          details: rawProxy.outboundProfiles?._default?.authenticationProfile
        },
        outboundCertificate: rawProxy.caCerts?.some((c: any) => c.outbound === true) || false
      }
    }
  };
  return removeEmptyValues(simplified);
}

/**
 * Tool to list all API proxies (Frontend APIs).
 * @param api AxwayApi class instance.
 * @returns An object containing the list of API proxies.
 */
export async function listApiProxies(api: AxwayApi) {
  try {
    const rawProxies = await api.listApiProxies();
    // Return a simplified version in the list to save tokens
    const proxies = rawProxies.map((p: any) => ({
      id: p.id,
      name: p.name,
      path: p.path,
      state: p.state,
      createdOn: p.createdOn,
      accessGrantedDate: p.accessGrantedDate
    }));
    return {
      count: proxies.length,
      apiProxies: proxies,
      message: `Found ${proxies.length} API proxies.`,
      relatedTools: [
        ...proxies.map((p: any) => ({
          tool_name: 'axway_apim_proxy_get',
          description: `Get troubleshooting details for proxy '${p.name}'.`,
          parameters: [{ name: 'id', value: p.id }]
        })),
        {
          tool_name: 'axway_apim_backend_list',
          description: 'List backend APIs, required to create a new proxy.',
          parameters: []
        }
      ]
    };
  } catch (error) {
    console.error(`Error listing API proxies:`, error);
    throw error;
  }
}

/**
 * Consumer-facing catalog: published proxies only.
 */
export async function getApiCatalog(api: AxwayApi) {
  const all = await listApiProxies(api);
  const published = (all.apiProxies || []).filter(
    (p: any) => String(p.state || "").toLowerCase() === "published"
  );
  return {
    count: published.length,
    catalog: published,
    message: `Catalog: ${published.length} API(s) published (use axway_apim_proxy_list for all lifecycle states).`,
    relatedTools: [
      {
        tool_name: "axway_apim_proxy_list",
        description: "Full admin inventory including unpublished/deprecated proxies.",
        parameters: [],
      },
    ],
  };
}

/**
 * Tool to get authentication-specific information for an API proxy.
 * @param api AxwayApi class instance.
 * @param id The API proxy ID.
 * @returns An object containing the proxy authentication information.
 */
export async function getProxyAuthenticationInfo(api: AxwayApi, id: string) {
  try {
    const rawProxy = await api.getApiProxy(id);
    const securityProfile = rawProxy.securityProfiles?.find((p: any) => p.isDefault);
    const authDevices = securityProfile?.devices || [];
    
    // Extract authentication information
    const apiKeyDevice = authDevices.find((d: any) => d.type === 'apiKey');
    const oauthDevice = authDevices.find((d: any) => d.type === 'oauth');
    
    // Determine the authentication field name
    let authFieldName = "X-API-Key"; // Default
    let authType = "none";
    
    if (apiKeyDevice?.properties?.headerName) {
      authFieldName = apiKeyDevice.properties.headerName;
      authType = "apiKey";
    } else if (oauthDevice?.properties?.headerName) {
      authFieldName = oauthDevice.properties.headerName;
      authType = "oauth";
    }

    return {
      proxyId: id,
      proxyName: rawProxy.name,
      proxyPath: rawProxy.path,
      authenticationInfo: {
        type: authType,
        fieldName: authFieldName,
        curlExample: `curl -H "${authFieldName}: YOUR_API_KEY" https://your-api-endpoint`,
        curlWithApiKey: `curl -H "${authFieldName}: YOUR_API_KEY" ${rawProxy.vhost}${rawProxy.path}`,
        warning: "Use the 'apiKey' field from credentials; do NOT use the 'secret' field",
        securityDevices: authDevices.map((d: any) => ({
          type: d.type,
          headerName: d.properties?.headerName,
          scopes: d.properties?.scopes
        }))
      },
      message: `Authentication information for proxy '${rawProxy.name}'. Use the '${authFieldName}' header for authentication.`,
      relatedTools: [
        {
          tool_name: 'get_api_keys_for_application',
          description: 'Get API Keys to use with this proxy.',
          parameters: []
        },
        {
          tool_name: 'get_api_proxy',
          description: `Get full details for proxy '${rawProxy.name}'.`,
          parameters: [{ name: 'id', value: id }]
        }
      ]
    };
  } catch (error) {
    console.error(`Error getting authentication info for proxy ${id}:`, error);
    throw error;
  }
}

/**
 * Tool to get details for a specific API proxy, formatted for troubleshooting.
 * @param api AxwayApi class instance.
 * @param id The ID of the API proxy to retrieve.
 * @returns An object containing the simplified proxy details.
 */
export async function getApiProxy(api: AxwayApi, id: string) {
  try {
    const rawProxy = await api.getApiProxy(id);
    const apiProxy = transformApiProxyForTroubleshooting(rawProxy);
    return {
      apiProxy: apiProxy,
      relatedTools: [
        {
          tool_name: 'update_api_proxy',
          description: `Update proxy '${apiProxy.name}'.`,
          parameters: [{ name: 'id', value: id }]
        },
        {
          tool_name: 'list_api_access',
          description: `View which applications have access to this proxy.`,
          parameters: [{ name: 'applicationId', value: 'ALL' }] // The user will need to replace this
        },
        {
          tool_name: 'publish_api',
          description: `Publish proxy '${apiProxy.name}' to make it active.`,
          parameters: [{ name: 'id', value: id }]
        },
        {
          tool_name: 'delete_api_proxy',
          description: `Delete proxy '${apiProxy.name}'.`,
          parameters: [{ name: 'id', value: id }]
        }
      ]
    };
  } catch (error) {
    console.error(`Error getting API proxy ${id}:`, error);
    throw error;
  }
}

/**
 * Tool to create a new API proxy (Frontend API).
 * @param api AxwayApi class instance.
 * @param name The name of the new proxy.
 * @param path The proxy exposure path (e.g. '/my-api/v1').
 * @param apiId The backend API ID to be exposed by this proxy.
 * @param organizationId The ID of the organization that will own the proxy.
 * @returns A confirmation object with the created proxy details.
 */
export async function createApiProxy(api: AxwayApi, name: string, path: string, apiId: string, organizationId: string) {
  try {
    const newProxy = await api.createApiProxy({ name, path, apiId, organizationId });
    return {
      message: `API proxy '${newProxy.name}' created successfully.`,
      apiProxy: newProxy,
      relatedTools: [
        {
          tool_name: 'get_api_proxy',
          description: 'View details of the newly created proxy.',
          parameters: [{ name: 'id', value: newProxy.id }]
        },
        {
          tool_name: 'publish_api',
          description: `Publish proxy '${newProxy.name}' to activate it.`,
          parameters: [{ name: 'id', value: newProxy.id }]
        }
      ]
    };
  } catch (error) {
    console.error(`Error creating API proxy:`, error);
    throw error;
  }
}

/**
 * Tool to update an existing API proxy. Only the provided fields will be changed.
 * @param api AxwayApi class instance.
 * @param id The ID of the proxy to update.
 * @param name (Optional) The new name for the proxy.
 * @param path (Optional) The new path for the proxy.
 * @param apiId (Optional) The new backend API ID.
 * @returns A confirmation object with the updated proxy details.
 */
export async function updateApiProxy(api: AxwayApi, id: string, name?: string, path?: string, apiId?: string) {
  try {
    const payload = removeEmptyValues({ name, path, apiId });
     if (Object.keys(payload).length === 0) {
      return { message: "No fields provided for update. No action was taken." };
    }
    const updatedProxy = await api.updateApiProxy(id, payload);
    return {
      message: `API proxy '${updatedProxy.name}' updated successfully.`,
      apiProxy: updatedProxy,
      relatedTools: [
        {
          tool_name: 'get_api_proxy',
          description: 'View the updated proxy details.',
          parameters: [{ name: 'id', value: id }]
        }
      ]
    };
  } catch (error) {
    console.error(`Error updating API proxy ${id}:`, error);
    throw error;
  }
}

/**
 * Tool to delete an API proxy by ID.
 * @param api AxwayApi class instance.
 * @param id The ID of the proxy to delete.
 * @returns A confirmation object for the deletion.
 */
export async function deleteApiProxy(api: AxwayApi, id: string) {
  try {
    await api.deleteApiProxy(id);
    return {
      message: `API proxy with ID '${id}' was deleted successfully.`,
      relatedTools: [
        {
          tool_name: 'list_api_proxies',
          description: 'List remaining proxies to confirm the deletion.',
          parameters: []
        }
      ]
    };
  } catch (error) {
    console.error(`Error deleting API proxy ${id}:`, error);
    throw error;
  }
}

/**
 * Tool to publish an API proxy, making it available for consumption.
 * @param api AxwayApi class instance.
 * @param id The ID of the proxy to publish.
 * @returns A confirmation object for the publication.
 */
export async function publishApi(api: AxwayApi, id: string) {
  try {
    const result = await api.publishApi(id);
    return {
      message: `API proxy with ID '${id}' was published successfully.`,
      details: result,
      relatedTools: [
        {
          tool_name: 'get_api_proxy',
          description: 'View the updated proxy state.',
          parameters: [{ name: 'id', value: id }]
        },
        {
          tool_name: 'unpublish_api',
          description: 'Revert the publication (unpublish).',
          parameters: [{ name: 'id', value: id }]
        }
      ]
    };
  } catch (error) {
    console.error(`Error publishing API proxy ${id}:`, error);
    throw error;
  }
}

/**
 * Tool to unpublish an API proxy, making it unavailable.
 * @param api AxwayApi class instance.
 * @param id The ID of the proxy to unpublish.
 * @returns A confirmation object for the operation.
 */
export async function unpublishApi(api: AxwayApi, id: string) {
  try {
    const result = await api.unpublishApi(id);
    return {
      message: `API proxy with ID '${id}' was unpublished successfully.`,
      details: result,
      relatedTools: [
        {
          tool_name: 'get_api_proxy',
          description: 'View the updated proxy state.',
          parameters: [{ name: 'id', value: id }]
        },
        {
          tool_name: 'publish_api',
          description: 'Publish the proxy again.',
          parameters: [{ name: 'id', value: id }]
        }
      ]
    };
  } catch (error) {
    console.error(`Error unpublishing API proxy ${id}:`, error);
    throw error;
  }
}

/**
 * Tool to mark an API proxy as deprecated.
 * @param api AxwayApi class instance.
 * @param id The ID of the proxy to mark as deprecated.
 * @returns A confirmation object for the operation.
 */
export async function deprecateApi(api: AxwayApi, id: string) {
  try {
    const result = await api.deprecateApi(id);
    return {
      message: `API proxy with ID '${id}' was deprecated successfully.`,
      details: result,
      relatedTools: [
        {
          tool_name: 'get_api_proxy',
          description: 'View the updated proxy state.',
          parameters: [{ name: 'id', value: id }]
        }
      ]
    };
  } catch (error) {
    console.error(`Error deprecating API proxy ${id}:`, error);
    throw error;
  }
} 