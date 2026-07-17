/**
 * @module src/operations/repository
 * @description This module contains the operations (tools) for managing the
 * Backend API Repository in the Axway API Manager. Backend APIs are the
 * definitions (e.g. Swagger/OpenAPI) of your real services, which are then
* exposed through API Proxies.
 */

import { AxwayApi } from "../api.js";
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Transforms the raw backend API object into a cleaner, more consistent format.
 * @param api O objeto de API de backend bruto.
 * @returns A formatted backend API object.
 * @internal
 */
function transformBackendApi(api: any) {
  return {
    backendApiId: api.id,
    name: api.name,
    type: api.type, // e.g., 'swagger', 'wadl'
    basePath: api.basePath,
    organizationId: api.organizationId,
    metadata: {
      createdAt: new Date(api.createdOn).toISOString(),
    }
  };
}

/**
 * Tool to list all backend APIs in the repository.
 * The `backendApiId` returned here is used as `apiId` when creating a proxy.
 * @param api AxwayApi class instance.
 * @returns An object containing the list of backend APIs.
 */
export async function listBackendApis(api: AxwayApi) {
  try {
    const rawApis = await api.listBackendApis();
    const backendApis = rawApis.map(transformBackendApi);
    return {
      count: backendApis.length,
      backendApis: backendApis,
      message: `Found ${backendApis.length} backend APIs.`,
      relatedTools: [
        ...backendApis.map((bApi: any) => ({
          tool_name: 'create_api_proxy',
          description: `Create an API proxy to expose backend API '${bApi.name}'.`,
          parameters: [
            { name: 'name', value: `${bApi.name} Proxy` },
            { name: 'path', value: `/${bApi.name.toLowerCase().replace(/\s/g, '-')}` },
            { name: 'apiId', value: bApi.backendApiId },
            { name: 'organizationId', value: bApi.organizationId }
          ]
        })),
        {
          tool_name: 'import_backend_api_from_url',
          description: 'Import a new backend API from a URL.',
          parameters: []
        }
      ]
    };
  } catch (error) {
    console.error(`Error listing backend APIs:`, error);
    throw error;
  }
}

/**
 * Tool to import a new backend API from a URL (e. g. a Swagger/OpenAPI definition).
 * @param api AxwayApi class instance.
 * @param url The full URL of the API definition to import.
 * @param organizationId The ID of the organization that will own this backend API.
 * @param name (Optional) A custom name for the API. If omitted, one is generated from the definition.
 * @returns A confirmation object with the imported backend API details.
 */
export async function importBackendApiFromUrl(api: AxwayApi, url: string, organizationId: string, name?: string) {
  try {
    const newApi = await api.importBackendApiFromUrl(url, organizationId, name);
    return {
      message: `Backend API '${newApi.name}' imported successfully.`,
      backendApi: transformBackendApi(newApi),
      relatedTools: [
        {
          tool_name: 'create_api_proxy',
          description: `Create a proxy to expose the newly imported API '${newApi.name}'.`,
          parameters: [
            { name: 'name', value: `${newApi.name} Proxy` },
            { name: 'path', value: `/${newApi.name.toLowerCase().replace(/\s/g, '-')}` },
            { name: 'apiId', value: newApi.id },
            { name: 'organizationId', value: newApi.organizationId }
          ]
        },
        {
          tool_name: 'list_backend_apis',
          description: 'View all available backend APIs.',
          parameters: []
        }
      ]
    };
  } catch (error) {
    console.error(`Error importing backend API from URL ${url}:`, error);
    throw error;
  }
}

/**
 * Tool to import a new backend API from a local file.
 * @param api AxwayApi class instance.
 * @param filePath Local path to the API definition file (e.g. 'swagger.json').
 * @param organizationId The ID of the organization that will own this backend API.
 * @param name (Optional) A custom name for the API.
 * @returns A confirmation object with the imported backend API details.
 */
export async function importBackendApiFromFile(api: AxwayApi, filePath: string, organizationId: string, name?: string) {
  try {
    const newApi = await api.importBackendApiFromFile(filePath, organizationId, name);
    return {
      message: `Backend API from file '${filePath}' imported successfully.`,
      backendApi: transformBackendApi(newApi),
      relatedTools: [
        {
          tool_name: 'create_api_proxy',
          description: `Create a proxy to expose the newly imported API '${newApi.name}'.`,
          parameters: [
            { name: 'name', value: `${newApi.name} Proxy` },
            { name: 'path', value: `/${newApi.name.toLowerCase().replace(/\s/g, '-')}` },
            { name: 'apiId', value: newApi.id },
            { name: 'organizationId', value: newApi.organizationId }
          ]
        },
        {
          tool_name: 'list_backend_apis',
          description: 'View all available backend APIs.',
          parameters: []
        }
      ]
    };
  } catch (error) {
    console.error(`Error importing backend API from file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Tool to delete a backend API from the repository by ID.
 * @param api AxwayApi class instance.
 * @param id The ID of the backend API to delete.
 * @returns A confirmation object for the deletion.
 */
export async function deleteBackendApi(api: AxwayApi, id: string) {
  try {
    await api.deleteBackendApi(id);
    return {
      message: `Backend API with ID '${id}' was deleted successfully.`,
      relatedTools: [
        {
          tool_name: 'list_backend_apis',
          description: 'List remaining backend APIs to confirm the deletion.',
          parameters: []
        }
      ]
    };
  } catch (error) {
    console.error(`Error deleting backend API ${id}:`, error);
    throw error;
  }
}

/**
 * MCP tool for uploading a file for backend API import.
 * Recebe filename e content_base64, salva em /tmp e retorna o caminho salvo.
 */
export async function uploadFileForImport(args: { filePath: string }) {
  if (!args.filePath) {
    throw new Error('Required parameter: filePath');
  }
  // Only returns the given path, since the file is already in the container
  return { filePath: args.filePath };
} 