/**
 * @module src/operations/organizations
 * @description This module contains the operations (tools) for managing
 * full (CRUD) Organizations in the Axway API Manager.
 */

import { AxwayApi } from "../api.js";
import { removeEmptyValues } from "../utils.js";

/**
 * Transforms the raw API organization object into a cleaner, more consistent format.
 * @param org The raw organization object.
 * @returns A formatted organization object.
 * @internal
 */
function transformOrganization(org: any) {
  return {
    organizationId: org.id,
    name: org.name,
    description: org.description,
    email: org.email,
    phone: org.phone,
    isEnabled: org.enabled,
    isDevelopment: org.development,
    metadata: {
      createdAt: new Date(org.createdOn).toISOString(),
    }
  };
}

/**
 * Tool to list all organizations in the API Manager.
 * @param api AxwayApi class instance.
 * @returns An object containing the list of organizations.
 */
export async function listOrganizations(api: AxwayApi) {
  try {
    const rawOrgs = await api.listOrganizations();
    const organizations = rawOrgs.map(transformOrganization);
    return {
      count: organizations.length,
      organizations: organizations,
      message: `Found ${organizations.length} organizations.`,
      relatedTools: [
        ...organizations.map((org: any) => ({
          tool_name: 'get_organization',
          description: `Get details for organization '${org.name}'.`,
          parameters: [{ name: 'id', value: org.organizationId }]
        })),
        {
          tool_name: 'create_organization',
          description: 'Create a new organization.',
          parameters: [{ name: 'name', value: 'New Organization' }]
        }
      ]
    };
  } catch (error) {
    console.error(`Error listing organizations:`, error);
    throw error;
  }
}

/**
 * Tool to get details for a specific organization by ID.
 * @param api AxwayApi class instance.
 * @param id The ID of the organization to retrieve.
 * @returns An object containing the organization details.
 */
export async function getOrganization(api: AxwayApi, id: string) {
  try {
    const rawOrg = await api.getOrganization(id);
    const organization = transformOrganization(rawOrg);
    return {
      organization: organization,
      relatedTools: [
        {
          tool_name: 'update_organization',
          description: `Update organization '${organization.name}'.`,
          parameters: [{ name: 'id', value: id }]
        },
        {
          tool_name: 'list_users',
          description: 'List all users to find those that belong to this organization.',
          parameters: []
        },
        {
          tool_name: 'delete_organization',
          description: `Delete organization '${organization.name}'.`,
          parameters: [{ name: 'id', value: id }]
        }
      ]
    };
  } catch (error) {
    console.error(`Error getting organization ${id}:`, error);
    throw error;
  }
}

/**
 * Tool to create a new organization.
 * @param api AxwayApi class instance.
 * @param name The name of the new organization.
 * @param description (Optional) A description for the organization.
 * @param email (Optional) The organization contact email.
 * @param phone (Optional) The organization contact phone.
 * @param enabled (Optional) Whether the organization should be created enabled. Default: true.
 * @returns A confirmation object with the created organization details.
 */
export async function createOrganization(api: AxwayApi, name: string, description?: string, email?: string, phone?: string, enabled: boolean = true) {
  try {
    const newOrg = await api.createOrganization({ name, description, email, phone, enabled });
    return {
      message: `Organization '${newOrg.name}' created successfully.`,
      organization: transformOrganization(newOrg),
      relatedTools: [
        {
          tool_name: 'list_organizations',
          description: 'View all organizations, including the newly created one.',
          parameters: []
        },
        {
          tool_name: 'get_organization',
          description: `View full details for organization '${newOrg.name}'.`,
          parameters: [{ name: 'id', value: newOrg.id }]
        }
      ]
    };
  } catch (error) {
    console.error(`Error creating organization:`, error);
    throw error;
  }
}

/**
 * Tool to update an existing organization.
 * Only the provided fields will be updated.
 * @param api AxwayApi class instance.
 * @param id The ID of the organization to update.
 * @param name (Optional) The new name for the organization.
 * @param description (Optional) The new description for the organization.
 * @param email (Optional) The new contact email.
 * @param phone (Optional) The new contact phone.
 * @param enabled (Optional) The new enabled state for the organization.
 * @returns A confirmation object with the updated organization details.
 */
export async function updateOrganization(api: AxwayApi, id: string, name?: string, description?: string, email?: string, phone?: string, enabled?: boolean) {
  try {
    const payload = removeEmptyValues({ name, description, email, phone, enabled });
    if (Object.keys(payload).length === 0) {
      return { message: "No fields provided for update. No action was taken." };
    }
    const updatedOrg = await api.updateOrganization(id, payload);
    return {
      message: `Organization '${updatedOrg.name}' updated successfully.`,
      organization: transformOrganization(updatedOrg),
      relatedTools: [
        {
          tool_name: 'get_organization',
          description: 'View the updated organization details.',
          parameters: [{ name: 'id', value: id }]
        }
      ]
    };
  } catch (error) {
    console.error(`Error updating organization ${id}:`, error);
    throw error;
  }
}

/**
 * Tool to delete an organization.
 * @param api AxwayApi class instance.
 * @param id The ID of the organization to delete.
 * @returns A confirmation object for the deletion.
 */
export async function deleteOrganization(api: AxwayApi, id: string) {
  try {
    await api.deleteOrganization(id);
    return {
      message: `Organization with ID '${id}' was deleted successfully.`,
      relatedTools: [
        {
          tool_name: 'list_organizations',
          description: 'List remaining organizations to confirm the deletion.',
          parameters: []
        }
      ]
    };
  } catch (error) {
    console.error(`Error deleting organization ${id}:`, error);
    throw error;
  }
}
