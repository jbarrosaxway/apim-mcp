/**
 * @module src/operations/applications
 * @description This module contains the operations (tools) for managing Applications in the Axway API Manager.
 * Includes capabilities to list and get application details, as well as manage
 * their credentials, such as API Keys and OAuth clients.
 */

import { AxwayApi } from "../api.js";

/**
 * Transforms the raw API application object into a cleaner, more consistent format.
 * @param app The raw application object.
 * @returns A formatted application object.
 * @internal
 */
function transformApplication(app: any) {
  return {
    applicationId: app.id,
    name: app.name,
    description: app.description,
    isEnabled: app.enabled,
    organizationId: app.organizationId,
    metadata: {
      createdAt: new Date(app.createdOn).toISOString(),
    }
  };
}

/**
 * Transforms the raw API Key object into a cleaner format.
 * @param key The raw API Key object.
 * @returns A formatted API Key object.
 * @internal
 */
function transformApiKey(key: any) {
  return {
    apiKeyId: key.id,
    apiKey: key.apiKey, // Use this field for authentication in curl calls
    secret: key.secret, // Do not use this field for authentication
    isEnabled: key.enabled,
    isCorsEnabled: key.cors,
    metadata: {
      createdAt: new Date(key.createdOn).toISOString(),
    },
    // Important usage information
    usageInfo: {
      authenticationField: "apiKey", // Correct field to use in headers
      curlExample: `curl -H "X-API-Key: ${key.apiKey}" https://your-api-endpoint`,
      warning: "Use 'apiKey' for authentication; do NOT use 'secret'"
    }
  };
}

/**
 * Transforms the raw OAuth credential object into a cleaner format.
 * @param cred The raw OAuth credential object.
 * @returns A formatted OAuth credential object.
 * @internal
 */
function transformOAuthCredential(cred: any) {
  return {
    credentialId: cred.id,
    clientId: cred.id, // In Axway, client_id is the same as the credential ID
    secret: cred.secret,
    type: cred.type,
    isEnabled: cred.enabled,
    redirectUrls: cred.redirectURIs || [],
    certificate: cred.cert,
    metadata: {
      createdAt: new Date(cred.createdOn).toISOString(),
    }
  };
}

/**
 * Transforms the raw permission object into a cleaner format.
 * @param perm The raw permission object.
 * @returns A formatted permission object.
 * @internal
 */
function transformPermission(perm: any) {
  return {
    permissionId: perm.id,
    apiId: perm.apiId,
    isEnabled: perm.enabled,
    // Note: Further details about the API require a separate call
  };
}

/**
 * Tool to list all applications visible to the authenticated user.
 * @param api AxwayApi class instance.
 * @returns An object containing the list of formatted applications.
 */
export async function listApplications(api: AxwayApi) {
  try {
    const rawApps = await api.listApplications();
    const applications = rawApps.map(transformApplication);
    return {
      count: applications.length,
      applications: applications,
      message: `Found ${applications.length} applications.`,
      relatedTools: [
        ...applications.map((app: any) => ({
          tool_name: 'get_application',
          description: `Get details for application '${app.name}'.`,
          parameters: [{ name: 'id', value: app.applicationId }]
        })),
        {
          tool_name: 'list_organizations',
          description: 'List organizations to see which organization each application belongs to.',
          parameters: []
        }
      ]
    };
  } catch (error) {
    console.error(`Error listing applications:`, error);
    throw error;
  }
}

/**
 * Tool to get details for a specific application by ID.
 * @param api AxwayApi class instance.
 * @param id The ID of the application to retrieve.
 * @returns An object containing the application details.
 */
export async function getApplication(api: AxwayApi, id: string) {
  try {
    const rawApp = await api.getApplication(id);
    const application = transformApplication(rawApp);
    return {
      application: application,
      relatedTools: [
        {
          tool_name: 'get_api_keys_for_application',
          description: `Manage API Keys for application '${application.name}'.`,
          parameters: [{ name: 'id', value: id }]
        },
        {
          tool_name: 'get_oauth_credentials_for_application',
          description: `Manage OAuth clients for application '${application.name}'.`,
          parameters: [{ name: 'id', value: id }]
        },
        {
          tool_name: 'list_api_access',
          description: `View which APIs application '${application.name}' has access to.`,
          parameters: [{ name: 'applicationId', value: id }]
        }
      ]
    };
  } catch (error) {
    console.error(`Error getting application ${id}:`, error);
    throw error;
  }
}

/**
 * Tool to get the API Keys associated with a specific application.
 * @param api AxwayApi class instance.
 * @param id The application ID.
 * @returns An object containing the application's API Key list.
 */
export async function getApiKeysForApplication(api: AxwayApi, id: string) {
  try {
    const rawKeys = await api.getApiKeysForApplication(id);
    const apiKeys = rawKeys.map(transformApiKey);
    return {
      applicationId: id,
      count: apiKeys.length,
      apiKeys: apiKeys,
      message: `Application ${id} has ${apiKeys.length} API Keys.`,
      relatedTools: [
        {
          tool_name: 'create_api_key',
          description: `Create a new API Key for application ${id}.`,
          parameters: [
            { name: 'appId', value: id },
            { name: 'enabled', value: 'true' }
          ]
        }
      ]
    };
  } catch (error) {
    console.error(`Error getting API Keys for application ${id}:`, error);
    throw error;
  }
}

/**
 * Tool to create a new API Key for a specific application.
 * @param api AxwayApi class instance.
 * @param appId The ID of the application for which the key will be created.
 * @param enabled (Optional) Whether the key should be created as enabled. Default: `true`.
 * @param secret (Optional) A custom secret for the API Key. If not provided, one will be generated.
 * @returns An object containing the newly created API Key.
 */
export async function createApiKey(api: AxwayApi, appId: string, enabled: boolean = true, secret?: string) {
  try {
    const newKey = await api.createApiKey(appId, { enabled, secret });
    return {
      message: "API Key created successfully.",
      apiKey: transformApiKey(newKey),
      relatedTools: [
        {
          tool_name: 'get_api_keys_for_application',
          description: `View all API Keys for application ${appId}.`,
          parameters: [{ name: 'id', value: appId }]
        }
      ]
    };
  } catch (error) {
    console.error(`Error creating API Key for application ${appId}:`, error);
    throw error;
  }
}

/**
 * Tool to get the OAuth credentials (clients) associated with an application.
 * @param api AxwayApi class instance.
 * @param id The application ID.
 * @returns An object containing the application's OAuth credential list.
 */
export async function getOAuthCredentialsForApplication(api: AxwayApi, id: string) {
  try {
    const rawCreds = await api.getOAuthCredentialsForApplication(id);
    const oauthCredentials = rawCreds.map(transformOAuthCredential);
    return {
      applicationId: id,
      count: oauthCredentials.length,
      oauthCredentials: oauthCredentials,
      message: `Application ${id} has ${oauthCredentials.length} OAuth credentials.`,
      relatedTools: [
        {
          tool_name: 'create_oauth_credential',
          description: `Create a new OAuth credential for application ${id}.`,
          parameters: [{ name: 'appId', value: id }]
        }
      ]
    };
  } catch (error) {
    console.error(`Error getting OAuth credentials for application ${id}:`, error);
    throw error;
  }
}

/**
 * Tool to create a new OAuth credential (client) for an application.
 * @param api AxwayApi class instance.
 * @param appId The ID of the application for which the credential will be created.
 * @param redirectURIs (Optional) A comma-separated list of redirect URIs.
 * @param cert (Optional) The public certificate (PEM format) to associate with the client.
 * @returns An object containing the newly created OAuth credential.
 */
export async function createOAuthCredential(api: AxwayApi, appId: string, redirectURIs?: string, cert?: string) {
  try {
    const newCred = await api.createOAuthCredential(appId, { redirectURIs, cert });
    return {
      message: "OAuth credential created successfully.",
      oauthCredential: transformOAuthCredential(newCred),
      relatedTools: [
        {
          tool_name: 'get_oauth_credentials_for_application',
          description: `View all credentials for application ${appId}.`,
          parameters: [{ name: 'id', value: appId }]
        }
      ]
    };
  } catch (error) {
    console.error(`Error creating OAuth credential for application ${appId}:`, error);
    throw error;
  }
}

/**
 * Tool to get the permission list (ACL) for a specific application.
 * This function is mainly for debugging, since `listApiAccess` is generally more useful.
 * @param api AxwayApi class instance.
 * @param id The application ID.
 * @returns An object containing the application's permission list.
 */
export async function getPermissionsForApplication(api: AxwayApi, id:string) {
  try {
    const rawPerms = await api.getPermissionsForApplication(id);
    const permissions = rawPerms.map(transformPermission);
    return {
      applicationId: id,
      permissions: permissions,
      message: `Found ${permissions.length} permission rules for application ${id}.`,
      relatedTools: [
        {
          tool_name: 'list_api_access',
          description: 'Get full details about the APIs this application can access.',
          parameters: [{ name: 'applicationId', value: id }]
        },
        {
          tool_name: 'grant_api_access',
          description: 'Manage permissions by granting access to an API.',
          parameters: [{ name: 'applicationId', value: id }]
        }
      ]
    };
  } catch (error) {
    console.error(`Error getting permissions for application ${id}:`, error);
    throw error;
  }
}
